'use server'

import { AuthClient } from '@/auth/AuthClient'
import { ExtraQuestionsService } from '@/extraQuestions/ExtraQuestionsService'
import { ExtraQuestionsRepository } from '@/extraQuestions/ExtraQuestionsRepository'
import { MembershipsRepository } from '@/memberships/MembershipsRepository'
import { CompetitionsRepository } from '@/competitions/CompetitionsRepository'
import type {
  ExtraQuestionType,
  CreateQuestionResult,
  SubmitAnswerResult,
  ResolveQuestionResult,
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
  input: { questionText: string; questionType: ExtraQuestionType },
): Promise<CreateQuestionResult> {
  try {
    const session = await getCallerSession()
    if (!session) return { success: false, error: 'UNAUTHORIZED' }

    const authClient = new AuthClient()
    const writable = authClient.requireWritableSession(session)
    if (!writable.allowed) return { success: false, error: writable.error }

    const service = makeService()
    return service.createQuestion(quinielaId, input, session.sub)
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
