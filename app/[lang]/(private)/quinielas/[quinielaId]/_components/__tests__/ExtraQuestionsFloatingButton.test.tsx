/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import ExtraQuestionsFloatingButton from '../ExtraQuestionsFloatingButton'

const defaultProps = {
  quinielaId: 'quiniela-1',
  lang: 'en',
  unansweredCount: 0,
  totalQuestions: 3,
}

describe('ExtraQuestionsFloatingButton', () => {
  it('returns null when totalQuestions === 0', () => {
    const { container } = render(
      <ExtraQuestionsFloatingButton {...defaultProps} totalQuestions={0} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the button when totalQuestions > 0', () => {
    render(<ExtraQuestionsFloatingButton {...defaultProps} totalQuestions={1} />)
    expect(screen.getByText('Extra')).toBeInTheDocument()
  })

  it('shows badge with count when unansweredCount > 0', () => {
    render(<ExtraQuestionsFloatingButton {...defaultProps} unansweredCount={5} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('does NOT render badge when unansweredCount === 0', () => {
    render(<ExtraQuestionsFloatingButton {...defaultProps} unansweredCount={0} />)
    // The badge element is hidden (not rendered) — "0" should not appear
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('link points to the correct extra-questions href', () => {
    render(
      <ExtraQuestionsFloatingButton
        quinielaId="q-abc"
        lang="en"
        unansweredCount={2}
        totalQuestions={4}
      />,
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/en/quinielas/q-abc/extra-questions')
  })
})
