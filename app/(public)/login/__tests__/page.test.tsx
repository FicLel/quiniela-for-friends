/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockHasAnyUser = jest.fn<Promise<boolean>, []>()
jest.mock('@/users/UsersRepository', () => ({
  UsersRepository: jest.fn().mockImplementation(() => ({
    hasAnyUser: mockHasAnyUser,
  })),
}))

// Stub out child components so we only test conditional rendering logic.
jest.mock('../_components/LoginForm', () => ({
  __esModule: true,
  default: () => <div data-testid="login-form" />,
}))

jest.mock('../_components/SetupAdminForm', () => ({
  __esModule: true,
  default: () => <div data-testid="setup-admin-form" />,
}))

jest.mock('../_components/SoccerAnimation', () => ({
  __esModule: true,
  default: () => null,
}))

// ---------------------------------------------------------------------------
// Import after mocks.
// ---------------------------------------------------------------------------
import LoginPage from '../page'

// ---------------------------------------------------------------------------
// Helper — render async server component.
// ---------------------------------------------------------------------------
async function renderPage() {
  const jsx = await LoginPage()
  return render(jsx as React.ReactElement)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders SetupAdminForm when no users exist', async () => {
    mockHasAnyUser.mockResolvedValueOnce(false)

    await renderPage()

    expect(screen.getByTestId('setup-admin-form')).toBeInTheDocument()
    expect(screen.queryByTestId('login-form')).not.toBeInTheDocument()
  })

  it('renders LoginForm when at least one user exists', async () => {
    mockHasAnyUser.mockResolvedValueOnce(true)

    await renderPage()

    expect(screen.getByTestId('login-form')).toBeInTheDocument()
    expect(screen.queryByTestId('setup-admin-form')).not.toBeInTheDocument()
  })

  it('falls back to LoginForm when hasAnyUser throws (fail-safe)', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockHasAnyUser.mockRejectedValueOnce(new Error('DB connection failed'))

    await renderPage()

    expect(screen.getByTestId('login-form')).toBeInTheDocument()
    expect(screen.queryByTestId('setup-admin-form')).not.toBeInTheDocument()
    expect(consoleSpy).toHaveBeenCalledWith(
      '[LoginPage] Could not check user count:',
      expect.any(Error),
    )

    consoleSpy.mockRestore()
  })
})
