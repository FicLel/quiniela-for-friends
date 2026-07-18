/**
 * GET  /api/quinielas/[quinielaId]/extra-questions/[questionId]/answers
 * POST /api/quinielas/[quinielaId]/extra-questions/[questionId]/answers
 *
 * GET  — List every member's answer to the question merged with its scored
 *         result, for admin review. Requires admin role within the quiniela.
 *
 * POST — Submit or update the calling user's answer to an extra question.
 *         Requires approved membership in the quiniela.
 *         The question must exist, belong to this quiniela, be unresolved,
 *         and (if set) its answer deadline must not have passed.
 *
 * Auth: valid session required for both methods.
 *
 * GET returns:
 *   200: { success: true; rows: { userId, userEmail, answerText, submittedAt, points, isCorrect, isOverridden, overriddenBy, overriddenAt }[] }
 *   403: { success: false; error: 'UNAUTHORIZED' }
 *   404: { success: false; error: 'QUESTION_NOT_FOUND' }
 *   500: { success: false; error: 'DB_ERROR' }
 *
 * POST body: { answerText: string }
 * POST returns:
 *   200: { success: true }
 *   400: { success: false; error: 'INVALID_INPUT' }
 *   403: { success: false; error: 'UNAUTHORIZED' }
 *   404: { success: false; error: 'QUESTION_NOT_FOUND' }
 *   409: { success: false; error: 'QUESTION_RESOLVED' | 'DEADLINE_PASSED' }
 *   500: { success: false; error: 'DB_ERROR' }
 */

import { AuthClient } from '@/auth/AuthClient'
import { ExtraQuestionsService } from '@/extraQuestions/ExtraQuestionsService'
import { ExtraQuestionsRepository } from '@/extraQuestions/ExtraQuestionsRepository'
import { MembershipsRepository } from '@/memberships/MembershipsRepository'
import { CompetitionsRepository } from '@/competitions/CompetitionsRepository'
import { UsersRepository } from '@/users/UsersRepository'
import type { SubmitAnswerResult, ListAnswersForReviewResult } from '@/extraQuestions/extraQuestions.types'

function makeService(): ExtraQuestionsService {
  return new ExtraQuestionsService(
    new ExtraQuestionsRepository(),
    new MembershipsRepository(),
    new CompetitionsRepository(),
    new UsersRepository(),
  )
}

// ---------------------------------------------------------------------------
// GET /api/quinielas/[quinielaId]/extra-questions/[questionId]/answers
// ---------------------------------------------------------------------------

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ quinielaId: string; questionId: string }> },
): Promise<Response> {
  // 1. Auth check
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session) {
    const result: ListAnswersForReviewResult = { success: false, error: 'UNAUTHORIZED' }
    return Response.json(result, { status: 403 })
  }

  const { quinielaId, questionId } = await params

  // 2. Delegate to service
  const service = makeService()
  const result = await service.listAnswersForReview(quinielaId, questionId, session.sub)

  if (!result.success) {
    const status =
      result.error === 'UNAUTHORIZED' ? 403
      : result.error === 'QUESTION_NOT_FOUND' ? 404
      : 500
    return Response.json(result, { status })
  }

  return Response.json(result, { status: 200 })
}

// ---------------------------------------------------------------------------
// POST /api/quinielas/[quinielaId]/extra-questions/[questionId]/answers
// ---------------------------------------------------------------------------

export async function POST(
  request: Request,
  { params }: { params: Promise<{ quinielaId: string; questionId: string }> },
): Promise<Response> {
  // 1. Auth check
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session) {
    const result: SubmitAnswerResult = { success: false, error: 'UNAUTHORIZED' }
    return Response.json(result, { status: 403 })
  }

  const writable = authClient.requireWritableSession(session)
  if (!writable.allowed) {
    const result: SubmitAnswerResult = { success: false, error: writable.error }
    return Response.json(result, { status: 403 })
  }

  const { quinielaId, questionId } = await params

  // 2. Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    const result: SubmitAnswerResult = { success: false, error: 'INVALID_INPUT' }
    return Response.json(result, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    const result: SubmitAnswerResult = { success: false, error: 'INVALID_INPUT' }
    return Response.json(result, { status: 400 })
  }

  const { answerText } = body as Record<string, unknown>

  if (typeof answerText !== 'string') {
    const result: SubmitAnswerResult = { success: false, error: 'INVALID_INPUT' }
    return Response.json(result, { status: 400 })
  }

  // 3. Delegate to service
  const service = makeService()
  const result = await service.submitAnswer(quinielaId, questionId, session.sub, answerText)

  if (!result.success) {
    const status =
      result.error === 'UNAUTHORIZED' ? 403
      : result.error === 'QUESTION_NOT_FOUND' ? 404
      : result.error === 'QUESTION_RESOLVED' || result.error === 'DEADLINE_PASSED' ? 409
      : result.error === 'INVALID_INPUT' ? 400
      : 500
    return Response.json(result, { status })
  }

  return Response.json(result, { status: 200 })
}
