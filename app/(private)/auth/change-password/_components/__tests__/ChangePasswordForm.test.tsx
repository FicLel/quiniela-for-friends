/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'

// ---------------------------------------------------------------------------
// Mock the server actions module at the module boundary.
// ---------------------------------------------------------------------------
jest.mock('@/app/(private)/auth/change-password/actions', () => ({
  changePassword: jest.fn(),
}))

import ChangePasswordForm from '../ChangePasswordForm'
import { changePassword } from '@/app/(private)/auth/change-password/actions'

const mockChangePassword = changePassword as jest.MockedFunction<typeof changePassword>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup() {
  return render(<ChangePasswordForm />)
}

async function fillAndSubmit(newPassword = 'ValidPass1', confirmPassword = 'ValidPass1') {
  // Use exact label text to avoid ambiguity with "Confirm new password".
  const newInput = screen.getByLabelText('New password')
  const confirmInput = screen.getByLabelText('Confirm new password')
  fireEvent.change(newInput, { target: { value: newPassword } })
  fireEvent.change(confirmInput, { target: { value: confirmPassword } })
  await act(async () => {
    fireEvent.submit(newInput.closest('form')!)
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChangePasswordForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // 1. Renders two password inputs and submit button.
  it('renders two password inputs and a submit button', () => {
    setup()

    expect(screen.getByLabelText('New password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /set new password/i })).toBeInTheDocument()
  })

  // 2. Shows "Passwords do not match." when passwords differ — both must pass policy so the
  //    mismatch check is actually reached.
  it('shows "Passwords do not match." when passwords differ and does not call changePassword', async () => {
    setup()
    // Both values pass policy (≥8 chars, upper, lower, digit) but are not equal.
    await fillAndSubmit('ValidPass1', 'ValidPass2')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.')
    })

    expect(mockChangePassword).not.toHaveBeenCalled()
  })

  // 3. Shows policy error when password is too short — changePassword NOT called.
  it('shows policy error when password is too short and does not call changePassword', async () => {
    setup()
    await fillAndSubmit('Ab1', 'Ab1')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Password must be at least 8 characters and contain an uppercase letter, a lowercase letter, and a digit.',
      )
    })

    expect(mockChangePassword).not.toHaveBeenCalled()
  })

  // 3b. Shows policy error (NOT mismatch) when both passwords are identical but fail policy.
  it('shows policy error when both passwords match but fail policy', async () => {
    setup()
    // Both values are identical but fail policy (no digit, too short-ish).
    await fillAndSubmit('abc', 'abc')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Password must be at least 8 characters and contain an uppercase letter, a lowercase letter, and a digit.',
      )
    })

    expect(mockChangePassword).not.toHaveBeenCalled()
  })

  // 4. Shows FLAG_UPDATE_FAILED message correctly.
  it('shows FLAG_UPDATE_FAILED message correctly', async () => {
    mockChangePassword.mockResolvedValueOnce({ success: false, error: 'FLAG_UPDATE_FAILED' })

    setup()
    await fillAndSubmit()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Your password was changed but we could not update your account. Please contact support.',
      )
    })
  })

  // 5. Shows UNAUTHORIZED message correctly.
  it('shows UNAUTHORIZED message correctly', async () => {
    mockChangePassword.mockResolvedValueOnce({ success: false, error: 'UNAUTHORIZED' })

    setup()
    await fillAndSubmit()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Your session has expired. Please log in again.',
      )
    })
  })

  // 6. Calls changePassword when both fields match and pass policy.
  it('calls changePassword when both fields match and pass policy', async () => {
    mockChangePassword.mockResolvedValueOnce({ success: false, error: 'UNKNOWN_ERROR' })

    setup()
    await fillAndSubmit('SecurePass1', 'SecurePass1')

    await waitFor(() => {
      expect(mockChangePassword).toHaveBeenCalledWith('SecurePass1', 'SecurePass1')
    })
  })
})
