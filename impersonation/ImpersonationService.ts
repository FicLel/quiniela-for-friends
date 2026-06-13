/**
 * ImpersonationService — Application-layer service for the admin
 * "View as User" (read-only impersonation) feature.
 *
 * Pure business logic — no Supabase/Next imports, depends only on the
 * IUsersRepository port.
 *
 * Rules:
 * - Only admins may start impersonation (AC-3).
 * - Target email is matched case/whitespace-insensitively (normalized by the caller).
 * - Impersonating another admin is forbidden, except impersonating yourself (AC-11/AC-12).
 * - Switching targets while already impersonating silently overwrites the target (AC-13)
 *   — this falls out of the caller replacing the session token, no extra logic needed here.
 */

import type { IUsersRepository } from '@/users/users.types'
import type { SessionPayload } from '@/auth/AuthClient'
import type { StartImpersonationResult } from '@/impersonation/impersonation.types'

export class ImpersonationService {
  constructor(private readonly usersRepo: IUsersRepository) {}

  /**
   * Start (or switch) impersonation as the given admin session targeting `email`.
   *
   * `email` must already be normalized (trim + lowercase) by the caller.
   *
   * Flow:
   * 1. AC-3: caller must have role === 'admin'. No repository call otherwise.
   * 2. AC-2: target user must exist (UsersRepository.findByEmail).
   * 3. AC-11: target cannot be another admin (target.role === 'admin' && target.id !== session.sub).
   * 4. AC-12: targeting self is a harmless no-op — proceeds with
   *    impersonating: { userId: session.sub, email: session.email }.
   * 5. AC-13: if already impersonating, the new target silently overwrites the old one
   *    (handled by the caller replacing the session token — no special-casing here).
   */
  async start(adminSession: SessionPayload, email: string): Promise<StartImpersonationResult> {
    if (adminSession.role !== 'admin') {
      return { success: false, error: 'NOT_ADMIN' }
    }

    const target = await this.usersRepo.findByEmail(email)

    if (!target) {
      return { success: false, error: 'USER_NOT_FOUND' }
    }

    if (target.role === 'admin' && target.id !== adminSession.sub) {
      return { success: false, error: 'CANNOT_IMPERSONATE_ADMIN' }
    }

    // AC-12: self-impersonation — proceed with the admin's own identity.
    if (target.id === adminSession.sub) {
      return {
        success: true,
        impersonating: { userId: adminSession.sub, email: adminSession.email },
      }
    }

    return {
      success: true,
      impersonating: { userId: target.id, email: target.email },
    }
  }
}
