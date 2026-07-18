/**
 * Unit tests for ExtraQuestionsService.
 *
 * All four port interfaces (IExtraQuestionsRepository, IMembershipsRepository,
 * ICompetitionsRepository, IUsersRepository) are mocked at the boundary — no
 * real DB queries made. Tests cover business logic only: branching, error
 * mapping, and happy paths.
 */

import { ExtraQuestionsService } from '../ExtraQuestionsService'
import type {
  IExtraQuestionsRepository,
  ExtraQuestion,
  ExtraQuestionAnswer,
  ExtraQuestionResult,
} from '../extraQuestions.types'
import type { IMembershipsRepository, Membership } from '@/memberships/memberships.types'
import type { ICompetitionsRepository } from '@/competitions/competitions.types'
import type { IUsersRepository, User } from '@/users/users.types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQuestion(overrides: Partial<ExtraQuestion> = {}): ExtraQuestion {
  return {
    id: 'question-uuid',
    quinielaId: 'quiniela-uuid',
    questionText: 'Who will win the Golden Boot?',
    questionType: 'player',
    status: 'unresolved',
    correctAnswer: null,
    createdBy: 'admin-user-uuid',
    createdAt: new Date('2026-06-01T00:00:00Z'),
    updatedAt: new Date('2026-06-01T00:00:00Z'),
    pointsValue: 1,
    answerDeadline: null,
    ...overrides,
  }
}

function makeAnswer(overrides: Partial<ExtraQuestionAnswer> = {}): ExtraQuestionAnswer {
  return {
    id: 'answer-uuid',
    questionId: 'question-uuid',
    userId: 'member-user-uuid',
    answerText: 'France',
    submittedAt: new Date('2026-06-01T01:00:00Z'),
    updatedAt: new Date('2026-06-01T01:00:00Z'),
    ...overrides,
  }
}

function makeResult(overrides: Partial<ExtraQuestionResult> = {}): ExtraQuestionResult {
  return {
    id: 'result-uuid',
    questionId: 'question-uuid',
    userId: 'member-user-uuid',
    quinielaId: 'quiniela-uuid',
    points: 1,
    scoredAt: new Date('2026-06-02T00:00:00Z'),
    isCorrect: true,
    isOverridden: false,
    overriddenBy: null,
    overriddenAt: null,
    ...overrides,
  }
}

function makeAdminMembership(overrides: Partial<Membership> = {}): Membership {
  return {
    id: 'membership-uuid',
    quinielaId: 'quiniela-uuid',
    userId: 'admin-user-uuid',
    role: 'admin',
    joinedAt: new Date('2026-01-01T00:00:00Z'),
    approvedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'member-user-uuid',
    email: 'member@example.com',
    passwordHash: 'hash',
    role: 'player',
    mustChangePassword: false,
    tokenVersion: 1,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

function makeExtraQuestionsRepo(
  overrides: Partial<Record<keyof IExtraQuestionsRepository, jest.Mock>> = {},
): IExtraQuestionsRepository {
  return {
    create: jest.fn().mockResolvedValue(makeQuestion()),
    findById: jest.fn().mockResolvedValue(makeQuestion()),
    findAllByQuiniela: jest.fn().mockResolvedValue([makeQuestion()]),
    upsertAnswer: jest.fn().mockResolvedValue(undefined),
    findAnswersByQuestion: jest.fn().mockResolvedValue([makeAnswer()]),
    findAnswerByUser: jest.fn().mockResolvedValue(makeAnswer()),
    findAnswersByUserForQuiniela: jest.fn().mockResolvedValue([]),
    resolveQuestion: jest.fn().mockResolvedValue({ previousAnswer: null }),
    updateQuestionDeadline: jest.fn().mockResolvedValue(makeQuestion()),
    upsertResults: jest.fn().mockResolvedValue(undefined),
    insertAuditEntry: jest.fn().mockResolvedValue(undefined),
    countByStatus: jest.fn().mockResolvedValue(0),
    countUnansweredOpenByUser: jest.fn().mockResolvedValue(0),
    countAll: jest.fn().mockResolvedValue(0),
    findResultsByUserForQuiniela: jest.fn().mockResolvedValue([]),
    findResultsByQuestion: jest.fn().mockResolvedValue([]),
    overrideResult: jest.fn().mockResolvedValue({ previousPoints: 0, previousIsCorrect: false }),
    ...overrides,
  } as unknown as IExtraQuestionsRepository
}

function makeMembershipsRepo(
  overrides: Partial<Record<keyof IMembershipsRepository, jest.Mock>> = {},
): IMembershipsRepository {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()),
    findAllByQuiniela: jest.fn(),
    deleteById: jest.fn(),
    countAdmins: jest.fn(),
    approve: jest.fn(),
    isMember: jest.fn().mockResolvedValue(false),
    isApprovedMember: jest.fn().mockResolvedValue(true),
    countByUser: jest.fn(),
    ...overrides,
  } as unknown as IMembershipsRepository
}

