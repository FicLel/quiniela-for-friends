export type LoginResult =
  | { success: true; token: string; mustChangePassword: boolean }
  | { success: false; error: 'INVALID_CREDENTIALS' | 'UNKNOWN_ERROR' }

export type ChangePasswordResult =
  | { success: true; token: string }
  | { success: false; error: 'POLICY_VIOLATION' | 'PASSWORDS_DO_NOT_MATCH' | 'FLAG_UPDATE_FAILED' | 'UNAUTHORIZED' | 'IMPERSONATING_READ_ONLY' | 'UNKNOWN_ERROR' }

export type CreateFirstAdminResult =
  | { success: true; token: string }
  | { success: false; error: 'SETUP_ALREADY_COMPLETE' | 'UNKNOWN_ERROR' }

export type LoginErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN_ERROR'

export type ChangePasswordErrorCode = NonNullable<Extract<ChangePasswordResult, { success: false }>['error']>
