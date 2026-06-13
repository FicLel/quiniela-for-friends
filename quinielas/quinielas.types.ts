export type Quiniela = {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export type CreateQuinielaResult =
  | { success: true; quiniela: Quiniela }
  | { success: false; error: 'NAME_EMPTY' | 'DB_ERROR' | 'IMPERSONATING_READ_ONLY' | 'UNKNOWN_ERROR' }

export type GetQuinielaResult =
  | { success: true; quiniela: Quiniela }
  | { success: false; error: 'NOT_FOUND' | 'UNKNOWN_ERROR' }

export type ListQuinielasForUserResult =
  | { success: true; quinielas: Quiniela[] }
  | { success: false; error: 'UNKNOWN_ERROR' }

export interface IQuinielasRepository {
  createWithAdmin(name: string, userId: string): Promise<Quiniela>
  findById(id: string): Promise<Quiniela | null>
  findAllForUser(userId: string): Promise<Quiniela[]>
}

export interface IQuinielasService {
  createQuiniela(input: { name: string; userId: string }): Promise<CreateQuinielaResult>
  getQuiniela(quinielaId: string): Promise<GetQuinielaResult>
  listQuinielasForUser(userId: string): Promise<ListQuinielasForUserResult>
}