function makeCompetitionsRepo(
  overrides: Partial<Record<keyof ICompetitionsRepository, jest.Mock>> = {},
): ICompetitionsRepository {
  return {
    upsertMatches: jest.fn(),
    findAllGroupStageMatches: jest.fn(),
    findAllMatches: jest.fn(),
    upsertKnockoutPlaceholders: jest.fn(),
    updateKnockoutTeams: jest.fn(),
    findById: jest.fn(),
    updateRegulationResults: jest.fn(),
    findKickoffAt: jest.fn(),
    hasAnyMatches: jest.fn().mockResolvedValue(true),
    findDistinctTeams: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as ICompetitionsRepository
}

function makeUsersRepo(
  overrides: Partial<Record<keyof IUsersRepository, jest.Mock>> = {},
): IUsersRepository {
  return {
    findById: jest.fn(),
    findByIds: jest.fn().mockResolvedValue([makeUser()]),
    findByEmail: jest.fn(),
    setMustChangePassword: jest.fn(),
    setPasswordHash: jest.fn(),
    incrementTokenVersion: jest.fn(),
    create: jest.fn(),
    hasAnyUser: jest.fn(),
    listAll: jest.fn(),
    findByIdWithMemberships: jest.fn(),
    ...overrides,
  } as unknown as IUsersRepository
}

function makeService(
  repoOverrides: Partial<Record<keyof IExtraQuestionsRepository, jest.Mock>> = {},
  membershipsOverrides: Partial<Record<keyof IMembershipsRepository, jest.Mock>> = {},
  competitionsOverrides: Partial<Record<keyof ICompetitionsRepository, jest.Mock>> = {},
  usersOverrides: Partial<Record<keyof IUsersRepository, jest.Mock>> = {},
): ExtraQuestionsService {
  return new ExtraQuestionsService(
    makeExtraQuestionsRepo(repoOverrides),
    makeMembershipsRepo(membershipsOverrides),
    makeCompetitionsRepo(competitionsOverrides),
    makeUsersRepo(usersOverrides),
  )
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// listQuestions
// ---------------------------------------------------------------------------

describe('ExtraQuestionsService.listQuestions', () => {
  it('returns { success: true, questions, userAnswers, userResults } for an approved member', async () => {
    const question = makeQuestion()
    const service = makeService(
      {
        findAllByQuiniela: jest.fn().mockResolvedValue([question]),
        findAnswersByUserForQuiniela: jest.fn().mockResolvedValue([
          { questionId: question.id, answerText: 'Brazil' },
        ]),
        findResultsByUserForQuiniela: jest.fn().mockResolvedValue([
          makeResult({ questionId: question.id, points: 1, isCorrect: true, isOverridden: false }),
        ]),
      },
      { isApprovedMember: jest.fn().mockResolvedValue(true) },
    )

    const result = await service.listQuestions('quiniela-uuid', 'user-uuid')

    expect(result).toEqual({
      success: true,
      questions: [question],
      userAnswers: { [question.id]: 'Brazil' },
      userResults: { [question.id]: { points: 1, isCorrect: true, isOverridden: false } },
    })
  })

  it('returns an empty userResults object when the caller has no scored results yet', async () => {
    const service = makeService(
      { findResultsByUserForQuiniela: jest.fn().mockResolvedValue([]) },
      { isApprovedMember: jest.fn().mockResolvedValue(true) },
    )

    const result = await service.listQuestions('quiniela-uuid', 'user-uuid')

    expect(result).toEqual(
      expect.objectContaining({ success: true, userResults: {} }),
    )
  })

  it('returns UNAUTHORIZED when caller is not an approved member', async () => {
    const service = makeService(
      {},
      { isApprovedMember: jest.fn().mockResolvedValue(false) },
    )

    const result = await service.listQuestions('quiniela-uuid', 'non-member')

    expect(result).toEqual({ success: false, error: 'UNAUTHORIZED' })
  })

  it('returns UNKNOWN_ERROR when repository throws', async () => {
    const service = makeService(
      { findAllByQuiniela: jest.fn().mockRejectedValue(new Error('DB failure')) },
      { isApprovedMember: jest.fn().mockResolvedValue(true) },
    )

    const result = await service.listQuestions('quiniela-uuid', 'user-uuid')

    expect(result).toEqual({ success: false, error: 'UNKNOWN_ERROR' })
  })
})

// ---------------------------------------------------------------------------
// createQuestion — success paths
// ---------------------------------------------------------------------------

describe('ExtraQuestionsService.createQuestion – success', () => {
  it('creates a question when caller is admin with competition data', async () => {
    const question = makeQuestion()
    const createMock = jest.fn().mockResolvedValue(question)
    const service = makeService(
      { create: createMock },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
      { hasAnyMatches: jest.fn().mockResolvedValue(true) },
    )

    const result = await service.createQuestion(
      'quiniela-uuid',
      { questionText: 'Who wins Golden Boot?', questionType: 'player', pointsValue: 1, answerDeadline: null },
      'admin-user-uuid',
    )

    expect(result).toEqual({ success: true, question })
    expect(createMock).toHaveBeenCalledWith({
      quinielaId: 'quiniela-uuid',
      questionText: 'Who wins Golden Boot?',
      questionType: 'player',
      createdBy: 'admin-user-uuid',
      pointsValue: 1,
      answerDeadline: null,
    })
  })

  it('trims whitespace from questionText before creating', async () => {
    const createMock = jest.fn().mockResolvedValue(makeQuestion())
    const service = makeService({ create: createMock })

    await service.createQuestion(
      'quiniela-uuid',
      { questionText: '  Which team wins the final?  ', questionType: 'team', pointsValue: 1, answerDeadline: null },
      'admin-user-uuid',
    )

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ questionText: 'Which team wins the final?' }),
    )
  })

  it('passes a custom pointsValue and a future answerDeadline through to repo.create', async () => {
    const createMock = jest.fn().mockResolvedValue(makeQuestion({ pointsValue: 3 }))
    const service = makeService({ create: createMock })
    const futureDeadline = new Date(Date.now() + 60_000)

    const result = await service.createQuestion(
      'quiniela-uuid',
      { questionText: 'Who scores first?', questionType: 'player', pointsValue: 3, answerDeadline: futureDeadline },
      'admin-user-uuid',
    )

    expect(result.success).toBe(true)
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ pointsValue: 3, answerDeadline: futureDeadline }),
    )
  })
})

