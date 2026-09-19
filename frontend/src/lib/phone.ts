/**
 * Turns what someone typed into the international (E.164) format Firebase phone sign-in
 * requires ("+" and a country code, digits only), or `null` if it can't be made into one.
 *
 * A number already starting with "+" (or "00") is taken as given. Otherwise, since users
 * here are mostly Vietnamese or American, a national number is completed with:
 * - a leading 0 and 9-10 digits: Vietnam, "0912 345 678" -> "+84912345678"
 * - exactly 10 digits: the US/Canada, "703 217 7712" -> "+17032177712"
 * - 11 digits starting with 1: the US/Canada, with the country code left unprefixed
 * Anything else is rejected rather than guessed at, so a wrong country is never silently dialed.
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
  } else if (digits.startsWith('0') && (digits.length === 10 || digits.length === 11)) {
    e164 = `+84${digits.slice(1)}`
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
