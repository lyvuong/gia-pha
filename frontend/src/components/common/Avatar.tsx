const COLORS = ['#7A1A27', '#B5622F', '#3E6B5C', '#2B4C6F', '#6B4A8A']

function colorForName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return COLORS[hash % COLORS.length]
}

function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return '?'
  return parts[parts.length - 1][0]?.toUpperCase() ?? '?'
}

interface AvatarProps {
  name: string
  photoUrl?: string | null
  size?: number
  /** Overrides the usual name-hash background — e.g. a child of a remarried anchor's
   * several wives is colored to match their own mother's union color instead (see
   * `TreeNodeData.avatarColor`). */
  colorOverride?: string
}

export function Avatar({ name, photoUrl, size = 48, colorOverride }: AvatarProps) {
  const style = { width: size, height: size, fontSize: size * 0.4 }

  if (photoUrl) {
    return <img src={photoUrl} alt={name} className="avatar avatar-photo" style={style} />
  }

  return (
    <div className="avatar avatar-initials" style={{ ...style, background: colorOverride ?? colorForName(name) }}>
      {initialsForName(name)}
    </div>
  )
}
