/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MembersClient from '../MembersClient'
import enDict from '@/i18n/dictionaries/en.json'
import type { MemberWithUser } from '@/memberships/memberships.types'
import type { InvitationWithStatus } from '@/invitations/invitations.types'

// Mock clipboard API
const mockWriteText = jest.fn().mockResolvedValue(undefined)
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: mockWriteText },
  writable: true,
  configurable: true,
})

// Mock window.confirm
const mockConfirm = jest.fn().mockReturnValue(true)
Object.defineProperty(window, 'confirm', {
  value: mockConfirm,
  writable: true,
  configurable: true,
})

const membersDict = enDict.members

const adminMember: MemberWithUser = {
  membershipId: 'membership-admin-1',
  quinielaId: 'quiniela-1',
  userId: 'user-admin-1',
  email: 'admin@example.com',
  role: 'admin',
  joinedAt: new Date('2026-01-01'),
  approvedAt: new Date('2026-01-01'),
}

const regularMember: MemberWithUser = {
  membershipId: 'membership-member-1',
  quinielaId: 'quiniela-1',
  userId: 'user-member-1',
  email: 'member@example.com',
  role: 'member',
  joinedAt: new Date('2026-01-02'),
  approvedAt: new Date('2026-01-02'),
}

const pendingMember: MemberWithUser = {
  membershipId: 'membership-pending-1',
  quinielaId: 'quiniela-1',
  userId: 'user-pending-1',
  email: 'pending@example.com',
  role: 'member',
  joinedAt: new Date('2026-01-03'),
  approvedAt: null,
}

const pendingInvitation: InvitationWithStatus = {
  id: 'invite-1',
  quinielaId: 'quiniela-1',
  email: 'invited@example.com',
  roleToAssign: 'member',
  tokenHash: 'hash123',
  shortCode: 'ab12cd34',
  expiresAt: new Date('2026-12-31'),
  acceptedAt: null,
  revokedAt: null,
  invitedByUserId: 'user-admin-1',
  createdAt: new Date('2026-01-01'),
  status: 'pending',
}

const defaultProps = {
  members: [adminMember, regularMember],
  invitations: [],
  callerMembership: { role: 'admin' as const, membershipId: 'membership-admin-1' },
  quinielaId: 'quiniela-1',
  lang: 'en' as const,
  dict: membersDict,
  inviteMemberAction: jest.fn().mockResolvedValue({ success: true, invitationId: 'inv-1', inviteUrl: 'http://localhost:3000/invite/abc123de' }),
  removeMemberAction: jest.fn().mockResolvedValue({ success: true }),
  revokeInviteAction: jest.fn().mockResolvedValue({ success: true }),
  leaveQuinielaAction: jest.fn().mockResolvedValue({ success: true }),
}

