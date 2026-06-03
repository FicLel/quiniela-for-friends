'use client'

import Link from 'next/link'

type ExtraQuestionsFloatingButtonProps = {
  quinielaId: string
  lang: string
  unansweredCount: number
  totalQuestions: number
}

export default function ExtraQuestionsFloatingButton({
  quinielaId,
  lang,
  unansweredCount,
  totalQuestions,
}: ExtraQuestionsFloatingButtonProps) {
  if (totalQuestions === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-30">
      <Link
        href={`/${lang}/quinielas/${quinielaId}/extra-questions`}
        className="relative flex items-center gap-2 rounded-full bg-green-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
        aria-label={`Extra questions${unansweredCount > 0 ? `, ${unansweredCount} unanswered` : ''}`}
      >
        {/* Star icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.83-4.401z"
            clipRule="evenodd"
          />
        </svg>
        <span>Extra</span>

        {/* Badge — only rendered when unansweredCount > 0 */}
        {unansweredCount > 0 && (
          <span
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white"
            aria-hidden="true"
          >
            {unansweredCount}
          </span>
        )}
      </Link>
    </div>
  )
}
