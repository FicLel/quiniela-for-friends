/**
 * ttlCache.ts — Minimal process-scoped TTL cache with LRU eviction.
 *
 * Used by repositories to avoid re-querying slow-changing data (app settings,
 * the matches list) on every request. Same trade-off as `users/usersCache.ts`:
 * the cache lives in the memory of a single server instance, so writes must
 * invalidate their keys explicitly to keep reads fresh on that instance.
 *
 * Infrastructure-layer only — services and views must not import this; they
 * keep talking to repository ports as before.
 */

type Entry<V> = {
  value: V
  expiresAt: number
}

export class TtlCache<V> {
  private readonly entries = new Map<string, Entry<V>>()

  /**
   * @param ttlMs      How long an entry stays fresh, in milliseconds.
   * @param maxEntries LRU capacity; the least recently used entry is evicted
   *                   when the cache grows past this size.
   */
  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number = 100,
  ) {}

  /** Return the cached value for `key`, or undefined if absent or expired. */
  get(key: string): V | undefined {
    const entry = this.entries.get(key)
    if (entry === undefined) return undefined

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key)
      return undefined
    }

    // Refresh LRU position: Map iteration order is insertion order, so
    // re-inserting moves the key to the most-recently-used end.
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry.value
  }

  /** Store `value` under `key`, evicting the least recently used entry if full. */
  set(key: string, value: V): void {
    this.entries.delete(key)
    if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value
      if (oldestKey !== undefined) this.entries.delete(oldestKey)
    }
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs })
  }

  /** Remove a single key — call from write paths to keep reads fresh. */
  invalidate(key: string): void {
    this.entries.delete(key)
  }

  /** Remove all entries. */
  clear(): void {
    this.entries.clear()
  }
}
