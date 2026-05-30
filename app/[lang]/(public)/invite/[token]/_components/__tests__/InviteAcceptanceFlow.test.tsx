/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import InviteAcceptanceFlow from '../InviteAcceptanceFlow'
import enDict from '@/i18n/dictionaries/en.json'
import type { PageData } from '../InviteAcceptanceFlow'

const dict = enDict.invite

const noop = jest.fn()

function renderFlow(pageData: PageData) {
  return render(
    <InviteAcceptanceFlow
      pageData={pageData}
      lang="en"
      dict={dict}
      acceptAsExistingAction={noop}
      acceptAsNewAction={noop}
    />,
  )
}

describe('InviteAcceptanceFlow', () => {
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
      rawToken: 'abc123',
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
      rawToken: 'abc123',
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
      rawToken: 'abc123',
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
      rawToken: 'abc123',
    })
    // loginHeading appears in both the <h1> and the link text — use getAllByText
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
      rawToken: 'abc123',
    })
    expect(screen.getByText(dict.signupHeading)).toBeInTheDocument()
    expect(screen.getByText(dict.signupSubtitle)).toBeInTheDocument()
    expect(screen.getByLabelText(dict.passwordLabel)).toBeInTheDocument()
    expect(screen.getByLabelText(dict.confirmPasswordLabel)).toBeInTheDocument()
    expect(screen.getByText(dict.joinButton)).toBeInTheDocument()
  })
})
