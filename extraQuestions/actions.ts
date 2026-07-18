'use server'

import { AuthClient } from '@/auth/AuthClient'
import { ExtraQuestionsService } from '@/extraQuestions/ExtraQuestionsService'
import { ExtraQuestionsRepository } from '@/extraQuestions/ExtraQuestionsRepository'
import { MembershipsRepository } from '@/memberships/MembershipsRepository'
import { CompetitionsRepository } from '@/competitions/CompetitionsRepository'
import { UsersRepository } from '@/users/UsersRepository'
import type {
  ExtraQuestionType,
  CreateQuestionResult,
  SubmitAnswerResult,
  ResolveQuestionResult,
  ListAnswersForReviewResult,
  OverrideAnswerResult,
  UpdateQuestionDeadlineResult,
} from '@/extraQuestions/extraQuestions.types'

async function getCallerSession() {
  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null
  return session
}

function makeService(): ExtraQuestionsService {
  return new ExtraQuestionsService(
    new ExtraQuestionsRepository(),
    new MembershipsRepository(),
    new CompetitionsRepository(),
    new UsersRepository(),
  )
}

/**
 * Submit (or update) a user's answer to an extra question.
 * Requires an active session and approved membership.
 */
export async function submitAnswer(
  quinielaId: string,
  questionId: string,
  answerText: string,
): Promise<SubmitAnswerResult> {
  try {
    const session = await getCallerSession()
    if (!session) return { success: false, error: 'UNAUTHORIZED' }

    const authClient = new AuthClient()
    const writable = authClient.requireWritableSession(session)
    if (!writable.allowed) return { success: false, error: writable.error }

    const service = makeService()
    return service.submitAnswer(quinielaId, questionId, session.sub, answerText)
  } catch (err) {
    console.error('[submitAnswer action] unhandled error:', err)
    return { success: false, error: 'DB_ERROR' }
  }
}

/**
 * Create a new extra question for a quiniela.
 * Caller must be an approved admin.
 */
export async function createQuestion(
  quinielaId: string,
  input: { questionText: string; questionType: ExtraQuestionType; pointsValue: number; answerDeadline: string | null },
): Promise<CreateQuestionResult> {
  try {
    const session = await getCallerSession()
    if (!session) return { success: false, error: 'UNAUTHORIZED' }

    const authClient = new AuthClient()
    const writable = authClient.requireWritableSession(session)
    if (!writable.allowed) return { success: false, error: writable.error }

    const service = makeService()
    return service.createQuestion(
      quinielaId,
      {
        questionText: input.questionText,
        questionType: input.questionType,
        pointsValue: input.pointsValue,
        answerDeadline: input.answerDeadline ? new Date(input.answerDeadline) : null,
      },
      session.sub,
    )
  } catch (err) {
    console.error('[createQuestion action] unhandled error:', err)
    return { success: false, error: 'DB_ERROR' }
  }
}

/**
 * Resolve (or re-resolve) an extra question with a correct answer.
 * Caller must be an approved admin.
 */
export async function resolveQuestion(
  quinielaId: string,
  questionId: string,
  correctAnswer: string,
): Promise<ResolveQuestionResult> {
  try {
    const session = await getCallerSession()
    if (!session) return { success: false, error: 'UNAUTHORIZED' }

    const authClient = new AuthClient()
    const writable = authClient.requireWritableSession(session)
    if (!writable.allowed) return { success: false, error: writable.error }

    const service = makeService()
    return service.resolveQuestion(quinielaId, questionId, correctAnswer, session.sub)
  } catch (err) {
    console.error('[resolveQuestion action] unhandled error:', err)
    return { success: false, error: 'DB_ERROR' }
  }
}

/**
 * Update the answer deadline on an existing extra question.
 * Caller must be an approved admin.
 */
export async function updateQuestionDeadline(
  quinielaId: string,
  questionId: string,
  answerDeadline: string | null,
): Promise<UpdateQuestionDeadlineResult> {
  try {
    const session = await getCallerSession()
    if (!session) return { success: false, error: 'UNAUTHORIZED' }

    const authClient = new AuthClient()
    const writable = authClient.requireWritableSession(session)
    if (!writable.allowed) return { success: false, error: writable.error }

    const service = makeService()
    return service.updateQuestionDeadline(
      quinielaId,
      questionId,
      answerDeadline ? new Date(answerDeadline) : null,
      session.sub,
    )
  } catch (err) {
    console.error('[updateQuestionDeadline action] unhandled error:', err)
    return { success: false, error: 'DB_ERROR' }
  }
}

/**
 * List every member's answer to a question, merged with its scored result,
 * for admin review. Read-only — requires an active session and admin role,
 * but does not require a writable (non-impersonating) session.
 */
export async function listAnswersForReview(
  quinielaId: string,
  questionId: string,
): Promise<ListAnswersForReviewResult> {
  try {
    const session = await getCallerSession()
    if (!session) return { success: false, error: 'UNAUTHORIZED' }

    const service = makeService()
    return service.listAnswersForReview(quinielaId, questionId, session.sub)
  } catch (err) {
    console.error('[listAnswersForReview action] unhandled error:', err)
    return { success: false, error: 'DB_ERROR' }
  }
}

/**
 * Override a single member's graded result for a resolved question.
 * Caller must be an approved admin.
 */
export async function overrideAnswer(
  quinielaId: string,
  questionId: string,
  targetUserId: string,
  isCorrect: boolean,
): Promise<OverrideAnswerResult> {
  try {
    const session = await getCallerSession()
    if (!session) return { success: false, error: 'UNAUTHORIZED' }

    const authClient = new AuthClient()
    const writable = authClient.requireWritableSession(session)
    if (!writable.allowed) return { success: false, error: writable.error }

    const service = makeService()
    return service.overrideAnswer(quinielaId, questionId, targetUserId, isCorrect, session.sub)
  } catch (err) {
    console.error('[overrideAnswer action] unhandled error:', err)
    return { success: false, error: 'DB_ERROR' }
  }
}
