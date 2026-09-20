import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useParams } from 'react-router-dom'
import { AddMemberIcon } from '../components/common/icons'
import { ChartInfo } from '../components/common/ChartInfo'
import { LanguageToggle } from '../components/common/LanguageToggle'
import { Logo } from '../components/common/Logo'
import { SearchBar } from '../components/common/SearchBar'
import { ThemeToggle } from '../components/common/ThemeToggle'
import { UserMenu } from '../components/common/UserMenu'
import { MemberDetailPanel } from '../components/member/MemberDetailPanel'
import { AllowedPhonesPanel } from '../components/member/AllowedPhonesPanel'
import { JoinRequestsPanel } from '../components/member/JoinRequestsPanel'
import { MyProfilePanel } from '../components/member/MyProfilePanel'
import { MemberEditForm } from '../components/member/MemberEditForm'
import { TrashPanel } from '../components/member/TrashPanel'
import { PdfExportButton } from '../components/pdf/PdfExportButton'
import { KinshipSummary } from '../components/tree/KinshipSummary'
import { TreeView } from '../components/tree/TreeView'
import { useAuth } from '../context/AuthProvider'
import { updateGiaPhaName, useGiaPha } from '../hooks/useGiaPha'
import { setEditorProfile, linkProfileToMember, signInKindOf, useEditorProfiles, useProfileLinks } from '../hooks/useEditorProfiles'
import { usePendingJoinRequests } from '../hooks/useJoinRequests'
import { useMembers } from '../hooks/useMembers'
import { findKinship } from '../lib/kinship'
import {
  AVAILABLE_CHART_TYPES,
  CHART_TYPE_OPTIONS,
  DEFAULT_EXTENDED_REACH,
  MAX_EXTENDED_REACH,
  selectMembersForChart,
  type ChartType,
} from '../lib/chartViews'
import type { Member } from '../types/models'

