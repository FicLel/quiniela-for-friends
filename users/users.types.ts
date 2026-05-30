import type { MembershipRole } from '@/memberships/memberships.types'

export type User = {
  id: string
  email: string
  passwordHash: string
  role: 'admin' | 'player'
  mustChangePassword: boolean
  createdAt: Date
  updatedAt: Date
}

export type CreateUserInput = {
  email: string
  passwordHash: string
  role: 'admin' | 'player'
  mustChangePassword?: boolean
}

export type UserListStatus = 'active' | 'pending'

export type UserListSort = { column: 'email' | 'name'; direction: 'asc' | 'desc' }

export type UserListFilters = { status?: UserListStatus; quinielaId?: string; search?: string }

export type UserWithMemberships = {
  id: string
  email: string
  name: string | null
  memberships: { membershipId: string; quinielaId: string; quinielaName: string; role: MembershipRole; approvedAt: Date | null }[]
}

export type UserListResult =
  | { ok: true; users: UserWithMemberships[]; total: number }
  | { ok: false; error: 'NOT_AUTHORIZED' | 'UNKNOWN_ERROR' }

export interface IUsersRepository {
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  setMustChangePassword(userId: string, value: boolean): Promise<void>
  setPasswordHash(userId: string, passwordHash: string): Promise<void>
  create(input: CreateUserInput): Promise<User>
  hasAnyUser(): Promise<boolean>
  listAll(
    filters: UserListFilters,
    pagination: { page: number; pageSize: number },
    sort: UserListSort,
  ): Promise<{ users: UserWithMemberships[]; total: number }>
  findByIdWithMemberships(userId: string): Promise<UserWithMemberships | null>
}

export type UserDetailResult =
  | { ok: true; user: UserWithMemberships }
  | { ok: false; error: 'NOT_AUTHORIZED' | 'USER_NOT_FOUND' | 'UNKNOWN_ERROR' }

export interface IUsersService {
  listAllUsers(
    callerRole: string,
    filters: UserListFilters,
    page: number,
    sort: UserListSort,
  ): Promise<UserListResult>
  getUserDetail(callerRole: string, userId: string): Promise<UserDetailResult>
}