// ---------------------------------------------------------------------------
// createQuestion — failure paths
// ---------------------------------------------------------------------------

describe('ExtraQuestionsService.createQuestion – failures', () => {
  it('returns UNAUTHORIZED when caller has no membership', async () => {
    const service = makeService(
      {},
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(null) },
    )

    const result = await service.createQuestion(
      'quiniela-uuid',
      { questionText: 'Some question', questionType: 'team', pointsValue: 1, answerDeadline: null },
      'non-member',
    )

    expect(result).toEqual({ success: false, error: 'UNAUTHORIZED' })
  })

  it('returns UNAUTHORIZED when caller is a member but not admin', async () => {
    const service = makeService(
      {},
      {
        findByQuinielaAndUser: jest.fn().mockResolvedValue(
          makeAdminMembership({ role: 'member' }),
        ),
      },
    )

    const result = await service.createQuestion(
      'quiniela-uuid',
      { questionText: 'Some question', questionType: 'team', pointsValue: 1, answerDeadline: null },
      'member-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'UNAUTHORIZED' })
  })

  it('returns UNAUTHORIZED when admin has approvedAt === null', async () => {
    const service = makeService(
      {},
      {
        findByQuinielaAndUser: jest.fn().mockResolvedValue(
          makeAdminMembership({ approvedAt: null }),
        ),
      },
    )

    const result = await service.createQuestion(
      'quiniela-uuid',
      { questionText: 'Some question', questionType: 'team', pointsValue: 1, answerDeadline: null },
      'admin-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'UNAUTHORIZED' })
  })

  it('returns INVALID_INPUT when questionText is empty', async () => {
    const service = makeService()

    const result = await service.createQuestion(
      'quiniela-uuid',
      { questionText: '   ', questionType: 'team', pointsValue: 1, answerDeadline: null },
      'admin-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'INVALID_INPUT' })
  })

  it('returns INVALID_INPUT when pointsValue is zero', async () => {
    const service = makeService()

    const result = await service.createQuestion(
      'quiniela-uuid',
      { questionText: 'Valid question', questionType: 'team', pointsValue: 0, answerDeadline: null },
      'admin-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'INVALID_INPUT' })
  })

  it('returns INVALID_INPUT when pointsValue is negative', async () => {
    const service = makeService()

    const result = await service.createQuestion(
      'quiniela-uuid',
      { questionText: 'Valid question', questionType: 'team', pointsValue: -1, answerDeadline: null },
      'admin-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'INVALID_INPUT' })
  })

  it('returns INVALID_INPUT when pointsValue is not an integer', async () => {
    const service = makeService()

    const result = await service.createQuestion(
      'quiniela-uuid',
      { questionText: 'Valid question', questionType: 'team', pointsValue: 1.5, answerDeadline: null },
      'admin-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'INVALID_INPUT' })
  })

  it('returns INVALID_INPUT when answerDeadline is in the past', async () => {
    const service = makeService()
    const pastDeadline = new Date(Date.now() - 60_000)

    const result = await service.createQuestion(
      'quiniela-uuid',
      { questionText: 'Valid question', questionType: 'team', pointsValue: 1, answerDeadline: pastDeadline },
      'admin-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'INVALID_INPUT' })
  })

  it('returns NO_COMPETITION_DATA when hasAnyMatches returns false', async () => {
    const service = makeService(
      {},
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
      { hasAnyMatches: jest.fn().mockResolvedValue(false) },
    )

    const result = await service.createQuestion(
      'quiniela-uuid',
      { questionText: 'Valid question', questionType: 'team', pointsValue: 1, answerDeadline: null },
      'admin-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'NO_COMPETITION_DATA' })
  })

  it('returns DB_ERROR when repo.create throws', async () => {
    const service = makeService(
      { create: jest.fn().mockRejectedValue(new Error('DB error')) },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
      { hasAnyMatches: jest.fn().mockResolvedValue(true) },
    )

    const result = await service.createQuestion(
      'quiniela-uuid',
      { questionText: 'Valid question', questionType: 'team', pointsValue: 1, answerDeadline: null },
      'admin-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'DB_ERROR' })
  })
})

// ---------------------------------------------------------------------------
// submitAnswer — success paths
// ---------------------------------------------------------------------------

describe('ExtraQuestionsService.submitAnswer – success', () => {
  it('returns { success: true } when member answers an unresolved question', async () => {
    const upsertMock = jest.fn().mockResolvedValue(undefined)
    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(makeQuestion({ status: 'unresolved' })),
        upsertAnswer: upsertMock,
      },
      { isApprovedMember: jest.fn().mockResolvedValue(true) },
    )

    const result = await service.submitAnswer(
      'quiniela-uuid',
      'question-uuid',
      'member-user-uuid',
      'France',
    )

    expect(result).toEqual({ success: true })
    expect(upsertMock).toHaveBeenCalledWith({
      questionId: 'question-uuid',
      userId: 'member-user-uuid',
      answerText: 'France',
    })
  })

  it('calls upsertAnswer again when member updates their answer', async () => {
    const upsertMock = jest.fn().mockResolvedValue(undefined)
    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(makeQuestion({ status: 'unresolved' })),
        upsertAnswer: upsertMock,
      },
      { isApprovedMember: jest.fn().mockResolvedValue(true) },
    )

    await service.submitAnswer('quiniela-uuid', 'question-uuid', 'member-user-uuid', 'Germany')
    await service.submitAnswer('quiniela-uuid', 'question-uuid', 'member-user-uuid', 'France')

    expect(upsertMock).toHaveBeenCalledTimes(2)
    expect(upsertMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ answerText: 'France' }),
    )
  })

  it('succeeds when the answer deadline is in the future', async () => {
    const upsertMock = jest.fn().mockResolvedValue(undefined)
    const futureDeadline = new Date(Date.now() + 60_000)
    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(
          makeQuestion({ status: 'unresolved', answerDeadline: futureDeadline }),
        ),
        upsertAnswer: upsertMock,
      },
      { isApprovedMember: jest.fn().mockResolvedValue(true) },
    )

    const result = await service.submitAnswer(
      'quiniela-uuid',
      'question-uuid',
      'member-user-uuid',
      'France',
    )

    expect(result).toEqual({ success: true })
    expect(upsertMock).toHaveBeenCalled()
  })

  it('succeeds when the answer deadline is null', async () => {
    const upsertMock = jest.fn().mockResolvedValue(undefined)
    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(
          makeQuestion({ status: 'unresolved', answerDeadline: null }),
        ),
        upsertAnswer: upsertMock,
      },
      { isApprovedMember: jest.fn().mockResolvedValue(true) },
    )

    const result = await service.submitAnswer(
      'quiniela-uuid',
      'question-uuid',
      'member-user-uuid',
      'France',
    )

    expect(result).toEqual({ success: true })
  })
})

