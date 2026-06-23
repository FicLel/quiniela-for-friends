'use client'

import type { Dictionary } from '@/i18n/getDictionary'

type ScrollToLastFinishedButtonProps = {
  visible: boolean
  onClick: () => void
  dict: Dictionary['welcome']
}

export default function ScrollToLastFinishedButton({
  visible,
  onClick,
  dict,
}: ScrollToLastFinishedButtonProps) {
  if (!visible) return null

  return (
    <div className="fixed bottom-6 right-6 z-30">
      <button
        type="button"
        onClick={onClick}
        aria-label={dict.scrollToLastFinishedLabel}
        className="flex items-center justify-center rounded-full bg-green-700 p-3 text-white shadow-lg transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
      >
        {/* Down-chevron icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  )
}
