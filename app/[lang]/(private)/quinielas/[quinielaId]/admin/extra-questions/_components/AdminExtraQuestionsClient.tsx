'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createQuestion,
  resolveQuestion,
  listAnswersForReview,
  overrideAnswer,
  updateQuestionDeadline,
} from '@/extraQuestions/actions'
import type {
  ExtraQuestion,
  ExtraQuestionType,
  ListAnswersForReviewResult,
} from '@/extraQuestions/extraQuestions.types'
import TeamAutocomplete from './TeamAutocomplete'
import PlayerAutocomplete from './PlayerAutocomplete'

type ReviewRow = Extract<ListAnswersForReviewResult, { success: true }>['rows'][number]

type AdminExtraQuestionsClientProps = {
  questions: ExtraQuestion[]
  hasCompetitionData: boolean
  quinielaId: string
  lang: string
}

export default function AdminExtraQuestionsClient({
  questions,
  hasCompetitionData,
  quinielaId,
}: AdminExtraQuestionsClientProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)

  return (
    <div className="space-y-6">
      {/* No competition data banner */}
      {!hasCompetitionData && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-5 py-4"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm text-yellow-800">
            Competition data must be loaded before creating extra questions. Import match data first.
          </p>
        </div>
      )}

      {/* Create question button — only when competition data exists */}
      {hasCompetitionData && (
        <div>
          {!showCreateForm ? (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              + Create Question
            </button>
          ) : (
            <CreateQuestionForm
              quinielaId={quinielaId}
              onSuccess={() => setShowCreateForm(false)}
              onCancel={() => setShowCreateForm(false)}
            />
          )}
        </div>
      )}

      {/* Questions list */}
      {questions.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-lg">
          <span className="mb-3 block text-4xl" role="img" aria-label="Question mark">
            ❓
          </span>
          <p className="text-sm text-gray-500">No extra questions yet. Create the first one!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((question) => (
            <AdminQuestionCard key={question.id} question={question} quinielaId={quinielaId} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CreateQuestionForm
// ---------------------------------------------------------------------------

type CreateQuestionFormProps = {
  quinielaId: string
  onSuccess: () => void
  onCancel: () => void
}

function CreateQuestionForm({ quinielaId, onSuccess, onCancel }: CreateQuestionFormProps) {
  const router = useRouter()
  const [questionText, setQuestionText] = useState('')
  const [questionType, setQuestionType] = useState<ExtraQuestionType>('team')
  const [pointsValue, setPointsValue] = useState('1')
  const [answerDeadline, setAnswerDeadline] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const parsedPointsValue = Number.parseInt(pointsValue, 10)
  const isPointsValueValid = Number.isInteger(parsedPointsValue) && parsedPointsValue >= 1

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (questionText.trim().length === 0) {
      setError('Question text is required.')
      return
    }

    if (!isPointsValueValid) {
      setError('Points value must be a whole number of at least 1.')
      return
    }

    startTransition(async () => {
      try {
        const result = await createQuestion(quinielaId, {
          questionText: questionText.trim(),
          questionType,
          pointsValue: parsedPointsValue,
          answerDeadline: answerDeadline ? new Date(answerDeadline).toISOString() : null,
        })

        if (result.success) {
          router.refresh()
          onSuccess()
        } else if (result.error === 'NO_COMPETITION_DATA') {
          setError('Competition data is not available. Cannot create question.')
        } else if (result.error === 'INVALID_INPUT') {
          setError('Invalid input. Please check the question text, points value, or deadline.')
        } else {
          setError('Something went wrong. Please try again.')
        }
      } catch {
        setError('Something went wrong. Please try again.')
      }
    })
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-lg">
      <h2 className="mb-4 text-lg font-semibold text-green-900">New Question</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="question-text" className="mb-1.5 block text-sm font-medium text-gray-700">
            Question text <span className="text-red-500">*</span>
          </label>
          <textarea
            id="question-text"
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            disabled={isPending}
            maxLength={500}
            rows={3}
            placeholder="e.g. Who will win the Golden Boot?"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200 disabled:bg-gray-50 disabled:text-gray-400"
          />
          <p className="mt-0.5 text-right text-xs text-gray-400">{questionText.length}/500</p>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-gray-700">Question type</legend>
          <div className="flex gap-6">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="questionType"
                value="team"
                checked={questionType === 'team'}
                onChange={() => setQuestionType('team')}
                disabled={isPending}
                className="h-4 w-4 accent-green-700"
              />
              <span className="text-sm text-gray-800">Team</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="questionType"
                value="player"
                checked={questionType === 'player'}
                onChange={() => setQuestionType('player')}
                disabled={isPending}
                className="h-4 w-4 accent-green-700"
              />
              <span className="text-sm text-gray-800">Player</span>
            </label>
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-4">
          <div>
            <label
              htmlFor="points-value"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Points value
            </label>
            <input
              id="points-value"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={pointsValue}
              onChange={(e) => setPointsValue(e.target.value)}
              disabled={isPending}
              className="w-24 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>

          <div>
            <label
              htmlFor="answer-deadline"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Answer deadline <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              id="answer-deadline"
              type="datetime-local"
              value={answerDeadline}
              onChange={(e) => setAnswerDeadline(e.target.value)}
              disabled={isPending}
              className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending || questionText.trim().length === 0 || !isPointsValueValid}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-green-400"
          >
            {isPending ? 'Creating…' : 'Create'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AdminQuestionCard
// ---------------------------------------------------------------------------

/** Formats a Date as the `YYYY-MM-DDTHH:mm` value a datetime-local input expects. */
function toDatetimeLocalValue(date: Date | null): string {
  if (date === null) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

type AdminQuestionCardProps = {
  question: ExtraQuestion
  quinielaId: string
}

function AdminQuestionCard({ question, quinielaId }: AdminQuestionCardProps) {
  const router = useRouter()
  const [correctAnswer, setCorrectAnswer] = useState(question.correctAnswer ?? '')
  const [error, setError] = useState<string | null>(null)
  const [resolveSuccess, setResolveSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [isEditingDeadline, setIsEditingDeadline] = useState(false)
  const [deadlineInput, setDeadlineInput] = useState(() => toDatetimeLocalValue(question.answerDeadline))
  const [deadlineError, setDeadlineError] = useState<string | null>(null)
  const [isDeadlinePending, startDeadlineTransition] = useTransition()

  function handleEditDeadline() {
    setDeadlineError(null)
    setDeadlineInput(toDatetimeLocalValue(question.answerDeadline))
    setIsEditingDeadline(true)
  }

  function handleCancelDeadline() {
    setDeadlineError(null)
    setIsEditingDeadline(false)
  }

  function handleSaveDeadline() {
    setDeadlineError(null)

    startDeadlineTransition(async () => {
      try {
        const result = await updateQuestionDeadline(
          quinielaId,
          question.id,
          deadlineInput ? new Date(deadlineInput).toISOString() : null,
        )

        if (result.success) {
          router.refresh()
          setIsEditingDeadline(false)
        } else if (result.error === 'INVALID_INPUT') {
          setDeadlineError('Deadline must be in the future.')
        } else if (result.error === 'QUESTION_NOT_FOUND') {
          setDeadlineError('Question not found.')
        } else {
          setDeadlineError('Something went wrong. Please try again.')
        }
      } catch {
        setDeadlineError('Something went wrong. Please try again.')
      }
    })
  }

  const [showReview, setShowReview] = useState(false)
  const [reviewRows, setReviewRows] = useState<ReviewRow[] | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [isReviewLoading, startReviewTransition] = useTransition()
  const [pendingOverrideUserId, setPendingOverrideUserId] = useState<string | null>(null)
  const [isOverridePending, startOverrideTransition] = useTransition()

  const isResolved = question.status === 'resolved'

  function handleResolve() {
    setError(null)
    setResolveSuccess(false)

    startTransition(async () => {
      try {
        const result = await resolveQuestion(quinielaId, question.id, correctAnswer)

        if (result.success) {
          setResolveSuccess(true)
          router.refresh()
        } else if (result.error === 'AUDIT_FAILED') {
          setError('Failed to write audit log. Please try again.')
        } else if (result.error === 'INVALID_INPUT') {
          setError('Please enter a valid answer.')
        } else if (result.error === 'QUESTION_NOT_FOUND') {
          setError('Question not found.')
        } else {
          setError('Something went wrong. Please try again.')
        }
      } catch {
        setError('Something went wrong. Please try again.')
      }
    })
  }

  function loadReview() {
    setReviewError(null)
    startReviewTransition(async () => {
      const result = await listAnswersForReview(quinielaId, question.id)

      if (result.success) {
        setReviewRows(result.rows)
      } else {
        setReviewError('Failed to load answers. Please try again.')
      }
    })
  }

  function handleToggleReview() {
    if (!showReview && reviewRows === null) {
      loadReview()
    }
    setShowReview((prev) => !prev)
  }

  function handleOverride(targetUserId: string, markCorrect: boolean) {
    setReviewError(null)
    setPendingOverrideUserId(targetUserId)

    startOverrideTransition(async () => {
      const result = await overrideAnswer(quinielaId, question.id, targetUserId, markCorrect)

      if (result.success) {
        setReviewRows((prev) =>
          prev === null
            ? prev
            : prev.map((row) =>
                row.userId === targetUserId
                  ? { ...row, points: result.points, isCorrect: result.isCorrect, isOverridden: true }
                  : row,
              ),
        )
        router.refresh()
      } else if (result.error === 'IMPERSONATING_READ_ONLY') {
        setReviewError('Cannot override answers while impersonating in read-only mode.')
      } else if (result.error === 'QUESTION_NOT_RESOLVED') {
        setReviewError('Question must be resolved before overriding answers.')
      } else if (result.error === 'ANSWER_NOT_FOUND') {
        setReviewError('No answer found for this member.')
      } else if (result.error === 'AUDIT_FAILED') {
        setReviewError('Failed to write audit log. Please try again.')
      } else {
        setReviewError('Something went wrong. Please try again.')
      }

      setPendingOverrideUserId(null)
    })
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-lg">
      {/* Header row */}
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            question.questionType === 'team'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-purple-100 text-purple-800'
          }`}
        >
          {question.questionType === 'team' ? 'Team' : 'Player'}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            isResolved ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-800'
          }`}
        >
          {isResolved ? 'Resolved' : 'Open'}
        </span>
      </div>

      {/* Question text */}
      <p className="mb-4 text-sm font-medium text-gray-900">{question.questionText}</p>

      {/* Deadline row */}
      <div className="mb-4 rounded-lg bg-gray-50 px-3 py-2.5">
        {!isEditingDeadline ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-gray-700">
              Deadline:{' '}
              <span className="font-medium text-gray-900">
                {question.answerDeadline ? question.answerDeadline.toLocaleString() : 'No deadline set'}
              </span>
            </span>
            <button
              type="button"
              onClick={handleEditDeadline}
              className="text-sm font-semibold text-green-700 transition hover:text-green-900"
            >
              Edit
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <label
              htmlFor={`deadline-${question.id}`}
              className="block text-sm font-medium text-gray-700"
            >
              Answer deadline <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              id={`deadline-${question.id}`}
              type="datetime-local"
              value={deadlineInput}
              onChange={(e) => setDeadlineInput(e.target.value)}
              disabled={isDeadlinePending}
              className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200 disabled:bg-gray-50 disabled:text-gray-400"
            />
            {deadlineError && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {deadlineError}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSaveDeadline}
                disabled={isDeadlinePending}
                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-green-400"
              >
                {isDeadlinePending ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handleCancelDeadline}
                disabled={isDeadlinePending}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Resolve / update answer section */}
      <div className="space-y-3">
        <div>
          <label
            htmlFor={`correct-answer-${question.id}`}
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            {isResolved ? 'Update correct answer' : 'Set correct answer'}
          </label>
          {question.questionType === 'team' ? (
            <TeamAutocomplete
              quinielaId={quinielaId}
              value={correctAnswer}
              onChange={setCorrectAnswer}
              disabled={isPending}
              placeholder="Search for a team…"
            />
          ) : (
            <PlayerAutocomplete
              quinielaId={quinielaId}
              value={correctAnswer}
              onChange={setCorrectAnswer}
              disabled={isPending}
              placeholder="Search for a player…"
            />
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {resolveSuccess && (
          <p role="status" className="text-sm text-green-700">
            {isResolved ? 'Answer updated.' : 'Question resolved.'}
          </p>
        )}

        <button
          type="button"
          onClick={handleResolve}
          disabled={isPending || correctAnswer.trim() === ''}
          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-green-400"
        >
          {isPending ? 'Saving…' : isResolved ? 'Save' : 'Resolve'}
        </button>
      </div>

      {/* Review answers section — only once the question is resolved */}
      {isResolved && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={handleToggleReview}
            className="text-sm font-semibold text-green-700 transition hover:text-green-900"
          >
            {showReview ? 'Hide answers' : 'Review answers'}
          </button>

          {showReview && (
            <div className="mt-3 space-y-2">
              {isReviewLoading && reviewRows === null && (
                <p className="text-sm text-gray-400">Loading answers…</p>
              )}

              {reviewError && (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {reviewError}
                </p>
              )}

              {reviewRows !== null && reviewRows.length === 0 && (
                <p className="text-sm text-gray-400">No members have answered yet.</p>
              )}

              {reviewRows !== null &&
                reviewRows.map((row) => {
                  const isRowPending = isOverridePending && pendingOverrideUserId === row.userId
                  return (
                    <div
                      key={row.userId}
                      className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2"
                    >
                      <span className="text-sm font-medium text-gray-900">{row.userEmail}</span>
                      <span className="text-sm text-gray-600">{row.answerText ?? 'No answer'}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {row.isCorrect ? '✓' : '✗'}
                      </span>
                      {row.isOverridden && (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                          (overridden)
                        </span>
                      )}
                      <div className="ml-auto flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleOverride(row.userId, true)}
                          disabled={isRowPending}
                          className="rounded-lg border border-green-200 px-2.5 py-1 text-xs font-semibold text-green-700 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Mark correct
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOverride(row.userId, false)}
                          disabled={isRowPending}
                          className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Mark incorrect
                        </button>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
