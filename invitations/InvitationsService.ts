/**
 * InvitationsService — Application-layer service for quiniela invitation management.
 *
 * Contains all business rules for sending, accepting, revoking, and listing
 * invitations. Depends on IMembershipsRepository, IInvitationsRepository,
 * and IUsersRepository through its constructor.
 *
 * Rules:
 * - Never imports from @supabase/supabase-js or fetch directly.
 * - Never imports from Next.js (no next/navigation, next/headers, etc.).
 * - All I/O goes through the injected repositories.
 * - Token generation uses Node.js built-in node:crypto only.
 * - Password hashing uses bcryptjs (same library and salt rounds as AuthService).
 */

import { randomBytes, createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { IInvitationsRepository, IInvitationsService, InvitationStatus, Invitation, SendInviteResult, AcceptInviteResult, RevokeInviteResult, ListInvitationsResult } from '@/invitations/invitations.types'
import type { IMembershipsRepository } from '@/memberships/memberships.types'
import type { IUsersRepository } from '@/users/users.types'

const INVITE_EXPIRY_DAYS = 7
const MIN_PASSWORD_LENGTH = 8
const BCRYPT_SALT_ROUNDS = 12
const SHORT_CODE_MAX_RETRIES = 5

export class InvitationsService implements IInvitationsService {
  constructor(
    private readonly invitationsRepository: IInvitationsRepository,
    private readonly membershipsRepository: IMembershipsRepository,
    private readonly usersRepository: IUsersRepository,
  ) {}

  /**
   * Compute a human-readable status from an invitation's timestamps.
   */
  private computeStatus(invitation: Invitation): InvitationStatus {
    if (invitation.acceptedAt !== null) return 'accepted'
    if (invitation.revokedAt !== null) return 'revoked'
    if (invitation.expiresAt < new Date()) return 'expired'
    return 'pending'
  }

  /**
   * Hash a raw token with SHA-256 and return the hex digest.
   */
  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex')
  }

  /**
   * Generate a random 8-character hex short code.
   */
  private generateShortCode(): string {
    return randomBytes(4).toString('hex')
  }

  /**
   * Send an invitation to join a quiniela.
   *
   * Flow:
   * 1. Lowercase and trim email.
   * 2. Verify caller is admin in the quiniela → CALLER_NOT_QUINIELA_ADMIN.
   * 3. Check invited email is not already a member → ALREADY_A_MEMBER.
   * 4. Revoke any existing active invitations for (email, quinielaId).
   * 5. Generate a 64-char hex raw token; hash it with SHA-256.
   * 6. Insert invitation row (expires_at = now + 7 days).
   * 7. Return { success: true, invitationId, inviteUrl: `${baseUrl}/invite/${rawToken}` }.
   */
  async sendInvite(input: {
    quinielaId: string
    email: string
    roleToAssign: 'admin' | 'member'
    callerUserId: string
    baseUrl: string
  }): Promise<SendInviteResult> {
    try {
      const email = input.email.toLowerCase().trim()

      // 1. Verify caller is admin
      const callerMembership = await this.membershipsRepository.findByQuinielaAndUser(
        input.quinielaId,
        input.callerUserId,
      )
      if (!callerMembership || callerMembership.role !== 'admin') {
        return { success: false, error: 'CALLER_NOT_QUINIELA_ADMIN' }
      }

      // 2. Check invited email is not already a member
      const invitedUser = await this.usersRepository.findByEmail(email)
      if (invitedUser !== null) {
        const existingMembership = await this.membershipsRepository.findByQuinielaAndUser(
          input.quinielaId,
          invitedUser.id,
        )
        if (existingMembership !== null) {
          return { success: false, error: 'ALREADY_A_MEMBER' }
        }
      }

      // 3. Revoke any existing active invitations
      const activeInvitations = await this.invitationsRepository.findActiveByEmailAndQuiniela(
        email,
        input.quinielaId,
      )
      for (const activeInvite of activeInvitations) {
        await this.invitationsRepository.markRevoked(activeInvite.id)
      }

      // 4. Generate token and hash
      const rawToken = randomBytes(32).toString('hex')
      const tokenHash = this.hashToken(rawToken)

      // 5. Insert invitation row — retry on short_code unique constraint collision
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS)

      let invitation
      let lastError: unknown
      for (let attempt = 0; attempt < SHORT_CODE_MAX_RETRIES; attempt++) {
        const shortCode = this.generateShortCode()
        try {
          invitation = await this.invitationsRepository.create({
            quinielaId: input.quinielaId,
            email,
            roleToAssign: input.roleToAssign,
            tokenHash,
            shortCode,
            expiresAt,
            invitedByUserId: input.callerUserId,
          })
          break
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          if (msg.includes('short_code') || msg.includes('unique')) {
            lastError = err
            continue
          }
          throw err
        }
      }

      if (!invitation) {
        throw lastError ?? new Error('Failed to generate unique short_code after retries')
      }

      const inviteUrl = `${input.baseUrl}/invite/${invitation.shortCode}`

      return { success: true, invitationId: invitation.id, inviteUrl }
    } catch {
      return { success: false, error: 'UNKNOWN_ERROR' }
    }
  }

  /**
   * Accept an invitation token.
   *
   * Flow:
   * 1. Hash rawToken → SHA-256.
   * 2. findByTokenHash → TOKEN_NOT_FOUND.
   * 3. Check expiresAt < now() → TOKEN_EXPIRED.
   * 4. Check revokedAt !== null → TOKEN_REVOKED.
   * 5. Check acceptedAt !== null → TOKEN_ALREADY_ACCEPTED.
   * 6. If callerUserId is set: fetch caller user, verify email matches → EMAIL_MISMATCH.
   *    Create membership, mark accepted, return { wasNewUser: false }.
   * 7. If callerUserId is null (new-user path):
   *    - Check if email already exists in DB → EMAIL_MISMATCH (action should redirect to login).
   *    - Require newPassword → PASSWORD_REQUIRED.
   *    - Validate min 8 chars → WEAK_PASSWORD.
   *    - Hash with bcrypt (cost 12), create user (mustChangePassword: false),
   *      create membership, mark accepted, return { wasNewUser: true }.
   */
  async acceptInvite(input: {
    rawToken: string
    callerUserId: string | null
    newPassword?: string
  }): Promise<AcceptInviteResult> {
    try {
      // 1. Hash token
      const tokenHash = this.hashToken(input.rawToken)

      // 2. Find invitation
      const invitation = await this.invitationsRepository.findByTokenHash(tokenHash)
      if (!invitation) {
        return { success: false, error: 'TOKEN_NOT_FOUND' }
      }

      // 3. Check expiry
      if (invitation.expiresAt < new Date()) {
        return { success: false, error: 'TOKEN_EXPIRED' }
      }

      // 4. Check revoked
      if (invitation.revokedAt !== null) {
        return { success: false, error: 'TOKEN_REVOKED' }
      }

      // 5. Check already accepted
      if (invitation.acceptedAt !== null) {
        return { success: false, error: 'TOKEN_ALREADY_ACCEPTED' }
      }

      if (input.callerUserId !== null) {
        // 6. Logged-in user path
        const callerUser = await this.usersRepository.findById(input.callerUserId)
        if (!callerUser || callerUser.email !== invitation.email) {
          return { success: false, error: 'EMAIL_MISMATCH' }
        }

        await this.membershipsRepository.create({
          quinielaId: invitation.quinielaId,
          userId: callerUser.id,
          role: invitation.roleToAssign,
        })
        await this.invitationsRepository.markAccepted(invitation.id)

        return { success: true, quinielaId: invitation.quinielaId, wasNewUser: false }
      } else {
        // 7. New-user path (callerUserId is null)

        // Check if email already exists → redirect to login
        const existingUser = await this.usersRepository.findByEmail(invitation.email)
        if (existingUser !== null) {
          return { success: false, error: 'EMAIL_MISMATCH' }
        }

        // Require password
        if (!input.newPassword) {
          return { success: false, error: 'PASSWORD_REQUIRED' }
        }

        // Validate password strength
        if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
          return { success: false, error: 'WEAK_PASSWORD' }
        }

        // Hash password and create user
        const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_SALT_ROUNDS)
        const newUser = await this.usersRepository.create({
          email: invitation.email,
          passwordHash,
          role: 'player',
          mustChangePassword: false,
        })

        await this.membershipsRepository.create({
          quinielaId: invitation.quinielaId,
          userId: newUser.id,
          role: invitation.roleToAssign,
        })
        await this.invitationsRepository.markAccepted(invitation.id)

        return { success: true, quinielaId: invitation.quinielaId, wasNewUser: true }
      }
    } catch {
      return { success: false, error: 'UNKNOWN_ERROR' }
    }
  }

  /**
   * Accept an invitation using the 8-character shortCode (from the invite URL).
   *
   * Mirrors `acceptInvite` exactly, but resolves the invitation via
   * `findByShortCode` instead of `findByTokenHash`.
   *
   * This is the method used by the new `/invite/[shortCode]` route.
   * The raw cryptographic token is NOT exposed in the URL with this path.
   *
   * Flow:
   * 1. findByShortCode → TOKEN_NOT_FOUND.
   * 2. Check expiresAt → TOKEN_EXPIRED.
   * 3. Check revokedAt → TOKEN_REVOKED.
   * 4. Check acceptedAt → TOKEN_ALREADY_ACCEPTED.
   * 5a. If callerUserId set: verify email, create membership, mark accepted → wasNewUser: false.
   * 5b. If callerUserId null: validate email uniqueness + password, create user + membership → wasNewUser: true.
   */
  async acceptInviteByShortCode(input: {
    shortCode: string
    callerUserId: string | null
    newPassword?: string
  }): Promise<AcceptInviteResult> {
    try {
      // 1. Find invitation by short code
      const invitation = await this.invitationsRepository.findByShortCode(input.shortCode)
      if (!invitation) {
        return { success: false, error: 'TOKEN_NOT_FOUND' }
      }

      // 2. Check expiry
      if (invitation.expiresAt < new Date()) {
        return { success: false, error: 'TOKEN_EXPIRED' }
      }

      // 3. Check revoked
      if (invitation.revokedAt !== null) {
        return { success: false, error: 'TOKEN_REVOKED' }
      }

      // 4. Check already accepted
      if (invitation.acceptedAt !== null) {
        return { success: false, error: 'TOKEN_ALREADY_ACCEPTED' }
      }

      if (input.callerUserId !== null) {
        // 5a. Logged-in user path
        const callerUser = await this.usersRepository.findById(input.callerUserId)
        if (!callerUser || callerUser.email !== invitation.email) {
          return { success: false, error: 'EMAIL_MISMATCH' }
        }

        await this.membershipsRepository.create({
          quinielaId: invitation.quinielaId,
          userId: callerUser.id,
          role: invitation.roleToAssign,
        })
        await this.invitationsRepository.markAccepted(invitation.id)

        return { success: true, quinielaId: invitation.quinielaId, wasNewUser: false }
      } else {
        // 5b. New-user path (callerUserId is null)

        // Check if email already exists → redirect to login
        const existingUser = await this.usersRepository.findByEmail(invitation.email)
        if (existingUser !== null) {
          return { success: false, error: 'EMAIL_MISMATCH' }
        }

        // Require password
        if (!input.newPassword) {
          return { success: false, error: 'PASSWORD_REQUIRED' }
        }

        // Validate password strength
        if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
          return { success: false, error: 'WEAK_PASSWORD' }
        }

        // Hash password and create user
        const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_SALT_ROUNDS)
        const newUser = await this.usersRepository.create({
          email: invitation.email,
          passwordHash,
          role: 'player',
          mustChangePassword: false,
        })

        await this.membershipsRepository.create({
          quinielaId: invitation.quinielaId,
          userId: newUser.id,
          role: invitation.roleToAssign,
        })
        await this.invitationsRepository.markAccepted(invitation.id)

        return { success: true, quinielaId: invitation.quinielaId, wasNewUser: true }
      }
    } catch {
      return { success: false, error: 'UNKNOWN_ERROR' }
    }
  }

  /**
   * Revoke a pending invitation.
   *
   * Flow:
   * 1. Check caller is quiniela admin → CALLER_NOT_QUINIELA_ADMIN.
   * 2. Find invitation; verify it belongs to quinielaId → INVITATION_NOT_FOUND.
   * 3. Check acceptedAt !== null → ALREADY_ACCEPTED.
   * 4. Check revokedAt !== null → ALREADY_REVOKED.
   * 5. markRevoked.
   */
  async revokeInvite(
    invitationId: string,
    quinielaId: string,
    callerUserId: string,
  ): Promise<RevokeInviteResult> {
    try {
      // 1. Check caller is admin
      const callerMembership = await this.membershipsRepository.findByQuinielaAndUser(
        quinielaId,
        callerUserId,
      )
      if (!callerMembership || callerMembership.role !== 'admin') {
        return { success: false, error: 'CALLER_NOT_QUINIELA_ADMIN' }
      }

      // 2. Find invitation and verify it belongs to this quiniela.
      // IInvitationsRepository has no findById — findAllByQuiniela + filter
      // is the correct approach, scoped to the quiniela for the ownership check.
      const allInvitations = await this.invitationsRepository.findAllByQuiniela(quinielaId)
      const target = allInvitations.find((inv) => inv.id === invitationId)
      if (!target) {
        return { success: false, error: 'INVITATION_NOT_FOUND' }
      }

      // 3. Check already accepted
      if (target.acceptedAt !== null) {
        return { success: false, error: 'ALREADY_ACCEPTED' }
      }

      // 4. Check already revoked
      if (target.revokedAt !== null) {
        return { success: false, error: 'ALREADY_REVOKED' }
      }

      // 5. Revoke
      await this.invitationsRepository.markRevoked(invitationId)
      return { success: true }
    } catch {
      return { success: false, error: 'UNKNOWN_ERROR' }
    }
  }

  /**
   * List all invitations for a quiniela with computed status.
   *
   * Flow:
   * 1. Check caller is quiniela admin → CALLER_NOT_QUINIELA_ADMIN.
   * 2. findAllByQuiniela, compute status for each.
   * 3. Return with status.
   */
  async listInvitations(
    quinielaId: string,
    callerUserId: string,
  ): Promise<ListInvitationsResult> {
    try {
      // 1. Check caller is admin
      const callerMembership = await this.membershipsRepository.findByQuinielaAndUser(
        quinielaId,
        callerUserId,
      )
      if (!callerMembership || callerMembership.role !== 'admin') {
        return { success: false, error: 'CALLER_NOT_QUINIELA_ADMIN' }
      }

      // 2. Fetch and compute statuses
      const rawInvitations = await this.invitationsRepository.findAllByQuiniela(quinielaId)
      const invitations = rawInvitations.map((inv) => ({
        ...inv,
        status: this.computeStatus(inv),
      }))

      return { success: true, invitations }
    } catch {
      return { success: false, error: 'UNKNOWN_ERROR' }
    }
  }
}
