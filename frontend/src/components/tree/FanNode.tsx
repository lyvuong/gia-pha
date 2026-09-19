import type { NodeProps } from '@xyflow/react'
import type { FanLayout, FanTextLine } from '../../lib/fanLayout'
import type { TreeNode } from '../../lib/treeLayout'

export interface FanNodeData extends Record<string, unknown> {
  fan: FanLayout
  selectedMemberId: string | null
  onSelectMember: (memberId: string) => void
}

function Lines({ lines }: { lines: FanTextLine[] }) {
  return (
    <>
      {lines.map((line, i) => (
        <text
          key={i}
          y={line.dy}
          fontSize={line.size}
          textAnchor="middle"
          dominantBaseline="central"
          className={line.muted ? 'fan-text fan-text-muted' : 'fan-text'}
        >
          {line.text}
        </text>
      ))}
    </>
  )
}

/** The whole fan chart as one React Flow node, so it gets the same pan/zoom/fit behavior as the other charts. */
export function FanNode({ data }: NodeProps<TreeNode>) {
  const { fan, selectedMemberId, onSelectMember } = data as unknown as FanNodeData

  return (
    <svg width={fan.width} height={fan.height} className="fan-chart">
      {fan.wedges.map((w) => (
        <g
          key={`${w.ring}-${w.path}`}
          className={`fan-wedge${w.member.id === selectedMemberId ? ' fan-wedge-selected' : ''}`}
          data-gender={w.member.gender ?? 'unknown'}
          onClick={() => onSelectMember(w.member.id)}
        >
          <title>{w.member.fullName}</title>
          <path d={w.path} />
          <g transform={`translate(${w.textX} ${w.textY}) rotate(${w.rotate})`} pointerEvents="none">
            <Lines lines={w.lines} />
          </g>
        </g>
      ))}
      <g
        className={`fan-wedge fan-root${fan.root.id === selectedMemberId ? ' fan-wedge-selected' : ''}`}
        data-gender={fan.root.gender ?? 'unknown'}
        onClick={() => onSelectMember(fan.root.id)}
      >
        <title>{fan.root.fullName}</title>
        <circle cx={fan.cx} cy={fan.cy} r={fan.rootRadius} />
        <g transform={`translate(${fan.cx} ${fan.cy})`} pointerEvents="none">
          <Lines lines={fan.rootLines} />
        </g>
      </g>
    </svg>
  )
}
