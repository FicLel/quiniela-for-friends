import { redirect, notFound } from 'next/navigation'
import { getDictionary, hasLocale } from '@/i18n/getDictionary'
import { AuthClient } from '@/auth/AuthClient'
import { QuinielasService } from '@/quinielas/QuinielasService'
import { QuinielasRepository } from '@/quinielas/QuinielasRepository'
import type { Locale } from '@/i18n/i18n.types'
import { listUsers, approveMember } from './actions'
import UsersClient from './_components/UsersClient'

type PageProps = { params: Promise<{ lang: string }> }

export default async function DashboardPage({ params }: PageProps) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)
  const locale = lang as Locale

  // Auth gate: must be admin
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session) {
    redirect(`/${locale}/login`)
  }

  if (session.role !== 'admin') {
    redirect(`/${locale}/welcome`)
  }

  // Fetch first page with default sort
  const defaultSort = { column: 'email' as const, direction: 'asc' as const }
  const usersResult = await listUsers(locale, {}, 1, defaultSort)
  const initialUsers = usersResult.ok ? usersResult.users : []
  const initialTotal = usersResult.ok ? usersResult.total : 0

  // Fetch quinielas for the filter dropdown (admin's own quinielas)
  const quinielasService = new QuinielasService(new QuinielasRepository())
  const quinielasResult = await quinielasService.listQuinielasForUser(session.sub)
  const quinielas = quinielasResult.success ? quinielasResult.quinielas : []

  // Bind actions so lang is pre-filled
  const boundListUsers = listUsers.bind(null, locale)
  const boundApproveMember = approveMember.bind(null, locale)

  return (
    <main className="min-h-screen w-full bg-white">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-2xl font-bold text-green-900">{dict.users.heading}</h1>
      </div>
      <UsersClient
        initialUsers={initialUsers}
        initialTotal={initialTotal}
        quinielas={quinielas}
        lang={locale}
        dict={dict.users}
        listUsersAction={boundListUsers}
        approveAction={boundApproveMember}
      />
    </main>
  )
}
