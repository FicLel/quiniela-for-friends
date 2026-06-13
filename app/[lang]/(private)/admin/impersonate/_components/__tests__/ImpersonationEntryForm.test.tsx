/** @jest-environment jsdom */
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import ImpersonationEntryForm from '../ImpersonationEntryForm'
import enDict from '@/i18n/dictionaries/en.json'
import type { StartImpersonationActionResult } from '../../actions'

const dict = enDict.impersonation
const mockStartImpersonation = jest.fn<Promise<StartImpersonationActionResult>, [string]>()

function setup() {
  return render(
    <ImpersonationEntryForm dict={dict} startImpersonationAction={mockStartImpersonation} />,
  )
}

async function fillAndSubmit(email = 'friend@example.com') {
  const input = screen.getByLabelText(dict.emailLabel)
  fireEvent.change(input, { target: { value: email } })
  await act(async () => {
    fireEvent.submit(input.closest('form')!)
  })
}

describe('ImpersonationEntryForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the email input and submit button', () => {
    setup()
    expect(screen.getByLabelText(dict.emailLabel)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: dict.submit })).toBeInTheDocument()
  })

  it('calls startImpersonationAction with the trimmed email on submit', async () => {
    mockStartImpersonation.mockResolvedValueOnce({ success: true })

    setup()
    await fillAndSubmit('  friend@example.com  ')

    await waitFor(() => {
      expect(mockStartImpersonation).toHaveBeenCalledWith('friend@example.com')
    })
  })

  it('shows errorNotAdmin when the action returns NOT_ADMIN', async () => {
    mockStartImpersonation.mockResolvedValueOnce({ success: false, error: 'NOT_ADMIN' })

    setup()
    await fillAndSubmit()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(dict.errorNotAdmin)
    })
  })

  it('shows errorUserNotFound when the action returns USER_NOT_FOUND', async () => {
    mockStartImpersonation.mockResolvedValueOnce({ success: false, error: 'USER_NOT_FOUND' })

    setup()
    await fillAndSubmit()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(dict.errorUserNotFound)
    })
  })

  it('shows errorCannotImpersonateAdmin when the action returns CANNOT_IMPERSONATE_ADMIN', async () => {
    mockStartImpersonation.mockResolvedValueOnce({
      success: false,
      error: 'CANNOT_IMPERSONATE_ADMIN',
    })

    setup()
    await fillAndSubmit()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(dict.errorCannotImpersonateAdmin)
    })
  })

  it('shows errorUnknown when the action returns UNKNOWN_ERROR', async () => {
    mockStartImpersonation.mockResolvedValueOnce({ success: false, error: 'UNKNOWN_ERROR' })

    setup()
    await fillAndSubmit()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(dict.errorUnknown)
    })
  })
})
