const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/I/1 to avoid confusion

export function generateInviteCode(length = 8): string {
  let code = ''
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return code
}
