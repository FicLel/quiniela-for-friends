/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import ChangePasswordForm from '../ChangePasswordForm'
import enDict from '@/i18n/dictionaries/en.json'
import type { ChangePasswordResult } from '@/auth/auth.types'

const dict = enDict.changePassword
const mockChangePassword = jest.fn<Promise<ChangePasswordResult>, [string, string]>()

function setup() {
  return render(<ChangePasswordForm dict={dict} changePasswordAction={mockChangePassword} />)
}

async function fillAndSubmit(newPassword = 'ValidPass1', confirmPassword = 'ValidPass1') {
  const newInput = screen.getByLabelText(dict.newPasswordLabel)
  const confirmInput = screen.getByLabelText(dict.confirmPasswordLabel)
  fireEvent.change(newInput, { target: { value: newPassword } })
  fireEvent.change(confirmInput, { target: { value: confirmPassword } })
  await act(async () => {
    fireEvent.submit(newInput.closest('form')!)
  })
}

describe('ChangePasswordForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders two password inputs and a submit button', () => {
    setup()
    expect(screen.getByLabelText(dict.newPasswordLabel)).toBeInTheDocument()
    expect(screen.getByLabelText(dict.confirmPasswordLabel)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(dict.setPassword, 'i') })).toBeInTheDocument()
  })

  it('shows "Passwords do not match." when passwords differ and does not call changePassword', async () => {
    setup()
    await fillAndSubmit('ValidPass1', 'ValidPass2')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(dict.errors.PASSWORDS_DO_NOT_MATCH)
    })

    expect(mockChangePassword).not.toHaveBeenCalled()
  })

  it('shows policy error when password is too short and does not call changePassword', async () => {
    setup()
    await fillAndSubmit('Ab1', 'Ab1')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(dict.errors.POLICY_VIOLATION)
    })

    expect(mockChangePassword).not.toHaveBeenCalled()
  })

  it('shows policy error when both passwords match but fail policy', async () => {
    setup()
    await fillAndSubmit('abc', 'abc')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(dict.errors.POLICY_VIOLATION)
    })

    expect(mockChangePassword).not.toHaveBeenCalled()
  })

  it('shows FLAG_UPDATE_FAILED message correctly', async () => {
    mockChangePassword.mockResolvedValueOnce({ success: false, error: 'FLAG_UPDATE_FAILED' })

    setup()
    await fillAndSubmit()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(dict.errors.FLAG_UPDATE_FAILED)
    })
  })

  it('shows UNAUTHORIZED message correctly', async () => {
    mockChangePassword.mockResolvedValueOnce({ success: false, error: 'UNAUTHORIZED' })

    setup()
    await fillAndSubmit()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(dict.errors.UNAUTHORIZED)
    })
  })

  it('calls changePassword when both fields match and pass policy', async () => {
    mockChangePassword.mockResolvedValueOnce({ success: false, error: 'UNKNOWN_ERROR' })

    setup()
    await fillAndSubmit('SecurePass1', 'SecurePass1')

    await waitFor(() => {
      expect(mockChangePassword).toHaveBeenCalledWith('SecurePass1', 'SecurePass1')
    })
  })
})
