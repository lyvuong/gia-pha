interface IconProps {
  size?: number
}

const commonProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function SearchIcon({ size = 16 }: IconProps) {
  return (
    <svg {...commonProps} width={size} height={size} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

export function AddMemberIcon({ size = 16 }: IconProps) {
  return (
    <svg {...commonProps} width={size} height={size} aria-hidden="true">
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21c0-4.4 3.6-7 7-7s7 2.6 7 7" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="16" y1="11" x2="22" y2="11" />
    </svg>
  )
}

export function ExportIcon({ size = 16 }: IconProps) {
  return (
    <svg {...commonProps} width={size} height={size} aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 21h16" />
    </svg>
  )
}
