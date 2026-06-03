/**
 * ExtraQuestionsService — Application-layer service for extra questions management.
 *
 * Contains all business rules for listing, creating, answering, and resolving
 * extra questions within a quiniela.
 *
 * Rules:
 * - Never imports from @supabase/supabase-js or fetch directly.
 * - Never imports from Next.js (no next/navigation, next/headers, etc.).
 * - All I/O goes through the injected repositories.
 */

import type {
  IExtraQuestionsRepository,
  IExtraQuestionsService,
  ExtraQuestionType,
  CreateQuestionResult,
  SubmitAnswerResult,
  ResolveQuestionResult,
  ListQuestionsResult,
} from '@/extraQuestions/extraQuestions.types'
import type { IMembershipsRepository } from '@/memberships/memberships.types'
import type { ICompetitionsRepository } from '@/competitions/competitions.types'

export class ExtraQuestionsService implements IExtraQuestionsService {
  constructor(
    private readonly repo: IExtraQuestionsRepository,
    private readonly membershipsRepo: IMembershipsRepository,
    private readonly competitionsRepo: ICompetitionsRepository,
  ) {}

  /**
   * List all questions for a quiniela along with the calling user's answers.
   * Caller must be an approved member of the quiniela.
   */
  async listQuestions(quinielaId: string, callerUserId: string): Promise<ListQuestionsResult> {
    try {
      const isApproved = await this.membershipsRepo.isApprovedMember(quinielaId, callerUserId)
      if (!isApproved) {
        return { success: false, error: 'UNAUTHORIZED' }
      }

      const questions = await this.repo.findAllByQuiniela(quinielaId)
      const answers = await this.repo.findAnswersByUserForQuiniela(quinielaId, callerUserId)

      const userAnswers: Record<string, string> = Object.fromEntries(
        answers.map((a) => [a.questionId, a.answerText]),
      )

      return { success: true, questions, userAnswers }
    } catch (err) {
      console.error('[ExtraQuestionsService] listQuestions failed:', err)
      return { success: false, error: 'UNKNOWN_ERROR' }
    }
  }

  /**
   * Create a new extra question for a quiniela.
   * Caller must be an approved admin of the quiniela.
   * The quiniela must have competition data (at least one match).
   */
  async createQuestion(
    quinielaId: string,
    input: { questionText: string; questionType: ExtraQuestionType },
    callerUserId: string,
  ): Promise<CreateQuestionResult> {
    try {
      // Step 1: Admin check
      const membership = await this.membershipsRepo.findByQuinielaAndUser(quinielaId, callerUserId)
      if (!membership || membership.role !== 'admin' || membership.approvedAt === null) {
        return { success: false, error: 'UNAUTHORIZED' }
      }

      // Step 2: Validate input
      if (input.questionText.trim().length < 1) {
        return { success: false, error: 'INVALID_INPUT' }
      }

      // Step 3: Verify competition data exists
      const hasMatches = await this.competitionsRepo.hasAnyMatches()
      if (!hasMatches) {
        return { success: false, error: 'NO_COMPETITION_DATA' }
      }

      // Step 4: Create the question
      const question = await this.repo.create({
        quinielaId,
        questionText: input.questionText.trim(),
        questionType: input.questionType,
        createdBy: callerUserId,
      })

      return { success: true, question }
    } catch (err) {
      console.error('[ExtraQuestionsService] createQuestion failed:', err)
      return { success: false, error: 'DB_ERROR' }
    }
  }

  /**
   * Submit (or update) a user's answer to an open question.
   * Caller must be an approved member of the quiniela.
   * The question must exist, belong to the quiniela, and not be resolved.
   */
  async submitAnswer(
    quinielaId: string,
    questionId: string,
    callerUserId: string,
    answerText: string,
  ): Promise<SubmitAnswerResult> {
    try {
      // Step 1: Membership check
      const isApproved = await this.membershipsRepo.isApprovedMember(quinielaId, callerUserId)
      if (!isApproved) {
        return { success: false, error: 'UNAUTHORIZED' }
      }

      // Step 2: Validate answer text
      if (answerText.trim().length < 1) {
        return { success: false, error: 'INVALID_INPUT' }
      }

      // Step 3: Check question exists and belongs to this quiniela
      const question = await this.repo.findById(questionId)
      if (!question || question.quinielaId !== quinielaId) {
        return { success: false, error: 'QUESTION_NOT_FOUND' }
      }

      // Step 4: Check question is still open
      if (question.status === 'resolved') {
        return { success: false, error: 'QUESTION_RESOLVED' }
      }

      // Step 5: Upsert the answer
      await this.repo.upsertAnswer({
        questionId,
        userId: callerUserId,
        answerText: answerText.trim(),
      })

      return { success: true }
    } catch (err) {
      console.error('[ExtraQuestionsService] submitAnswer failed:', err)
      return { success: false, error: 'DB_ERROR' }
    }
  }

  /**
   * Resolve a question (or re-resolve with a new answer) and score all existing answers.
   * Caller must be an approved admin of the quiniela.
   * Scoring is case-insensitive: answered text compared to correct answer.
   * An audit log entry is written; if it fails the entire operation returns AUDIT_FAILED.
   */
  async resolveQuestion(
    quinielaId: string,
    questionId: string,
    correctAnswer: string,
    callerUserId: string,
  ): Promise<ResolveQuestionResult> {
    try {
      // Step 1: Admin check
      const membership = await this.membershipsRepo.findByQuinielaAndUser(quinielaId, callerUserId)
      if (!membership || membership.role !== 'admin' || membership.approvedAt === null) {
        return { success: false, error: 'UNAUTHORIZED' }
      }

      // Step 2: Validate correct answer
      if (correctAnswer.trim().length < 1) {
        return { success: false, error: 'INVALID_INPUT' }
      }

      // Step 3: Check question exists and belongs to quiniela
      const question = await this.repo.findById(questionId)
      if (!question || question.quinielaId !== quinielaId) {
        return { success: false, error: 'QUESTION_NOT_FOUND' }
      }

      // Step 4: Resolve the question and capture previous answer
      const { previousAnswer } = await this.repo.resolveQuestion(questionId, correctAnswer.trim())

      // Step 5: Fetch all answers for scoring
      const answers = await this.repo.findAnswersByQuestion(questionId)

      // Step 6: Compute result rows (case-insensitive comparison)
      const trimmedCorrect = correctAnswer.trim().toLowerCase()
      const resultRows = answers.map((a) => ({
        questionId,
        userId: a.userId,
        quinielaId,
        points: (a.answerText.toLowerCase() === trimmedCorrect ? 1 : 0) as 0 | 1,
      }))

      // Step 7: Upsert results
      await this.repo.upsertResults(resultRows)

      // Step 8: Write audit entry (failure here aborts with AUDIT_FAILED)
      try {
        await this.repo.insertAuditEntry({
          questionId,
          quinielaId,
          changedBy: callerUserId,
          previousAnswer,
          newAnswer: correctAnswer.trim(),
          membersRescored: answers.length,
        })
      } catch (auditError) {
        console.error('insertAuditEntry failed:', auditError)
        return { success: false, error: 'AUDIT_FAILED' }
      }

      return { success: true, membersRescored: answers.length }
    } catch (err) {
      // If already returned AUDIT_FAILED above, this won't be reached
      // Catch-all for unexpected DB errors in steps 1-7
      console.error('[ExtraQuestionsService] resolveQuestion failed:', err)
      return { success: false, error: 'DB_ERROR' }
    }
  }
}
