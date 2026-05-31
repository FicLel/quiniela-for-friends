/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'

// ---------------------------------------------------------------------------
// Mock the server actions module at the module boundary.
// ---------------------------------------------------------------------------
jest.mock('@/app/(public)/login/actions', () => ({
  createFirstAdmin: jest.fn(),
}))

import SetupAdminForm from '../SetupAdminForm'
import { createFirstAdmin } from '@/app/(public)/login/actions'

const mockCreateFirstAdmin = createFirstAdmin as jest.MockedFunction<typeof createFirstAdmin>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup() {
  return render(<SetupAdminForm />)
}

async function fillAndSubmit({
  email = 'admin@example.com',
  password = 'Password1',
  confirmPassword = 'Password1',
}: {
  email?: string
  password?: string
  confirmPassword?: string
} = {}) {
  const emailInput = screen.getByLabelText(/email address/i)
  const passwordInput = screen.getByLabelText('Password')
  // Use exact label text to avoid matching the show/hide button's aria-label.
  const confirmInput = screen.getByLabelText('Confirm password')

  fireEvent.change(emailInput, { target: { value: email } })
  fireEvent.change(passwordInput, { target: { value: password } })
  fireEvent.change(confirmInput, { target: { value: confirmPassword } })

  await act(async () => {
    fireEvent.submit(emailInput.closest('form')!)
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SetupAdminForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // 1. Renders heading and three inputs + submit button.
  it('renders the setup heading, three inputs, and submit button', () => {
    setup()

    expect(screen.getByText(/set up your quiniela/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /create admin account/i }),
    ).toBeInTheDocument()
  })

  // 2. Empty email — shows email field error, action not called.
  it('shows email error and does not call createFirstAdmin when email is empty', async () => {
    setup()
    await fillAndSubmit({ email: '' })

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument()
    })

    expect(mockCreateFirstAdmin).not.toHaveBeenCalled()
  })

  // 3. Invalid email format — shows email field error, action not called.
  it('shows email error and does not call createFirstAdmin when email is invalid', async () => {
    setup()
    await fillAndSubmit({ email: 'not-an-email' })

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument()
    })

    expect(mockCreateFirstAdmin).not.toHaveBeenCalled()
  })

  // 4. Empty password — shows password field error, action not called.
  it('shows password error and does not call createFirstAdmin when password is empty', async () => {
    setup()
    await fillAndSubmit({ password: '', confirmPassword: '' })

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument()
    })

    expect(mockCreateFirstAdmin).not.toHaveBeenCalled()
  })

  // 5. Password shorter than 8 chars — shows password field error, action not called.
  it('shows password error and does not call createFirstAdmin when password is too short', async () => {
    setup()
    await fillAndSubmit({ password: 'Ab1', confirmPassword: 'Ab1' })

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument()
    })

    expect(mockCreateFirstAdmin).not.toHaveBeenCalled()
  })

  // 6. Passwords do not match — shows confirm-password error, action not called.
  it('shows "Passwords do not match." and does not call createFirstAdmin when passwords differ', async () => {
    setup()
    await fillAndSubmit({ password: 'Password1', confirmPassword: 'Password2' })

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
    })

    expect(mockCreateFirstAdmin).not.toHaveBeenCalled()
  })

  // 7. SETUP_ALREADY_COMPLETE — shows form error with link to /login.
  it('shows form error and a login link when createFirstAdmin returns SETUP_ALREADY_COMPLETE', async () => {
    mockCreateFirstAdmin.mockResolvedValueOnce({
      success: false,
      error: 'SETUP_ALREADY_COMPLETE',
    })

    setup()
    await fillAndSubmit()

    await waitFor(() => {
      expect(
        screen.getByText(/setup is already complete\. please log in\./i),
      ).toBeInTheDocument()
      const link = screen.getByRole('link', { name: /log in/i })
      expect(link).toHaveAttribute('href', '/login')
    })
  })

  // 8. UNKNOWN_ERROR — shows generic form error.
  it('shows generic error when createFirstAdmin returns UNKNOWN_ERROR', async () => {
    mockCreateFirstAdmin.mockResolvedValueOnce({
      success: false,
      error: 'UNKNOWN_ERROR',
    })

    setup()
    await fillAndSubmit()

    await waitFor(() => {
      expect(
        screen.getByText(/something went wrong\. please try again\./i),
      ).toBeInTheDocument()
    })
  })

  // 9. Show/hide toggle on password field toggles input type.
  it('toggles password input type when show/hide button is clicked', async () => {
    setup()

    const passwordInput = screen.getByLabelText('Password')
    expect(passwordInput).toHaveAttribute('type', 'password')

    const showButton = screen.getByRole('button', { name: /show password/i })
    await act(async () => {
      fireEvent.click(showButton)
    })

    expect(passwordInput).toHaveAttribute('type', 'text')

    const hideButton = screen.getByRole('button', { name: /hide password/i })
    await act(async () => {
      fireEvent.click(hideButton)
    })

    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  // 10. Show/hide toggle on confirm password field toggles input type.
  it('toggles confirm password input type when show/hide button is clicked', async () => {
    setup()

    const confirmInput = screen.getByLabelText('Confirm password')
    expect(confirmInput).toHaveAttribute('type', 'password')

    const showButton = screen.getByRole('button', { name: /show confirm password/i })
    await act(async () => {
      fireEvent.click(showButton)
    })

    expect(confirmInput).toHaveAttribute('type', 'text')
  })

  // 11. Valid submit — createFirstAdmin called with correct args.
  it('calls createFirstAdmin with correct args on valid submit', async () => {
    // Return a value so the transition completes (redirect() is not available in tests).
    mockCreateFirstAdmin.mockResolvedValueOnce({ success: false, error: 'UNKNOWN_ERROR' })

    setup()
    await fillAndSubmit({
      email: 'admin@example.com',
      password: 'SecurePass1',
      confirmPassword: 'SecurePass1',
    })

    await waitFor(() => {
      expect(mockCreateFirstAdmin).toHaveBeenCalledWith(
        'admin@example.com',
        'SecurePass1',
        'SecurePass1',
      )
    })
  })

  // 12. Success path — when createFirstAdmin "redirects" (resolves with no failure result),
  //     the form shows no error message.
  it('shows no error when createFirstAdmin resolves as a redirect (success path)', async () => {
    // In the real app redirect() throws inside the server action, so the client
    // never receives a result. Simulate by having the mock never settle — the
    // transition stays pending — which mirrors the successful redirect UX.
    mockCreateFirstAdmin.mockReturnValueOnce(new Promise(() => {}))

    setup()
    await fillAndSubmit()

    // No error alerts should appear.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(mockCreateFirstAdmin).toHaveBeenCalled()
  })
})
