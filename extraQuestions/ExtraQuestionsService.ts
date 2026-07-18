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
  ListAnswersForReviewResult,
  OverrideAnswerResult,
  UpdateQuestionDeadlineResult,
} from '@/extraQuestions/extraQuestions.types'
import type { IMembershipsRepository } from '@/memberships/memberships.types'
import type { ICompetitionsRepository } from '@/competitions/competitions.types'
import type { IUsersRepository } from '@/users/users.types'

export class ExtraQuestionsService implements IExtraQuestionsService {
  constructor(
    private readonly repo: IExtraQuestionsRepository,
    private readonly membershipsRepo: IMembershipsRepository,
    private readonly competitionsRepo: ICompetitionsRepository,
    private readonly usersRepo: IUsersRepository,
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
      const results = await this.repo.findResultsByUserForQuiniela(quinielaId, callerUserId)

      const userAnswers: Record<string, string> = Object.fromEntries(
        answers.map((a) => [a.questionId, a.answerText]),
      )

      const userResults: Record<string, { points: number; isCorrect: boolean; isOverridden: boolean }> =
        Object.fromEntries(
          results.map((r) => [
            r.questionId,
            { points: r.points, isCorrect: r.isCorrect, isOverridden: r.isOverridden },
          ]),
        )

      return { success: true, questions, userAnswers, userResults }
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
    input: { questionText: string; questionType: ExtraQuestionType; pointsValue: number; answerDeadline: Date | null },
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

      if (!Number.isInteger(input.pointsValue) || input.pointsValue < 1) {
        return { success: false, error: 'INVALID_INPUT' }
      }

      if (input.answerDeadline !== null && input.answerDeadline <= new Date()) {
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
        pointsValue: input.pointsValue,
        answerDeadline: input.answerDeadline,
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

      // Step 4b: Check the answer deadline has not passed
      if (question.answerDeadline !== null && question.answerDeadline <= new Date()) {
        return { success: false, error: 'DEADLINE_PASSED' }
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

      // Step 6: Compute result rows (case-insensitive comparison).
      // Re-resolving always wipes prior manual overrides and re-grades everyone
      // from scratch — this is a bulk overwrite, not a merge.
      const trimmedCorrect = correctAnswer.trim().toLowerCase()
      const resultRows = answers.map((a) => {
        const isCorrect = a.answerText.toLowerCase() === trimmedCorrect
        return {
          questionId,
          userId: a.userId,
          quinielaId,
          points: isCorrect ? question.pointsValue : 0,
          isCorrect,
          isOverridden: false,
          overriddenBy: null,
          overriddenAt: null,
        }
      })

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
          entryType: 'resolve',
          targetUserId: null,
          previousPoints: null,
          newPoints: null,
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

  /**
   * Update the answer deadline on an existing question.
   * Caller must be an approved admin of the quiniela. Allowed regardless of
   * question status — the deadline only gates answer submission, so editing
   * it after resolution is harmless.
   */
  async updateQuestionDeadline(
    quinielaId: string,
    questionId: string,
    answerDeadline: Date | null,
    callerUserId: string,
  ): Promise<UpdateQuestionDeadlineResult> {
    try {
      // Step 1: Admin check
      const membership = await this.membershipsRepo.findByQuinielaAndUser(quinielaId, callerUserId)
      if (!membership || membership.role !== 'admin' || membership.approvedAt === null) {
        return { success: false, error: 'UNAUTHORIZED' }
      }

      // Step 2: Validate — same future-date rule as createQuestion
      if (answerDeadline !== null && answerDeadline <= new Date()) {
        return { success: false, error: 'INVALID_INPUT' }
      }

      // Step 3: Check question exists and belongs to quiniela
      const question = await this.repo.findById(questionId)
      if (!question || question.quinielaId !== quinielaId) {
        return { success: false, error: 'QUESTION_NOT_FOUND' }
      }

      // Step 4: Update
      const updated = await this.repo.updateQuestionDeadline(questionId, answerDeadline)
      if (!updated) {
        return { success: false, error: 'QUESTION_NOT_FOUND' }
      }

      return { success: true, question: updated }
    } catch (err) {
      console.error('[ExtraQuestionsService] updateQuestionDeadline failed:', err)
      return { success: false, error: 'DB_ERROR' }
    }
  }

  /**
   * List every member's answer to a question, merged with its scored result
   * (if any) and the member's email, for admin review.
   * Caller must be an approved admin of the quiniela.
   */
  async listAnswersForReview(
    quinielaId: string,
    questionId: string,
    callerUserId: string,
  ): Promise<ListAnswersForReviewResult> {
    try {
      // Step 1: Admin check
      const membership = await this.membershipsRepo.findByQuinielaAndUser(quinielaId, callerUserId)
      if (!membership || membership.role !== 'admin' || membership.approvedAt === null) {
        return { success: false, error: 'UNAUTHORIZED' }
      }

      // Step 2: Check question exists and belongs to quiniela
      const question = await this.repo.findById(questionId)
      if (!question || question.quinielaId !== quinielaId) {
        return { success: false, error: 'QUESTION_NOT_FOUND' }
      }

      // Step 3: Fetch answers, results, and the answering users' emails
      const answers = await this.repo.findAnswersByQuestion(questionId)
      const results = await this.repo.findResultsByQuestion(questionId)
      const userIds = [...new Set(answers.map((a) => a.userId))]
      const users = await this.usersRepo.findByIds(userIds)

      // Step 4: Merge in-memory — answers are the base list
      const resultByUserId = new Map(results.map((r) => [r.userId, r]))
      const emailByUserId = new Map(users.map((u) => [u.id, u.email]))

      const rows = answers.map((a) => {
        const result = resultByUserId.get(a.userId)
        return {
          userId: a.userId,
          userEmail: emailByUserId.get(a.userId) ?? '',
          answerText: a.answerText,
          submittedAt: a.submittedAt,
          points: result?.points ?? 0,
          isCorrect: result?.isCorrect ?? false,
          isOverridden: result?.isOverridden ?? false,
          overriddenBy: result?.overriddenBy ?? null,
          overriddenAt: result?.overriddenAt ?? null,
        }
      })

      return { success: true, rows }
    } catch (err) {
      console.error('[ExtraQuestionsService] listAnswersForReview failed:', err)
      return { success: false, error: 'DB_ERROR' }
    }
  }

  /**
   * Override a single member's graded result for a resolved question.
   * Caller must be an approved admin of the quiniela. The question must
   * already be resolved (overrides only correct a baseline auto-grade), and
   * the target user must already have a result row (i.e. was auto-graded).
   * Writes an audit log entry; failure there aborts with AUDIT_FAILED.
   */
  async overrideAnswer(
    quinielaId: string,
    questionId: string,
    targetUserId: string,
    isCorrect: boolean,
    callerUserId: string,
  ): Promise<OverrideAnswerResult> {
    try {
      // Step 1: Admin check
      const membership = await this.membershipsRepo.findByQuinielaAndUser(quinielaId, callerUserId)
      if (!membership || membership.role !== 'admin' || membership.approvedAt === null) {
        return { success: false, error: 'UNAUTHORIZED' }
      }

      // Step 2: Check question exists and belongs to quiniela
      const question = await this.repo.findById(questionId)
      if (!question || question.quinielaId !== quinielaId) {
        return { success: false, error: 'QUESTION_NOT_FOUND' }
      }

      // Step 3: Overrides are only allowed after a baseline auto-grade exists
      if (question.status !== 'resolved') {
        return { success: false, error: 'QUESTION_NOT_RESOLVED' }
      }

      // Step 4: Compute points from the question's configured value
      const points = isCorrect ? question.pointsValue : 0

      // Step 5: Apply the override
      const prev = await this.repo.overrideResult({
        questionId,
        userId: targetUserId,
        points,
        isCorrect,
        overriddenBy: callerUserId,
      })

      if (prev === null) {
        return { success: false, error: 'ANSWER_NOT_FOUND' }
      }

      // Step 6: Write audit entry (failure here aborts with AUDIT_FAILED)
      try {
        await this.repo.insertAuditEntry({
          questionId,
          quinielaId,
          changedBy: callerUserId,
          previousAnswer: null,
          newAnswer: null,
          membersRescored: 1,
          entryType: 'override',
          targetUserId,
          previousPoints: prev.previousPoints,
          newPoints: points,
        })
      } catch (auditError) {
        console.error('insertAuditEntry failed:', auditError)
        return { success: false, error: 'AUDIT_FAILED' }
      }

      return { success: true, points, isCorrect }
    } catch (err) {
      console.error('[ExtraQuestionsService] overrideAnswer failed:', err)
      return { success: false, error: 'DB_ERROR' }
    }
  }
}
