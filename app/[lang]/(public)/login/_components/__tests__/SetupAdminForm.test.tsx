/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import SetupAdminForm from '../SetupAdminForm'
import enDict from '@/i18n/dictionaries/en.json'
import type { CreateFirstAdminResult } from '@/auth/auth.types'

// usePathname is called inside SetupAdminForm to build the "Log in" link href.
jest.mock('next/navigation', () => ({
  usePathname: () => '/en/login',
}))

const dict = enDict.setup
const mockCreateFirstAdmin = jest.fn<
  Promise<CreateFirstAdminResult>,
  [string, string, string]
>()

function setup() {
  return render(
    <SetupAdminForm dict={dict} createFirstAdminAction={mockCreateFirstAdmin} />,
  )
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
  const emailInput = screen.getByLabelText(new RegExp(dict.emailLabel, 'i'))
  const passwordInput = screen.getByLabelText(dict.passwordLabel)
  const confirmInput = screen.getByLabelText(dict.confirmPasswordLabel)

  fireEvent.change(emailInput, { target: { value: email } })
  fireEvent.change(passwordInput, { target: { value: password } })
  fireEvent.change(confirmInput, { target: { value: confirmPassword } })

  await act(async () => {
    fireEvent.submit(emailInput.closest('form')!)
  })
}

describe('SetupAdminForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the setup heading, three inputs, and submit button', () => {
    setup()
    expect(screen.getByText(dict.heading)).toBeInTheDocument()
    expect(screen.getByLabelText(new RegExp(dict.emailLabel, 'i'))).toBeInTheDocument()
    expect(screen.getByLabelText(dict.passwordLabel)).toBeInTheDocument()
    expect(screen.getByLabelText(dict.confirmPasswordLabel)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: new RegExp(dict.createAccount, 'i') }),
    ).toBeInTheDocument()
  })

  it('shows email error and does not call createFirstAdmin when email is empty', async () => {
    setup()
    await fillAndSubmit({ email: '' })

    await waitFor(() => {
      expect(screen.getByText(dict.errors.invalidEmail)).toBeInTheDocument()
    })
    expect(mockCreateFirstAdmin).not.toHaveBeenCalled()
  })

  it('shows email error and does not call createFirstAdmin when email is invalid', async () => {
    setup()
    await fillAndSubmit({ email: 'not-an-email' })

    await waitFor(() => {
      expect(screen.getByText(dict.errors.invalidEmail)).toBeInTheDocument()
    })
    expect(mockCreateFirstAdmin).not.toHaveBeenCalled()
  })

  it('shows password error and does not call createFirstAdmin when password is empty', async () => {
    setup()
    await fillAndSubmit({ password: '', confirmPassword: '' })

    await waitFor(() => {
      expect(screen.getByText(dict.errors.passwordTooShort)).toBeInTheDocument()
    })
    expect(mockCreateFirstAdmin).not.toHaveBeenCalled()
  })

  it('shows password error and does not call createFirstAdmin when password is too short', async () => {
    setup()
    await fillAndSubmit({ password: 'Ab1', confirmPassword: 'Ab1' })

    await waitFor(() => {
      expect(screen.getByText(dict.errors.passwordTooShort)).toBeInTheDocument()
    })
    expect(mockCreateFirstAdmin).not.toHaveBeenCalled()
  })

  it('shows "Passwords do not match." and does not call createFirstAdmin when passwords differ', async () => {
    setup()
    await fillAndSubmit({ password: 'Password1', confirmPassword: 'Password2' })

    await waitFor(() => {
      expect(screen.getByText(dict.errors.passwordsMismatch)).toBeInTheDocument()
    })
    expect(mockCreateFirstAdmin).not.toHaveBeenCalled()
  })

  it('shows form error and a login link when createFirstAdmin returns SETUP_ALREADY_COMPLETE', async () => {
    mockCreateFirstAdmin.mockResolvedValueOnce({
      success: false,
      error: 'SETUP_ALREADY_COMPLETE',
    })

    setup()
    await fillAndSubmit()

    await waitFor(() => {
      expect(screen.getByText(dict.errors.alreadyComplete)).toBeInTheDocument()
      const link = screen.getByRole('link', { name: new RegExp(dict.logIn, 'i') })
      expect(link).toHaveAttribute('href', '/en/login')
    })
  })

  it('shows generic error when createFirstAdmin returns UNKNOWN_ERROR', async () => {
    mockCreateFirstAdmin.mockResolvedValueOnce({ success: false, error: 'UNKNOWN_ERROR' })

    setup()
    await fillAndSubmit()

    await waitFor(() => {
      expect(screen.getByText(dict.errors.unknown)).toBeInTheDocument()
    })
  })

  it('toggles password input type when show/hide button is clicked', async () => {
    setup()
    const passwordInput = screen.getByLabelText(dict.passwordLabel)
    expect(passwordInput).toHaveAttribute('type', 'password')

    const showButton = screen.getByRole('button', { name: dict.showPassword })
    await act(async () => { fireEvent.click(showButton) })
    expect(passwordInput).toHaveAttribute('type', 'text')

    const hideButton = screen.getByRole('button', { name: dict.hidePassword })
    await act(async () => { fireEvent.click(hideButton) })
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('toggles confirm password input type when show/hide button is clicked', async () => {
    setup()
    const confirmInput = screen.getByLabelText(dict.confirmPasswordLabel)
    expect(confirmInput).toHaveAttribute('type', 'password')

    const showButton = screen.getByRole('button', { name: dict.showConfirmPassword })
    await act(async () => { fireEvent.click(showButton) })
    expect(confirmInput).toHaveAttribute('type', 'text')
  })

  it('calls createFirstAdmin with correct args on valid submit', async () => {
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

  it('shows no error when createFirstAdmin resolves as a redirect (success path)', async () => {
    mockCreateFirstAdmin.mockReturnValueOnce(new Promise(() => {}))

    setup()
    await fillAndSubmit()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(mockCreateFirstAdmin).toHaveBeenCalled()
  })
})
