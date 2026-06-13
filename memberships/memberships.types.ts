export type MembershipRole = 'admin' | 'member'

export type Membership = {
  id: string
  quinielaId: string
  userId: string
  role: MembershipRole
  joinedAt: Date
  approvedAt: Date | null
}

export type MemberWithUser = {
  membershipId: string
  quinielaId: string
  userId: string
  email: string
  role: MembershipRole
  joinedAt: Date
  approvedAt: Date | null
}

export type ListMembersResult =
  | { success: true; members: MemberWithUser[] }
  | { success: false; error: 'QUINIELA_NOT_FOUND' | 'UNKNOWN_ERROR' }

export type RemoveMemberResult =
  | { success: true }
  | { success: false; error: 'MEMBERSHIP_NOT_FOUND' | 'CANNOT_REMOVE_ADMIN' | 'CALLER_NOT_QUINIELA_ADMIN' | 'IMPERSONATING_READ_ONLY' | 'UNKNOWN_ERROR' }

export type ApproveMemberResult =
  | { ok: true }
  | { ok: false; error: 'CALLER_NOT_ADMIN' | 'MEMBERSHIP_NOT_FOUND' | 'IMPERSONATING_READ_ONLY' | 'UNKNOWN_ERROR' }

export type LeaveQuinielaResult =
  | { success: true }
  | { success: false; error: 'MEMBERSHIP_NOT_FOUND' | 'LAST_ADMIN_CANNOT_LEAVE' | 'NOT_A_MEMBER' | 'IMPERSONATING_READ_ONLY' | 'UNKNOWN_ERROR' }

export interface IMembershipsRepository {
  create(input: { quinielaId: string; userId: string; role: MembershipRole }): Promise<Membership>
  findById(membershipId: string): Promise<Membership | null>
  findByQuinielaAndUser(quinielaId: string, userId: string): Promise<Membership | null>
  findAllByQuiniela(quinielaId: string): Promise<MemberWithUser[]>
  deleteById(membershipId: string): Promise<void>
  countAdmins(quinielaId: string): Promise<number>
  approve(membershipId: string): Promise<void>
  /** Returns true if the user has ANY membership row (approved or pending). Used for duplicate-prevention checks. */
  isMember(quinielaId: string, userId: string): Promise<boolean>
  /** Returns true only if the user has an APPROVED membership (approved_at IS NOT NULL). Use this for access-control gates. */
  isApprovedMember(quinielaId: string, userId: string): Promise<boolean>
  /** Count approved memberships for a user (approved_at IS NOT NULL). */
  countByUser(userId: string): Promise<number>
}

export interface IMembershipsService {
  listMembers(quinielaId: string): Promise<ListMembersResult>
  removeMember(quinielaId: string, targetMembershipId: string, callerUserId: string): Promise<RemoveMemberResult>
  leaveQuiniela(quinielaId: string, callerUserId: string): Promise<LeaveQuinielaResult>
  approveMember(callerUserId: string, membershipId: string): Promise<ApproveMemberResult>
}
