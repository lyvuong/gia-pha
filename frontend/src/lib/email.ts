/** A plausible email address, lower-cased (the form Firebase reports for a verified Google account), or `null`. */
export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase()
  return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email) && email.length <= 254 ? email : null
}

/** Splits a pasted list into email lines (parsed here) and the remaining lines (left for phone parsing). */
export function parseEmailLines(text: string): {
  entries: { email: string; label: string }[]
  rest: string
} {
  const byEmail = new Map<string, string>()
  const rest: string[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    if (!line.includes('@')) {
      rest.push(line)
      continue
    }
    const fields = line.split(/[,;\t]/).map((f) => f.trim()).filter(Boolean)
    const idx = fields.findIndex((f) => normalizeEmail(f))
    if (idx >= 0) {
      const email = normalizeEmail(fields[idx])!
      if (!byEmail.has(email)) byEmail.set(email, fields.filter((_, i) => i !== idx).join(', ').slice(0, 100))
      continue
    }
    // "Aunt Lan lan@gmail.com" — pick the address out of the line.
    const match = line.match(/[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+/)
    const email = match ? normalizeEmail(match[0]) : null
    if (email) {
      if (!byEmail.has(email)) byEmail.set(email, line.replace(match![0], '').replace(/[\s,;:<>–—-]+$|^[\s,;:<>–—-]+/g, '').slice(0, 100))
    } else {
      rest.push(line)
    }
  }
  return { entries: [...byEmail].map(([email, label]) => ({ email, label })), rest: rest.join('\n') }
}
