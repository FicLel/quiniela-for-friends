'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createQuestion, resolveQuestion } from '@/extraQuestions/actions'
import type { ExtraQuestion, ExtraQuestionType } from '@/extraQuestions/extraQuestions.types'
import TeamAutocomplete from './TeamAutocomplete'
import PlayerAutocomplete from './PlayerAutocomplete'

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
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (questionText.trim().length === 0) {
      setError('Question text is required.')
      return
    }

    startTransition(async () => {
      try {
        const result = await createQuestion(quinielaId, { questionText: questionText.trim(), questionType })

        if (result.success) {
          router.refresh()
          onSuccess()
        } else if (result.error === 'NO_COMPETITION_DATA') {
          setError('Competition data is not available. Cannot create question.')
        } else if (result.error === 'INVALID_INPUT') {
          setError('Invalid input. Please check the question text.')
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

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending || questionText.trim().length === 0}
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
    </div>
  )
}
