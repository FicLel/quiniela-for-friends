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

      {viewMode === 'date' ? (
        // Date view: ALL matches (group stage + knockout) in one chronological flow
        <DateGroupedView
          matches={[...groupStageMatches, ...knockoutMatches]}
          dict={dict}
          lang={lang}
          isApproved={isApproved}
          onSaveScore={onSaveScore}
        />
      ) : (
        // Group view: group stage in accordions + knockout rounds by bracket stage
        <>
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
          <KnockoutSection
            knockoutMatches={knockoutMatches}
            dict={dict}
            lang={lang}
            isApproved={isApproved}
            onSaveScore={onSaveScore}
          />
        </>
      )}
    </div>
  )
}
