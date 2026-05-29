/**
 * usersCache.ts — Module-level singleton cache for the `hasAnyUser` flag.
 *
 * This cache is intentionally process-scoped (not per-request) so that the
 * setup screen check never issues a DB round-trip once at least one user row
 * exists. The cache is write-once: once set to `true` it is never reset
 * (because users are never deleted in this application).
 *
 * The cache starts as `null` (unknown). After the first successful DB query it
 * is set to either `true` or `false`. Once `true`, all subsequent calls skip
 * the DB entirely.
 */

let hasUsers: boolean | null = null

/**
 * Read the current cached value.
 * Returns `null` if the cache has not been populated yet.
 */
export function getCachedHasUsers(): boolean | null {
  return hasUsers
}

/**
 * Write a value into the cache.
 * Once set to `true` the cache is permanent for the process lifetime.
 */
export function setCachedHasUsers(value: boolean): void {
  hasUsers = value
}
