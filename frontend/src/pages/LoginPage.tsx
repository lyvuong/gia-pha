import type { ConfirmationResult } from 'firebase/auth'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Logo } from '../components/common/Logo'
import { ThemeToggle } from '../components/common/ThemeToggle'
import { useAuth } from '../context/AuthProvider'
import { useTheme } from '../hooks/useTheme'
import { normalizePhoneNumber } from '../lib/phone'

const RECAPTCHA_CONTAINER_ID = 'recaptcha-container'

export function LoginPage() {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { signInWithGoogle, signInWithPhone } = useAuth()
  const [phoneNumber, setPhoneNumber] = useState('')
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    // Firebase only accepts international format ("+1703..."), so complete what was typed.
    const e164 = normalizePhoneNumber(phoneNumber)
    if (!e164) {
      setError(t('auth.invalidPhone'))
      return
    }
    setBusy(true)
    try {
      const result = await signInWithPhone(e164, RECAPTCHA_CONTAINER_ID)
      setConfirmation(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    if (!confirmation) return
    setError(null)
    setBusy(true)
    try {
      await confirmation.confirm(code)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogle() {
    setError(null)
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="page-theme-toggle">
        <ThemeToggle />
      </div>
      <Logo size={72} onDark={theme === 'dark'} />
      <h1>{t('auth.signInTitle')}</h1>

      <section className="phone-signin">
        {!confirmation ? (
          <form onSubmit={handleSendCode}>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder={t('auth.phoneNumberPlaceholder')}
              required
            />
            <button type="submit" disabled={busy}>{t('auth.sendCode')}</button>
            <p className="phone-hint">{t('auth.phoneHint')}</p>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('auth.verificationCodePlaceholder')}
              required
            />
            <button type="submit" disabled={busy}>{t('auth.verifyCode')}</button>
          </form>
        )}
        <div id={RECAPTCHA_CONTAINER_ID} />
      </section>

      <div className="signin-divider">or</div>

      <button type="button" className="google-signin" onClick={handleGoogle} disabled={busy}>
        {t('auth.signInWithGoogle')}
      </button>

      {error && <p className="error-text">{error}</p>}
    </div>
  )
}
