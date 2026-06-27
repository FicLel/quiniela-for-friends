/** @jest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react'
import { QuinielaBracketNav } from '../QuinielaBracketNav'
import enDict from '@/i18n/dictionaries/en.json'

const dict = { bracket: enDict.navbar.bracket }

describe('QuinielaBracketNav', () => {
  it('renders nothing when the user has no quinielas', () => {
    const { container } = render(<QuinielaBracketNav lang="en" quinielas={[]} dict={dict} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a direct link to the bracket page when the user has exactly one quiniela', () => {
    render(
      <QuinielaBracketNav
        lang="en"
        quinielas={[{ id: 'q-1', name: 'World Cup 2026' }]}
        dict={dict}
      />,
    )
    const link = screen.getByRole('link', { name: dict.bracket })
    expect(link).toHaveAttribute('href', '/en/quinielas/q-1/bracket')
  })

  it('renders a dropdown toggle when the user has more than one quiniela', () => {
    render(
      <QuinielaBracketNav
        lang="en"
        quinielas={[
          { id: 'q-1', name: 'World Cup 2026' },
          { id: 'q-2', name: 'Office Pool' },
        ]}
        dict={dict}
      />,
    )
    expect(screen.getByRole('button', { name: `${dict.bracket} ▾` })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'World Cup 2026' })).not.toBeInTheDocument()
  })

  it('opens the dropdown and shows a bracket link per quiniela', () => {
    render(
      <QuinielaBracketNav
        lang="en"
        quinielas={[
          { id: 'q-1', name: 'World Cup 2026' },
          { id: 'q-2', name: 'Office Pool' },
        ]}
        dict={dict}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: `${dict.bracket} ▾` }))

    const link1 = screen.getByRole('link', { name: 'World Cup 2026' })
    const link2 = screen.getByRole('link', { name: 'Office Pool' })
    expect(link1).toHaveAttribute('href', '/en/quinielas/q-1/bracket')
    expect(link2).toHaveAttribute('href', '/en/quinielas/q-2/bracket')
  })

  it('closes the dropdown after selecting a quiniela', () => {
    render(
      <QuinielaBracketNav
        lang="en"
        quinielas={[
          { id: 'q-1', name: 'World Cup 2026' },
          { id: 'q-2', name: 'Office Pool' },
        ]}
        dict={dict}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: `${dict.bracket} ▾` }))
    fireEvent.click(screen.getByRole('link', { name: 'World Cup 2026' }))
    expect(screen.queryByRole('link', { name: 'World Cup 2026' })).not.toBeInTheDocument()
  })
})
