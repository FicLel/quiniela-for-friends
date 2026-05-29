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

export interface IUsersRepository {
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  setMustChangePassword(userId: string, value: boolean): Promise<void>
  setPasswordHash(userId: string, passwordHash: string): Promise<void>
  create(input: CreateUserInput): Promise<User>
  hasAnyUser(): Promise<boolean>
}