describe('MembersClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockConfirm.mockReturnValue(true)
  })

  // -------------------------------------------------------------------------
  // Member list rendering
  // -------------------------------------------------------------------------

  it('renders member emails', () => {
    render(<MembersClient {...defaultProps} />)
    expect(screen.getByText('admin@example.com')).toBeInTheDocument()
    expect(screen.getByText('member@example.com')).toBeInTheDocument()
  })

  it('renders role badges', () => {
    render(<MembersClient {...defaultProps} />)
    // Multiple elements may show the same text (badge + form option), use getAllByText
    expect(screen.getAllByText(membersDict.roleAdmin).length).toBeGreaterThan(0)
    expect(screen.getAllByText(membersDict.roleMember).length).toBeGreaterThan(0)
  })

  // -------------------------------------------------------------------------
  // Remove button visibility
  // -------------------------------------------------------------------------

  it('shows Remove button for non-admin member when caller is admin', () => {
    render(<MembersClient {...defaultProps} />)
    const removeButtons = screen.getAllByText(membersDict.removeMember)
    expect(removeButtons.length).toBeGreaterThan(0)
  })

  it('does not show Remove button when caller is not admin', () => {
    render(
      <MembersClient
        {...defaultProps}
        callerMembership={{ role: 'member', membershipId: 'membership-member-1' }}
      />,
    )
    expect(screen.queryByText(membersDict.removeMember)).not.toBeInTheDocument()
  })

  it('does not show Remove button for admin members', () => {
    // Both members are admins — no remove buttons should appear
    const twoAdmins: MemberWithUser[] = [
      adminMember,
      { ...regularMember, role: 'admin', membershipId: 'membership-admin-2', userId: 'user-admin-2' },
    ]
    render(<MembersClient {...defaultProps} members={twoAdmins} />)
    // The caller is admin-1; the other member is also admin — cannot remove
    expect(screen.queryByText(membersDict.removeMember)).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Invite form — admins only
  // -------------------------------------------------------------------------

  it('shows invite form for admin', () => {
    render(<MembersClient {...defaultProps} />)
    expect(screen.getByText(membersDict.inviteMember)).toBeInTheDocument()
    expect(screen.getByText(membersDict.inviteButton)).toBeInTheDocument()
  })

  it('does not show invite form for non-admin', () => {
    render(
      <MembersClient
        {...defaultProps}
        callerMembership={{ role: 'member', membershipId: 'membership-member-1' }}
      />,
    )
    expect(screen.queryByText(membersDict.inviteMember)).not.toBeInTheDocument()
  })

  it('shows generated invite URL and copy button after generating invite', async () => {
    render(<MembersClient {...defaultProps} />)

    fireEvent.click(screen.getByText(membersDict.inviteButton))

    await waitFor(() => {
      expect(screen.getByText('http://localhost:3000/invite/abc123de')).toBeInTheDocument()
      expect(screen.getByText(membersDict.copyLink)).toBeInTheDocument()
    })
  })

  it('shows "Copied!" for 2 seconds after clicking copy link', async () => {
    jest.useFakeTimers()
    render(<MembersClient {...defaultProps} />)

    fireEvent.click(screen.getByText(membersDict.inviteButton))

    await waitFor(() => {
      expect(screen.getByText(membersDict.copyLink)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(membersDict.copyLink))
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('http://localhost:3000/invite/abc123de')
    })

    // After clipboard write, button should show "Copied!"
    await waitFor(() => {
      expect(screen.getByText(membersDict.linkCopied)).toBeInTheDocument()
    })

    jest.runAllTimers()
    await waitFor(() => {
      expect(screen.getByText(membersDict.copyLink)).toBeInTheDocument()
    })

    jest.useRealTimers()
  })

  // -------------------------------------------------------------------------
  // Pending invitations
  // -------------------------------------------------------------------------

  it('shows active invite link section when there are pending invites', () => {
    render(<MembersClient {...defaultProps} invitations={[pendingInvitation]} />)
    expect(screen.getByText(membersDict.activeInviteLink ?? membersDict.pendingInvites)).toBeInTheDocument()
    expect(screen.getByText(`…/invite/${pendingInvitation.shortCode}`)).toBeInTheDocument()
  })

  it('shows revoke button for pending invitations', () => {
    render(<MembersClient {...defaultProps} invitations={[pendingInvitation]} />)
    expect(screen.getByText(membersDict.revokeInvite)).toBeInTheDocument()
  })

  it('does not show pending invitations section when empty', () => {
    render(<MembersClient {...defaultProps} invitations={[]} />)
    expect(screen.queryByText(membersDict.pendingInvites)).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Leave quiniela
  // -------------------------------------------------------------------------

  it('shows leave quiniela button for admin', () => {
    render(<MembersClient {...defaultProps} />)
    expect(screen.getByText(membersDict.leaveQuiniela)).toBeInTheDocument()
  })

  it('does not show leave quiniela button for non-admin', () => {
    render(
      <MembersClient
        {...defaultProps}
        callerMembership={{ role: 'member', membershipId: 'membership-member-1' }}
      />,
    )
    expect(screen.queryByText(membersDict.leaveQuiniela)).not.toBeInTheDocument()
  })

  it('calls leaveQuinielaAction after confirmation', async () => {
    render(<MembersClient {...defaultProps} />)

    fireEvent.click(screen.getByText(membersDict.leaveQuiniela))

    await waitFor(() => {
      expect(defaultProps.leaveQuinielaAction).toHaveBeenCalled()
    })
  })

  it('does not call leaveQuinielaAction when confirm is cancelled', async () => {
    mockConfirm.mockReturnValue(false)
    render(<MembersClient {...defaultProps} />)

    fireEvent.click(screen.getByText(membersDict.leaveQuiniela))
    expect(defaultProps.leaveQuinielaAction).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Approve member
  // -------------------------------------------------------------------------

  it('shows Pending badge for pending member', () => {
    render(<MembersClient {...defaultProps} members={[adminMember, pendingMember]} />)
    expect(screen.getByText(membersDict.statusPending)).toBeInTheDocument()
    expect(screen.getByText('pending@example.com')).toBeInTheDocument()
  })

  it('shows Approve button for pending member when caller is admin and approveMemberAction provided', () => {
    const mockApprove = jest.fn().mockResolvedValue({ ok: true })
    render(
      <MembersClient
        {...defaultProps}
        members={[adminMember, pendingMember]}
        approveMemberAction={mockApprove}
      />,
    )
    expect(screen.getByText(membersDict.approveButton)).toBeInTheDocument()
  })

  it('does not show Approve button when approveMemberAction is not provided', () => {
    render(
      <MembersClient
        {...defaultProps}
        members={[adminMember, pendingMember]}
        approveMemberAction={undefined}
      />,
    )
    expect(screen.queryByText(membersDict.approveButton)).not.toBeInTheDocument()
  })

  it('does not show Approve button for non-admin caller', () => {
    const mockApprove = jest.fn().mockResolvedValue({ ok: true })
    render(
      <MembersClient
        {...defaultProps}
        members={[adminMember, pendingMember]}
        callerMembership={{ role: 'member', membershipId: 'membership-member-1' }}
        approveMemberAction={mockApprove}
      />,
    )
    expect(screen.queryByText(membersDict.approveButton)).not.toBeInTheDocument()
  })

  it('calls approveMemberAction with the correct membershipId when Approve is clicked', async () => {
    const mockApprove = jest.fn().mockResolvedValue({ ok: true })
    render(
      <MembersClient
        {...defaultProps}
        members={[adminMember, pendingMember]}
        approveMemberAction={mockApprove}
      />,
    )

    fireEvent.click(screen.getByText(membersDict.approveButton))

    await waitFor(() => {
      expect(mockApprove).toHaveBeenCalledWith('membership-pending-1')
    })
  })

  it('removes Pending badge after successful approve', async () => {
    const mockApprove = jest.fn().mockResolvedValue({ ok: true })
    render(
      <MembersClient
        {...defaultProps}
        members={[adminMember, pendingMember]}
        approveMemberAction={mockApprove}
      />,
    )

    fireEvent.click(screen.getByText(membersDict.approveButton))

    await waitFor(() => {
      expect(screen.queryByText(membersDict.statusPending)).not.toBeInTheDocument()
      expect(screen.queryByText(membersDict.approveButton)).not.toBeInTheDocument()
    })
  })
})
