/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { ImpersonationBanner } from '../ImpersonationBanner'
import enDict from '@/i18n/dictionaries/en.json'

jest.mock('@/app/[lang]/(private)/admin/impersonate/actions', () => ({
  endImpersonation: jest.fn(),
}))

const dict = enDict.impersonation

describe('ImpersonationBanner', () => {
  it('renders the viewing-as message with the email interpolated', () => {
    render(<ImpersonationBanner lang="en" email="friend@example.com" dict={dict} />)

    expect(screen.getByText('Viewing as friend@example.com')).toBeInTheDocument()
  })

  it('renders an exit button bound to endImpersonation', () => {
    render(<ImpersonationBanner lang="en" email="friend@example.com" dict={dict} />)

    expect(screen.getByRole('button', { name: dict.exit })).toBeInTheDocument()
  })
})
