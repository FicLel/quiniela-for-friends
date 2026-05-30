export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired'

export type Invitation = {
  id: string
  quinielaId: string
  email: string
  roleToAssign: 'admin' | 'member'
  tokenHash: string
  shortCode: string
  expiresAt: Date
  acceptedAt: Date | null
  revokedAt: Date | null
  invitedByUserId: string
  createdAt: Date
}

export type InvitationWithStatus = Invitation & { status: InvitationStatus }

export type SendInviteResult =
  | { success: true; invitationId: string; inviteUrl: string }
  | { success: false; error: 'CALLER_NOT_QUINIELA_ADMIN' | 'ALREADY_A_MEMBER' | 'DB_ERROR' | 'UNKNOWN_ERROR' }

export type AcceptInviteResult =
  | { success: true; quinielaId: string; wasNewUser: boolean }
  | { success: false; error: 'TOKEN_NOT_FOUND' | 'TOKEN_EXPIRED' | 'TOKEN_REVOKED' | 'TOKEN_ALREADY_ACCEPTED' | 'EMAIL_MISMATCH' | 'PASSWORD_REQUIRED' | 'WEAK_PASSWORD' | 'DB_ERROR' | 'UNKNOWN_ERROR' }

export type RevokeInviteResult =
  | { success: true }
  | { success: false; error: 'INVITATION_NOT_FOUND' | 'CALLER_NOT_QUINIELA_ADMIN' | 'ALREADY_ACCEPTED' | 'ALREADY_REVOKED' | 'UNKNOWN_ERROR' }

export type ListInvitationsResult =
  | { success: true; invitations: InvitationWithStatus[] }
  | { success: false; error: 'CALLER_NOT_QUINIELA_ADMIN' | 'UNKNOWN_ERROR' }

export interface IInvitationsRepository {
  create(input: {
    quinielaId: string
    email: string
    roleToAssign: 'admin' | 'member'
    tokenHash: string
    shortCode: string
    expiresAt: Date
    invitedByUserId: string
  }): Promise<Invitation>
  findByTokenHash(tokenHash: string): Promise<Invitation | null>
  findByShortCode(shortCode: string): Promise<Invitation | null>
  findActiveByEmailAndQuiniela(email: string, quinielaId: string): Promise<Invitation[]>
  markAccepted(invitationId: string): Promise<void>
  markRevoked(invitationId: string): Promise<void>
  findAllByQuiniela(quinielaId: string): Promise<Invitation[]>
}

export interface IInvitationsService {
  sendInvite(input: {
    quinielaId: string
    email: string
    roleToAssign: 'admin' | 'member'
    callerUserId: string
    baseUrl: string
  }): Promise<SendInviteResult>
  acceptInvite(input: {
    rawToken: string
    callerUserId: string | null
    newPassword?: string
  }): Promise<AcceptInviteResult>
  acceptInviteByShortCode(input: {
    shortCode: string
    callerUserId: string | null
    newPassword?: string
  }): Promise<AcceptInviteResult>
  revokeInvite(
    invitationId: string,
    quinielaId: string,
    callerUserId: string,
  ): Promise<RevokeInviteResult>
  listInvitations(
    quinielaId: string,
    callerUserId: string,
  ): Promise<ListInvitationsResult>
}
