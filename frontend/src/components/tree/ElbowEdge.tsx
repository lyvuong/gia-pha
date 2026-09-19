import type { EdgeProps } from '@xyflow/react'

/** A right-angle connector with an exact, fully explicit path — rather than react-flow's
 * own smoothstep routing, which adds a small automatic offset near each end. That offset
 * is invisible most of the time, but breaks the one thing this edge exists for: several
 * edges pinned to the *same* centerX need to render as pixel-identical, truly overlapping
 * lines (one shared trunk), and several edges pinned to *different* centerX values need
 * to never share a coordinate at all. A hand-built path guarantees both exactly, with no
 * hidden rounding.
 *
 * Deliberately never bakes an estimated source/target coordinate into the path — only
 * `sourceX`/`sourceY`/`targetX`/`targetY` (react-flow's own measured handle positions) are
 * used for the legs touching the endpoints. `data.centerX` and `data.viaY` are the only
 * "free" values the layout supplies, and both are independent routing choices (a bend x,
 * an extra detour row) rather than an estimate of where the endpoint's handle actually
 * is — an earlier version passed a whole list of corner points including a guessed
 * source/target y, which was *usually* right but occasionally a few pixels off from the
 * real measured handle (box height isn't perfectly fixed), turning what should be a
 * horizontal or vertical leg into a barely-visible diagonal. */
interface ElbowEdgeData extends Record<string, unknown> {
  centerX?: number
  viaY?: number
  /** Trunk/spine mode: several children sharing one source draw their *shared* leg
   * (source straight down to `viaY`, then the full horizontal bar under all of them) only
   * once, via a single edge carrying this — see `legOnly` for the rest. Without this
   * split, every one of N children's own full path retraced that same shared leg, so it
   * rendered N times thicker near the source than out at the single farthest child, where
   * only one child's path still reached. */
  spanLoX?: number
  spanHiX?: number
  /** The complement of `spanLoX`/`spanHiX`: this child's own short branch down from the
   * shared bar (already drawn by the trunk edge) to itself — deliberately skips the leg
   * from the source down to `viaY` that a full path would otherwise retrace. */
  legOnly?: boolean
  /** Paired with `spanLoX`/`spanHiX`: draws only the horizontal bar itself, skipping the
   * `sourceX`/`sourceY`-to-`viaY` leg that mode normally leads with — for a merged bar
   * shared by *several* remarried spouses' own trunks (see `mergedBarYByAnchorId`), where
   * each spouse already draws her own short drop into the bar as her own zero-width
   * `spanLoX`/`spanHiX` edge; a plain (non-`barOnly`) edge for the bar itself would add a
   * spurious extra leg down from whichever single node got picked as its `source`, which
   * isn't where any real line is meant to start. */
  barOnly?: boolean
}

/** Connectors with no union color of their own (a parent with no recorded spouse, or the
 * shared bar of several wives) still need a stroke, or they draw nothing at all: the path is
 * built by hand and so gets none of react-flow's default edge styling. */
const DEFAULT_STROKE = 'var(--color-gold-dark)'

export function ElbowEdge({ sourceX, sourceY, targetX, targetY, data, style: edgeStyle }: EdgeProps) {
  const info = data as ElbowEdgeData | undefined
  const style = { ...edgeStyle, stroke: edgeStyle?.stroke ?? DEFAULT_STROKE }
  if (info?.spanLoX !== undefined && info.spanHiX !== undefined && info.viaY !== undefined) {
    const path = info.barOnly
      ? `M ${info.spanLoX} ${info.viaY} L ${info.spanHiX} ${info.viaY}`
      : `M ${sourceX} ${sourceY} L ${sourceX} ${info.viaY} M ${info.spanLoX} ${info.viaY} L ${info.spanHiX} ${info.viaY}`
    return <path fill="none" style={style} d={path} />
  }
  const bendX = info?.centerX ?? (sourceX + targetX) / 2
  if (info?.legOnly && info.viaY !== undefined) {
    const path = `M ${bendX} ${info.viaY} L ${bendX} ${targetY} L ${targetX} ${targetY}`
    return <path fill="none" style={style} d={path} />
  }
  const path =
    info?.viaY !== undefined
      ? `M ${sourceX} ${sourceY} L ${sourceX} ${info.viaY} L ${bendX} ${info.viaY} L ${bendX} ${targetY} L ${targetX} ${targetY}`
      : `M ${sourceX} ${sourceY} L ${bendX} ${sourceY} L ${bendX} ${targetY} L ${targetX} ${targetY}`
  return <path fill="none" style={style} d={path} />
}
