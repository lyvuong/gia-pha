import { Background, Controls, ReactFlow, useReactFlow, type NodeMouseHandler } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEffect, useMemo, type Ref } from 'react'
import type { ChartType } from '../../lib/chartViews'
import { computeFanLayout } from '../../lib/fanLayout'
import { computeTreeLayout, findEldestChildIds, type TreeNode } from '../../lib/treeLayout'
import type { Member } from '../../types/models'
import { ElbowEdge } from './ElbowEdge'
import { FanNode } from './FanNode'
import { GroupDivider } from './GroupDivider'
import { MemberNode } from './MemberNode'
import { UnionNode } from './UnionNode'

const nodeTypes = { memberNode: MemberNode, unionNode: UnionNode, groupDivider: GroupDivider, fanNode: FanNode }
const edgeTypes = { elbowEdge: ElbowEdge }

/** Rendered as a child of <ReactFlow>: re-fits the viewport whenever `viewKey` changes
 * (a different root person or chart type), since <ReactFlow fitView> only fits on mount. */
function FitOnChange({ viewKey }: { viewKey: string }) {
  const { fitView } = useReactFlow()

  useEffect(() => {
    // Wait a frame so the new nodes have been measured.
    const frame = requestAnimationFrame(() => fitView({ duration: 400, padding: 0.1 }))
    return () => cancelAnimationFrame(frame)
  }, [viewKey, fitView])

  return null
}

interface TreeViewProps {
  members: Member[]
  /** Everyone in the tree, not just this chart's `members` — for tree-wide facts like who
   * is an eldest son, which a filtered chart alone can't decide. */
  allMembers: Member[]
  chartType: ChartType
  /** The person the chart is centered on, or null for the full tree. */
  rootId: string | null
  selectedMemberId: string | null
  /** Identifies the current root person + chart type; the viewport re-fits when it changes. */
  viewKey: string
  onSelectMember: (member: Member) => void
  containerRef?: Ref<HTMLDivElement>
}

export function TreeView({ members, allMembers, chartType, rootId, selectedMemberId, viewKey, onSelectMember, containerRef }: TreeViewProps) {
  const isFan = chartType === 'fan' && rootId !== null
  const { nodes, edges } = useMemo(() => {
    if (isFan) {
      const fan = computeFanLayout(members, rootId)
      if (!fan) return { nodes: [], edges: [] }
      const fanNode: TreeNode = {
        id: 'fan-chart',
        type: 'fanNode',
        position: { x: 0, y: 0 },
        width: fan.width,
        height: fan.height,
        draggable: false,
        selectable: false,
        data: {
          fan,
          selectedMemberId,
          onSelectMember: (id: string) => {
            const member = members.find((m) => m.id === id)
            if (member) onSelectMember(member)
          },
        },
      }
      return { nodes: [fanNode], edges: [] }
    }
    return computeTreeLayout(members)
  }, [members, isFan, rootId, selectedMemberId, onSelectMember])

  const eldestSonIds = useMemo(() => findEldestChildIds(allMembers, 'male'), [allMembers])
  const eldestDaughterIds = useMemo(() => findEldestChildIds(allMembers, 'female'), [allMembers])

  const styledNodes = useMemo(
    () =>
      nodes.map((n) =>
        isFan
          ? n
          : n.type === 'memberNode'
            ? {
                ...n,
                selected: n.id === selectedMemberId,
                data: { ...n.data, isEldestSon: eldestSonIds.has(n.id), isEldestDaughter: eldestDaughterIds.has(n.id) },
              }
            : { ...n, selected: n.id === selectedMemberId },
      ),
    [nodes, selectedMemberId, isFan, eldestSonIds, eldestDaughterIds],
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
        nodesDraggable={false}
        minZoom={0.02}
        fitView
      >
        <Background />
        <Controls />
        <FitOnChange viewKey={viewKey} />
      </ReactFlow>
    </div>
  )
}
