/**
 * GET  /api/quinielas/[quinielaId]/extra-questions
 * POST /api/quinielas/[quinielaId]/extra-questions
 *
 * GET  — List all questions for the quiniela along with the caller's answers.
 *         Requires approved membership.
 *
 * POST — Create a new extra question.
 *         Requires admin role within the quiniela.
 *
 * Auth: valid session required for both methods.
 *
 * GET returns:
 *   200: { success: true; questions: ExtraQuestion[]; userAnswers: Record<string, string> }
 *   403: { success: false; error: 'UNAUTHORIZED' }
 *   500: { success: false; error: 'UNKNOWN_ERROR' }
 *
 * POST body: { questionText: string; questionType: 'team' | 'player' }
 * POST returns:
 *   201: { success: true; question: ExtraQuestion }
 *   400: { success: false; error: 'INVALID_INPUT' | 'NO_COMPETITION_DATA' }
 *   403: { success: false; error: 'UNAUTHORIZED' }
 *   500: { success: false; error: 'DB_ERROR' }
 */

import { AuthClient } from '@/auth/AuthClient'
import { ExtraQuestionsService } from '@/extraQuestions/ExtraQuestionsService'
import { ExtraQuestionsRepository } from '@/extraQuestions/ExtraQuestionsRepository'
import { MembershipsRepository } from '@/memberships/MembershipsRepository'
import { CompetitionsRepository } from '@/competitions/CompetitionsRepository'
import type { ExtraQuestionType, ListQuestionsResult, CreateQuestionResult } from '@/extraQuestions/extraQuestions.types'

function makeService(): ExtraQuestionsService {
  return new ExtraQuestionsService(
    new ExtraQuestionsRepository(),
    new MembershipsRepository(),
    new CompetitionsRepository(),
  )
}

function isValidQuestionType(value: unknown): value is ExtraQuestionType {
  return value === 'team' || value === 'player'
}

// ---------------------------------------------------------------------------
// GET /api/quinielas/[quinielaId]/extra-questions
// ---------------------------------------------------------------------------

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ quinielaId: string }> },
): Promise<Response> {
  // 1. Auth check
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session) {
    const result: ListQuestionsResult = { success: false, error: 'UNAUTHORIZED' }
    return Response.json(result, { status: 403 })
  }

  const { quinielaId } = await params

  // 2. Delegate to service
  const service = makeService()
  const result = await service.listQuestions(quinielaId, session.sub)

  if (!result.success) {
    const status = result.error === 'UNAUTHORIZED' ? 403 : 500
    return Response.json(result, { status })
  }

  return Response.json(result, { status: 200 })
}

// ---------------------------------------------------------------------------
// POST /api/quinielas/[quinielaId]/extra-questions
// ---------------------------------------------------------------------------

export async function POST(
  request: Request,
  { params }: { params: Promise<{ quinielaId: string }> },
): Promise<Response> {
  // 1. Auth check
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session) {
    const result: CreateQuestionResult = { success: false, error: 'UNAUTHORIZED' }
    return Response.json(result, { status: 403 })
  }

  const { quinielaId } = await params

  // 2. Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    const result: CreateQuestionResult = { success: false, error: 'INVALID_INPUT' }
    return Response.json(result, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    const result: CreateQuestionResult = { success: false, error: 'INVALID_INPUT' }
    return Response.json(result, { status: 400 })
  }

  const { questionText, questionType } = body as Record<string, unknown>

  if (typeof questionText !== 'string' || !isValidQuestionType(questionType)) {
    const result: CreateQuestionResult = { success: false, error: 'INVALID_INPUT' }
    return Response.json(result, { status: 400 })
  }

  // 3. Delegate to service
  const service = makeService()
  const result = await service.createQuestion(quinielaId, { questionText, questionType }, session.sub)

  if (!result.success) {
    const status =
      result.error === 'UNAUTHORIZED' ? 403
      : result.error === 'INVALID_INPUT' || result.error === 'NO_COMPETITION_DATA' ? 400
      : 500
    return Response.json(result, { status })
  }

  return Response.json(result, { status: 201 })
}
