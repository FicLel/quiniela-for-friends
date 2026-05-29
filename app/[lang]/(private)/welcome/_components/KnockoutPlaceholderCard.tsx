type KnockoutPlaceholderCardProps = {
  roundLabel: string
}

export default function KnockoutPlaceholderCard({ roundLabel }: KnockoutPlaceholderCardProps) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm sm:px-5 sm:py-4 lg:px-6 lg:py-4">
      {/* Row 1: round label */}
      <div className="mb-3 flex items-center justify-between sm:mb-4">
        <p className="text-xs font-medium text-gray-500">{roundLabel}</p>
      </div>

      {/* Row 2: home TBD | separator | away TBD */}
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        {/* Home team placeholder */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="h-14 w-14 rounded-full bg-gray-100 ring-2 ring-gray-200" aria-hidden="true" />
          <span className="text-center text-xs font-semibold text-gray-400">TBD</span>
        </div>

        {/* Separator */}
        <div className="shrink-0 text-sm font-bold text-gray-300">:</div>

        {/* Away team placeholder */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="h-14 w-14 rounded-full bg-gray-100 ring-2 ring-gray-200" aria-hidden="true" />
          <span className="text-center text-xs font-semibold text-gray-400">TBD</span>
        </div>
      </div>
    </div>
  )
}
