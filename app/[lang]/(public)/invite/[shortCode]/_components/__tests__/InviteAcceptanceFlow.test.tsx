/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import InviteAcceptanceFlow from '../InviteAcceptanceFlow'
import enDict from '@/i18n/dictionaries/en.json'
import type { PageData } from '../InviteAcceptanceFlow'

const dict = enDict.invite
const pendingApprovalDict = enDict.pendingApproval

const noop = jest.fn()

function renderFlow(pageData: PageData) {
  return render(
    <InviteAcceptanceFlow
      pageData={pageData}
      lang="en"
      dict={dict}
      pendingApprovalDict={pendingApprovalDict}
      acceptAsExistingAction={noop}
      acceptAsNewAction={noop}
    />,
  )
}

const validOpenBase: PageData = {
  status: 'valid',
  quinielaId: 'q-1',
  hasSession: false,
  shortCode: 'abc12345',
}

describe('InviteAcceptanceFlow (shortCode)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ---------------------------------------------------------------------------
  // Invalid states
  // ---------------------------------------------------------------------------

  it('renders expired message for EXPIRED reason', () => {
    renderFlow({ status: 'invalid', reason: 'EXPIRED' })
    expect(screen.getByText(dict.invalidHeading)).toBeInTheDocument()
    expect(screen.getByText(dict.expiredMessage)).toBeInTheDocument()
  })

  it('renders revoked message for REVOKED reason', () => {
    renderFlow({ status: 'invalid', reason: 'REVOKED' })
    expect(screen.getByText(dict.revokedMessage)).toBeInTheDocument()
  })

  it('renders not found message for NOT_FOUND reason', () => {
    renderFlow({ status: 'invalid', reason: 'NOT_FOUND' })
    expect(screen.getByText(dict.notFoundMessage)).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Valid state — logged-in user (hasSession = true)
  // ---------------------------------------------------------------------------

  it('renders join button when user has a session', () => {
    renderFlow({ ...validOpenBase, hasSession: true })
    expect(screen.getByText(dict.joinButton)).toBeInTheDocument()
    expect(screen.getByText(dict.joinHeading)).toBeInTheDocument()
  })

  it('calls acceptAsExistingAction when Join button is clicked', async () => {
    const mockAcceptExisting = jest.fn().mockResolvedValue({ success: true, quinielaId: 'q-1', pendingApproval: true })

    render(
      <InviteAcceptanceFlow
        pageData={{ ...validOpenBase, hasSession: true }}
        lang="en"
        dict={dict}
        pendingApprovalDict={pendingApprovalDict}
        acceptAsExistingAction={mockAcceptExisting}
        acceptAsNewAction={noop}
      />,
    )

    fireEvent.click(screen.getByText(dict.joinButton))

    await waitFor(() => {
      expect(mockAcceptExisting).toHaveBeenCalled()
    })
  })

  it('shows pending approval state after existing user successfully joins', async () => {
    const mockAcceptExisting = jest.fn().mockResolvedValue({ success: true, quinielaId: 'q-1', pendingApproval: true })

    render(
      <InviteAcceptanceFlow
        pageData={{ ...validOpenBase, hasSession: true }}
        lang="en"
        dict={dict}
        pendingApprovalDict={pendingApprovalDict}
        acceptAsExistingAction={mockAcceptExisting}
        acceptAsNewAction={noop}
      />,
    )

    fireEvent.click(screen.getByText(dict.joinButton))

    await waitFor(() => {
      expect(screen.getByText(dict.pendingHeading)).toBeInTheDocument()
      expect(screen.getByText(dict.pendingMessage)).toBeInTheDocument()
    })
  })

  it('shows already-member message when acceptAsExistingAction returns alreadyMember=true', async () => {
    const mockAcceptExisting = jest.fn().mockResolvedValue({ success: true, quinielaId: 'q-1', alreadyMember: true })

    render(
      <InviteAcceptanceFlow
        pageData={{ ...validOpenBase, hasSession: true }}
        lang="en"
        dict={dict}
        pendingApprovalDict={pendingApprovalDict}
        acceptAsExistingAction={mockAcceptExisting}
        acceptAsNewAction={noop}
      />,
    )

    fireEvent.click(screen.getByText(dict.joinButton))

    await waitFor(() => {
      expect(screen.getByText(dict.alreadyMember)).toBeInTheDocument()
    })
  })

  it('shows error message when acceptAsExistingAction returns failure', async () => {
    const mockAcceptExisting = jest.fn().mockResolvedValue({ success: false, error: 'UNKNOWN_ERROR' })

    render(
      <InviteAcceptanceFlow
        pageData={{ ...validOpenBase, hasSession: true }}
        lang="en"
        dict={dict}
        pendingApprovalDict={pendingApprovalDict}
        acceptAsExistingAction={mockAcceptExisting}
        acceptAsNewAction={noop}
      />,
    )

    fireEvent.click(screen.getByText(dict.joinButton))

    await waitFor(() => {
      expect(screen.getByText(dict.errors.UNKNOWN_ERROR)).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // Valid state — no session (signup form)
  // ---------------------------------------------------------------------------

  it('renders signup form when user has no session', () => {
    renderFlow({ ...validOpenBase, hasSession: false })
    expect(screen.getByText(dict.signupHeading)).toBeInTheDocument()
    expect(screen.getByLabelText(dict.emailLabel)).toBeInTheDocument()
    expect(screen.getByLabelText(dict.passwordLabel)).toBeInTheDocument()
    expect(screen.getByLabelText(dict.confirmPasswordLabel)).toBeInTheDocument()
    expect(screen.getByText(dict.joinButton)).toBeInTheDocument()
  })

  it('shows pending approval state after successful new-user registration', async () => {
    const mockAcceptAsNew = jest.fn().mockResolvedValue({
      success: true,
      quinielaId: 'q-1',
      wasNewUser: true,
      pendingApproval: true,
    })

    render(
      <InviteAcceptanceFlow
        pageData={{ ...validOpenBase, hasSession: false }}
        lang="en"
        dict={dict}
        pendingApprovalDict={pendingApprovalDict}
        acceptAsExistingAction={noop}
        acceptAsNewAction={mockAcceptAsNew}
      />,
    )

    fireEvent.change(screen.getByLabelText(dict.emailLabel), { target: { value: 'new@example.com' } })
    fireEvent.change(screen.getByLabelText(dict.passwordLabel), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText(dict.confirmPasswordLabel), { target: { value: 'password123' } })
    fireEvent.submit(screen.getByLabelText(dict.passwordLabel).closest('form')!)

    await waitFor(() => {
      expect(mockAcceptAsNew).toHaveBeenCalledWith('new@example.com', 'password123')
    })

    await waitFor(() => {
      expect(screen.getByText(dict.pendingHeading)).toBeInTheDocument()
      expect(screen.getByText(dict.pendingMessage)).toBeInTheDocument()
    })
  })

  it('shows error when registration fails', async () => {
    const mockAcceptAsNew = jest.fn().mockResolvedValue({ success: false, error: 'UNKNOWN_ERROR' })

    render(
      <InviteAcceptanceFlow
        pageData={{ ...validOpenBase, hasSession: false }}
        lang="en"
        dict={dict}
        pendingApprovalDict={pendingApprovalDict}
        acceptAsExistingAction={noop}
        acceptAsNewAction={mockAcceptAsNew}
      />,
    )

    fireEvent.change(screen.getByLabelText(dict.emailLabel), { target: { value: 'new@example.com' } })
    fireEvent.change(screen.getByLabelText(dict.passwordLabel), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText(dict.confirmPasswordLabel), { target: { value: 'password123' } })
    fireEvent.submit(screen.getByLabelText(dict.passwordLabel).closest('form')!)

    await waitFor(() => {
      expect(screen.queryByText(dict.pendingHeading)).not.toBeInTheDocument()
      expect(screen.getByText(dict.errors.UNKNOWN_ERROR)).toBeInTheDocument()
    })
  })

  it('shows EMAIL_ALREADY_EXISTS error when account already exists', async () => {
    const mockAcceptAsNew = jest.fn().mockResolvedValue({ success: false, error: 'EMAIL_ALREADY_EXISTS' })

    render(
      <InviteAcceptanceFlow
        pageData={{ ...validOpenBase, hasSession: false }}
        lang="en"
        dict={dict}
        pendingApprovalDict={pendingApprovalDict}
        acceptAsExistingAction={noop}
        acceptAsNewAction={mockAcceptAsNew}
      />,
    )

    fireEvent.change(screen.getByLabelText(dict.emailLabel), { target: { value: 'existing@example.com' } })
    fireEvent.change(screen.getByLabelText(dict.passwordLabel), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText(dict.confirmPasswordLabel), { target: { value: 'password123' } })
    fireEvent.submit(screen.getByLabelText(dict.passwordLabel).closest('form')!)

    await waitFor(() => {
      expect(screen.getByText(dict.errors.EMAIL_ALREADY_EXISTS)).toBeInTheDocument()
    })
  })

  it('shows back link in pending approval state', async () => {
    const mockAcceptAsNew = jest.fn().mockResolvedValue({
      success: true,
      quinielaId: 'q-1',
      wasNewUser: true,
      pendingApproval: true,
    })

    render(
      <InviteAcceptanceFlow
        pageData={{ ...validOpenBase, hasSession: false }}
        lang="en"
        dict={dict}
        pendingApprovalDict={pendingApprovalDict}
        acceptAsExistingAction={noop}
        acceptAsNewAction={mockAcceptAsNew}
      />,
    )

    fireEvent.change(screen.getByLabelText(dict.emailLabel), { target: { value: 'new@example.com' } })
    fireEvent.change(screen.getByLabelText(dict.passwordLabel), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText(dict.confirmPasswordLabel), { target: { value: 'password123' } })
    fireEvent.submit(screen.getByLabelText(dict.passwordLabel).closest('form')!)

    await waitFor(() => {
      expect(screen.getByText(pendingApprovalDict.backLink)).toBeInTheDocument()
    })
  })
})
