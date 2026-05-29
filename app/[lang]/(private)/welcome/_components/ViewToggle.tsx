import Link from 'next/link'
import type { Dictionary } from '@/i18n/getDictionary'

type ViewToggleProps = {
  activeView: 'date' | 'group'
  dict: Dictionary['welcome']
}

export default function ViewToggle({ activeView, dict }: ViewToggleProps) {
  const activeClass = 'bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium'
  const inactiveClass = 'bg-gray-100 text-gray-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-200 transition'

  return (
    <div className="flex gap-2 bg-white px-4 py-3 shadow-sm">
      <Link
        href="?view=date"
        className={activeView === 'date' ? activeClass : inactiveClass}
      >
        {dict.viewByDate}
      </Link>
      <Link
        href="?view=group"
        className={activeView === 'group' ? activeClass : inactiveClass}
      >
        {dict.viewByGroup}
      </Link>
    </div>
  )
}
