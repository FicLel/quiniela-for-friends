import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { hasLocale } from '@/i18n/getDictionary'
import { AuthClient } from '@/auth/AuthClient'
import { MembershipsRepository } from '@/memberships/MembershipsRepository'
import { ExtraQuestionsService } from '@/extraQuestions/ExtraQuestionsService'
import { ExtraQuestionsRepository } from '@/extraQuestions/ExtraQuestionsRepository'
import { CompetitionsRepository } from '@/competitions/CompetitionsRepository'
import { UsersRepository } from '@/users/UsersRepository'
import type { Locale } from '@/i18n/i18n.types'
import ExtraQuestionsClient from './_components/ExtraQuestionsClient'

type PageProps = {
  params: Promise<{ lang: string; quinielaId: string }>
}

export default async function ExtraQuestionsPage({ params }: PageProps) {
  const { lang, quinielaId } = await params
  if (!hasLocale(lang)) notFound()

  const locale = lang as Locale

  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session) {
    redirect(`/${locale}/login`)
  }

  const membershipsRepo = new MembershipsRepository()
  const isMember = await membershipsRepo.isApprovedMember(quinielaId, session.sub)

  if (!isMember) {
    redirect(`/${locale}/quinielas`)
  }

  const service = new ExtraQuestionsService(
    new ExtraQuestionsRepository(),
    membershipsRepo,
    new CompetitionsRepository(),
    new UsersRepository(),
  )

  const result = await service.listQuestions(quinielaId, session.sub)

  // If the service failed (should not happen given isMember check above), redirect
  if (!result.success) {
    redirect(`/${locale}/quinielas`)
  }

  const { questions, userAnswers, userResults } = result

  return (
    <main className="min-h-screen bg-green-50 px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        {/* Back link */}
        <div className="mb-6">
          <Link
            href={`/${locale}/quinielas/${quinielaId}/leaderboard`}
            className="inline-flex items-center gap-1 text-sm text-green-700 transition hover:text-green-900"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02z"
                clipRule="evenodd"
              />
            </svg>
            Back to leaderboard
          </Link>
        </div>

        <div className="mb-6 flex items-center gap-2">
          <span className="text-2xl" role="img" aria-label="Star">
            ⭐
          </span>
          <h1 className="text-2xl font-bold text-green-900">Extra Questions</h1>
        </div>

        {questions.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-lg">
            <span className="mb-3 block text-4xl" role="img" aria-label="Question mark">
              ❓
            </span>
            <p className="text-sm text-gray-500">No extra questions have been created yet.</p>
          </div>
        ) : (
          <ExtraQuestionsClient
            questions={questions}
            userAnswers={userAnswers}
            userResults={userResults}
            quinielaId={quinielaId}
            lang={locale}
          />
        )}
      </div>
    </main>
  )
}
