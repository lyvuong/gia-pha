/**
 * Turns what someone typed into the international (E.164) format Firebase phone sign-in
 * requires ("+" and a country code, digits only), or `null` if it can't be made into one.
 *
 * A number already starting with "+" (or "00") is taken as given. Otherwise it is assumed to
 * be in the US/Canada (+1):
 * - exactly 10 digits: "703 217 7712" -> "+17032177712"
 * - 11 digits starting with 1: the country code left unprefixed
 * Any other country needs its country code typed ("+84 912 345 678"); anything else is
 * rejected rather than guessed at, so a wrong country is never silently dialed.
 */
export function normalizePhoneNumber(input: string): string | null {
  const trimmed = input.trim()
  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return null

  let e164: string
  if (hasPlus) {
    e164 = `+${digits}`
  } else if (digits.startsWith('00')) {
    e164 = `+${digits.slice(2)}`
  } else if (digits.length === 10) {
    e164 = `+1${digits}`
  } else if (digits.length === 11 && digits.startsWith('1')) {
    e164 = `+${digits}`
  } else {
    return null
  }

  // E.164: up to 15 digits in total, and a country code never starts with 0.
  return /^\+[1-9]\d{6,14}$/.test(e164) ? e164 : null
}

export interface ParsedPhoneList {
  entries: { phone: string; label: string }[]
  /** Lines that held no readable number, so the user can fix them. */
  skipped: string[]
}

/**
 * Reads a pasted list, one person per line: "number", "Name, number" or "number, Name"
 * (commas, tabs or semicolons between columns), or a name and number run together
 * ("Aunt Lan +1 703 217 7712"). Duplicate numbers are merged, keeping the first label.
 */
export function parsePhoneList(text: string): ParsedPhoneList {
  const byPhone = new Map<string, string>()
  const skipped: string[] = []

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    const fields = line.split(/[,;\t]/).map((f) => f.trim()).filter(Boolean)
    let phone: string | null = null
    let label = ''
    // A column that is only digits and phone punctuation is the number; the rest is the name.
    const numberIndex = fields.findIndex((f) => /^[+\d\s().-]+$/.test(f) && normalizePhoneNumber(f))
    if (numberIndex >= 0) {
      phone = normalizePhoneNumber(fields[numberIndex])
      label = fields.filter((_, i) => i !== numberIndex).join(', ')
    } else {
      // A name and number in one field, either order: pick out the run of digits and phone punctuation.
      const match = line.match(/^(.*?)(\+?\d[\d\s().-]{6,}\d)(.*)$/)
      if (match) {
        phone = normalizePhoneNumber(match[2])
        label = (match[1] + ' ' + match[3]).replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, '').replace(/\s+/g, ' ')
      }
    }

    if (!phone) skipped.push(line)
    else if (!byPhone.has(phone)) byPhone.set(phone, label.slice(0, 100))
  }

  return { entries: [...byPhone].map(([phone, label]) => ({ phone, label })), skipped }
}
