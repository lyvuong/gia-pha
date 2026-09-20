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

export function TrashIcon({ size = 16 }: IconProps) {
  return (
    <svg {...commonProps} width={size} height={size} aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

/** A wastebasket with a recycling arrow inside: deleted people can be restored from it. */
export function RecycleBinIcon({ size = 16 }: IconProps) {
  return (
    <svg {...commonProps} width={size} height={size} aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
      <path d="M14.5 11.5A3 3 0 1 0 15 14.5" strokeWidth={1.6} />
      <path d="M14.8 9.2v2.6h-2.6" strokeWidth={1.6} />
    </svg>
  )
}

export function LanguageIcon({ size = 16 }: IconProps) {
  return (
    <svg {...commonProps} width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="3" y1="14" x2="21" y2="14" />
    </svg>
  )
}

export function InfoIcon({ size = 16 }: IconProps) {
  return (
    <svg {...commonProps} width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="12" y1="7.5" x2="12" y2="7.5" />
    </svg>
  )
}