// ---------------------------------------------------------------------------
// submitAnswer — failure paths
// ---------------------------------------------------------------------------

describe('ExtraQuestionsService.submitAnswer – failures', () => {
  it('returns UNAUTHORIZED when caller is not an approved member', async () => {
    const upsertMock = jest.fn()
    const service = makeService(
      { upsertAnswer: upsertMock },
      { isApprovedMember: jest.fn().mockResolvedValue(false) },
    )

    const result = await service.submitAnswer(
      'quiniela-uuid',
      'question-uuid',
      'non-member',
      'France',
    )

    expect(result).toEqual({ success: false, error: 'UNAUTHORIZED' })
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('returns INVALID_INPUT when answerText is blank', async () => {
    const upsertMock = jest.fn()
    const service = makeService(
      { upsertAnswer: upsertMock },
      { isApprovedMember: jest.fn().mockResolvedValue(true) },
    )

    const result = await service.submitAnswer(
      'quiniela-uuid',
      'question-uuid',
      'member-user-uuid',
      '   ',
    )

    expect(result).toEqual({ success: false, error: 'INVALID_INPUT' })
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('returns QUESTION_NOT_FOUND when question does not exist', async () => {
    const upsertMock = jest.fn()
    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(null),
        upsertAnswer: upsertMock,
      },
      { isApprovedMember: jest.fn().mockResolvedValue(true) },
    )

    const result = await service.submitAnswer(
      'quiniela-uuid',
      'question-uuid',
      'member-user-uuid',
      'France',
    )

    expect(result).toEqual({ success: false, error: 'QUESTION_NOT_FOUND' })
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('returns QUESTION_NOT_FOUND when question belongs to a different quiniela', async () => {
    const upsertMock = jest.fn()
    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(makeQuestion({ quinielaId: 'other-quiniela-uuid' })),
        upsertAnswer: upsertMock,
      },
      { isApprovedMember: jest.fn().mockResolvedValue(true) },
    )

    const result = await service.submitAnswer(
      'quiniela-uuid',
      'question-uuid',
      'member-user-uuid',
      'France',
    )

    expect(result).toEqual({ success: false, error: 'QUESTION_NOT_FOUND' })
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('returns QUESTION_RESOLVED and does NOT call upsertAnswer for resolved questions', async () => {
    const upsertMock = jest.fn()
    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(makeQuestion({ status: 'resolved' })),
        upsertAnswer: upsertMock,
      },
      { isApprovedMember: jest.fn().mockResolvedValue(true) },
    )

    const result = await service.submitAnswer(
      'quiniela-uuid',
      'question-uuid',
      'member-user-uuid',
      'France',
    )

    expect(result).toEqual({ success: false, error: 'QUESTION_RESOLVED' })
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('returns DEADLINE_PASSED when the deadline is past and the question is still unresolved', async () => {
    const upsertMock = jest.fn()
    const pastDeadline = new Date(Date.now() - 60_000)
    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(
          makeQuestion({ status: 'unresolved', answerDeadline: pastDeadline }),
        ),
        upsertAnswer: upsertMock,
      },
      { isApprovedMember: jest.fn().mockResolvedValue(true) },
    )

    const result = await service.submitAnswer(
      'quiniela-uuid',
      'question-uuid',
      'member-user-uuid',
      'France',
    )

    expect(result).toEqual({ success: false, error: 'DEADLINE_PASSED' })
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('returns QUESTION_RESOLVED (not DEADLINE_PASSED) when both apply — resolved check takes precedence', async () => {
    const upsertMock = jest.fn()
    const pastDeadline = new Date(Date.now() - 60_000)
    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(
          makeQuestion({ status: 'resolved', answerDeadline: pastDeadline }),
        ),
        upsertAnswer: upsertMock,
      },
      { isApprovedMember: jest.fn().mockResolvedValue(true) },
    )

    const result = await service.submitAnswer(
      'quiniela-uuid',
      'question-uuid',
      'member-user-uuid',
      'France',
    )

    expect(result).toEqual({ success: false, error: 'QUESTION_RESOLVED' })
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('returns DB_ERROR when upsertAnswer throws', async () => {
    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(makeQuestion({ status: 'unresolved' })),
        upsertAnswer: jest.fn().mockRejectedValue(new Error('upsertAnswer DB failure')),
      },
      { isApprovedMember: jest.fn().mockResolvedValue(true) },
    )

    const result = await service.submitAnswer(
      'quiniela-uuid',
      'question-uuid',
      'member-user-uuid',
      'France',
    )

    expect(result).toEqual({ success: false, error: 'DB_ERROR' })
  })
})

// ---------------------------------------------------------------------------
// resolveQuestion — success paths
// ---------------------------------------------------------------------------

describe('ExtraQuestionsService.resolveQuestion – success', () => {
  it('resolves a question for the first time: all correct answers score pointsValue (default 1)', async () => {
    const answers = [
      makeAnswer({ userId: 'user-1', answerText: 'France' }),
      makeAnswer({ userId: 'user-2', answerText: 'france' }),
      makeAnswer({ userId: 'user-3', answerText: 'Germany' }),
    ]
    const upsertResultsMock = jest.fn().mockResolvedValue(undefined)
    const insertAuditMock = jest.fn().mockResolvedValue(undefined)

    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(makeQuestion()),
        resolveQuestion: jest.fn().mockResolvedValue({ previousAnswer: null }),
        findAnswersByQuestion: jest.fn().mockResolvedValue(answers),
        upsertResults: upsertResultsMock,
        insertAuditEntry: insertAuditMock,
      },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    const result = await service.resolveQuestion(
      'quiniela-uuid',
      'question-uuid',
      'France',
      'admin-user-uuid',
    )

    expect(result).toEqual({ success: true, membersRescored: 3 })
    expect(upsertResultsMock).toHaveBeenCalledWith([
      {
        questionId: 'question-uuid', userId: 'user-1', quinielaId: 'quiniela-uuid',
        points: 1, isCorrect: true, isOverridden: false, overriddenBy: null, overriddenAt: null,
      },
      {
        questionId: 'question-uuid', userId: 'user-2', quinielaId: 'quiniela-uuid',
        points: 1, isCorrect: true, isOverridden: false, overriddenBy: null, overriddenAt: null,
      },
      {
        questionId: 'question-uuid', userId: 'user-3', quinielaId: 'quiniela-uuid',
        points: 0, isCorrect: false, isOverridden: false, overriddenBy: null, overriddenAt: null,
      },
    ])
  })

  it('uses the configured pointsValue when correct, and 0 when incorrect', async () => {
    const answers = [
      makeAnswer({ userId: 'user-1', answerText: 'France' }),
      makeAnswer({ userId: 'user-2', answerText: 'Germany' }),
    ]
    const upsertResultsMock = jest.fn().mockResolvedValue(undefined)

    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(makeQuestion({ pointsValue: 3 })),
        resolveQuestion: jest.fn().mockResolvedValue({ previousAnswer: null }),
        findAnswersByQuestion: jest.fn().mockResolvedValue(answers),
        upsertResults: upsertResultsMock,
        insertAuditEntry: jest.fn().mockResolvedValue(undefined),
      },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    await service.resolveQuestion('quiniela-uuid', 'question-uuid', 'France', 'admin-user-uuid')

    expect(upsertResultsMock).toHaveBeenCalledWith([
      expect.objectContaining({ userId: 'user-1', points: 3, isCorrect: true }),
      expect.objectContaining({ userId: 'user-2', points: 0, isCorrect: false }),
    ])
  })

  it('resets override tracking flags to false/null for every result row on resolve', async () => {
    const upsertResultsMock = jest.fn().mockResolvedValue(undefined)

    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(makeQuestion()),
        resolveQuestion: jest.fn().mockResolvedValue({ previousAnswer: null }),
        findAnswersByQuestion: jest.fn().mockResolvedValue([makeAnswer({ userId: 'user-1' })]),
        upsertResults: upsertResultsMock,
        insertAuditEntry: jest.fn().mockResolvedValue(undefined),
      },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    await service.resolveQuestion('quiniela-uuid', 'question-uuid', 'France', 'admin-user-uuid')

    expect(upsertResultsMock).toHaveBeenCalledWith([
      expect.objectContaining({ isOverridden: false, overriddenBy: null, overriddenAt: null }),
    ])
  })

  it('case-insensitive match: "france" equals "France" → correct, scored at pointsValue', async () => {
    const answers = [makeAnswer({ userId: 'user-1', answerText: 'france' })]
    const upsertResultsMock = jest.fn().mockResolvedValue(undefined)

    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(makeQuestion()),
        resolveQuestion: jest.fn().mockResolvedValue({ previousAnswer: null }),
        findAnswersByQuestion: jest.fn().mockResolvedValue(answers),
        upsertResults: upsertResultsMock,
        insertAuditEntry: jest.fn().mockResolvedValue(undefined),
      },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    await service.resolveQuestion('quiniela-uuid', 'question-uuid', 'France', 'admin-user-uuid')

    expect(upsertResultsMock).toHaveBeenCalledWith([
      expect.objectContaining({ userId: 'user-1', points: 1, isCorrect: true }),
    ])
  })

  it('re-resolution: previousAnswer is captured from repo and passed to audit entry', async () => {
    const insertAuditMock = jest.fn().mockResolvedValue(undefined)

    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(makeQuestion({ status: 'resolved' })),
        resolveQuestion: jest.fn().mockResolvedValue({ previousAnswer: 'OldAnswer' }),
        findAnswersByQuestion: jest.fn().mockResolvedValue([makeAnswer()]),
        upsertResults: jest.fn().mockResolvedValue(undefined),
        insertAuditEntry: insertAuditMock,
      },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    const result = await service.resolveQuestion(
      'quiniela-uuid',
      'question-uuid',
      'NewAnswer',
      'admin-user-uuid',
    )

    expect(result).toEqual({ success: true, membersRescored: 1 })
    expect(insertAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        previousAnswer: 'OldAnswer',
        newAnswer: 'NewAnswer',
        entryType: 'resolve',
        targetUserId: null,
      }),
    )
  })

  it('resolves with zero answers → membersRescored: 0, upsertResults called with []', async () => {
    const upsertResultsMock = jest.fn().mockResolvedValue(undefined)

    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(makeQuestion()),
        resolveQuestion: jest.fn().mockResolvedValue({ previousAnswer: null }),
        findAnswersByQuestion: jest.fn().mockResolvedValue([]),
        upsertResults: upsertResultsMock,
        insertAuditEntry: jest.fn().mockResolvedValue(undefined),
      },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    const result = await service.resolveQuestion(
      'quiniela-uuid',
      'question-uuid',
      'France',
      'admin-user-uuid',
    )

    expect(result).toEqual({ success: true, membersRescored: 0 })
    expect(upsertResultsMock).toHaveBeenCalledWith([])
  })
})

