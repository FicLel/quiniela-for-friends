import GroupAccordion from './GroupAccordion'
import ViewToggle from './ViewToggle'
import DateGroupedView from './DateGroupedView'
import KnockoutSection from './KnockoutSection'
import type { MatchCardData } from './MatchCard'
import type { Dictionary } from '@/i18n/getDictionary'
import type { Locale } from '@/i18n/i18n.types'

type WelcomeMatchListProps = {
  viewMode: 'date' | 'group'
  groupStageMatches: MatchCardData[]
  knockoutMatches: MatchCardData[]
  sortedGroups: [string, MatchCardData[]][]
  dict: Dictionary['welcome']
  lang: Locale
  isApproved: boolean
  onSaveScore?: (matchId: string, home: number, away: number) => Promise<unknown>
}

export default function WelcomeMatchList({
  viewMode,
  groupStageMatches,
  knockoutMatches,
  sortedGroups,
  dict,
  lang,
  isApproved,
  onSaveScore,
}: WelcomeMatchListProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* View toggle — sticky at top */}
      <div className="sticky top-0 z-10">
        <ViewToggle activeView={viewMode} dict={dict} />
      </div>

      {/* Group-stage content — either date view or group accordion view */}
      {viewMode === 'date' ? (
        <DateGroupedView
          matches={groupStageMatches}
          dict={dict}
          lang={lang}
          isApproved={isApproved}
          onSaveScore={onSaveScore}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {sortedGroups.map(([group, groupMatches]) => (
            <GroupAccordion
              key={group}
              group={group}
              matches={groupMatches}
              dict={dict}
              lang={lang}
              isApproved={isApproved}
              onSaveScore={onSaveScore}
            />
          ))}
        </div>
      )}

      {/* Knockout rounds — always shown below */}
      <KnockoutSection
        knockoutMatches={knockoutMatches}
        dict={dict}
        lang={lang}
        isApproved={isApproved}
        onSaveScore={onSaveScore}
      />
    </div>
  )
}
