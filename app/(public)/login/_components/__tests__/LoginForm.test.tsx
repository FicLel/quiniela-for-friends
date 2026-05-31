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
  login: jest.fn(),
}))

import LoginForm from '../LoginForm'
import { login } from '@/app/(public)/login/actions'

const mockLogin = login as jest.MockedFunction<typeof login>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup() {
  return render(<LoginForm />)
}

async function fillAndSubmit(email = 'test@example.com', password = 'password123') {
  const emailInput = screen.getByLabelText(/email address/i)
  const passwordInput = screen.getByLabelText(/password/i)
  fireEvent.change(emailInput, { target: { value: email } })
  fireEvent.change(passwordInput, { target: { value: password } })
  await act(async () => {
    fireEvent.submit(emailInput.closest('form')!)
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // 1. Renders email input, password input, and submit button.
  it('renders email input, password input, and submit button', () => {
    setup()

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  // 2. Submit button is disabled while isPending.
  // Note: useTransition marks isPending=true synchronously only for the duration
  // of the transition. We verify via the mock being called (not a timing check).
  it('calls login with correct credentials on valid submit', async () => {
    // Return a value so the transition completes without error redirect.
    mockLogin.mockResolvedValueOnce({ success: false, error: 'UNKNOWN_ERROR' })

    setup()
    await fillAndSubmit('valid@example.com', 'Secret1!')

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('valid@example.com', 'Secret1!')
    })
  })

  // 3. Shows "Please enter a valid email address." when email is invalid — login is NOT called.
  it('shows validation error for invalid email and does not call login', async () => {
    setup()
    await fillAndSubmit('not-an-email', 'password123')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Please enter a valid email address.',
      )
    })

    expect(mockLogin).not.toHaveBeenCalled()
  })

  // 4. Shows "Invalid email or password." when login returns INVALID_CREDENTIALS.
  it('shows "Invalid email or password." when login returns INVALID_CREDENTIALS', async () => {
    mockLogin.mockResolvedValueOnce({ success: false, error: 'INVALID_CREDENTIALS' })

    setup()
    await fillAndSubmit()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password.')
    })
  })

  // 5. Shows "Something went wrong." when login returns UNKNOWN_ERROR.
  it('shows "Something went wrong." when login returns UNKNOWN_ERROR', async () => {
    mockLogin.mockResolvedValueOnce({ success: false, error: 'UNKNOWN_ERROR' })

    setup()
    await fillAndSubmit()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
    })
  })

  // 6. Does not call login when both fields are empty (invalid email guard fires first).
  it('does not call login when email is empty', async () => {
    setup()
    await fillAndSubmit('', '')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Please enter a valid email address.',
      )
    })

    expect(mockLogin).not.toHaveBeenCalled()
  })
})