// ---------------------------------------------------------------------------
// resolveQuestion — failure paths
// ---------------------------------------------------------------------------

describe('ExtraQuestionsService.resolveQuestion – failures', () => {
  it('returns UNAUTHORIZED when caller is not an admin', async () => {
    const service = makeService(
      {},
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(null) },
    )

    const result = await service.resolveQuestion(
      'quiniela-uuid',
      'question-uuid',
      'France',
      'non-admin',
    )

    expect(result).toEqual({ success: false, error: 'UNAUTHORIZED' })
  })

  it('returns INVALID_INPUT when correctAnswer is blank', async () => {
    const service = makeService(
      {},
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    const result = await service.resolveQuestion(
      'quiniela-uuid',
      'question-uuid',
      '   ',
      'admin-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'INVALID_INPUT' })
  })

  it('returns QUESTION_NOT_FOUND when question does not exist', async () => {
    const service = makeService(
      { findById: jest.fn().mockResolvedValue(null) },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    const result = await service.resolveQuestion(
      'quiniela-uuid',
      'nonexistent-question',
      'France',
      'admin-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'QUESTION_NOT_FOUND' })
  })

  it('returns AUDIT_FAILED when insertAuditEntry throws', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(makeQuestion()),
        resolveQuestion: jest.fn().mockResolvedValue({ previousAnswer: null }),
        findAnswersByQuestion: jest.fn().mockResolvedValue([makeAnswer()]),
        upsertResults: jest.fn().mockResolvedValue(undefined),
        insertAuditEntry: jest.fn().mockRejectedValue(new Error('audit write failed')),
      },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    const result = await service.resolveQuestion(
      'quiniela-uuid',
      'question-uuid',
      'France',
      'admin-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'AUDIT_FAILED' })
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('returns DB_ERROR when upsertResults throws', async () => {
    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(makeQuestion()),
        resolveQuestion: jest.fn().mockResolvedValue({ previousAnswer: null }),
        findAnswersByQuestion: jest.fn().mockResolvedValue([makeAnswer()]),
        upsertResults: jest.fn().mockRejectedValue(new Error('upsertResults DB failure')),
      },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    const result = await service.resolveQuestion(
      'quiniela-uuid',
      'question-uuid',
      'France',
      'admin-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'DB_ERROR' })
  })
})

// ---------------------------------------------------------------------------
// updateQuestionDeadline
// ---------------------------------------------------------------------------

describe('ExtraQuestionsService.updateQuestionDeadline', () => {
  it('sets a future deadline on an existing question', async () => {
    const futureDeadline = new Date(Date.now() + 60_000)
    const updated = makeQuestion({ answerDeadline: futureDeadline })
    const updateMock = jest.fn().mockResolvedValue(updated)
    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(makeQuestion({ answerDeadline: null })),
        updateQuestionDeadline: updateMock,
      },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    const result = await service.updateQuestionDeadline(
      'quiniela-uuid',
      'question-uuid',
      futureDeadline,
      'admin-user-uuid',
    )

    expect(result).toEqual({ success: true, question: updated })
    expect(updateMock).toHaveBeenCalledWith('question-uuid', futureDeadline)
  })

  it('clears an existing deadline when passed null', async () => {
    const updated = makeQuestion({ answerDeadline: null })
    const updateMock = jest.fn().mockResolvedValue(updated)
    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(makeQuestion({ answerDeadline: new Date(Date.now() + 60_000) })),
        updateQuestionDeadline: updateMock,
      },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    const result = await service.updateQuestionDeadline(
      'quiniela-uuid',
      'question-uuid',
      null,
      'admin-user-uuid',
    )

    expect(result).toEqual({ success: true, question: updated })
    expect(updateMock).toHaveBeenCalledWith('question-uuid', null)
  })

  it('returns UNAUTHORIZED when caller has no membership', async () => {
    const service = makeService(
      {},
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(null) },
    )

    const result = await service.updateQuestionDeadline(
      'quiniela-uuid',
      'question-uuid',
      null,
      'non-member',
    )

    expect(result).toEqual({ success: false, error: 'UNAUTHORIZED' })
  })

  it('returns UNAUTHORIZED when caller is a non-admin member', async () => {
    const service = makeService(
      {},
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership({ role: 'member' })) },
    )

    const result = await service.updateQuestionDeadline(
      'quiniela-uuid',
      'question-uuid',
      null,
      'member-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'UNAUTHORIZED' })
  })

  it('returns INVALID_INPUT when the new deadline is in the past', async () => {
    const service = makeService(
      {},
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )
    const pastDeadline = new Date(Date.now() - 60_000)

    const result = await service.updateQuestionDeadline(
      'quiniela-uuid',
      'question-uuid',
      pastDeadline,
      'admin-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'INVALID_INPUT' })
  })

  it('returns QUESTION_NOT_FOUND when the question does not exist', async () => {
    const service = makeService(
      { findById: jest.fn().mockResolvedValue(null) },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    const result = await service.updateQuestionDeadline(
      'quiniela-uuid',
      'question-uuid',
      null,
      'admin-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'QUESTION_NOT_FOUND' })
  })

  it('returns QUESTION_NOT_FOUND when the question belongs to a different quiniela', async () => {
    const service = makeService(
      { findById: jest.fn().mockResolvedValue(makeQuestion({ quinielaId: 'other-quiniela-uuid' })) },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    const result = await service.updateQuestionDeadline(
      'quiniela-uuid',
      'question-uuid',
      null,
      'admin-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'QUESTION_NOT_FOUND' })
  })

  it('allows editing the deadline even when the question is already resolved', async () => {
    const futureDeadline = new Date(Date.now() + 60_000)
    const updated = makeQuestion({ status: 'resolved', answerDeadline: futureDeadline })
    const updateMock = jest.fn().mockResolvedValue(updated)
    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(makeQuestion({ status: 'resolved' })),
        updateQuestionDeadline: updateMock,
      },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    const result = await service.updateQuestionDeadline(
      'quiniela-uuid',
      'question-uuid',
      futureDeadline,
      'admin-user-uuid',
    )

    expect(result).toEqual({ success: true, question: updated })
    expect(updateMock).toHaveBeenCalled()
  })

  it('returns QUESTION_NOT_FOUND when repo.updateQuestionDeadline returns null', async () => {
    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(makeQuestion()),
        updateQuestionDeadline: jest.fn().mockResolvedValue(null),
      },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    const result = await service.updateQuestionDeadline(
      'quiniela-uuid',
      'question-uuid',
      null,
      'admin-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'QUESTION_NOT_FOUND' })
  })

  it('returns DB_ERROR when repo.updateQuestionDeadline throws', async () => {
    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(makeQuestion()),
        updateQuestionDeadline: jest.fn().mockRejectedValue(new Error('DB failure')),
      },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    const result = await service.updateQuestionDeadline(
      'quiniela-uuid',
      'question-uuid',
      null,
      'admin-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'DB_ERROR' })
  })
})

// ---------------------------------------------------------------------------
// listAnswersForReview
// ---------------------------------------------------------------------------

describe('ExtraQuestionsService.listAnswersForReview', () => {
  it('returns UNAUTHORIZED when caller has no membership', async () => {
    const service = makeService(
      {},
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(null) },
    )

    const result = await service.listAnswersForReview('quiniela-uuid', 'question-uuid', 'non-member')

    expect(result).toEqual({ success: false, error: 'UNAUTHORIZED' })
  })

  it('returns UNAUTHORIZED when caller is an unapproved admin', async () => {
    const service = makeService(
      {},
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership({ approvedAt: null })) },
    )

    const result = await service.listAnswersForReview('quiniela-uuid', 'question-uuid', 'admin-user-uuid')

    expect(result).toEqual({ success: false, error: 'UNAUTHORIZED' })
  })

  it('returns UNAUTHORIZED when caller is a non-admin member', async () => {
    const service = makeService(
      {},
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership({ role: 'member' })) },
    )

    const result = await service.listAnswersForReview('quiniela-uuid', 'question-uuid', 'member-user-uuid')

    expect(result).toEqual({ success: false, error: 'UNAUTHORIZED' })
  })

  it('returns QUESTION_NOT_FOUND when the question does not exist', async () => {
    const service = makeService(
      { findById: jest.fn().mockResolvedValue(null) },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    const result = await service.listAnswersForReview('quiniela-uuid', 'question-uuid', 'admin-user-uuid')

    expect(result).toEqual({ success: false, error: 'QUESTION_NOT_FOUND' })
  })

  it('returns QUESTION_NOT_FOUND when the question belongs to a different quiniela', async () => {
    const service = makeService(
      { findById: jest.fn().mockResolvedValue(makeQuestion({ quinielaId: 'other-quiniela-uuid' })) },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    const result = await service.listAnswersForReview('quiniela-uuid', 'question-uuid', 'admin-user-uuid')

    expect(result).toEqual({ success: false, error: 'QUESTION_NOT_FOUND' })
  })

  it('merges answers, results, and user emails into the review rows', async () => {
    const answers = [
      makeAnswer({ userId: 'user-1', answerText: 'France' }),
      makeAnswer({ userId: 'user-2', answerText: 'Germany' }),
    ]
    const results = [
      makeResult({ userId: 'user-1', points: 1, isCorrect: true, isOverridden: false }),
    ]
    const users = [
      makeUser({ id: 'user-1', email: 'user1@example.com' }),
      makeUser({ id: 'user-2', email: 'user2@example.com' }),
    ]

    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(makeQuestion({ status: 'resolved' })),
        findAnswersByQuestion: jest.fn().mockResolvedValue(answers),
        findResultsByQuestion: jest.fn().mockResolvedValue(results),
      },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
      {},
      { findByIds: jest.fn().mockResolvedValue(users) },
    )

    const result = await service.listAnswersForReview('quiniela-uuid', 'question-uuid', 'admin-user-uuid')

    expect(result).toEqual({
      success: true,
      rows: [
        {
          userId: 'user-1',
          userEmail: 'user1@example.com',
          answerText: 'France',
          submittedAt: answers[0].submittedAt,
          points: 1,
          isCorrect: true,
          isOverridden: false,
          overriddenBy: null,
          overriddenAt: null,
        },
        {
          // Answered-but-unresolved user (no result row yet) defaults to isCorrect: false
          userId: 'user-2',
          userEmail: 'user2@example.com',
          answerText: 'Germany',
          submittedAt: answers[1].submittedAt,
          points: 0,
          isCorrect: false,
          isOverridden: false,
          overriddenBy: null,
          overriddenAt: null,
        },
      ],
    })
  })

  it('returns DB_ERROR when the repository throws', async () => {
    const service = makeService(
      {
        findAnswersByQuestion: jest.fn().mockRejectedValue(new Error('DB failure')),
      },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    const result = await service.listAnswersForReview('quiniela-uuid', 'question-uuid', 'admin-user-uuid')

    expect(result).toEqual({ success: false, error: 'DB_ERROR' })
  })
})

