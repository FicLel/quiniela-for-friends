/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AppSettingsForm from '../AppSettingsForm'
import enDict from '@/i18n/dictionaries/en.json'

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

function jsonOk(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response)
}

function jsonError(body: unknown, status = 500) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const dict = enDict.adminSettings

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn()
})

describe('AppSettingsForm', () => {
  it('renders the heading labels and both radio options', () => {
    render(<AppSettingsForm initialMode="shared" dict={dict} />)

    expect(screen.getByText(dict.predictionModeLabel)).toBeInTheDocument()
    expect(screen.getByText(dict.predictionModeShared)).toBeInTheDocument()
    expect(screen.getByText(dict.predictionModePerQuiniela)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: dict.saveButton })).toBeInTheDocument()
  })

  it('initialises radio to the initialMode prop', () => {
    render(<AppSettingsForm initialMode="per_quiniela" dict={dict} />)

    const sharedRadio = screen.getByRole('radio', { name: dict.predictionModeShared }) as HTMLInputElement
    const perQuinielaRadio = screen.getByRole('radio', { name: dict.predictionModePerQuiniela }) as HTMLInputElement

    expect(sharedRadio.checked).toBe(false)
    expect(perQuinielaRadio.checked).toBe(true)
  })

  it('shows saveSuccess message after a successful PUT', async () => {
    ;(global.fetch as jest.Mock).mockImplementation(() => jsonOk({ success: true }))

    render(<AppSettingsForm initialMode="shared" dict={dict} />)

    fireEvent.submit(screen.getByRole('button', { name: dict.saveButton }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(dict.saveSuccess)
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/settings',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ predictionMode: 'shared' }),
      }),
    )
  })

  it('sends the updated mode when the radio is changed before submitting', async () => {
    ;(global.fetch as jest.Mock).mockImplementation(() => jsonOk({ success: true }))

    render(<AppSettingsForm initialMode="shared" dict={dict} />)

    // Switch to per_quiniela
    fireEvent.click(screen.getByRole('radio', { name: dict.predictionModePerQuiniela }))

    fireEvent.submit(screen.getByRole('button', { name: dict.saveButton }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(dict.saveSuccess)
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/settings',
      expect.objectContaining({
        body: JSON.stringify({ predictionMode: 'per_quiniela' }),
      }),
    )
  })

  it('shows error message when the API returns a known error code', async () => {
    ;(global.fetch as jest.Mock).mockImplementation(() =>
      jsonOk({ success: false, error: 'INVALID_PAYLOAD' }),
    )

    render(<AppSettingsForm initialMode="shared" dict={dict} />)

    fireEvent.submit(screen.getByRole('button', { name: dict.saveButton }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(dict.errors.INVALID_PAYLOAD)
    })
  })

  it('shows UNKNOWN_ERROR message for unknown error codes', async () => {
    ;(global.fetch as jest.Mock).mockImplementation(() =>
      jsonOk({ success: false, error: 'SOME_WEIRD_ERROR' }),
    )

    render(<AppSettingsForm initialMode="shared" dict={dict} />)

    fireEvent.submit(screen.getByRole('button', { name: dict.saveButton }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(dict.errors.UNKNOWN_ERROR)
    })
  })

  it('shows UNKNOWN_ERROR message when fetch itself throws', async () => {
    ;(global.fetch as jest.Mock).mockImplementation(async () => {
      throw new Error('Network failure')
    })

    render(<AppSettingsForm initialMode="shared" dict={dict} />)

    fireEvent.submit(screen.getByRole('button', { name: dict.saveButton }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(dict.errors.UNKNOWN_ERROR)
    })
  })
})
