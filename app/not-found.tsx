import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { AuthClient } from '@/auth/AuthClient'
import { DEFAULT_LOCALE } from '@/i18n/i18n.types'

export default async function NotFound() {
  const headersList = await headers()
  const locale = headersList.get('x-locale') ?? DEFAULT_LOCALE

  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  redirect(session ? `/${locale}/welcome` : `/${locale}/login`)
}
