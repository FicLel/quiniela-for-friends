/**
 * schemaCheckCache.ts — Process-scoped cache for repository schema checks.
 *
 * Every repository lazily verifies its table exists with a `select … limit 0`
 * round-trip, but the result was only cached per repository *instance*.
 * Because pages and API routes construct fresh repositories on every request,
 * each request paid one verification query per repository (~5–7 wasted
 * queries per page view).
 *
 * This module caches the in-flight/settled check per table for the lifetime
 * of the server process — the same trade-off as `users/usersCache.ts`. A
 * rejected check is evicted so a transient failure does not poison the
 * process; the next call retries.
 */

const checksByTable = new Map<string, Promise<void>>()

/**
 * Run `check` at most once per process for `tableName`, deduplicating
 * concurrent callers. Subsequent calls return the cached resolved promise.
 */
export function verifyTableOnce(tableName: string, check: () => Promise<void>): Promise<void> {
  let cached = checksByTable.get(tableName)
  if (cached === undefined) {
    cached = check().catch((err: unknown) => {
      // Evict so the next call retries instead of failing forever.
      checksByTable.delete(tableName)
      throw err
    })
    checksByTable.set(tableName, cached)
  }
  return cached
}

/** Clear all cached checks — intended for tests only. */
export function resetSchemaCheckCache(): void {
  checksByTable.clear()
}
