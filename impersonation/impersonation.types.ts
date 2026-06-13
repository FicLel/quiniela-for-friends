/**
 * impersonation.types.ts — Domain types and result types for the
 * admin "View as User" (read-only impersonation) feature.
 */

/** The impersonation payload stored on SessionPayload.impersonating. */
export type ImpersonationTarget = {
  userId: string
  email: string
}

/**
 * Result of ImpersonationService.start().
 *
 * On success, `impersonating` is the payload the caller should write onto
 * the session token's `impersonating` field.
 */
export type StartImpersonationResult =
  | { success: true; impersonating: ImpersonationTarget }
  | {
      success: false
      error: 'NOT_ADMIN' | 'USER_NOT_FOUND' | 'CANNOT_IMPERSONATE_ADMIN'
    }
