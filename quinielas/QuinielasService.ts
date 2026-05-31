/**
 * QuinielasService — Application-layer service for quiniela management.
 *
 * Contains all business logic for creating and retrieving quinielas.
 * Depends on IQuinielasRepository through its constructor so it can be
 * swapped with test doubles.
 *
 * Rules:
 * - Never imports from @supabase/supabase-js or fetch directly.
 * - Never imports from Next.js (no next/navigation, next/headers, etc.).
 * - All I/O goes through the injected repository.
 */

import type {
  IQuinielasRepository,
  IQuinielasService,
  CreateQuinielaResult,
  GetQuinielaResult,
  ListQuinielasForUserResult,
} from '@/quinielas/quinielas.types'

export class QuinielasService implements IQuinielasService {
  constructor(private readonly repository: IQuinielasRepository) {}

  /**
   * Create a new quiniela with the caller as the admin member.
   *
   * Flow:
   * 1. Trim the name; return NAME_EMPTY if blank.
   * 2. Call repository.createWithAdmin.
   * 3. On DB throw → DB_ERROR.
   * 4. Any other unexpected throw → UNKNOWN_ERROR.
   */
  async createQuiniela(input: {
    name: string
    userId: string
  }): Promise<CreateQuinielaResult> {
    const name = input.name.trim()
    if (name === '') {
      return { success: false, error: 'NAME_EMPTY' }
    }

    try {
      const quiniela = await this.repository.createWithAdmin(name, input.userId)
      return { success: true, quiniela }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.toLowerCase().includes('db') || message.toLowerCase().includes('sql') || message.toLowerCase().includes('failed')) {
        return { success: false, error: 'DB_ERROR' }
      }
      return { success: false, error: 'UNKNOWN_ERROR' }
    }
  }

  /**
   * Fetch a single quiniela by id.
   *
   * Flow:
   * 1. findById → null → NOT_FOUND.
   * 2. On unexpected throw → UNKNOWN_ERROR.
   */
  async getQuiniela(quinielaId: string): Promise<GetQuinielaResult> {
    try {
      const quiniela = await this.repository.findById(quinielaId)
      if (quiniela === null) {
        return { success: false, error: 'NOT_FOUND' }
      }
      return { success: true, quiniela }
    } catch {
      return { success: false, error: 'UNKNOWN_ERROR' }
    }
  }

  /**
   * List all quinielas a user belongs to (as any role).
   *
   * Flow:
   * 1. findAllForUser → return list.
   * 2. On unexpected throw → UNKNOWN_ERROR.
   */
  async listQuinielasForUser(userId: string): Promise<ListQuinielasForUserResult> {
    try {
      const quinielas = await this.repository.findAllForUser(userId)
      return { success: true, quinielas }
    } catch {
      return { success: false, error: 'UNKNOWN_ERROR' }
    }
  }
}
