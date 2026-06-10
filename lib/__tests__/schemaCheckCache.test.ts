/**
 * Unit tests for the process-level schema-check cache — deduplication per
 * table, independence between tables, and retry after a failed check.
 */

import { verifyTableOnce, resetSchemaCheckCache } from '../schemaCheckCache'

beforeEach(() => {
  resetSchemaCheckCache()
})

describe('verifyTableOnce', () => {
  it('runs the check on the first call and caches the success', async () => {
    const check = jest.fn().mockResolvedValue(undefined)

    await verifyTableOnce('users', check)
    await verifyTableOnce('users', check)
    await verifyTableOnce('users', check)

    expect(check).toHaveBeenCalledTimes(1)
  })

  it('deduplicates concurrent callers into a single in-flight check', async () => {
    let resolveCheck: () => void = () => undefined
    const check = jest.fn(
      () => new Promise<void>((resolve) => { resolveCheck = resolve }),
    )

    const first = verifyTableOnce('matches', check)
    const second = verifyTableOnce('matches', check)
    resolveCheck()
    await Promise.all([first, second])

    expect(check).toHaveBeenCalledTimes(1)
  })

  it('caches each table independently', async () => {
    const usersCheck = jest.fn().mockResolvedValue(undefined)
    const matchesCheck = jest.fn().mockResolvedValue(undefined)

    await verifyTableOnce('users', usersCheck)
    await verifyTableOnce('matches', matchesCheck)
    await verifyTableOnce('users', usersCheck)

    expect(usersCheck).toHaveBeenCalledTimes(1)
    expect(matchesCheck).toHaveBeenCalledTimes(1)
  })

  it('evicts a rejected check so the next call retries', async () => {
    const check = jest.fn()
      .mockRejectedValueOnce(new Error('transient failure'))
      .mockResolvedValueOnce(undefined)

    await expect(verifyTableOnce('users', check)).rejects.toThrow('transient failure')
    await expect(verifyTableOnce('users', check)).resolves.toBeUndefined()

    expect(check).toHaveBeenCalledTimes(2)
  })

  it('resetSchemaCheckCache clears cached successes', async () => {
    const check = jest.fn().mockResolvedValue(undefined)

    await verifyTableOnce('users', check)
    resetSchemaCheckCache()
    await verifyTableOnce('users', check)

    expect(check).toHaveBeenCalledTimes(2)
  })
})
