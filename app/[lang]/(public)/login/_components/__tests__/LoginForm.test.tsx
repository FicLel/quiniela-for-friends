/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import LoginForm from '../LoginForm'
import enDict from '@/i18n/dictionaries/en.json'
import type { LoginResult } from '@/auth/auth.types'

const dict = enDict.login
const mockLoginAction = jest.fn<Promise<LoginResult>, [string, string]>()

function setup() {
  return render(<LoginForm dict={dict} loginAction={mockLoginAction} />)
}

async function fillAndSubmit(email = 'test@example.com', password = 'password123') {
  const emailInput = screen.getByLabelText(new RegExp(dict.emailLabel, 'i'))
  const passwordInput = screen.getByLabelText(dict.passwordLabel)
  fireEvent.change(emailInput, { target: { value: email } })
  fireEvent.change(passwordInput, { target: { value: password } })
  await act(async () => {
    fireEvent.submit(emailInput.closest('form')!)
  })
}

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders email input, password input, and submit button', () => {
    setup()
    expect(screen.getByLabelText(new RegExp(dict.emailLabel, 'i'))).toBeInTheDocument()
    expect(screen.getByLabelText(dict.passwordLabel)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(dict.signIn, 'i') })).toBeInTheDocument()
  })

  it('calls loginAction with correct credentials on valid submit', async () => {
    mockLoginAction.mockResolvedValueOnce({ success: false, error: 'UNKNOWN_ERROR' })

    setup()
    await fillAndSubmit('valid@example.com', 'Secret1!')

    await waitFor(() => {
      expect(mockLoginAction).toHaveBeenCalledWith('valid@example.com', 'Secret1!')
    })
  })

  it('shows validation error for invalid email and does not call loginAction', async () => {
    setup()
    await fillAndSubmit('not-an-email', 'password123')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(dict.errors.VALIDATION_ERROR)
    })

    expect(mockLoginAction).not.toHaveBeenCalled()
  })

  it('shows "Invalid email or password." when loginAction returns INVALID_CREDENTIALS', async () => {
    mockLoginAction.mockResolvedValueOnce({ success: false, error: 'INVALID_CREDENTIALS' })

    setup()
    await fillAndSubmit()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(dict.errors.INVALID_CREDENTIALS)
    })
  })

  it('shows "Something went wrong." when loginAction returns UNKNOWN_ERROR', async () => {
    mockLoginAction.mockResolvedValueOnce({ success: false, error: 'UNKNOWN_ERROR' })

    setup()
    await fillAndSubmit()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(dict.errors.UNKNOWN_ERROR)
    })
  })

  it('does not call loginAction when email is empty', async () => {
    setup()
    await fillAndSubmit('', '')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(dict.errors.VALIDATION_ERROR)
    })

    expect(mockLoginAction).not.toHaveBeenCalled()
  })
})
