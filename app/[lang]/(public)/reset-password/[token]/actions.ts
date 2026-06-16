'use server'

import { redirect } from 'next/navigation'
import { AuthClient } from '@/auth/AuthClient'
import { PasswordResetService } from '@/auth/PasswordResetService'
import { PasswordResetRepository } from '@/auth/PasswordResetRepository'
import { UsersRepository } from '@/users/UsersRepository'
import { changePasswordSchema } from '@/auth/auth.schemas'
import type { ConsumeResetTokenResult } from '@/auth/auth.types'
import type { Locale } from '@/i18n/i18n.types'

export async function resetPassword(
  lang: Locale,
  rawToken: string,
  newPassword: string,
  confirmPassword: string,
): Promise<ConsumeResetTokenResult> {
  const parsed = changePasswordSchema.safeParse({ newPassword, confirmPassword })

  if (!parsed.success) {
    const hasConfirmError = parsed.error.issues.some((issue) =>
      issue.path.includes('confirmPassword'),
    )
    if (hasConfirmError) {
      return { success: false, error: 'PASSWORDS_DO_NOT_MATCH' }
    }
    return { success: false, error: 'POLICY_VIOLATION' }
  }

  const authClient = new AuthClient()
  const service = new PasswordResetService(
    new PasswordResetRepository(),
    new UsersRepository(),
    authClient,
  )

  const result = await service.consumeResetToken(rawToken, parsed.data.newPassword)

  if (!result.success) {
    return result
  }

  await authClient.setSessionCookieOnServerAction(result.token)

  redirect(`/${lang}/welcome`)
}
