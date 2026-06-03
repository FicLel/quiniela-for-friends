/**
 * Unit tests for ExtraQuestionsService.
 *
 * All three port interfaces (IExtraQuestionsRepository, IMembershipsRepository,
 * ICompetitionsRepository) are mocked at the boundary — no real DB queries made.
 * Tests cover business logic only: branching, error mapping, and happy paths.
 */

import { ExtraQuestionsService } from '../ExtraQuestionsService'
import type {
  IExtraQuestionsRepository,
  ExtraQuestion,
  ExtraQuestionAnswer,
} from '../extraQuestions.types'
import type { IMembershipsRepository, Membership } from '@/memberships/memberships.types'
import type { ICompetitionsRepository } from '@/competitions/competitions.types'

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
    upsertResults: jest.fn().mockResolvedValue(undefined),
    insertAuditEntry: jest.fn().mockResolvedValue(undefined),
    countByStatus: jest.fn().mockResolvedValue(0),
    countUnansweredOpenByUser: jest.fn().mockResolvedValue(0),
    countAll: jest.fn().mockResolvedValue(0),
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

function makeService(
  repoOverrides: Partial<Record<keyof IExtraQuestionsRepository, jest.Mock>> = {},
  membershipsOverrides: Partial<Record<keyof IMembershipsRepository, jest.Mock>> = {},
  competitionsOverrides: Partial<Record<keyof ICompetitionsRepository, jest.Mock>> = {},
): ExtraQuestionsService {
  return new ExtraQuestionsService(
    makeExtraQuestionsRepo(repoOverrides),
    makeMembershipsRepo(membershipsOverrides),
    makeCompetitionsRepo(competitionsOverrides),
  )
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// listQuestions
// ---------------------------------------------------------------------------

describe('ExtraQuestionsService.listQuestions', () => {
  it('returns { success: true, questions, userAnswers } for an approved member', async () => {
    const question = makeQuestion()
    const service = makeService(
      {
        findAllByQuiniela: jest.fn().mockResolvedValue([question]),
        findAnswersByUserForQuiniela: jest.fn().mockResolvedValue([
          { questionId: question.id, answerText: 'Brazil' },
        ]),
      },
      { isApprovedMember: jest.fn().mockResolvedValue(true) },
    )

    const result = await service.listQuestions('quiniela-uuid', 'user-uuid')

    expect(result).toEqual({
      success: true,
      questions: [question],
      userAnswers: { [question.id]: 'Brazil' },
    })
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
      { questionText: 'Who wins Golden Boot?', questionType: 'player' },
      'admin-user-uuid',
    )

    expect(result).toEqual({ success: true, question })
    expect(createMock).toHaveBeenCalledWith({
      quinielaId: 'quiniela-uuid',
      questionText: 'Who wins Golden Boot?',
      questionType: 'player',
      createdBy: 'admin-user-uuid',
    })
  })

  it('trims whitespace from questionText before creating', async () => {
    const createMock = jest.fn().mockResolvedValue(makeQuestion())
    const service = makeService({ create: createMock })

    await service.createQuestion(
      'quiniela-uuid',
      { questionText: '  Which team wins the final?  ', questionType: 'team' },
      'admin-user-uuid',
    )

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ questionText: 'Which team wins the final?' }),
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
      { questionText: 'Some question', questionType: 'team' },
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
      { questionText: 'Some question', questionType: 'team' },
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
      { questionText: 'Some question', questionType: 'team' },
      'admin-user-uuid',
    )

    expect(result).toEqual({ success: false, error: 'UNAUTHORIZED' })
  })

  it('returns INVALID_INPUT when questionText is empty', async () => {
    const service = makeService()

    const result = await service.createQuestion(
      'quiniela-uuid',
      { questionText: '   ', questionType: 'team' },
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
      { questionText: 'Valid question', questionType: 'team' },
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
      { questionText: 'Valid question', questionType: 'team' },
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
  it('resolves a question for the first time: all correct answers score 1 point', async () => {
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
      { questionId: 'question-uuid', userId: 'user-1', quinielaId: 'quiniela-uuid', points: 1 },
      { questionId: 'question-uuid', userId: 'user-2', quinielaId: 'quiniela-uuid', points: 1 },
      { questionId: 'question-uuid', userId: 'user-3', quinielaId: 'quiniela-uuid', points: 0 },
    ])
  })

  it('case-insensitive match: "france" equals "France" → points: 1', async () => {
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
      expect.objectContaining({ userId: 'user-1', points: 1 }),
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
