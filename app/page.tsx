import { redirect } from 'next/navigation'
import { DEFAULT_LOCALE } from '@/i18n/i18n.types'

export default function RootPage() {
  redirect(`/${DEFAULT_LOCALE}`)
}
