import MatchCard, { type MatchCardData } from './MatchCard'
import KnockoutPlaceholderCard from './KnockoutPlaceholderCard'
import type { Dictionary } from '@/i18n/getDictionary'
import type { Locale } from '@/i18n/i18n.types'

type KnockoutSectionProps = {
  knockoutMatches: MatchCardData[]
  dict: Dictionary['welcome']
  lang: Locale
  isApproved: boolean
  onSaveScore?: (matchId: string, home: number, away: number) => Promise<unknown>
}

const KNOCKOUT_ROUNDS = [
  { stage: 'ROUND_OF_16',    labelKey: 'knockoutRoundOf16'     },
  { stage: 'QUARTER_FINALS', labelKey: 'knockoutQuarterFinals' },
  { stage: 'SEMI_FINALS',    labelKey: 'knockoutSemiFinals'    },
  { stage: 'FINAL',          labelKey: 'knockoutFinal'         },
] as const

export default function KnockoutSection({
  knockoutMatches,
  dict,
  lang,
  isApproved,
  onSaveScore,
}: KnockoutSectionProps) {
  return (
    <div className="mt-8 border-t border-gray-200 pt-8">
      <div className="flex flex-col gap-6">
        {KNOCKOUT_ROUNDS.map((round) => {
          const roundLabel = dict[round.labelKey]
          const roundMatches = knockoutMatches.filter((m) => m.stage === round.stage)

          return (
            <div key={round.stage}>
              <h2 className="mb-3 text-base font-semibold text-green-900">{roundLabel}</h2>
              <div className="flex flex-col gap-3">
                {roundMatches.length > 0 ? (
                  roundMatches.map((m) => (
                    <MatchCard
                      key={m.id}
                      {...m}
                      dict={dict}
                      lang={lang}
                      isApproved={isApproved}
                      onSaveScore={onSaveScore}
                    />
                  ))
                ) : (
                  <KnockoutPlaceholderCard roundLabel={roundLabel} />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
