interface LogoProps {
  size?: number
  /** The mark's default colors (maroon linework) read poorly against a maroon or dark
   * surface — pass true there for the gold-on-transparent variant instead. */
  onDark?: boolean
}

export function Logo({ size = 36, onDark = false }: LogoProps) {
  const src = onDark ? '/icons/logo-mark-light.png' : '/icons/logo-mark.png'
  return <img src={src} alt="" className="app-logo" style={{ height: size, width: size }} />
}
