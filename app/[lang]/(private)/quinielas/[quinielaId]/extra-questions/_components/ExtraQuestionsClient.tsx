'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { submitAnswer } from '@/extraQuestions/actions'
import type { ExtraQuestion } from '@/extraQuestions/extraQuestions.types'

type UserResult = { points: number; isCorrect: boolean; isOverridden: boolean }

type ExtraQuestionsClientProps = {
  questions: ExtraQuestion[]
  userAnswers: Record<string, string>
  userResults: Record<string, UserResult>
  quinielaId: string
  lang: string
}

export default function ExtraQuestionsClient({
  questions,
  userAnswers,
  userResults,
  quinielaId,
}: ExtraQuestionsClientProps) {
  return (
    <div className="space-y-4">
      {questions.map((question) => (
        <QuestionCard
          key={question.id}
          question={question}
          userAnswer={userAnswers[question.id] ?? ''}
          userResult={userResults[question.id]}
          quinielaId={quinielaId}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// QuestionCard
// ---------------------------------------------------------------------------

type QuestionCardProps = {
  question: ExtraQuestion
  userAnswer: string
  userResult: UserResult | undefined
  quinielaId: string
}

function QuestionCard({ question, userAnswer, userResult, quinielaId }: QuestionCardProps) {
  const router = useRouter()
  const [draft, setDraft] = useState(userAnswer)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isResolved = question.status === 'resolved'
  const isPastDeadline = question.answerDeadline !== null && question.answerDeadline <= new Date()

  function handleSave() {
    setInlineError(null)
    setSaveSuccess(false)

    startTransition(async () => {
      const result = await submitAnswer(quinielaId, question.id, draft)

      if (result.success) {
        setSaveSuccess(true)
        router.refresh()
      } else if (result.error === 'QUESTION_RESOLVED') {
        setInlineError('This question has already been resolved and can no longer be answered.')
        router.refresh()
      } else if (result.error === 'DEADLINE_PASSED') {
        setInlineError('The deadline for this question has passed.')
        router.refresh()
      } else if (result.error === 'INVALID_INPUT') {
        setInlineError('Answer cannot be empty.')
      } else if (result.error === 'QUESTION_NOT_FOUND') {
        setInlineError('Question not found.')
      } else {
        setInlineError('Something went wrong. Please try again.')
      }
    })
  }

  // Points/correctness come from the persisted, admin-reviewable result — never
  // recomputed client-side from a raw string comparison.
  const earnedPoints = userResult?.points ?? 0
  const isCorrect = userResult?.isCorrect ?? false

  return (
    <div className="rounded-2xl bg-white p-6 shadow-lg">
      {/* Header row: badges */}
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

      {isResolved ? (
        /* Resolved state */
        <div className="space-y-3">
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
              Correct answer
            </p>
            <p className="text-sm font-semibold text-gray-900">{question.correctAnswer}</p>
          </div>

          {userAnswer !== '' && (
            <div className="rounded-lg bg-gray-50 px-4 py-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                Your answer
              </p>
              <p className="text-sm text-gray-700">{userAnswer}</p>
            </div>
          )}

          {userAnswer !== '' && (
            <p
              className={`text-sm font-semibold ${isCorrect ? 'text-green-700' : 'text-red-600'}`}
            >
              {isCorrect
                ? `✓ +${earnedPoints} ${earnedPoints === 1 ? 'point' : 'points'}`
                : '✗ No point'}
              {userResult?.isOverridden && (
                <span className="ml-1 font-normal text-gray-500">(reviewed by admin)</span>
              )}
            </p>
          )}

          {userAnswer === '' && (
            <p className="text-sm text-gray-400 italic">You did not submit an answer.</p>
          )}
        </div>
      ) : (
        /* Unresolved state — text input */
        <div className="space-y-3">
          <div>
            <label
              htmlFor={`answer-${question.id}`}
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Your answer
            </label>
            <input
              id={`answer-${question.id}`}
              type="text"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                setSaveSuccess(false)
                setInlineError(null)
              }}
              disabled={isPending || isPastDeadline}
              placeholder="Type your answer…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>

          {isPastDeadline && (
            <p role="status" className="text-xs font-medium text-gray-400">
              Answers closed
            </p>
          )}

          {inlineError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {inlineError}
            </p>
          )}

          {saveSuccess && (
            <p role="status" className="text-sm text-green-700">
              Answer saved.
            </p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || isPastDeadline || draft.trim() === ''}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-green-400"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )
}
