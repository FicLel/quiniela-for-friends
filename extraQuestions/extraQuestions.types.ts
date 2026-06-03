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
  points: 0 | 1
  scoredAt: Date
}

export type ExtraQuestionAuditEntry = {
  id: string
  questionId: string
  quinielaId: string
  changedBy: string
  previousAnswer: string | null
  newAnswer: string
  membersRescored: number
  createdAt: Date
}

// ---------------------------------------------------------------------------
// Result types (discriminated unions)
// ---------------------------------------------------------------------------

export type CreateQuestionResult =
  | { success: true; question: ExtraQuestion }
  | { success: false; error: 'UNAUTHORIZED' | 'NO_COMPETITION_DATA' | 'INVALID_INPUT' | 'DB_ERROR' }

export type SubmitAnswerResult =
  | { success: true }
  | { success: false; error: 'UNAUTHORIZED' | 'QUESTION_NOT_FOUND' | 'QUESTION_RESOLVED' | 'INVALID_INPUT' | 'DB_ERROR' }

export type ResolveQuestionResult =
  | { success: true; membersRescored: number }
  | { success: false; error: 'UNAUTHORIZED' | 'QUESTION_NOT_FOUND' | 'INVALID_INPUT' | 'AUDIT_FAILED' | 'DB_ERROR' }

export type ListQuestionsResult =
  | { success: true; questions: ExtraQuestion[]; userAnswers: Record<string, string> }
  | { success: false; error: 'UNAUTHORIZED' | 'UNKNOWN_ERROR' }

// ---------------------------------------------------------------------------
// Port interfaces
// ---------------------------------------------------------------------------

export interface IExtraQuestionsRepository {
  create(input: {
    quinielaId: string
    questionText: string
    questionType: ExtraQuestionType
    createdBy: string
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

  upsertResults(rows: Omit<ExtraQuestionResult, 'id' | 'scoredAt'>[]): Promise<void>

  insertAuditEntry(entry: Omit<ExtraQuestionAuditEntry, 'id' | 'createdAt'>): Promise<void>

  countByStatus(quinielaId: string, status: ExtraQuestionStatus): Promise<number>

  countUnansweredOpenByUser(quinielaId: string, userId: string): Promise<number>

  countAll(quinielaId: string): Promise<number>
}

export interface IExtraQuestionsService {
  listQuestions(quinielaId: string, callerUserId: string): Promise<ListQuestionsResult>

  createQuestion(
    quinielaId: string,
    input: { questionText: string; questionType: ExtraQuestionType },
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
}
