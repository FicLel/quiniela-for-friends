/**
 * ExtraQuestionsRepository — Infrastructure adapter for extra_questions tables.
 *
 * Implements IExtraQuestionsRepository using the Supabase JS client with the
 * service-role key (bypasses RLS). Follows the same patterns as CompetitionsRepository:
 * - Constructor validates env vars and initialises the Supabase client.
 * - Lazy verifySchema() — checks the extra_questions table exists once per instance.
 * - Snake_case ↔ camelCase mapping at the boundary.
 */

import { createClient } from '@supabase/supabase-js'
import type {
  IExtraQuestionsRepository,
  ExtraQuestion,
  ExtraQuestionAnswer,
  ExtraQuestionResult,
  ExtraQuestionAuditEntry,
  ExtraQuestionStatus,
  ExtraQuestionType,
} from '@/extraQuestions/extraQuestions.types'

export class ExtraQuestionsRepository implements IExtraQuestionsRepository {
  private readonly supabase
  /** Resolves once on the first successful schema check; rejects if the table is absent. */
  private schemaCheck: Promise<void> | null = null

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
    this.supabase = createClient(url, key)
  }

  /**
   * Lazily verifies that `public.extra_questions` exists in the database.
   * The check is performed at most once per repository instance — subsequent
   * calls reuse the cached Promise so there is no repeated round-trip.
   */
  private async verifySchema(): Promise<void> {
    if (this.schemaCheck === null) {
      this.schemaCheck = (async () => {
        const { error } = await this.supabase
          .from('extra_questions')
          .select('id')
          .limit(1)

        if (error) {
          throw new Error(
            'Supabase table "public.extra_questions" does not exist — run pending migrations before starting the application.',
          )
        }
      })()
    }
    return this.schemaCheck
  }

  /**
   * Map a raw Supabase row (snake_case) to the ExtraQuestion domain type.
   */
  private toExtraQuestion(row: Record<string, unknown>): ExtraQuestion {
    return {
      id: row.id as string,
      quinielaId: row.quiniela_id as string,
      questionText: row.question_text as string,
      questionType: row.question_type as ExtraQuestionType,
      status: row.status as ExtraQuestionStatus,
      correctAnswer: (row.correct_answer as string | null) ?? null,
      createdBy: row.created_by as string,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    }
  }

  /**
   * Map a raw Supabase row (snake_case) to the ExtraQuestionAnswer domain type.
   */
  private toExtraQuestionAnswer(row: Record<string, unknown>): ExtraQuestionAnswer {
    return {
      id: row.id as string,
      questionId: row.question_id as string,
      userId: row.user_id as string,
      answerText: row.answer_text as string,
      submittedAt: new Date(row.submitted_at as string),
      updatedAt: new Date(row.updated_at as string),
    }
  }

  /**
   * Create a new extra question.
   * Throws on Supabase error.
   */
  async create(input: {
    quinielaId: string
    questionText: string
    questionType: ExtraQuestionType
    createdBy: string
  }): Promise<ExtraQuestion> {
    await this.verifySchema()

    const { data, error } = await this.supabase
      .from('extra_questions')
      .insert({
        quiniela_id: input.quinielaId,
        question_text: input.questionText,
        question_type: input.questionType,
        created_by: input.createdBy,
      })
      .select('*')
      .single()

    if (error || !data) {
      throw new Error(`create extra_question failed: ${error?.message ?? 'no data returned'}`)
    }

    return this.toExtraQuestion(data as Record<string, unknown>)
  }

  /**
   * Find a single extra question by its primary key UUID.
   * Returns null if not found.
   */
  async findById(questionId: string): Promise<ExtraQuestion | null> {
    await this.verifySchema()

    const { data, error } = await this.supabase
      .from('extra_questions')
      .select('*')
      .eq('id', questionId)
      .single()

    if (error || !data) return null

    return this.toExtraQuestion(data as Record<string, unknown>)
  }

  /**
   * Return all questions for a quiniela ordered by created_at ASC.
   * Returns [] if none.
   */
  async findAllByQuiniela(quinielaId: string): Promise<ExtraQuestion[]> {
    await this.verifySchema()

    const { data, error } = await this.supabase
      .from('extra_questions')
      .select('*')
      .eq('quiniela_id', quinielaId)
      .order('created_at')

    if (error) {
      throw new Error(`findAllByQuiniela extra_questions failed: ${error.message}`)
    }

    if (!data || data.length === 0) return []

    return (data as Record<string, unknown>[]).map((row) => this.toExtraQuestion(row))
  }

  /**
   * Upsert an answer for a user on a question.
   * Uses onConflict on (question_id, user_id) — updates submitted_at and updated_at on conflict.
   * Throws on Supabase error.
   */
  async upsertAnswer(input: {
    questionId: string
    userId: string
    answerText: string
  }): Promise<void> {
    await this.verifySchema()

    const now = new Date().toISOString()

    const { error } = await this.supabase
      .from('extra_question_answers')
      .upsert(
        {
          question_id: input.questionId,
          user_id: input.userId,
          answer_text: input.answerText,
          submitted_at: now,
          updated_at: now,
        },
        { onConflict: 'question_id,user_id' },
      )

    if (error) {
      throw new Error(`upsertAnswer extra_question_answers failed: ${error.message}`)
    }
  }

  /**
   * Return all answers for a given question.
   * Returns [] if none.
   */
  async findAnswersByQuestion(questionId: string): Promise<ExtraQuestionAnswer[]> {
    await this.verifySchema()

    const { data, error } = await this.supabase
      .from('extra_question_answers')
      .select('*')
      .eq('question_id', questionId)

    if (error) {
      throw new Error(`findAnswersByQuestion failed: ${error.message}`)
    }

    if (!data || data.length === 0) return []

    return (data as Record<string, unknown>[]).map((row) => this.toExtraQuestionAnswer(row))
  }

  /**
   * Return a single answer for a user on a question, or null if none exists.
   */
  async findAnswerByUser(
    questionId: string,
    userId: string,
  ): Promise<ExtraQuestionAnswer | null> {
    await this.verifySchema()

    const { data, error } = await this.supabase
      .from('extra_question_answers')
      .select('*')
      .eq('question_id', questionId)
      .eq('user_id', userId)
      .single()

    if (error || !data) return null

    return this.toExtraQuestionAnswer(data as Record<string, unknown>)
  }

  /**
   * Return all answers by a user for questions in the given quiniela.
   * Two-step approach (safer than PostgREST join):
   *   1. Fetch all question IDs for the quiniela.
   *   2. Fetch answers by user in those question IDs.
   * Returns [] if the quiniela has no questions or user has no answers.
   */
  async findAnswersByUserForQuiniela(
    quinielaId: string,
    userId: string,
  ): Promise<{ questionId: string; answerText: string }[]> {
    await this.verifySchema()

    // Step 1: Fetch all question IDs for the quiniela
    const { data: questionRows, error: questionsError } = await this.supabase
      .from('extra_questions')
      .select('id')
      .eq('quiniela_id', quinielaId)

    if (questionsError) {
      throw new Error(`findAnswersByUserForQuiniela questions fetch failed: ${questionsError.message}`)
    }

    if (!questionRows || questionRows.length === 0) return []

    const questionIds = (questionRows as { id: string }[]).map((r) => r.id)

    // Step 2: Fetch answers by userId for those question IDs
    const { data: answerRows, error: answersError } = await this.supabase
      .from('extra_question_answers')
      .select('question_id, answer_text')
      .eq('user_id', userId)
      .in('question_id', questionIds)

    if (answersError) {
      throw new Error(`findAnswersByUserForQuiniela answers fetch failed: ${answersError.message}`)
    }

    if (!answerRows || answerRows.length === 0) return []

    return (answerRows as { question_id: string; answer_text: string }[]).map((r) => ({
      questionId: r.question_id,
      answerText: r.answer_text,
    }))
  }

  /**
   * Mark a question as resolved and set its correct_answer.
   * First reads the existing correct_answer to return as previousAnswer.
   * Returns { previousAnswer }.
   * Throws on Supabase error.
   */
  async resolveQuestion(
    questionId: string,
    correctAnswer: string,
  ): Promise<{ previousAnswer: string | null }> {
    await this.verifySchema()

    // Step 1: Read existing correct_answer
    const { data: existing, error: readError } = await this.supabase
      .from('extra_questions')
      .select('correct_answer')
      .eq('id', questionId)
      .single()

    if (readError || !existing) {
      throw new Error(`resolveQuestion read failed: ${readError?.message ?? 'not found'}`)
    }

    const previousAnswer = ((existing as Record<string, unknown>).correct_answer as string | null) ?? null

    // Step 2: Update status and correct_answer
    const { error: updateError } = await this.supabase
      .from('extra_questions')
      .update({
        status: 'resolved',
        correct_answer: correctAnswer,
        updated_at: new Date().toISOString(),
      })
      .eq('id', questionId)

    if (updateError) {
      throw new Error(`resolveQuestion update failed: ${updateError.message}`)
    }

    return { previousAnswer }
  }

  /**
   * Upsert result rows keyed on (question_id, user_id).
   * No-op when rows is empty.
   * Throws on Supabase error.
   */
  async upsertResults(rows: Omit<ExtraQuestionResult, 'id' | 'scoredAt'>[]): Promise<void> {
    if (rows.length === 0) return

    await this.verifySchema()

    const dbRows = rows.map((r) => ({
      question_id: r.questionId,
      user_id: r.userId,
      quiniela_id: r.quinielaId,
      points: r.points,
    }))

    const { error } = await this.supabase
      .from('extra_question_results')
      .upsert(dbRows, { onConflict: 'question_id,user_id' })

    if (error) {
      throw new Error(`upsertResults extra_question_results failed: ${error.message}`)
    }
  }

  /**
   * Insert an audit log entry.
   * Throws on Supabase error.
   */
  async insertAuditEntry(
    entry: Omit<ExtraQuestionAuditEntry, 'id' | 'createdAt'>,
  ): Promise<void> {
    await this.verifySchema()

    const { error } = await this.supabase.from('extra_question_audit_log').insert({
      question_id: entry.questionId,
      quiniela_id: entry.quinielaId,
      changed_by: entry.changedBy,
      previous_answer: entry.previousAnswer ?? null,
      new_answer: entry.newAnswer,
      members_rescored: entry.membersRescored,
    })

    if (error) {
      throw new Error(`insertAuditEntry failed: ${error.message}`)
    }
  }

  /**
   * Count questions for a quiniela filtered by status.
   * Throws on Supabase error.
   */
  async countByStatus(quinielaId: string, status: ExtraQuestionStatus): Promise<number> {
    await this.verifySchema()

    const { count, error } = await this.supabase
      .from('extra_questions')
      .select('id', { count: 'exact', head: true })
      .eq('quiniela_id', quinielaId)
      .eq('status', status)

    if (error) throw new Error(`countByStatus failed: ${error.message}`)
    return count ?? 0
  }

  /**
   * Count unresolved questions that the user has NOT yet answered for the quiniela.
   * = (count of unresolved questions) - (count of answers the user submitted for those questions)
   */
  async countUnansweredOpenByUser(quinielaId: string, userId: string): Promise<number> {
    await this.verifySchema()

    // Step 1: Count unresolved questions for quiniela
    const { count: unresolvedCount, error: countError } = await this.supabase
      .from('extra_questions')
      .select('id', { count: 'exact', head: true })
      .eq('quiniela_id', quinielaId)
      .eq('status', 'unresolved')

    if (countError) throw new Error(`countUnansweredOpenByUser count failed: ${countError.message}`)
    const totalUnresolved = unresolvedCount ?? 0

    if (totalUnresolved === 0) return 0

    // Step 2: Fetch question IDs for unresolved questions
    const { data: questionRows, error: questionsError } = await this.supabase
      .from('extra_questions')
      .select('id')
      .eq('quiniela_id', quinielaId)
      .eq('status', 'unresolved')

    if (questionsError) throw new Error(`countUnansweredOpenByUser questions fetch failed: ${questionsError.message}`)

    const questionIds = (questionRows ?? []).map((r: Record<string, unknown>) => r.id as string)

    // Step 3: Count user's answers for those question IDs
    const { count: answeredCount, error: answersError } = await this.supabase
      .from('extra_question_answers')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('question_id', questionIds)

    if (answersError) throw new Error(`countUnansweredOpenByUser answers count failed: ${answersError.message}`)

    return totalUnresolved - (answeredCount ?? 0)
  }

  /**
   * Count all questions for the quiniela regardless of status.
   * Throws on Supabase error.
   */
  async countAll(quinielaId: string): Promise<number> {
    await this.verifySchema()

    const { count, error } = await this.supabase
      .from('extra_questions')
      .select('id', { count: 'exact', head: true })
      .eq('quiniela_id', quinielaId)

    if (error) throw new Error(`countAll failed: ${error.message}`)
    return count ?? 0
  }
}
