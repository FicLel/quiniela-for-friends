/**
 * POST /api/quinielas/[quinielaId]/extra-questions/[questionId]/resolve
 *
 * Resolve (or re-resolve) an extra question with a correct answer.
 * Requires admin role within the quiniela.
 * Scores all existing member answers and writes an audit log entry.
 *
 * Auth: valid session required.
 *
 * POST body: { correctAnswer: string }
 * POST returns:
 *   200: { success: true; membersRescored: number }
 *   400: { success: false; error: 'INVALID_INPUT' }
 *   403: { success: false; error: 'UNAUTHORIZED' }
 *   404: { success: false; error: 'QUESTION_NOT_FOUND' }
 *   500: { success: false; error: 'DB_ERROR' | 'AUDIT_FAILED' }
 */

import { AuthClient } from '@/auth/AuthClient'
import { ExtraQuestionsService } from '@/extraQuestions/ExtraQuestionsService'
import { ExtraQuestionsRepository } from '@/extraQuestions/ExtraQuestionsRepository'
import { MembershipsRepository } from '@/memberships/MembershipsRepository'
import { CompetitionsRepository } from '@/competitions/CompetitionsRepository'
import type { ResolveQuestionResult } from '@/extraQuestions/extraQuestions.types'

function makeService(): ExtraQuestionsService {
  return new ExtraQuestionsService(
    new ExtraQuestionsRepository(),
    new MembershipsRepository(),
    new CompetitionsRepository(),
  )
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ quinielaId: string; questionId: string }> },
): Promise<Response> {
  // 1. Auth check
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session) {
    const result: ResolveQuestionResult = { success: false, error: 'UNAUTHORIZED' }
    return Response.json(result, { status: 403 })
  }

  const writable = authClient.requireWritableSession(session)
  if (!writable.allowed) {
    const result: ResolveQuestionResult = { success: false, error: writable.error }
    return Response.json(result, { status: 403 })
  }

  const { quinielaId, questionId } = await params

  // 2. Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    const result: ResolveQuestionResult = { success: false, error: 'INVALID_INPUT' }
    return Response.json(result, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    const result: ResolveQuestionResult = { success: false, error: 'INVALID_INPUT' }
    return Response.json(result, { status: 400 })
  }

  const { correctAnswer } = body as Record<string, unknown>

  if (typeof correctAnswer !== 'string') {
    const result: ResolveQuestionResult = { success: false, error: 'INVALID_INPUT' }
    return Response.json(result, { status: 400 })
  }

  // 3. Delegate to service
  const service = makeService()
  const result = await service.resolveQuestion(quinielaId, questionId, correctAnswer, session.sub)

  if (!result.success) {
    const status =
      result.error === 'UNAUTHORIZED' ? 403
      : result.error === 'QUESTION_NOT_FOUND' ? 404
      : result.error === 'INVALID_INPUT' ? 400
      : 500 // DB_ERROR and AUDIT_FAILED
    return Response.json(result, { status })
  }

  return Response.json(result, { status: 200 })
}
