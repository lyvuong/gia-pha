import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useParams } from 'react-router-dom'
import { AddMemberIcon, TrashIcon } from '../components/common/icons'
import { ChartInfo } from '../components/common/ChartInfo'
import { LanguageToggle } from '../components/common/LanguageToggle'
import { Logo } from '../components/common/Logo'
import { SearchBar } from '../components/common/SearchBar'
import { ThemeToggle } from '../components/common/ThemeToggle'
import { UserMenu } from '../components/common/UserMenu'
import { MemberDetailPanel } from '../components/member/MemberDetailPanel'
import { MemberEditForm } from '../components/member/MemberEditForm'
import { TrashPanel } from '../components/member/TrashPanel'
import { PdfExportButton } from '../components/pdf/PdfExportButton'
import { KinshipSummary } from '../components/tree/KinshipSummary'
import { TreeView } from '../components/tree/TreeView'
import { useAuth } from '../context/AuthProvider'
import { updateGiaPhaName, useGiaPha } from '../hooks/useGiaPha'
import { setEditorProfile, useEditorProfiles } from '../hooks/useEditorProfiles'
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

  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [rootMemberId, setRootMemberId] = useState<string | null>(null)
  const [chartType, setChartType] = useState<ChartType>('full')
  const [extendedReach, setExtendedReach] = useState(DEFAULT_EXTENDED_REACH)
  const [kinshipTargetId, setKinshipTargetId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [showingTrash, setShowingTrash] = useState(false)
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

  function showChartFor(id: string, type: ChartType = 'pedigree') {
    setRootMemberId(id)
    setChartType(type)
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
          onSelectMember={(m) => {
            setShowingTrash(false)
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
            setAdding(true)
          }}
          title={t('tree.addMember')}
        >
          <AddMemberIcon size={15} />
          <span className="btn-label">{t('tree.addMember')}</span>
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={() => {
            setSelectedMember(null)
            setAdding(false)
            setShowingTrash(true)
          }}
          title={t('tree.trash')}
        >
          <TrashIcon size={15} />
          <span className="btn-label">
            {t('tree.trash')}
            {deletedMembers.length > 0 && ` (${deletedMembers.length})`}
          </span>
        </button>
        <PdfExportButton giaPhaName={giaPha.name} members={members} treeContainerRef={treeContainerRef} />
        <ThemeToggle />
        <LanguageToggle />
        <UserMenu />
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
            setSelectedMember(m)
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

        {!adding && !showingTrash && selectedMember && (
          <MemberDetailPanel
            giaPha={giaPha}
            member={selectedMember}
            members={members}
            currentUid={user.uid}
            editorNames={editorNames}
            onClose={() => setSelectedMember(null)}
            onDeleted={() => setSelectedMember(null)}
            onViewPedigree={() => showChartFor(selectedMember.id, 'pedigree')}
            onViewDescendants={() => showChartFor(selectedMember.id, 'descendant')}
          />
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
