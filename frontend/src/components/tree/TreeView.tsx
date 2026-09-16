import {
  Background,
  Controls,
  ReactFlow,
  useReactFlow,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEffect, useMemo, type Ref } from 'react'
import { computeTreeLayout, NODE_HEIGHT, NODE_WIDTH } from '../../lib/treeLayout'
import type { Member } from '../../types/models'
import { MemberNode } from './MemberNode'
import { SpouseEdge } from './SpouseEdge'
import { UnionNode } from './UnionNode'

const nodeTypes = { memberNode: MemberNode, unionNode: UnionNode }
const edgeTypes = { spouseEdge: SpouseEdge }

interface CenterOnMemberProps {
  memberId: string | null
}

/** Rendered as a child of <ReactFlow> so it can call useReactFlow() to pan to a searched member. */
function CenterOnMember({ memberId }: CenterOnMemberProps) {
  const { getNode, setCenter } = useReactFlow()

  useEffect(() => {
    if (!memberId) return
    const node = getNode(memberId)
    if (node) {
      setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + NODE_HEIGHT / 2, { zoom: 1, duration: 400 })
    }
  }, [memberId, getNode, setCenter])

  return null
}

interface TreeViewProps {
  members: Member[]
  selectedMemberId: string | null
  centerOnMemberId: string | null
  onSelectMember: (member: Member) => void
  containerRef?: Ref<HTMLDivElement>
}

export function TreeView({ members, selectedMemberId, centerOnMemberId, onSelectMember, containerRef }: TreeViewProps) {
  const { nodes, edges } = useMemo(() => computeTreeLayout(members), [members])

  const styledNodes = useMemo(
    () => nodes.map((n) => (n.id === selectedMemberId ? { ...n, selected: true } : n)),
    [nodes, selectedMemberId],
  )

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    const member = members.find((m) => m.id === node.id)
    if (member) onSelectMember(member)
  }

  return (
    <div ref={containerRef} className="tree-view-container">
      <ReactFlow
        nodes={styledNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        fitView
      >
        <Background />
        <Controls />
        <CenterOnMember memberId={centerOnMemberId} />
      </ReactFlow>
    </div>
  )
}
