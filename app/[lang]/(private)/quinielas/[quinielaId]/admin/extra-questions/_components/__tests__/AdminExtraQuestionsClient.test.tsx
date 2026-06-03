/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AdminExtraQuestionsClient from '../AdminExtraQuestionsClient'
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
  createQuestion: jest.fn(),
  resolveQuestion: jest.fn(),
}))

// Import after mocking so we can configure the mock per-test
import { createQuestion, resolveQuestion } from '@/extraQuestions/actions'

// ---------------------------------------------------------------------------
// Mock autocomplete children (they do fetch on mount — keep them simple)
// ---------------------------------------------------------------------------
jest.mock('../TeamAutocomplete', () => ({
  __esModule: true,
  default: ({
    value,
    onChange,
    placeholder,
    disabled,
  }: {
    value: string
    onChange: (v: string) => void
    placeholder?: string
    disabled?: boolean
  }) => (
    <input
      data-testid="team-autocomplete"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  ),
}))

jest.mock('../PlayerAutocomplete', () => ({
  __esModule: true,
  default: ({
    value,
    onChange,
    placeholder,
    disabled,
  }: {
    value: string
    onChange: (v: string) => void
    placeholder?: string
    disabled?: boolean
  }) => (
    <input
      data-testid="player-autocomplete"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  ),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseQuestion: ExtraQuestion = {
  id: 'q-1',
  quinielaId: 'quiniela-1',
  questionText: 'Who will win the Golden Boot?',
  questionType: 'player',
  status: 'unresolved',
  correctAnswer: null,
  createdBy: 'user-admin-1',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

const resolvedQuestion: ExtraQuestion = {
  ...baseQuestion,
  id: 'q-2',
  questionText: 'Which team wins the tournament?',
  questionType: 'team',
  status: 'resolved',
  correctAnswer: 'Argentina',
}

const defaultProps = {
  questions: [],
  hasCompetitionData: true,
  quinielaId: 'quiniela-1',
  lang: 'en',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks()
})

describe('AdminExtraQuestionsClient', () => {
  // -------------------------------------------------------------------------
  // Competition data banner
  // -------------------------------------------------------------------------

  it('shows competition data banner when hasCompetitionData === false', () => {
    render(<AdminExtraQuestionsClient {...defaultProps} hasCompetitionData={false} />)
    expect(
      screen.getByText(/Competition data must be loaded before creating extra questions/),
    ).toBeInTheDocument()
  })

  it('does not show create button when hasCompetitionData === false', () => {
    render(<AdminExtraQuestionsClient {...defaultProps} hasCompetitionData={false} />)
    expect(screen.queryByText('+ Create Question')).not.toBeInTheDocument()
  })

  it('does not show competition data banner when hasCompetitionData === true', () => {
    render(<AdminExtraQuestionsClient {...defaultProps} hasCompetitionData={true} />)
    expect(screen.queryByText(/Competition data must be loaded/)).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Create button and form toggle
  // -------------------------------------------------------------------------

  it('shows create button when hasCompetitionData === true', () => {
    render(<AdminExtraQuestionsClient {...defaultProps} />)
    expect(screen.getByText('+ Create Question')).toBeInTheDocument()
  })

  it('toggles create form when create button is clicked', () => {
    render(<AdminExtraQuestionsClient {...defaultProps} />)
    fireEvent.click(screen.getByText('+ Create Question'))
    expect(screen.getByText('New Question')).toBeInTheDocument()
    expect(screen.queryByText('+ Create Question')).not.toBeInTheDocument()
  })

  it('hides create form when Cancel is clicked', () => {
    render(<AdminExtraQuestionsClient {...defaultProps} />)
    fireEvent.click(screen.getByText('+ Create Question'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('New Question')).not.toBeInTheDocument()
    expect(screen.getByText('+ Create Question')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Create form submission
  // -------------------------------------------------------------------------

  it('calls createQuestion with correct args on form submit', async () => {
    ;(createQuestion as jest.Mock).mockResolvedValue({ success: true, question: baseQuestion })

    render(<AdminExtraQuestionsClient {...defaultProps} />)
    fireEvent.click(screen.getByText('+ Create Question'))

    fireEvent.change(screen.getByLabelText(/Question text/i), {
      target: { value: 'Who will win?' },
    })

    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(createQuestion).toHaveBeenCalledWith('quiniela-1', {
        questionText: 'Who will win?',
        questionType: 'team',
      })
    })
  })

  it('shows inline error when createQuestion returns INVALID_INPUT', async () => {
    ;(createQuestion as jest.Mock).mockResolvedValue({ success: false, error: 'INVALID_INPUT' })

    render(<AdminExtraQuestionsClient {...defaultProps} />)
    fireEvent.click(screen.getByText('+ Create Question'))
    fireEvent.change(screen.getByLabelText(/Question text/i), {
      target: { value: 'Some question' },
    })
    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Invalid input/)
    })
  })

  it('shows inline error when createQuestion returns NO_COMPETITION_DATA', async () => {
    ;(createQuestion as jest.Mock).mockResolvedValue({
      success: false,
      error: 'NO_COMPETITION_DATA',
    })

    render(<AdminExtraQuestionsClient {...defaultProps} />)
    fireEvent.click(screen.getByText('+ Create Question'))
    fireEvent.change(screen.getByLabelText(/Question text/i), {
      target: { value: 'Some question' },
    })
    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Competition data is not available/)
    })
  })

  // -------------------------------------------------------------------------
  // Resolve form
  // -------------------------------------------------------------------------

  it('renders unresolved question with resolve button', () => {
    render(<AdminExtraQuestionsClient {...defaultProps} questions={[baseQuestion]} />)
    expect(screen.getByText('Who will win the Golden Boot?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resolve' })).toBeInTheDocument()
  })

  it('renders resolved question with Save button and correct answer pre-filled', () => {
    render(<AdminExtraQuestionsClient {...defaultProps} questions={[resolvedQuestion]} />)
    expect(screen.getByText('Which team wins the tournament?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(screen.getByTestId('team-autocomplete')).toHaveValue('Argentina')
  })

  it('calls resolveQuestion with correct args when Resolve button clicked', async () => {
    ;(resolveQuestion as jest.Mock).mockResolvedValue({ success: true, membersRescored: 3 })

    render(<AdminExtraQuestionsClient {...defaultProps} questions={[baseQuestion]} />)

    // Type into the mocked autocomplete
    fireEvent.change(screen.getByTestId('player-autocomplete'), {
      target: { value: 'Lionel Messi' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }))

    await waitFor(() => {
      expect(resolveQuestion).toHaveBeenCalledWith('quiniela-1', 'q-1', 'Lionel Messi')
    })
  })

  it('shows inline AUDIT_FAILED error when resolveQuestion returns AUDIT_FAILED', async () => {
    ;(resolveQuestion as jest.Mock).mockResolvedValue({ success: false, error: 'AUDIT_FAILED' })

    render(<AdminExtraQuestionsClient {...defaultProps} questions={[baseQuestion]} />)

    fireEvent.change(screen.getByTestId('player-autocomplete'), {
      target: { value: 'Some Player' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Failed to write audit log/)
    })
  })

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  it('shows empty state when there are no questions', () => {
    render(<AdminExtraQuestionsClient {...defaultProps} questions={[]} />)
    expect(screen.getByText(/No extra questions yet/)).toBeInTheDocument()
  })
})
