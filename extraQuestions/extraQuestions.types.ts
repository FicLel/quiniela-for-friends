/**
 * extraQuestions.types.ts — Domain types, DTOs, and port interfaces for the
 * extraQuestions module (admin-created open-answer questions with scoring).
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type ExtraQuestionStatus = 'unresolved' | 'resolved'
export type ExtraQuestionType = 'team' | 'player'

export type ExtraQuestion = {
  id: string
  quinielaId: string
  questionText: string
  questionType: ExtraQuestionType
  status: ExtraQuestionStatus
  correctAnswer: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
  pointsValue: number
  answerDeadline: Date | null
}

export type ExtraQuestionAnswer = {
  id: string
  questionId: string
  userId: string
  answerText: string
  submittedAt: Date
  updatedAt: Date
}

export type ExtraQuestionResult = {
  id: string
  questionId: string
  userId: string
  quinielaId: string
  points: number
  scoredAt: Date
  isCorrect: boolean
  isOverridden: boolean
  overriddenBy: string | null
  overriddenAt: Date | null
}

export type ExtraQuestionAuditEntry = {
  id: string
  questionId: string
  quinielaId: string
  changedBy: string
  previousAnswer: string | null
  newAnswer: string | null
  membersRescored: number
  createdAt: Date
  entryType: 'resolve' | 'override'
  targetUserId: string | null
  previousPoints: number | null
  newPoints: number | null
}

// ---------------------------------------------------------------------------
// Result types (discriminated unions)
// ---------------------------------------------------------------------------

export type CreateQuestionResult =
  | { success: true; question: ExtraQuestion }
  | { success: false; error: 'UNAUTHORIZED' | 'NO_COMPETITION_DATA' | 'INVALID_INPUT' | 'IMPERSONATING_READ_ONLY' | 'DB_ERROR' }

export type SubmitAnswerResult =
  | { success: true }
  | { success: false; error: 'UNAUTHORIZED' | 'QUESTION_NOT_FOUND' | 'QUESTION_RESOLVED' | 'DEADLINE_PASSED' | 'INVALID_INPUT' | 'IMPERSONATING_READ_ONLY' | 'DB_ERROR' }

export type ResolveQuestionResult =
  | { success: true; membersRescored: number }
  | { success: false; error: 'UNAUTHORIZED' | 'QUESTION_NOT_FOUND' | 'INVALID_INPUT' | 'AUDIT_FAILED' | 'IMPERSONATING_READ_ONLY' | 'DB_ERROR' }

export type UpdateQuestionDeadlineResult =
  | { success: true; question: ExtraQuestion }
  | { success: false; error: 'UNAUTHORIZED' | 'QUESTION_NOT_FOUND' | 'INVALID_INPUT' | 'IMPERSONATING_READ_ONLY' | 'DB_ERROR' }

export type ListQuestionsResult =
  | {
      success: true
      questions: ExtraQuestion[]
      userAnswers: Record<string, string>
      userResults: Record<string, { points: number; isCorrect: boolean; isOverridden: boolean }>
    }
  | { success: false; error: 'UNAUTHORIZED' | 'UNKNOWN_ERROR' }

export type ListAnswersForReviewResult =
  | {
      success: true
      rows: {
        userId: string
        userEmail: string
        answerText: string | null
        submittedAt: Date | null
        points: number
        isCorrect: boolean
        isOverridden: boolean
        overriddenBy: string | null
        overriddenAt: Date | null
      }[]
    }
  | { success: false; error: 'UNAUTHORIZED' | 'QUESTION_NOT_FOUND' | 'DB_ERROR' }

export type OverrideAnswerResult =
  | { success: true; points: number; isCorrect: boolean }
  | {
      success: false
      error:
        | 'UNAUTHORIZED'
        | 'QUESTION_NOT_FOUND'
        | 'QUESTION_NOT_RESOLVED'
        | 'ANSWER_NOT_FOUND'
        | 'AUDIT_FAILED'
        | 'IMPERSONATING_READ_ONLY'
        | 'DB_ERROR'
    }

// ---------------------------------------------------------------------------
// Port interfaces
// ---------------------------------------------------------------------------

export interface IExtraQuestionsRepository {
  create(input: {
    quinielaId: string
    questionText: string
    questionType: ExtraQuestionType
    createdBy: string
    pointsValue: number
    answerDeadline: Date | null
  }): Promise<ExtraQuestion>

  findById(questionId: string): Promise<ExtraQuestion | null>

  findAllByQuiniela(quinielaId: string): Promise<ExtraQuestion[]>

  upsertAnswer(input: {
    questionId: string
    userId: string
    answerText: string
  }): Promise<void>

  findAnswersByQuestion(questionId: string): Promise<ExtraQuestionAnswer[]>

  findAnswerByUser(questionId: string, userId: string): Promise<ExtraQuestionAnswer | null>

  findAnswersByUserForQuiniela(
    quinielaId: string,
    userId: string,
  ): Promise<{ questionId: string; answerText: string }[]>

  resolveQuestion(
    questionId: string,
    correctAnswer: string,
  ): Promise<{ previousAnswer: string | null }>

  updateQuestionDeadline(
    questionId: string,
    answerDeadline: Date | null,
  ): Promise<ExtraQuestion | null>

  upsertResults(rows: Omit<ExtraQuestionResult, 'id' | 'scoredAt'>[]): Promise<void>

  insertAuditEntry(entry: Omit<ExtraQuestionAuditEntry, 'id' | 'createdAt'>): Promise<void>

  countByStatus(quinielaId: string, status: ExtraQuestionStatus): Promise<number>

  countUnansweredOpenByUser(quinielaId: string, userId: string): Promise<number>

  countAll(quinielaId: string): Promise<number>

  findResultsByUserForQuiniela(quinielaId: string, userId: string): Promise<ExtraQuestionResult[]>

  findResultsByQuestion(questionId: string): Promise<ExtraQuestionResult[]>

  overrideResult(input: {
    questionId: string
    userId: string
    points: number
    isCorrect: boolean
    overriddenBy: string
  }): Promise<{ previousPoints: number; previousIsCorrect: boolean } | null>
}

export interface IExtraQuestionsService {
  listQuestions(quinielaId: string, callerUserId: string): Promise<ListQuestionsResult>

  createQuestion(
    quinielaId: string,
    input: { questionText: string; questionType: ExtraQuestionType; pointsValue: number; answerDeadline: Date | null },
    callerUserId: string,
  ): Promise<CreateQuestionResult>

  submitAnswer(
    quinielaId: string,
    questionId: string,
    callerUserId: string,
    answerText: string,
  ): Promise<SubmitAnswerResult>

  resolveQuestion(
    quinielaId: string,
    questionId: string,
    correctAnswer: string,
    callerUserId: string,
  ): Promise<ResolveQuestionResult>

  updateQuestionDeadline(
    quinielaId: string,
    questionId: string,
    answerDeadline: Date | null,
    callerUserId: string,
  ): Promise<UpdateQuestionDeadlineResult>

  listAnswersForReview(
    quinielaId: string,
    questionId: string,
    callerUserId: string,
  ): Promise<ListAnswersForReviewResult>

  overrideAnswer(
    quinielaId: string,
    questionId: string,
    targetUserId: string,
    isCorrect: boolean,
    callerUserId: string,
  ): Promise<OverrideAnswerResult>
}
