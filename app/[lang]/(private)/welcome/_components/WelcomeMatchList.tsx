'use client'

import { useMemo } from 'react'
import GroupAccordion from './GroupAccordion'
import ViewToggle from './ViewToggle'
import DateGroupedView from './DateGroupedView'
import KnockoutSection from './KnockoutSection'
import ScrollToLastFinishedButton from './ScrollToLastFinishedButton'
import { useLastFinishedMatchVisibility } from '../_hooks/useLastFinishedMatchVisibility'
import type { MatchCardData } from './MatchCard'
import type { Dictionary } from '@/i18n/getDictionary'
import type { Locale } from '@/i18n/i18n.types'
import type { SyncRegulationResultsResult } from '@/competitions/competitions.types'

type WelcomeMatchListProps = {
  viewMode: 'date' | 'group'
  groupStageMatches: MatchCardData[]
  knockoutMatches: MatchCardData[]
  sortedGroups: [string, MatchCardData[]][]
  dict: Dictionary['welcome']
  lang: Locale
  isApproved: boolean
  onSaveScore?: (matchId: string, home: number, away: number) => Promise<unknown>
  userRole?: 'admin' | 'player'
  onSyncResult?: (matchId: string, home: number, away: number) => Promise<SyncRegulationResultsResult>
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
  userRole,
  onSyncResult,
}: WelcomeMatchListProps) {
  const allMatches = useMemo(
    () => [...groupStageMatches, ...knockoutMatches],
    [groupStageMatches, knockoutMatches],
  )

  const lastFinishedMatchId = useMemo(() => {
    const finishedMatches = allMatches.filter(
      (match) => match.regulationHomeGoals != null && match.regulationAwayGoals != null,
    )
    if (finishedMatches.length === 0) return null

    return finishedMatches.reduce((latest, current) =>
      current.scheduledAt.localeCompare(latest.scheduledAt) > 0 ? current : latest,
    ).id
  }, [allMatches])

  const { setTargetElement, showButton, scrollToTarget } = useLastFinishedMatchVisibility()

  return (
    <div className="flex flex-col gap-4">
      {/* View toggle — sticky at top */}
      <div className="sticky top-0 z-10">
        <ViewToggle activeView={viewMode} dict={dict} />
      </div>

      {viewMode === 'date' ? (
        // Date view: ALL matches (group stage + knockout) in one chronological flow
        <>
          <DateGroupedView
            matches={allMatches}
            dict={dict}
            lang={lang}
            isApproved={isApproved}
            onSaveScore={onSaveScore}
            userRole={userRole}
            onSyncResult={onSyncResult}
            lastFinishedMatchId={lastFinishedMatchId}
            setTargetElement={setTargetElement}
          />
          <ScrollToLastFinishedButton
            visible={lastFinishedMatchId !== null && showButton}
            onClick={scrollToTarget}
            dict={dict}
          />
        </>
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
                userRole={userRole}
                onSyncResult={onSyncResult}
              />
            ))}
          </div>
          <KnockoutSection
            knockoutMatches={knockoutMatches}
            dict={dict}
            lang={lang}
            isApproved={isApproved}
            onSaveScore={onSaveScore}
            userRole={userRole}
            onSyncResult={onSyncResult}
          />
        </>
      )}
    </div>
  )
}
