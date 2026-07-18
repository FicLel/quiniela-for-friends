/**
 * PATCH /api/quinielas/[quinielaId]/extra-questions/[questionId]/deadline
 *
 * Update the answer deadline on an existing extra question.
 * Requires admin role within the quiniela. Allowed regardless of question
 * status — the deadline only gates answer submission, so editing it after
 * resolution is harmless.
 *
 * Auth: valid session required.
 *
 * PATCH body: { answerDeadline: string | null }
 * PATCH returns:
 *   200: { success: true; question: ExtraQuestion }
 *   400: { success: false; error: 'INVALID_INPUT' }
 *   403: { success: false; error: 'UNAUTHORIZED' | 'IMPERSONATING_READ_ONLY' }
 *   404: { success: false; error: 'QUESTION_NOT_FOUND' }
 *   500: { success: false; error: 'DB_ERROR' }
 */

import { AuthClient } from '@/auth/AuthClient'
import { ExtraQuestionsService } from '@/extraQuestions/ExtraQuestionsService'
import { ExtraQuestionsRepository } from '@/extraQuestions/ExtraQuestionsRepository'
import { MembershipsRepository } from '@/memberships/MembershipsRepository'
import { CompetitionsRepository } from '@/competitions/CompetitionsRepository'
import { UsersRepository } from '@/users/UsersRepository'
import type { UpdateQuestionDeadlineResult } from '@/extraQuestions/extraQuestions.types'

function makeService(): ExtraQuestionsService {
  return new ExtraQuestionsService(
    new ExtraQuestionsRepository(),
    new MembershipsRepository(),
    new CompetitionsRepository(),
    new UsersRepository(),
  )
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ quinielaId: string; questionId: string }> },
): Promise<Response> {
  // 1. Auth check
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session) {
    const result: UpdateQuestionDeadlineResult = { success: false, error: 'UNAUTHORIZED' }
    return Response.json(result, { status: 403 })
  }

  const writable = authClient.requireWritableSession(session)
  if (!writable.allowed) {
    const result: UpdateQuestionDeadlineResult = { success: false, error: writable.error }
    return Response.json(result, { status: 403 })
  }

  const { quinielaId, questionId } = await params

  // 2. Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    const result: UpdateQuestionDeadlineResult = { success: false, error: 'INVALID_INPUT' }
    return Response.json(result, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    const result: UpdateQuestionDeadlineResult = { success: false, error: 'INVALID_INPUT' }
    return Response.json(result, { status: 400 })
  }

  const { answerDeadline } = body as Record<string, unknown>

  if (answerDeadline !== null && answerDeadline !== undefined && typeof answerDeadline !== 'string') {
    const result: UpdateQuestionDeadlineResult = { success: false, error: 'INVALID_INPUT' }
    return Response.json(result, { status: 400 })
  }

  const parsedDeadline = typeof answerDeadline === 'string' ? new Date(answerDeadline) : null
  if (parsedDeadline !== null && Number.isNaN(parsedDeadline.getTime())) {
    const result: UpdateQuestionDeadlineResult = { success: false, error: 'INVALID_INPUT' }
    return Response.json(result, { status: 400 })
  }

  // 3. Delegate to service
  const service = makeService()
  const result = await service.updateQuestionDeadline(quinielaId, questionId, parsedDeadline, session.sub)

  if (!result.success) {
    const status =
      result.error === 'UNAUTHORIZED' ? 403
      : result.error === 'QUESTION_NOT_FOUND' ? 404
      : result.error === 'INVALID_INPUT' ? 400
      : 500 // DB_ERROR
    return Response.json(result, { status })
  }

  return Response.json(result, { status: 200 })
}
