'use server'

import { CompetitionsClient } from '@/competitions/CompetitionsClient'
import { CompetitionsRepository } from '@/competitions/CompetitionsRepository'
import { CompetitionsService } from '@/competitions/CompetitionsService'
import type { ImportMatchesResult } from '@/competitions/competitions.types'

export async function importWorldCupMatches(): Promise<ImportMatchesResult> {
  const client = new CompetitionsClient()
  const repository = new CompetitionsRepository()
  const service = new CompetitionsService(client, repository)
  return service.importGroupStageMatches()
}
