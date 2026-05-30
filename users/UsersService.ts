/**
 * UsersService — Application-layer service for user management (admin operations).
 *
 * Business rules:
 * - Only callers with role='admin' may list all users.
 * - Depends only on IUsersRepository (injected via constructor).
 *
 * Rules:
 * - Never imports from @supabase/supabase-js or fetch directly.
 * - Never imports from Next.js (no next/navigation, next/headers, etc.).
 * - All I/O goes through the injected repository.
 */

import type {
  IUsersRepository,
  IUsersService,
  UserListFilters,
  UserListSort,
  UserListResult,
  UserDetailResult,
} from '@/users/users.types'

export class UsersService implements IUsersService {
  constructor(private readonly usersRepository: IUsersRepository) {}

  /**
   * List all users with their quiniela memberships.
   *
   * Flow:
   * 1. If callerRole !== 'admin' → { ok: false, error: 'NOT_AUTHORIZED' }.
   * 2. Call usersRepository.listAll with filters, pagination (pageSize=20), and sort.
   * 3. Return { ok: true, users, total }.
   * 4. Catch any error → { ok: false, error: 'UNKNOWN_ERROR' }.
   */
  async listAllUsers(
    callerRole: string,
    filters: UserListFilters,
    page: number,
    sort: UserListSort,
  ): Promise<UserListResult> {
    if (callerRole !== 'admin') {
      return { ok: false, error: 'NOT_AUTHORIZED' }
    }

    try {
      const { users, total } = await this.usersRepository.listAll(
        filters,
        { page, pageSize: 20 },
        sort,
      )
      return { ok: true, users, total }
    } catch {
      return { ok: false, error: 'UNKNOWN_ERROR' }
    }
  }

  async getUserDetail(callerRole: string, userId: string): Promise<UserDetailResult> {
    if (callerRole !== 'admin') {
      return { ok: false, error: 'NOT_AUTHORIZED' }
    }
    try {
      const user = await this.usersRepository.findByIdWithMemberships(userId)
      if (!user) return { ok: false, error: 'USER_NOT_FOUND' }
      return { ok: true, user }
    } catch {
      return { ok: false, error: 'UNKNOWN_ERROR' }
    }
  }
}
