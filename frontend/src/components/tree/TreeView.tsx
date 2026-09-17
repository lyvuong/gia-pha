import {
  Background,
  Controls,
  ReactFlow,
  useReactFlow,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEffect, useMemo, useState, type Ref } from 'react'
import { setTreePosition, setUnionTreePosition } from '../../hooks/useMembers'
import { computeTreeLayout, NODE_HEIGHT, NODE_WIDTH } from '../../lib/treeLayout'
import type { Member } from '../../types/models'
import { ElbowEdge } from './ElbowEdge'
import { GroupDivider } from './GroupDivider'
import { MemberNode } from './MemberNode'
import { SpouseEdge } from './SpouseEdge'
import { UnionNode } from './UnionNode'

const nodeTypes = { memberNode: MemberNode, unionNode: UnionNode, groupDivider: GroupDivider }
const edgeTypes = { spouseEdge: SpouseEdge, elbowEdge: ElbowEdge }

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
  giaPhaId: string
  currentUid: string
  members: Member[]
  selectedMemberId: string | null
  centerOnMemberId: string | null
  onSelectMember: (member: Member) => void
  containerRef?: Ref<HTMLDivElement>
}

export function TreeView({ giaPhaId, currentUid, members, selectedMemberId, centerOnMemberId, onSelectMember, containerRef }: TreeViewProps) {
  const { nodes, edges } = useMemo(() => computeTreeLayout(members), [members])
  // Tracks whichever node is mid-drag so it can get a boundary-box outline — separate
  // from `selected`, since the drag target isn't necessarily the selected member.
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const styledNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        selected: n.id === selectedMemberId,
        className: n.id === draggingId ? 'tree-node-dragging' : undefined,
      })),
    [nodes, selectedMemberId, draggingId],
  )

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    const member = members.find((m) => m.id === node.id)
    if (member) onSelectMember(member)
  }

  function handleNodeDragStart(_event: unknown, node: Node) {
    setDraggingId(node.id)
  }

  // Dragging a box only ever moves that one member — see `setTreePosition` / the tree
  // layout's own handling of `Member.treePosition` — so a manual nudge to dodge a line
  // crossing never shifts anyone else's box. A connector dot can be dragged too (see
  // `setUnionTreePosition`), independent of either spouse's own box.
  function handleNodeDragStop(_event: unknown, node: Node) {
    setDraggingId(null)
    if (node.type === 'memberNode') {
      void setTreePosition(giaPhaId, node.id, { x: node.position.x, y: node.position.y }, currentUid)
    } else if (node.type === 'unionNode') {
      const data = node.data as Record<string, unknown>
      const spouseId = data.spouseId as string | undefined
      const anchorId = data.anchorId as string | undefined
      const spouseNode = spouseId ? nodes.find((n) => n.id === spouseId) : undefined
      const anchorNode = anchorId ? nodes.find((n) => n.id === anchorId) : undefined
      if (!spouseId || !spouseNode || !anchorNode) return

      // Never leave the dot floating at an arbitrary drop point — snap to whichever of
      // two clean spots it was dropped closer to: sitting right on the spouse's own
      // connector handle (a plain straight line to her, whatever her row), or sitting at
      // the true center of the direct line between the couple (the classic union-dot
      // look for an ordinary adjacent couple).
      const edgeCenter = { x: spouseNode.position.x + NODE_WIDTH, y: spouseNode.position.y + NODE_HEIGHT / 2 }
      const lineCenter = {
        x: (anchorNode.position.x + spouseNode.position.x) / 2 + NODE_WIDTH / 2,
        y: (anchorNode.position.y + spouseNode.position.y) / 2 + NODE_HEIGHT / 2,
      }
      const dropped = node.position
      const distanceTo = (p: { x: number; y: number }) => Math.hypot(p.x - dropped.x, p.y - dropped.y)
      const snapped = distanceTo(edgeCenter) <= distanceTo(lineCenter) ? edgeCenter : lineCenter
      void setUnionTreePosition(giaPhaId, spouseId, snapped, currentUid)
    }
  }

  return (
    <div ref={containerRef} className="tree-view-container">
      <ReactFlow
        nodes={styledNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        fitView
      >
        <Background />
        <Controls />
        <CenterOnMember memberId={centerOnMemberId} />
      </ReactFlow>
    </div>
  )
}
