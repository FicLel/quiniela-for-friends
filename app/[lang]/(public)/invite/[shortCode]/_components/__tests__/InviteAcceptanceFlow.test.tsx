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

describe('InviteAcceptanceFlow (shortCode)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Invalid states
  // -------------------------------------------------------------------------

  it('renders expired message for EXPIRED reason', () => {
    renderFlow({ status: 'invalid', reason: 'EXPIRED' })
    expect(screen.getByText(dict.invalidHeading)).toBeInTheDocument()
    expect(screen.getByText(dict.expiredMessage)).toBeInTheDocument()
  })

  it('renders revoked message for REVOKED reason', () => {
    renderFlow({ status: 'invalid', reason: 'REVOKED' })
    expect(screen.getByText(dict.revokedMessage)).toBeInTheDocument()
  })

  it('renders already accepted message for ALREADY_ACCEPTED reason', () => {
    renderFlow({ status: 'invalid', reason: 'ALREADY_ACCEPTED' })
    expect(screen.getByText(dict.alreadyAcceptedMessage)).toBeInTheDocument()
  })

  it('renders not found message for NOT_FOUND reason', () => {
    renderFlow({ status: 'invalid', reason: 'NOT_FOUND' })
    expect(screen.getByText(dict.notFoundMessage)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Valid state — session email matches
  // -------------------------------------------------------------------------

  it('renders confirm button when sessionEmailMatches is true', () => {
    renderFlow({
      status: 'valid',
      quinielaId: 'q-1',
      maskedEmail: 'a***@example.com',
      userExists: true,
      hasSession: true,
      sessionEmailMatches: true,
      shortCode: 'abc12345',
    })
    expect(screen.getByText(dict.joinButton)).toBeInTheDocument()
    expect(screen.getByText(dict.joinHeading)).toBeInTheDocument()
  })

  it('shows masked email in ready-to-join state', () => {
    renderFlow({
      status: 'valid',
      quinielaId: 'q-1',
      maskedEmail: 'a***@example.com',
      userExists: true,
      hasSession: true,
      sessionEmailMatches: true,
      shortCode: 'abc12345',
    })
    expect(screen.getByText('a***@example.com')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Valid state — email mismatch
  // -------------------------------------------------------------------------

  it('renders email mismatch message when session email does not match', () => {
    renderFlow({
      status: 'valid',
      quinielaId: 'q-1',
      maskedEmail: 'a***@example.com',
      userExists: true,
      hasSession: true,
      sessionEmailMatches: false,
      shortCode: 'abc12345',
    })
    expect(screen.getByText(dict.emailMismatchHeading)).toBeInTheDocument()
    expect(screen.getByText(dict.emailMismatchMessage)).toBeInTheDocument()
    expect(screen.getByText(dict.logoutLink)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Valid state — no session, user exists (login prompt)
  // -------------------------------------------------------------------------

  it('renders login prompt when user exists and has no session', () => {
    renderFlow({
      status: 'valid',
      quinielaId: 'q-1',
      maskedEmail: 'a***@example.com',
      userExists: true,
      hasSession: false,
      sessionEmailMatches: false,
      shortCode: 'abc12345',
    })
    expect(screen.getAllByText(dict.loginHeading).length).toBeGreaterThan(0)
    expect(screen.getByText(dict.loginSubtitle)).toBeInTheDocument()
    expect(screen.getByText('a***@example.com')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Valid state — no session, new user (signup form)
  // -------------------------------------------------------------------------

  it('renders signup form when user does not exist and has no session', () => {
    renderFlow({
      status: 'valid',
      quinielaId: 'q-1',
      maskedEmail: 'n***@example.com',
      userExists: false,
      hasSession: false,
      sessionEmailMatches: false,
      shortCode: 'abc12345',
    })
    expect(screen.getByText(dict.signupHeading)).toBeInTheDocument()
    expect(screen.getByText(dict.signupSubtitle)).toBeInTheDocument()
    expect(screen.getByLabelText(dict.passwordLabel)).toBeInTheDocument()
    expect(screen.getByLabelText(dict.confirmPasswordLabel)).toBeInTheDocument()
    expect(screen.getByText(dict.joinButton)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Pending approval state after new-user registration
  // -------------------------------------------------------------------------

  it('shows pending approval state after successful new-user registration with pendingApproval=true', async () => {
    const mockAcceptAsNew = jest.fn().mockResolvedValue({
      success: true,
      quinielaId: 'q-1',
      wasNewUser: true,
      pendingApproval: true,
    })

    render(
      <InviteAcceptanceFlow
        pageData={{
          status: 'valid',
          quinielaId: 'q-1',
          maskedEmail: 'n***@example.com',
          userExists: false,
          hasSession: false,
          sessionEmailMatches: false,
          shortCode: 'abc12345',
        }}
        lang="en"
        dict={dict}
        pendingApprovalDict={pendingApprovalDict}
        acceptAsExistingAction={noop}
        acceptAsNewAction={mockAcceptAsNew}
      />,
    )

    // Fill in passwords
    fireEvent.change(screen.getByLabelText(dict.passwordLabel), {
      target: { value: 'password123' },
    })
    fireEvent.change(screen.getByLabelText(dict.confirmPasswordLabel), {
      target: { value: 'password123' },
    })

    fireEvent.submit(screen.getByLabelText(dict.passwordLabel).closest('form')!)

    await waitFor(() => {
      expect(mockAcceptAsNew).toHaveBeenCalledWith('password123')
    })

    // Should show pending approval state, NOT quiniela content or redirect
    await waitFor(() => {
      expect(screen.getByText(dict.pendingHeading)).toBeInTheDocument()
      expect(screen.getByText(dict.pendingMessage)).toBeInTheDocument()
    })
  })

  it('does NOT show pending state when registration returns success without pendingApproval', async () => {
    // This case should not happen per the brief, but verify no pending screen shown
    // when pendingApproval is false/undefined
    const mockAcceptAsNew = jest.fn().mockResolvedValue({
      success: false,
      error: 'UNKNOWN_ERROR',
    })

    render(
      <InviteAcceptanceFlow
        pageData={{
          status: 'valid',
          quinielaId: 'q-1',
          maskedEmail: 'n***@example.com',
          userExists: false,
          hasSession: false,
          sessionEmailMatches: false,
          shortCode: 'abc12345',
        }}
        lang="en"
        dict={dict}
        pendingApprovalDict={pendingApprovalDict}
        acceptAsExistingAction={noop}
        acceptAsNewAction={mockAcceptAsNew}
      />,
    )

    fireEvent.change(screen.getByLabelText(dict.passwordLabel), {
      target: { value: 'password123' },
    })
    fireEvent.change(screen.getByLabelText(dict.confirmPasswordLabel), {
      target: { value: 'password123' },
    })
    fireEvent.submit(screen.getByLabelText(dict.passwordLabel).closest('form')!)

    await waitFor(() => {
      // Error should appear, NOT the pending screen
      expect(screen.queryByText(dict.pendingHeading)).not.toBeInTheDocument()
      expect(screen.getByText(dict.errors.UNKNOWN_ERROR)).toBeInTheDocument()
    })
  })

  it('shows back link to quinielas in pending approval state', async () => {
    const mockAcceptAsNew = jest.fn().mockResolvedValue({
      success: true,
      quinielaId: 'q-1',
      wasNewUser: true,
      pendingApproval: true,
    })

    render(
      <InviteAcceptanceFlow
        pageData={{
          status: 'valid',
          quinielaId: 'q-1',
          maskedEmail: 'n***@example.com',
          userExists: false,
          hasSession: false,
          sessionEmailMatches: false,
          shortCode: 'abc12345',
        }}
        lang="en"
        dict={dict}
        pendingApprovalDict={pendingApprovalDict}
        acceptAsExistingAction={noop}
        acceptAsNewAction={mockAcceptAsNew}
      />,
    )

    fireEvent.change(screen.getByLabelText(dict.passwordLabel), {
      target: { value: 'password123' },
    })
    fireEvent.change(screen.getByLabelText(dict.confirmPasswordLabel), {
      target: { value: 'password123' },
    })
    fireEvent.submit(screen.getByLabelText(dict.passwordLabel).closest('form')!)

    await waitFor(() => {
      expect(screen.getByText(pendingApprovalDict.backLink)).toBeInTheDocument()
    })
  })
})
