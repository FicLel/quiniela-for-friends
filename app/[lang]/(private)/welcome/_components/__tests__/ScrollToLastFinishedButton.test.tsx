/** @jest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react'
import ScrollToLastFinishedButton from '../ScrollToLastFinishedButton'
import enDict from '@/i18n/dictionaries/en.json'

const dict = enDict.welcome

describe('ScrollToLastFinishedButton', () => {
  it('renders null when visible is false', () => {
    const { container } = render(
      <ScrollToLastFinishedButton visible={false} onClick={jest.fn()} dict={dict} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the button when visible is true', () => {
    render(<ScrollToLastFinishedButton visible={true} onClick={jest.fn()} dict={dict} />)
    expect(screen.getByRole('button', { name: dict.scrollToLastFinishedLabel })).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = jest.fn()
    render(<ScrollToLastFinishedButton visible={true} onClick={onClick} dict={dict} />)

    fireEvent.click(screen.getByRole('button', { name: dict.scrollToLastFinishedLabel }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
