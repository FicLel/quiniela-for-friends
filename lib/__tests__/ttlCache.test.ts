/**
 * Unit tests for TtlCache — TTL expiry, LRU eviction, and invalidation.
 */

import { TtlCache } from '../ttlCache'

afterEach(() => {
  jest.useRealTimers()
})

describe('TtlCache – basic get/set', () => {
  it('returns undefined for a missing key', () => {
    const cache = new TtlCache<string>(1000)
    expect(cache.get('missing')).toBeUndefined()
  })

  it('returns the stored value before the TTL expires', () => {
    const cache = new TtlCache<string>(1000)
    cache.set('key', 'value')
    expect(cache.get('key')).toBe('value')
  })

  it('can store and distinguish null values from missing keys', () => {
    const cache = new TtlCache<string | null>(1000)
    cache.set('key', null)
    expect(cache.get('key')).toBeNull()
    expect(cache.get('other')).toBeUndefined()
  })
})

describe('TtlCache – TTL expiry', () => {
  it('expires entries after the TTL elapses', () => {
    jest.useFakeTimers({ now: new Date('2026-06-10T12:00:00Z') })
    const cache = new TtlCache<string>(30_000)

    cache.set('key', 'value')
    jest.setSystemTime(new Date('2026-06-10T12:00:29Z'))
    expect(cache.get('key')).toBe('value')

    jest.setSystemTime(new Date('2026-06-10T12:00:31Z'))
    expect(cache.get('key')).toBeUndefined()
  })

  it('overwriting a key refreshes its TTL', () => {
    jest.useFakeTimers({ now: new Date('2026-06-10T12:00:00Z') })
    const cache = new TtlCache<string>(30_000)

    cache.set('key', 'old')
    jest.setSystemTime(new Date('2026-06-10T12:00:20Z'))
    cache.set('key', 'new')

    // 40s after the first set but only 20s after the overwrite — still fresh.
    jest.setSystemTime(new Date('2026-06-10T12:00:40Z'))
    expect(cache.get('key')).toBe('new')
  })
})

describe('TtlCache – LRU eviction', () => {
  it('evicts the least recently used entry when full', () => {
    const cache = new TtlCache<string>(60_000, 2)

    cache.set('a', 'A')
    cache.set('b', 'B')
    // Touch 'a' so 'b' becomes the least recently used.
    cache.get('a')
    cache.set('c', 'C')

    expect(cache.get('a')).toBe('A')
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('c')).toBe('C')
  })

  it('overwriting an existing key does not evict another entry', () => {
    const cache = new TtlCache<string>(60_000, 2)

    cache.set('a', 'A')
    cache.set('b', 'B')
    cache.set('b', 'B2')

    expect(cache.get('a')).toBe('A')
    expect(cache.get('b')).toBe('B2')
  })
})

describe('TtlCache – invalidation', () => {
  it('invalidate removes a single key', () => {
    const cache = new TtlCache<string>(60_000)
    cache.set('a', 'A')
    cache.set('b', 'B')

    cache.invalidate('a')

    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe('B')
  })

  it('clear removes all entries', () => {
    const cache = new TtlCache<string>(60_000)
    cache.set('a', 'A')
    cache.set('b', 'B')

    cache.clear()

    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBeUndefined()
  })
})
