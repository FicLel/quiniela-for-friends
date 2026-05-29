import type { Dictionary } from '@/i18n/getDictionary'

type Props = { dict: Dictionary['welcome'] }

export default function EmptyState({ dict }: Props) {
  return (
    <div className="rounded-2xl border border-green-200 bg-white p-10 text-center shadow-sm">
      <p className="text-lg font-semibold text-green-900">{dict.emptyHeading}</p>
      <p className="mt-2 text-sm text-green-700">{dict.emptySubtitle}</p>
    </div>
  )
}
