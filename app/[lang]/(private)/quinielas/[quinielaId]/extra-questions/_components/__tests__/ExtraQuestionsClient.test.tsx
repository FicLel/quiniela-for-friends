/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ExtraQuestionsClient from '../ExtraQuestionsClient'
import type { ExtraQuestion } from '@/extraQuestions/extraQuestions.types'

// ---------------------------------------------------------------------------
// Mock next/navigation
// ---------------------------------------------------------------------------
const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

// ---------------------------------------------------------------------------
// Mock server actions
// ---------------------------------------------------------------------------
jest.mock('@/extraQuestions/actions', () => ({
  submitAnswer: jest.fn(),
}))

import { submitAnswer } from '@/extraQuestions/actions'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const unresolvedQuestion: ExtraQuestion = {
  id: 'q-1',
  quinielaId: 'quiniela-1',
  questionText: 'Who will win the Golden Boot?',
  questionType: 'player',
  status: 'unresolved',
  correctAnswer: null,
  createdBy: 'user-admin-1',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  pointsValue: 1,
  answerDeadline: null,
}

const pastDeadlineQuestion: ExtraQuestion = {
  ...unresolvedQuestion,
  id: 'q-3',
  answerDeadline: new Date('2020-01-01'),
}

const resolvedQuestion: ExtraQuestion = {
  ...unresolvedQuestion,
  id: 'q-2',
  questionText: 'Which team wins the tournament?',
  questionType: 'team',
  status: 'resolved',
  correctAnswer: 'Argentina',
  pointsValue: 3,
}

const defaultProps = {
  quinielaId: 'quiniela-1',
  lang: 'en',
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('ExtraQuestionsClient', () => {
  // -------------------------------------------------------------------------
  // Unresolved state — answer submission
  // -------------------------------------------------------------------------

  it('renders an input for unresolved questions and submits the draft answer', async () => {
    ;(submitAnswer as jest.Mock).mockResolvedValue({ success: true })

    render(
      <ExtraQuestionsClient
        {...defaultProps}
        questions={[unresolvedQuestion]}
        userAnswers={{}}
        userResults={{}}
      />,
    )

    fireEvent.change(screen.getByLabelText(/Your answer/i), {
      target: { value: 'Lionel Messi' },
    })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(submitAnswer).toHaveBeenCalledWith('quiniela-1', 'q-1', 'Lionel Messi')
    })
    expect(screen.getByText('Answer saved.')).toBeInTheDocument()
  })

  it('shows an inline error when submitAnswer returns DEADLINE_PASSED', async () => {
    ;(submitAnswer as jest.Mock).mockResolvedValue({ success: false, error: 'DEADLINE_PASSED' })

    render(
      <ExtraQuestionsClient
        {...defaultProps}
        questions={[unresolvedQuestion]}
        userAnswers={{}}
        userResults={{}}
      />,
    )

    fireEvent.change(screen.getByLabelText(/Your answer/i), { target: { value: 'Messi' } })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(screen.getByText('The deadline for this question has passed.')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Past-deadline state — input disabled up front, not just after a failed submit
  // -------------------------------------------------------------------------

  it('disables the input and Save button when the answer deadline has passed', () => {
    render(
      <ExtraQuestionsClient
        {...defaultProps}
        questions={[pastDeadlineQuestion]}
        userAnswers={{}}
        userResults={{}}
      />,
    )

    expect(screen.getByLabelText(/Your answer/i)).toBeDisabled()
    expect(screen.getByText('Save')).toBeDisabled()
    expect(screen.getByText('Answers closed')).toBeInTheDocument()
  })

  it('does not show "Answers closed" when there is no deadline or it has not passed yet', () => {
    render(
      <ExtraQuestionsClient
        {...defaultProps}
        questions={[unresolvedQuestion]}
        userAnswers={{}}
        userResults={{}}
      />,
    )

    expect(screen.queryByText('Answers closed')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Your answer/i)).not.toBeDisabled()
  })

  // -------------------------------------------------------------------------
  // Resolved state — points come from userResult, never from re-comparing strings
  // -------------------------------------------------------------------------

  it('renders +N points from userResult even when the correctAnswer string differs in phrasing', () => {
    render(
      <ExtraQuestionsClient
        {...defaultProps}
        questions={[resolvedQuestion]}
        userAnswers={{ 'q-2': 'arg' }}
        userResults={{ 'q-2': { points: 3, isCorrect: true, isOverridden: false } }}
      />,
    )

    // Answer text "arg" does not match "Argentina" as a raw string — the badge must
    // still show correct because it is driven by userResult.isCorrect, not a
    // client-side string comparison.
    expect(screen.getByText('✓ +3 points')).toBeInTheDocument()
  })

  it('pluralizes "point" (singular) when exactly 1 point is earned', () => {
    render(
      <ExtraQuestionsClient
        {...defaultProps}
        questions={[resolvedQuestion]}
        userAnswers={{ 'q-2': 'Argentina' }}
        userResults={{ 'q-2': { points: 1, isCorrect: true, isOverridden: false } }}
      />,
    )

    expect(screen.getByText('✓ +1 point')).toBeInTheDocument()
  })

  it('shows "No point" when userResult.isCorrect is false, even if the strings match', () => {
    render(
      <ExtraQuestionsClient
        {...defaultProps}
        questions={[resolvedQuestion]}
        userAnswers={{ 'q-2': 'Argentina' }}
        userResults={{ 'q-2': { points: 0, isCorrect: false, isOverridden: false } }}
      />,
    )

    expect(screen.getByText('✗ No point')).toBeInTheDocument()
  })

  it('falls back to 0 points / not correct when there is no userResult entry', () => {
    render(
      <ExtraQuestionsClient
        {...defaultProps}
        questions={[resolvedQuestion]}
        userAnswers={{ 'q-2': 'Argentina' }}
        userResults={{}}
      />,
    )

    expect(screen.getByText('✗ No point')).toBeInTheDocument()
  })

  it('shows "(reviewed by admin)" when userResult.isOverridden is true', () => {
    render(
      <ExtraQuestionsClient
        {...defaultProps}
        questions={[resolvedQuestion]}
        userAnswers={{ 'q-2': 'Argentina' }}
        userResults={{ 'q-2': { points: 3, isCorrect: true, isOverridden: true } }}
      />,
    )

    expect(screen.getByText('(reviewed by admin)')).toBeInTheDocument()
  })

  it('does not show "(reviewed by admin)" when userResult.isOverridden is false', () => {
    render(
      <ExtraQuestionsClient
        {...defaultProps}
        questions={[resolvedQuestion]}
        userAnswers={{ 'q-2': 'Argentina' }}
        userResults={{ 'q-2': { points: 3, isCorrect: true, isOverridden: false } }}
      />,
    )

    expect(screen.queryByText('(reviewed by admin)')).not.toBeInTheDocument()
  })

  it('shows "You did not submit an answer" when the member left the question blank', () => {
    render(
      <ExtraQuestionsClient
        {...defaultProps}
        questions={[resolvedQuestion]}
        userAnswers={{}}
        userResults={{}}
      />,
    )

    expect(screen.getByText('You did not submit an answer.')).toBeInTheDocument()
  })
})