export function TreePage() {
  const { t } = useTranslation()
  const { giaPhaId } = useParams<{ giaPhaId: string }>()
  const { user, loading: authLoading } = useAuth()
  const { giaPha, loading: giaPhaLoading } = useGiaPha(giaPhaId)
  const { members, deletedMembers, loading: membersLoading } = useMembers(giaPhaId)
  const editorNames = useEditorProfiles(giaPhaId)
  const joinRequests = usePendingJoinRequests(giaPhaId)
  const { links: profileLinks, loaded: profileLinksLoaded } = useProfileLinks(giaPhaId)

  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [rootMemberId, setRootMemberId] = useState<string | null>(null)
  const [chartType, setChartType] = useState<ChartType>('full')
  const [extendedReach, setExtendedReach] = useState(DEFAULT_EXTENDED_REACH)
  const [kinshipTargetId, setKinshipTargetId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [showingTrash, setShowingTrash] = useState(false)
  const [showingRequests, setShowingRequests] = useState(false)
  const [showingAllowed, setShowingAllowed] = useState(false)
  // Asks a member who they are in the tree until they answer (or dismiss it for this visit).
  const [profilePromptDismissed, setProfilePromptDismissed] = useState(false)
  const [showingProfilePicker, setShowingProfilePicker] = useState(false)
  const [pendingSelectId, setPendingSelectId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const treeContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (giaPha && user && !editorNames[user.uid]) {
      setEditorProfile(giaPha.id, user.uid, user.displayName ?? user.phoneNumber ?? user.uid)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [giaPha?.id, user?.uid])

  useEffect(() => {
    if (selectedMember) {
      const fresh = members.find((m) => m.id === selectedMember.id)
      setSelectedMember(fresh ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members])

  // Links made before the sign-in kind was recorded get it filled in the next time that person visits.
  const myLink = user ? profileLinks[user.uid] : undefined
  useEffect(() => {
    if (giaPha && user && myLink && !myLink.provider) {
      void linkProfileToMember(giaPha.id, user.uid, myLink.memberId, signInKindOf(user))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [giaPha?.id, user?.uid, myLink?.memberId, myLink?.provider])

  // After picking or adding themselves, open that profile once it has arrived in the members list.
  useEffect(() => {
    if (!pendingSelectId) return
    const found = members.find((m) => m.id === pendingSelectId)
    if (found) {
      setSelectedMember(found)
      setPendingSelectId(null)
    }
  }, [members, pendingSelectId])

  // The root is dropped if the person is deleted while being viewed.
  const rootId = rootMemberId && members.some((m) => m.id === rootMemberId) ? rootMemberId : null
  const targetId = kinshipTargetId && members.some((m) => m.id === kinshipTargetId) ? kinshipTargetId : null
  const kinship = useMemo(
    () => (chartType === 'kinship' && rootId && targetId ? findKinship(members, rootId, targetId) : null),
    [members, chartType, rootId, targetId],
  )
  const chartMembers = useMemo(
    () => selectMembersForChart(members, rootId ? chartType : 'full', rootId, { extendedReach, kinship }),
    [members, chartType, rootId, extendedReach, kinship],
  )
  const rootMember = rootId ? members.find((m) => m.id === rootId) ?? null : null
  const targetMember = targetId ? members.find((m) => m.id === targetId) ?? null : null

  // Choosing someone keeps the chart type already in use; with none chosen yet (full tree) it starts on the family group chart.
  function showChartFor(id: string, type?: ChartType) {
    setRootMemberId(id)
    setChartType(type ?? (chartType === 'full' ? 'familyGroup' : chartType))
  }

  function showFullTree() {
    setRootMemberId(null)
    setChartType('full')
  }

  // Signed out (or never signed in): the login page is served at "/".
  if (!authLoading && !user) return <Navigate to="/" replace />
  if (authLoading || giaPhaLoading || membersLoading) return <p className="page-status">{t('common.loading')}</p>
  if (!giaPha || !user) return null

  const isMember = giaPha.editors.includes(user.uid) || giaPha.ownerUid === user.uid
  if (!isMember) return <p className="page-status">{t('join.notFound')}</p>

  // Which family member this signed-in person is (if they've said, and that person still exists).
  const myMember = members.find((m) => m.id === profileLinks[user.uid]?.memberId) ?? null
  // A Google and a phone account may be the same person, but two accounts of one kind may not.
  const myKind = signInKindOf(user)
  const takenMemberIds = new Set(
    Object.entries(profileLinks)
      .filter(([uid, link]) => uid !== user.uid && link.provider === myKind)
      .map(([, link]) => link.memberId),
  )
  // Someone who has said who they are is shown by that person's name, not their phone number.
  const nameByUid: Record<string, string> = { ...editorNames }
  for (const [uid, link] of Object.entries(profileLinks)) {
    const linked = members.find((m) => m.id === link.memberId)
    if (linked) nameByUid[uid] = linked.fullName
  }
  const showProfilePicker = showingProfilePicker || (profileLinksLoaded && !myMember && !profilePromptDismissed)

  function openMyProfile() {
    if (!myMember) {
      setShowingProfilePicker(true)
      return
    }
    setAdding(false)
    setShowingTrash(false)
    setShowingRequests(false)
    setShowingAllowed(false)
    setShowingProfilePicker(false)
    setSelectedMember(myMember)
  }

  function startEditingName() {
    setNameDraft(giaPha!.name)
    setEditingName(true)
  }

  async function saveName() {
    const trimmed = nameDraft.trim()
    setEditingName(false)
    if (trimmed && trimmed !== giaPha!.name) {
      await updateGiaPhaName(giaPha!, trimmed)
    }
  }

  return (
    <div className="tree-page">
      <header className="tree-page-header">
        <Logo size={36} onDark />
        {editingName ? (
          <input
            className="tree-title-input"
            value={nameDraft}
            autoFocus
            onFocus={(e) => e.target.select()}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveName()
              if (e.key === 'Escape') setEditingName(false)
            }}
          />
        ) : (
          <h1 className="tree-title" onClick={startEditingName} title={t('tree.renameHint')}>
            {giaPha.name}
          </h1>
        )}
        <SearchBar
          members={members}
          selectedName={rootMember?.fullName}
          onSelectMember={(m) => {
            setShowingTrash(false)
            setShowingRequests(false)
            setSelectedMember(m)
            showChartFor(m.id)
          }}
        />
        {rootId && (
          <div className="chart-type-select">
            <select
              value={chartType}
              aria-label={t('tree.chartType')}
              onChange={(e) => setChartType(e.target.value as ChartType)}
            >
              {CHART_TYPE_OPTIONS.map((type) => {
                const available = AVAILABLE_CHART_TYPES.includes(type)
                return (
                  <option key={type} value={type} disabled={!available}>
                    {t(`tree.chart_${type}`)}
                    {!available && ` (${t('tree.comingSoon')})`}
                  </option>
                )
              })}
            </select>
            {chartType === 'extended' && (
              <div className="reach-control" role="group" aria-label={t('tree.reach')}>
                <span>{t('tree.reach')}</span>
                <button
                  type="button"
                  onClick={() => setExtendedReach((r) => Math.max(1, r - 1))}
                  disabled={extendedReach <= 1}
                  aria-label={t('tree.reachLess')}
                >
                  −
                </button>
                <strong>{extendedReach}</strong>
                <button
                  type="button"
                  onClick={() => setExtendedReach((r) => Math.min(MAX_EXTENDED_REACH, r + 1))}
                  disabled={extendedReach >= MAX_EXTENDED_REACH}
                  aria-label={t('tree.reachMore')}
                >
                  +
                </button>
              </div>
            )}
            {chartType === 'kinship' && (
              <div className="kinship-picker">
                {targetMember ? (
                  <>
                    <span className="kinship-target">{targetMember.fullName}</span>
                    <button
                      type="button"
                      className="icon-button"
                      title={t('tree.kinshipSwap')}
                      aria-label={t('tree.kinshipSwap')}
                      onClick={() => {
                        setRootMemberId(targetMember.id)
                        setKinshipTargetId(rootId)
                      }}
                    >
                      ⇄
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      title={t('tree.kinshipClear')}
                      aria-label={t('tree.kinshipClear')}
                      onClick={() => setKinshipTargetId(null)}
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <SearchBar
                    members={members}
                    placeholder={t('tree.kinshipRelateTo')}
                    onSelectMember={(m) => setKinshipTargetId(m.id)}
                  />
                )}
              </div>
            )}
            <ChartInfo chartType={chartType} />
            <button type="button" className="icon-button" onClick={showFullTree}>
              <span className="btn-label">{t('tree.showFullTree')}</span>
              <span aria-hidden="true">×</span>
            </button>
          </div>
        )}
        <button
          type="button"
          className="icon-button"
          onClick={() => {
            setShowingTrash(false)
            setShowingRequests(false)
            setAdding(true)
          }}
          title={t('tree.addMember')}
        >
          <AddMemberIcon size={15} />
          <span className="btn-label">{t('tree.addMember')}</span>
        </button>
        {joinRequests.length > 0 && (
          <button
            type="button"
            className="icon-button"
            onClick={() => {
              setSelectedMember(null)
              setAdding(false)
              setShowingTrash(false)
              setShowingRequests(true)
            }}
            title={t('tree.requests')}
          >
            <AddMemberIcon size={15} />
            <span className="btn-label">{t('tree.requests')} ({joinRequests.length})</span>
          </button>
        )}
        <PdfExportButton giaPhaName={giaPha.name} members={members} treeContainerRef={treeContainerRef} />
        <ThemeToggle />
        <LanguageToggle />
        <UserMenu
          inviteLink={giaPha.inviteCode ? `${window.location.origin}/join/${giaPha.inviteCode}` : undefined}
          trashCount={deletedMembers.length}
          displayName={myMember?.fullName}
          onOpenProfile={openMyProfile}
          onOpenInviteByPhone={() => {
            setSelectedMember(null)
            setAdding(false)
            setShowingTrash(false)
            setShowingRequests(false)
            setShowingProfilePicker(false)
            setShowingAllowed(true)
          }}
          onOpenTrash={() => {
            setSelectedMember(null)
            setAdding(false)
            setShowingRequests(false)
            setShowingAllowed(false)
            setShowingTrash(true)
          }}
        />
      </header>

      <div className="tree-page-body">
        {chartType === 'kinship' && rootMember && (
          <KinshipSummary members={members} root={rootMember} target={targetMember} kinship={kinship} />
        )}
        <TreeView
          members={chartMembers}
          chartType={rootId ? chartType : 'full'}
          rootId={rootId}
          selectedMemberId={selectedMember?.id ?? null}
          viewKey={`${rootId ?? ''}:${rootId ? chartType : 'full'}:${chartType === 'extended' ? extendedReach : ''}:${chartType === 'kinship' ? targetId ?? '' : ''}`}
          onSelectMember={(m) => {
            setShowingTrash(false)
            setShowingRequests(false)
            setSelectedMember(m)
            // Only the first pick fills the search bar and chooses the chart; after that a click just opens the details.
            if (!rootId) showChartFor(m.id)
          }}
          containerRef={treeContainerRef}
        />

        {adding && (
          <div className="member-detail-panel">
            <MemberEditForm
              giaPhaId={giaPha.id}
              member={null}
              members={members}
              currentUid={user.uid}
              onSaved={() => setAdding(false)}
              onCancel={() => setAdding(false)}
            />
          </div>
        )}

        {showProfilePicker && (
          <MyProfilePanel
            giaPhaId={giaPha.id}
            currentUid={user.uid}
            signInKind={myKind}
            members={members}
            takenMemberIds={takenMemberIds}
            defaultName={user.displayName ?? ''}
            onLinked={(memberId) => {
              setShowingProfilePicker(false)
              setPendingSelectId(memberId)
            }}
            onClose={() => {
              setShowingProfilePicker(false)
              setProfilePromptDismissed(true)
            }}
          />
        )}

        {!showProfilePicker && !adding && !showingTrash && !showingRequests && selectedMember && (
          <MemberDetailPanel
            giaPha={giaPha}
            member={selectedMember}
            members={members}
            currentUid={user.uid}
            editorNames={nameByUid}
            onClose={() => setSelectedMember(null)}
            onDeleted={() => setSelectedMember(null)}
            onViewPedigree={() => showChartFor(selectedMember.id, 'pedigree')}
            onViewDescendants={() => showChartFor(selectedMember.id, 'descendant')}
          />
        )}

        {showingAllowed && (
          <AllowedPhonesPanel giaPhaId={giaPha.id} currentUid={user.uid} onClose={() => setShowingAllowed(false)} />
        )}

        {showingRequests && (
          <JoinRequestsPanel giaPhaId={giaPha.id} requests={joinRequests} onClose={() => setShowingRequests(false)} />
        )}

        {showingTrash && (
          <TrashPanel
            giaPhaId={giaPha.id}
            deletedMembers={deletedMembers}
            currentUid={user.uid}
            onClose={() => setShowingTrash(false)}
          />
        )}
      </div>
    </div>
  )
}
