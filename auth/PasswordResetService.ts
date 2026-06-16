import { randomBytes, createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { AuthClient } from '@/auth/AuthClient'
import type { IPasswordResetRepository } from '@/auth/PasswordResetRepository'
import type { IUsersRepository } from '@/users/users.types'
import type { CreateResetTokenResult, ConsumeResetTokenResult } from '@/auth/auth.types'

const RESET_TOKEN_EXPIRY_HOURS = 24
const BCRYPT_SALT_ROUNDS = 12

export class PasswordResetService {
  constructor(
    private readonly resetRepository: IPasswordResetRepository,
    private readonly usersRepository: IUsersRepository,
    private readonly authClient: AuthClient,
  ) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex')
  }

  /**
   * Generate a password reset link for a target user.
   * Only admins can call this — caller must have already been verified as admin.
   */
  async createResetToken(
    adminUserId: string,
    targetUserId: string,
    baseUrl: string,
    locale: string,
  ): Promise<CreateResetTokenResult> {
    try {
      const targetUser = await this.usersRepository.findById(targetUserId)
      if (!targetUser) {
        return { success: false, error: 'USER_NOT_FOUND' }
      }

      const rawToken = randomBytes(32).toString('hex')
      const tokenHash = this.hashToken(rawToken)
      const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)

      await this.resetRepository.createToken({
        userId: targetUserId,
        tokenHash,
        expiresAt,
        createdBy: adminUserId,
      })

      const resetUrl = `${baseUrl}/${locale}/reset-password/${rawToken}`
      return { success: true, resetUrl }
    } catch {
      return { success: false, error: 'UNKNOWN_ERROR' }
    }
  }

  /**
   * Validate a raw token without consuming it. Used by the page server component
   * to decide whether to render the form or redirect.
   */
  async validateToken(rawToken: string): Promise<boolean> {
    try {
      const tokenHash = this.hashToken(rawToken)
      const record = await this.resetRepository.findValidByHash(tokenHash)
      return record !== null
    } catch {
      return false
    }
  }

  /**
   * Consume a reset token: update the user's password, mark the token as used,
   * and issue a fresh JWT session.
   */
  async consumeResetToken(
    rawToken: string,
    newPassword: string,
  ): Promise<ConsumeResetTokenResult> {
    try {
      const tokenHash = this.hashToken(rawToken)
      const record = await this.resetRepository.findValidByHash(tokenHash)

      if (!record) {
        return { success: false, error: 'TOKEN_INVALID' }
      }

      const newHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS)
      await this.usersRepository.setPasswordHash(record.userId, newHash)
      await this.usersRepository.setMustChangePassword(record.userId, false)
      await this.resetRepository.markUsed(record.id)

      const userRow = await this.usersRepository.findById(record.userId)
      if (!userRow) {
        return { success: false, error: 'UNKNOWN_ERROR' }
      }

      const token = await this.authClient.createToken({
        sub: userRow.id,
        email: userRow.email,
        role: userRow.role,
        mustChangePassword: false,
        tokenVersion: userRow.tokenVersion,
      })

      return { success: true, token }
    } catch {
      return { success: false, error: 'UNKNOWN_ERROR' }
    }
  }
}
