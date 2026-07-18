/**
 * POST /api/quinielas/[quinielaId]/extra-questions/[questionId]/override
 *
 * Override a single member's graded result for a resolved extra question.
 * Requires admin role within the quiniela. The question must already be
 * resolved (overrides only correct an existing baseline auto-grade) and the
 * target user must already have a scored result row.
 * Writes an audit log entry (entryType: 'override'); failure there aborts
 * the whole operation with AUDIT_FAILED.
 *
 * Auth: valid session required.
 *
 * POST body: { targetUserId: string; isCorrect: boolean }
 * POST returns:
 *   200: { success: true; points: number; isCorrect: boolean }
 *   400: { success: false; error: 'INVALID_INPUT' }
 *   403: { success: false; error: 'UNAUTHORIZED' | 'IMPERSONATING_READ_ONLY' }
 *   404: { success: false; error: 'QUESTION_NOT_FOUND' | 'ANSWER_NOT_FOUND' }
 *   409: { success: false; error: 'QUESTION_NOT_RESOLVED' }
 *   500: { success: false; error: 'AUDIT_FAILED' | 'DB_ERROR' }
 */

import { AuthClient } from '@/auth/AuthClient'
import { ExtraQuestionsService } from '@/extraQuestions/ExtraQuestionsService'
import { ExtraQuestionsRepository } from '@/extraQuestions/ExtraQuestionsRepository'
import { MembershipsRepository } from '@/memberships/MembershipsRepository'
import { CompetitionsRepository } from '@/competitions/CompetitionsRepository'
import { UsersRepository } from '@/users/UsersRepository'
import type { OverrideAnswerResult } from '@/extraQuestions/extraQuestions.types'

function makeService(): ExtraQuestionsService {
  return new ExtraQuestionsService(
    new ExtraQuestionsRepository(),
    new MembershipsRepository(),
    new CompetitionsRepository(),
    new UsersRepository(),
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
    const result: OverrideAnswerResult = { success: false, error: 'UNAUTHORIZED' }
    return Response.json(result, { status: 403 })
  }

  const writable = authClient.requireWritableSession(session)
  if (!writable.allowed) {
    const result: OverrideAnswerResult = { success: false, error: writable.error }
    return Response.json(result, { status: 403 })
  }

  const { quinielaId, questionId } = await params

  // 2. Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ success: false, error: 'INVALID_INPUT' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return Response.json({ success: false, error: 'INVALID_INPUT' }, { status: 400 })
  }

  const { targetUserId, isCorrect } = body as Record<string, unknown>

  if (typeof targetUserId !== 'string' || typeof isCorrect !== 'boolean') {
    return Response.json({ success: false, error: 'INVALID_INPUT' }, { status: 400 })
  }

  // 3. Delegate to service
  const service = makeService()
  const result = await service.overrideAnswer(quinielaId, questionId, targetUserId, isCorrect, session.sub)

  if (!result.success) {
    const status =
      result.error === 'UNAUTHORIZED' ? 403
      : result.error === 'QUESTION_NOT_FOUND' || result.error === 'ANSWER_NOT_FOUND' ? 404
      : result.error === 'QUESTION_NOT_RESOLVED' ? 409
      : 500 // AUDIT_FAILED and DB_ERROR
    return Response.json(result, { status })
  }

  return Response.json(result, { status: 200 })
}
