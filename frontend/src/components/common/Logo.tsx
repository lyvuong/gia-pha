interface LogoProps {
  size?: number
}

export function Logo({ size = 36 }: LogoProps) {
  return <img src="/icons/logo-mark.png" alt="" className="app-logo" style={{ height: size, width: size }} />
}
