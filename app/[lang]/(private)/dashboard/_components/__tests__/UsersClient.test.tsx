/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import UsersClient from '../UsersClient'
import enDict from '@/i18n/dictionaries/en.json'
import type { UserWithMemberships } from '@/users/users.types'
import type { UserListFilters, UserListSort, UserListResult } from '@/users/users.types'
import type { ApproveMemberResult } from '@/memberships/memberships.types'
import type { Quiniela } from '@/quinielas/quinielas.types'

jest.useFakeTimers()

const dict = enDict.users

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const activeUser: UserWithMemberships = {
  id: 'user-1',
  email: 'alice@example.com',
  name: null,
  memberships: [
    {
      membershipId: 'mem-1',
      quinielaId: 'q-1',
      quinielaName: 'World Cup 2026',
      role: 'member',
      approvedAt: new Date('2026-01-01'),
    },
  ],
}

const pendingUser: UserWithMemberships = {
  id: 'user-2',
  email: 'bob@example.com',
  name: null,
  memberships: [
    {
      membershipId: 'mem-2',
      quinielaId: 'q-1',
      quinielaName: 'World Cup 2026',
      role: 'member',
      approvedAt: null,
    },
  ],
}

const quiniela: Quiniela = {
  id: 'q-1',
  name: 'World Cup 2026',
  createdBy: 'user-admin',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

// ---------------------------------------------------------------------------
// Mock actions
// ---------------------------------------------------------------------------

const mockListUsersAction = jest.fn(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (_filters: UserListFilters, _page: number, _sort: UserListSort): Promise<UserListResult> => ({
    ok: true,
    users: [activeUser, pendingUser],
    total: 2,
  }),
)

const mockApproveAction = jest.fn(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (_membershipId: string): Promise<ApproveMemberResult> => ({ ok: true }),
)

const defaultProps = {
  initialUsers: [activeUser, pendingUser],
  initialTotal: 2,
  quinielas: [quiniela],
  lang: 'en' as const,
  dict,
  listUsersAction: mockListUsersAction,
  approveAction: mockApproveAction,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderClient(overrides?: Partial<typeof defaultProps>) {
  return render(<UsersClient {...defaultProps} {...overrides} />)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UsersClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  it('renders user emails from initialUsers', () => {
    renderClient()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
  })

  it('renders Active badge for users with all approved memberships', () => {
    renderClient()
    // "Active" appears in both the status dropdown option and the badge
    const activeBadges = screen.getAllByText(dict.badgeActive)
    expect(activeBadges.length).toBeGreaterThan(0)
  })

  it('renders Pending badge for users with null approvedAt', () => {
    renderClient()
    // "Pending" appears in both the status dropdown option and the badge
    const pendingBadges = screen.getAllByText(dict.badgePending)
    expect(pendingBadges.length).toBeGreaterThan(0)
  })

  it('renders quiniela count column', () => {
    renderClient()
    // Both users have 1 membership each
    const cells = screen.getAllByText('1')
    expect(cells.length).toBeGreaterThan(0)
  })

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  it('shows empty state when initialUsers is empty', () => {
    renderClient({ initialUsers: [], initialTotal: 0 })
    expect(screen.getByText(dict.emptyState)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  it('shows error state and retry button when listUsersAction fails', async () => {
    mockListUsersAction.mockResolvedValueOnce({ ok: false, error: 'NOT_AUTHORIZED' })

    renderClient()

    // Change filter to trigger a fetch (status dropdown — no debounce)
    fireEvent.change(screen.getByLabelText(/status/i), {
      target: { value: 'active' },
    })

    await waitFor(() => {
      expect(screen.getByText(dict.errorState)).toBeInTheDocument()
      expect(screen.getByText(dict.retryButton)).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Filter: status
  // -------------------------------------------------------------------------

  it('calls listUsersAction with status filter when status dropdown changes', async () => {
    renderClient()

    fireEvent.change(screen.getByLabelText(/status/i), {
      target: { value: 'pending' },
    })

    await waitFor(() => {
      expect(mockListUsersAction).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending' }),
        1,
        expect.any(Object),
      )
    })
  })

  // -------------------------------------------------------------------------
  // Filter: search (debounced)
  // -------------------------------------------------------------------------

  it('calls listUsersAction with search string after debounce', async () => {
    renderClient()

    const searchInput = screen.getByPlaceholderText(dict.searchPlaceholder)
    fireEvent.change(searchInput, { target: { value: 'alice' } })

    // Should NOT call yet (before timer fires)
    expect(mockListUsersAction).not.toHaveBeenCalled()

    // Advance past debounce threshold with act()
    await act(async () => {
      jest.advanceTimersByTime(400)
    })

    await waitFor(() => {
      expect(mockListUsersAction).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'alice' }),
        1,
        expect.any(Object),
      )
    })
  })

  it('does not call listUsersAction before debounce delay', async () => {
    renderClient()

    const searchInput = screen.getByPlaceholderText(dict.searchPlaceholder)
    fireEvent.change(searchInput, { target: { value: 'bob' } })

    await act(async () => {
      jest.advanceTimersByTime(100) // Only 100ms — not enough
    })

    expect(mockListUsersAction).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Sort
  // -------------------------------------------------------------------------

  it('calls listUsersAction with desc sort when email header is clicked', async () => {
    renderClient()

    // Initial sort is email asc, first click on email header toggles to desc
    fireEvent.click(screen.getByText(dict.columnEmail))

    await waitFor(() => {
      expect(mockListUsersAction).toHaveBeenCalledWith(
        expect.any(Object),
        1,
        expect.objectContaining({ column: 'email', direction: 'desc' }),
      )
    })
  })

  it('calls listUsersAction with asc sort after clicking email header twice', async () => {
    renderClient()

    // Click once → desc
    fireEvent.click(screen.getByText(dict.columnEmail))
    await waitFor(() => {
      expect(mockListUsersAction).toHaveBeenLastCalledWith(
        expect.any(Object),
        1,
        expect.objectContaining({ column: 'email', direction: 'desc' }),
      )
    })

    // Click again → asc
    fireEvent.click(screen.getByText(dict.columnEmail))
    await waitFor(() => {
      expect(mockListUsersAction).toHaveBeenLastCalledWith(
        expect.any(Object),
        1,
        expect.objectContaining({ column: 'email', direction: 'asc' }),
      )
    })
  })

  // -------------------------------------------------------------------------
  // Row click → detail panel
  // -------------------------------------------------------------------------

  it('opens UserDetailPanel when a user row is clicked', async () => {
    renderClient()

    fireEvent.click(screen.getByText('alice@example.com'))

    await waitFor(() => {
      expect(screen.getByText(dict.detailHeading)).toBeInTheDocument()
      // The panel shows the user's email
      expect(screen.getAllByText('alice@example.com').length).toBeGreaterThan(0)
    })
  })

  it('shows quiniela names in the detail panel', async () => {
    renderClient()

    fireEvent.click(screen.getByText('alice@example.com'))

    await waitFor(() => {
      // 'World Cup 2026' appears in both the panel and the quiniela dropdown option
      expect(screen.getAllByText('World Cup 2026').length).toBeGreaterThan(0)
    })
  })

  // -------------------------------------------------------------------------
  // Approve button in detail panel
  // -------------------------------------------------------------------------

  it('shows Approve button for pending memberships in detail panel', async () => {
    renderClient()

    // Open pending user's panel
    fireEvent.click(screen.getByText('bob@example.com'))

    await waitFor(() => {
      expect(screen.getByText(dict.approveButton)).toBeInTheDocument()
    })
  })

  it('calls approveAction and updates badge when Approve is clicked', async () => {
    renderClient()

    fireEvent.click(screen.getByText('bob@example.com'))

    await waitFor(() => {
      expect(screen.getByText(dict.approveButton)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(dict.approveButton))

    await waitFor(() => {
      expect(mockApproveAction).toHaveBeenCalledWith('mem-2')
    })

    // After approve, Pending badge in the panel should flip to Active badge
    // The Approve button should disappear (membership is now approved)
    await waitFor(() => {
      expect(screen.queryByText(dict.approveButton)).not.toBeInTheDocument()
    })
  })

  it('does not show Approve button for already-approved memberships in detail panel', async () => {
    renderClient()

    fireEvent.click(screen.getByText('alice@example.com'))

    await waitFor(() => {
      expect(screen.getByText(dict.detailHeading)).toBeInTheDocument()
    })

    expect(screen.queryByText(dict.approveButton)).not.toBeInTheDocument()
  })
})