// ---------------------------------------------------------------------------
// overrideAnswer
// ---------------------------------------------------------------------------

describe('ExtraQuestionsService.overrideAnswer', () => {
  it('returns UNAUTHORIZED when caller has no membership', async () => {
    const service = makeService(
      {},
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(null) },
    )

    const result = await service.overrideAnswer(
      'quiniela-uuid', 'question-uuid', 'member-user-uuid', true, 'non-member',
    )

    expect(result).toEqual({ success: false, error: 'UNAUTHORIZED' })
  })

  it('returns UNAUTHORIZED when caller is a non-admin member', async () => {
    const service = makeService(
      {},
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership({ role: 'member' })) },
    )

    const result = await service.overrideAnswer(
      'quiniela-uuid', 'question-uuid', 'member-user-uuid', true, 'member-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'UNAUTHORIZED' })
  })

  it('returns QUESTION_NOT_FOUND when the question does not exist', async () => {
    const service = makeService(
      { findById: jest.fn().mockResolvedValue(null) },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    const result = await service.overrideAnswer(
      'quiniela-uuid', 'question-uuid', 'member-user-uuid', true, 'admin-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'QUESTION_NOT_FOUND' })
  })

  it('returns QUESTION_NOT_FOUND when the question belongs to a different quiniela', async () => {
    const service = makeService(
      { findById: jest.fn().mockResolvedValue(makeQuestion({ quinielaId: 'other-quiniela-uuid' })) },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    const result = await service.overrideAnswer(
      'quiniela-uuid', 'question-uuid', 'member-user-uuid', true, 'admin-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'QUESTION_NOT_FOUND' })
  })

  it('returns QUESTION_NOT_RESOLVED when the question is still unresolved', async () => {
    const overrideResultMock = jest.fn()
    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(makeQuestion({ status: 'unresolved' })),
        overrideResult: overrideResultMock,
      },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    const result = await service.overrideAnswer(
      'quiniela-uuid', 'question-uuid', 'member-user-uuid', true, 'admin-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'QUESTION_NOT_RESOLVED' })
    expect(overrideResultMock).not.toHaveBeenCalled()
  })

  it('returns ANSWER_NOT_FOUND when repo.overrideResult returns null', async () => {
    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(makeQuestion({ status: 'resolved' })),
        overrideResult: jest.fn().mockResolvedValue(null),
      },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    const result = await service.overrideAnswer(
      'quiniela-uuid', 'question-uuid', 'member-user-uuid', true, 'admin-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'ANSWER_NOT_FOUND' })
  })

  it('happy path: computes points from pointsValue/isCorrect and writes an override audit entry', async () => {
    const overrideResultMock = jest.fn().mockResolvedValue({ previousPoints: 0, previousIsCorrect: false })
    const insertAuditMock = jest.fn().mockResolvedValue(undefined)

    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(makeQuestion({ status: 'resolved', pointsValue: 5 })),
        overrideResult: overrideResultMock,
        insertAuditEntry: insertAuditMock,
      },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    const result = await service.overrideAnswer(
      'quiniela-uuid', 'question-uuid', 'member-user-uuid', true, 'admin-user-uuid',
    )

    expect(result).toEqual({ success: true, points: 5, isCorrect: true })
    expect(overrideResultMock).toHaveBeenCalledWith({
      questionId: 'question-uuid',
      userId: 'member-user-uuid',
      points: 5,
      isCorrect: true,
      overriddenBy: 'admin-user-uuid',
    })
    expect(insertAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entryType: 'override',
        targetUserId: 'member-user-uuid',
        previousPoints: 0,
        newPoints: 5,
        changedBy: 'admin-user-uuid',
      }),
    )
  })

  it('computes points: 0 when overriding to incorrect', async () => {
    const overrideResultMock = jest.fn().mockResolvedValue({ previousPoints: 5, previousIsCorrect: true })

    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(makeQuestion({ status: 'resolved', pointsValue: 5 })),
        overrideResult: overrideResultMock,
      },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    const result = await service.overrideAnswer(
      'quiniela-uuid', 'question-uuid', 'member-user-uuid', false, 'admin-user-uuid',
    )

    expect(result).toEqual({ success: true, points: 0, isCorrect: false })
    expect(overrideResultMock).toHaveBeenCalledWith(
      expect.objectContaining({ points: 0, isCorrect: false }),
    )
  })

  it('returns AUDIT_FAILED when insertAuditEntry throws', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(makeQuestion({ status: 'resolved' })),
        overrideResult: jest.fn().mockResolvedValue({ previousPoints: 0, previousIsCorrect: false }),
        insertAuditEntry: jest.fn().mockRejectedValue(new Error('audit write failed')),
      },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    const result = await service.overrideAnswer(
      'quiniela-uuid', 'question-uuid', 'member-user-uuid', true, 'admin-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'AUDIT_FAILED' })
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('returns DB_ERROR when repo.overrideResult throws', async () => {
    const service = makeService(
      {
        findById: jest.fn().mockResolvedValue(makeQuestion({ status: 'resolved' })),
        overrideResult: jest.fn().mockRejectedValue(new Error('DB failure')),
      },
      { findByQuinielaAndUser: jest.fn().mockResolvedValue(makeAdminMembership()) },
    )

    const result = await service.overrideAnswer(
      'quiniela-uuid', 'question-uuid', 'member-user-uuid', true, 'admin-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'DB_ERROR' })
  })
})
