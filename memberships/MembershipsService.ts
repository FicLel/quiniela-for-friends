/**
 * MembershipsService — Application-layer service for quiniela membership management.
 *
 * Contains all business rules for listing, removing, and leaving quinielas.
 * Depends on IMembershipsRepository through its constructor.
 *
 * Rules:
 * - Never imports from @supabase/supabase-js or fetch directly.
 * - Never imports from Next.js (no next/navigation, next/headers, etc.).
 * - All I/O goes through the injected repository.
 */

import type {
  IMembershipsRepository,
  IMembershipsService,
  ListMembersResult,
  RemoveMemberResult,
  LeaveQuinielaResult,
} from '@/memberships/memberships.types'

export class MembershipsService implements IMembershipsService {
  constructor(private readonly repository: IMembershipsRepository) {}

  /**
   * List all members (with user email) for a quiniela.
   */
  async listMembers(quinielaId: string): Promise<ListMembersResult> {
    try {
      const members = await this.repository.findAllByQuiniela(quinielaId)
      return { success: true, members }
    } catch {
      return { success: false, error: 'UNKNOWN_ERROR' }
    }
  }

  /**
   * Remove a member from a quiniela.
   *
   * Business rules:
   * 1. Caller must have role='admin' in the quiniela → CALLER_NOT_QUINIELA_ADMIN
   * 2. Target membership must exist AND belong to this quiniela → MEMBERSHIP_NOT_FOUND
   * 3. Target must not be an admin → CANNOT_REMOVE_ADMIN
   * 4. Delete the target membership.
   */
  async removeMember(
    quinielaId: string,
    targetMembershipId: string,
    callerUserId: string,
  ): Promise<RemoveMemberResult> {
    try {
      // 1. Check caller is admin
      const callerMembership = await this.repository.findByQuinielaAndUser(
        quinielaId,
        callerUserId,
      )
      if (!callerMembership || callerMembership.role !== 'admin') {
        return { success: false, error: 'CALLER_NOT_QUINIELA_ADMIN' }
      }

      // 2. Find target membership; verify it belongs to this quiniela
      const targetMembership = await this.repository.findById(targetMembershipId)
      if (!targetMembership || targetMembership.quinielaId !== quinielaId) {
        return { success: false, error: 'MEMBERSHIP_NOT_FOUND' }
      }

      // 3. Cannot remove an admin
      if (targetMembership.role === 'admin') {
        return { success: false, error: 'CANNOT_REMOVE_ADMIN' }
      }

      // 4. Delete
      await this.repository.deleteById(targetMembershipId)
      return { success: true }
    } catch {
      return { success: false, error: 'UNKNOWN_ERROR' }
    }
  }

  /**
   * Leave a quiniela (caller removes themselves).
   *
   * Business rules:
   * 1. Find caller's membership; if not found → MEMBERSHIP_NOT_FOUND
   * 2. If caller's role is 'member' → NOT_A_MEMBER (members cannot self-leave via this path)
   *    NOTE: Per spec, members cannot self-leave; only admins can leave IF there are 2+ admins.
   *    If caller has no membership at all → MEMBERSHIP_NOT_FOUND
   *    If caller is a member (not admin) → NOT_A_MEMBER
   * 3. Count admins; if count ≤ 1 → LAST_ADMIN_CANNOT_LEAVE
   * 4. Delete caller's membership.
   */
  async leaveQuiniela(
    quinielaId: string,
    callerUserId: string,
  ): Promise<LeaveQuinielaResult> {
    try {
      // 1. Find caller membership
      const callerMembership = await this.repository.findByQuinielaAndUser(
        quinielaId,
        callerUserId,
      )
      if (!callerMembership) {
        return { success: false, error: 'MEMBERSHIP_NOT_FOUND' }
      }

      // 2. Members cannot self-leave
      if (callerMembership.role === 'member') {
        return { success: false, error: 'NOT_A_MEMBER' }
      }

      // 3. Last admin cannot leave
      const adminCount = await this.repository.countAdmins(quinielaId)
      if (adminCount <= 1) {
        return { success: false, error: 'LAST_ADMIN_CANNOT_LEAVE' }
      }

      // 4. Delete
      await this.repository.deleteById(callerMembership.id)
      return { success: true }
    } catch {
      return { success: false, error: 'UNKNOWN_ERROR' }
    }
  }
}
