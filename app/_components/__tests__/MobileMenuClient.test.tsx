/** @jest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileMenuClient } from '../MobileMenuClient'
import enDict from '@/i18n/dictionaries/en.json'

jest.mock('next/navigation', () => ({
  usePathname: () => '/en/welcome',
  useRouter: () => ({ push: jest.fn() }),
}))

const dict = enDict.navbar

function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
}

describe('MobileMenuClient', () => {
  it('renders a bracket link to the single quiniela the user belongs to', () => {
    render(
      <MobileMenuClient
        lang="en"
        dict={dict}
        quinielas={[{ id: 'q-1', name: 'World Cup 2026' }]}
      />,
    )
    openMenu()
    const link = screen.getByRole('link', { name: dict.bracket })
    expect(link).toHaveAttribute('href', '/en/quinielas/q-1/bracket')
  })

  it('renders a bracket link per quiniela when the user belongs to more than one', () => {
    render(
      <MobileMenuClient
        lang="en"
        dict={dict}
        quinielas={[
          { id: 'q-1', name: 'World Cup 2026' },
          { id: 'q-2', name: 'Office Pool' },
        ]}
      />,
    )
    openMenu()
    const bracketLinks = screen.getAllByRole('link', { name: new RegExp(dict.bracket) })
    expect(bracketLinks).toHaveLength(2)
    expect(bracketLinks[0]).toHaveAttribute('href', '/en/quinielas/q-1/bracket')
    expect(bracketLinks[1]).toHaveAttribute('href', '/en/quinielas/q-2/bracket')
  })

  it('does not render a bracket link when the user has no quinielas', () => {
    render(<MobileMenuClient lang="en" dict={dict} quinielas={[]} />)
    openMenu()
    expect(screen.queryByText(dict.bracket, { exact: false })).not.toBeInTheDocument()
  })

  it('still renders the leaderboard link alongside the bracket link', () => {
    render(
      <MobileMenuClient
        lang="en"
        dict={dict}
        quinielas={[{ id: 'q-1', name: 'World Cup 2026' }]}
      />,
    )
    openMenu()
    expect(screen.getByRole('link', { name: dict.leaderboard })).toHaveAttribute(
      'href',
      '/en/quinielas/q-1/leaderboard',
    )
    expect(screen.getByRole('link', { name: dict.bracket })).toHaveAttribute(
      'href',
      '/en/quinielas/q-1/bracket',
    )
  })
})
