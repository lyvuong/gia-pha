import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { LanguageToggle } from '../components/common/LanguageToggle'
import { SearchBar } from '../components/common/SearchBar'
import { MemberDetailPanel } from '../components/member/MemberDetailPanel'
import { MemberEditForm } from '../components/member/MemberEditForm'
import { PdfExportButton } from '../components/pdf/PdfExportButton'
import { TreeView } from '../components/tree/TreeView'
import { useAuth } from '../context/AuthProvider'
import { useGiaPha } from '../hooks/useGiaPha'
import { setEditorProfile, useEditorProfiles } from '../hooks/useEditorProfiles'
import { useMembers } from '../hooks/useMembers'
import type { Member } from '../types/models'

export function TreePage() {
  const { t } = useTranslation()
  const { giaPhaId } = useParams<{ giaPhaId: string }>()
  const { user } = useAuth()
  const { giaPha, loading: giaPhaLoading } = useGiaPha(giaPhaId)
  const { members, loading: membersLoading } = useMembers(giaPhaId)
  const editorNames = useEditorProfiles(giaPhaId)

  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [centerOnMemberId, setCenterOnMemberId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
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

  if (giaPhaLoading || membersLoading) return <p className="page-status">{t('common.loading')}</p>
  if (!giaPha || !user) return null

  const isMember = giaPha.editors.includes(user.uid) || giaPha.ownerUid === user.uid
  if (!isMember) return <p className="page-status">{t('join.notFound')}</p>

  return (
    <div className="tree-page">
      <header className="tree-page-header">
        <h1>{giaPha.name}</h1>
        <SearchBar
          members={members}
          onSelectMember={(m) => {
            setSelectedMember(m)
            setCenterOnMemberId(m.id)
          }}
        />
        <button type="button" onClick={() => setAdding(true)}>{t('tree.addMember')}</button>
        <PdfExportButton giaPhaName={giaPha.name} members={members} treeContainerRef={treeContainerRef} />
        <LanguageToggle />
      </header>

      <div className="tree-page-body">
        <TreeView
          members={members}
          selectedMemberId={selectedMember?.id ?? null}
          centerOnMemberId={centerOnMemberId}
          onSelectMember={setSelectedMember}
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

        {!adding && selectedMember && (
          <MemberDetailPanel
            giaPha={giaPha}
            member={selectedMember}
            members={members}
            currentUid={user.uid}
            editorNames={editorNames}
            onClose={() => setSelectedMember(null)}
            onDeleted={() => setSelectedMember(null)}
          />
        )}
      </div>
    </div>
  )
}
