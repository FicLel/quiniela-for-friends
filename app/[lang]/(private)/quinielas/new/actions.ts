'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { AuthClient } from '@/auth/AuthClient'
import { QuinielasService } from '@/quinielas/QuinielasService'
import { QuinielasRepository } from '@/quinielas/QuinielasRepository'
import type { CreateQuinielaResult } from '@/quinielas/quinielas.types'
import type { Locale } from '@/i18n/i18n.types'

const createQuinielaSchema = z.object({
  name: z.string().trim().min(1).max(100),
})

/**
 * Create a new quiniela. On success, redirects to the members page.
 * On failure, returns the typed CreateQuinielaResult.
 *
 * IMPORTANT: redirect() throws internally — must NOT be inside a try/catch.
 */
export async function createQuiniela(
  lang: Locale,
  name: string,
): Promise<CreateQuinielaResult> {
  const parsed = createQuinielaSchema.safeParse({ name })

  if (!parsed.success) {
    return { success: false, error: 'NAME_EMPTY' }
  }

  const authClient = new AuthClient()
  const token = await authClient.getTokenFromServerAction()
  const session = token ? await authClient.verifyToken(token) : null

  if (!session) {
    return { success: false, error: 'UNKNOWN_ERROR' }
  }

  const service = new QuinielasService(new QuinielasRepository())
  const result = await service.createQuiniela({
    name: parsed.data.name,
    createdBy: session.sub,
  })

  if (!result.success) {
    return result
  }

  redirect(`/${lang}/quinielas/${result.quiniela.id}/members`)
}
