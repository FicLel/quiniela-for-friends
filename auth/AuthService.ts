import bcrypt from 'bcryptjs'
import type { AuthClient } from '@/auth/AuthClient'
import type { IUsersRepository } from '@/users/users.types'
import type { LoginResult, ChangePasswordResult, CreateFirstAdminResult } from '@/auth/auth.types'

/**
 * AuthService — Application-layer service for authentication use cases.
 *
 * Contains all business rules for the Email + Password login flow and the
 * forced password-change flow. Depends on AuthClient and IUsersRepository
 * through its constructor so both can be swapped with test doubles.
 *
 * Rules:
 * - Never imports from @supabase/supabase-js or @supabase/ssr directly.
 * - Never imports from Next.js (no next/navigation, next/headers, etc.).
 * - All I/O goes through the injected client and repository.
 */
export class AuthService {
  constructor(
    private readonly authClient: AuthClient,
    private readonly usersRepository: IUsersRepository,
  ) {}

  /**
   * Authenticate a user with email + password.
   *
   * Flow:
   * 1. Look up the user row by email.
   * 2. If no row exists → INVALID_CREDENTIALS (avoids user enumeration).
   * 3. Verify the supplied password against the stored bcrypt hash.
   * 4. If hash mismatch → INVALID_CREDENTIALS.
   * 5. Issue a JWT session token via AuthClient.
   * 6. Return { success: true, token, mustChangePassword }.
   * 7. Unexpected throws → UNKNOWN_ERROR.
   */
  async login(email: string, password: string): Promise<LoginResult> {
    try {
      const userRow = await this.usersRepository.findByEmail(email)

      if (userRow === null) {
        return { success: false, error: 'INVALID_CREDENTIALS' }
      }

      const passwordValid = await bcrypt.compare(password, userRow.passwordHash)
      if (!passwordValid) {
        return { success: false, error: 'INVALID_CREDENTIALS' }
      }

      const token = await this.authClient.createToken({
        sub: userRow.id,
        email: userRow.email,
        role: userRow.role,
        mustChangePassword: userRow.mustChangePassword,
      })

      return { success: true, token, mustChangePassword: userRow.mustChangePassword }
    } catch {
      return { success: false, error: 'UNKNOWN_ERROR' }
    }
  }

  /**
   * Create the first admin user during initial application setup.
   *
   * Flow:
   * 1. Call hasAnyUser() — if `true`, the setup window is closed → SETUP_ALREADY_COMPLETE.
   * 2. Hash the password with bcrypt (cost 12).
   * 3. Insert the user row via repository.create() with mustChangePassword: true.
   * 4. Issue a JWT session token with mustChangePassword: true.
   * 5. Return { success: true, token }.
   * 6. Any unexpected throw → UNKNOWN_ERROR.
   *
   * Note: mustChangePassword is set to `true` so the admin is forced to choose
   * a permanent password on first login, consistent with the rest of the
   * password-management flow.
   */
  async createFirstAdmin(
    email: string,
    password: string,
  ): Promise<CreateFirstAdminResult> {
    try {
      const alreadyHasUsers = await this.usersRepository.hasAnyUser()
      if (alreadyHasUsers) {
        return { success: false, error: 'SETUP_ALREADY_COMPLETE' }
      }

      const passwordHash = await bcrypt.hash(password, 12)

      const user = await this.usersRepository.create({
        email,
        passwordHash,
        role: 'admin',
        mustChangePassword: true,
      })

      const token = await this.authClient.createToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        mustChangePassword: true,
      })

      return { success: true, token }
    } catch {
      return { success: false, error: 'UNKNOWN_ERROR' }
    }
  }

  /**
   * Change the authenticated user's password and clear the mustChangePassword
   * flag in public.users.
   *
   * Flow:
   * 1. Hash the new password with bcrypt (cost 12).
   * 2. Persist the new hash via setPasswordHash.
   * 3. Clear the mustChangePassword flag via setMustChangePassword.
   * 4. Issue a fresh JWT with mustChangePassword = false.
   * 5. If any step throws → return the appropriate error code.
   */
  async changePassword(
    userId: string,
    newPassword: string,
  ): Promise<ChangePasswordResult> {
    try {
      const newHash = await bcrypt.hash(newPassword, 12)
      await this.usersRepository.setPasswordHash(userId, newHash)
    } catch {
      return { success: false, error: 'UNKNOWN_ERROR' }
    }

    try {
      await this.usersRepository.setMustChangePassword(userId, false)
    } catch {
      return { success: false, error: 'FLAG_UPDATE_FAILED' }
    }

    try {
      const userRow = await this.usersRepository.findById(userId)
      if (!userRow) {
        return { success: false, error: 'UNKNOWN_ERROR' }
      }

      const token = await this.authClient.createToken({
        sub: userRow.id,
        email: userRow.email,
        role: userRow.role,
        mustChangePassword: false,
      })

      return { success: true, token }
    } catch {
      return { success: false, error: 'UNKNOWN_ERROR' }
    }
  }
}
