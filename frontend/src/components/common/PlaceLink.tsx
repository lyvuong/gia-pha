interface PlaceLinkProps {
  text: string | null | undefined
}

export function PlaceLink({ text }: PlaceLinkProps) {
  if (!text) return null

  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="place-link">
      <span aria-hidden="true">📍</span> {text}
    </a>
  )
}
