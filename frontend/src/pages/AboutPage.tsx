import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { CloseIcon } from '../components/common/icons'
import { Logo } from '../components/common/Logo'
import { checkForUpdate, installLatestVersion } from '../lib/updateCheck'
import { APP_VERSION, BUILD_DATE, BUILD_HASH } from '../lib/version'

const GITHUB_URL = 'https://github.com/lyvuong/gia-pha'
const STEP_KEYS = ['signIn', 'you', 'browse', 'edit', 'invite', 'trash', 'export'] as const

type UpdateState = 'idle' | 'checking' | 'latest' | 'available' | 'failed'

export function AboutPage() {
  const { t } = useTranslation()
  const [update, setUpdate] = useState<UpdateState>('idle')
  const [latestVersion, setLatestVersion] = useState<string | undefined>()

  async function check() {
    setUpdate('checking')
    try {
      const result = await checkForUpdate()
      setLatestVersion(result.latestVersion)
      setUpdate(result.hasUpdate ? 'available' : 'latest')
    } catch {
      setUpdate('failed')
    }
  }

  return (
    <div className="about-page">
      <div className="about-topbar">
        <Link to="/" className="icon-button about-close" title={t('about.close')} aria-label={t('about.close')}>
          <CloseIcon size={15} />
          <span className="btn-label">{t('about.close')}</span>
        </Link>
      </div>

      <section className="about-card about-hero">
        <Logo size={56} />
        <h1>{t('app.name')}</h1>
        <p>{t('about.tagline')}</p>
      </section>

      <section className="about-card">
        <h2>{t('about.versionTitle')}</h2>
        <dl className="about-facts">
          <dt>{t('about.version')}</dt>
          <dd>v{APP_VERSION}</dd>
          <dt>{t('about.build')}</dt>
          <dd>{BUILD_HASH ? `#${BUILD_HASH}` : '—'}</dd>
          <dt>{t('about.buildDate')}</dt>
          <dd>{BUILD_DATE || '—'}</dd>
        </dl>
        <div className="about-update">
          {update === 'available' ? (
            <button type="button" onClick={() => void installLatestVersion()}>
              {t('about.install', { version: latestVersion ? `v${latestVersion}` : '' })}
            </button>
          ) : (
            <button type="button" onClick={() => void check()} disabled={update === 'checking'}>
              {update === 'checking' ? t('about.checking') : t('about.checkUpdates')}
            </button>
          )}
          {update === 'latest' && <span>{t('about.upToDate')}</span>}
          {update === 'available' && <span>{t('about.updateFound')}</span>}
          {update === 'failed' && <span className="error-text">{t('about.checkFailed')}</span>}
        </div>
      </section>

      <section className="about-card">
        <h2>{t('about.developerTitle')}</h2>
        <p>
          <strong>Ly Vuong</strong> — {t('about.developerRole')}
        </p>
        <p>{t('about.builtWith')}</p>
        <p>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">{t('about.github')}</a>
        </p>
      </section>

      <section className="about-card">
        <h2>{t('about.howToTitle')}</h2>
        <ol className="about-steps">
          {STEP_KEYS.map((key) => (
            <li key={key}>
              <strong>{t(`about.steps.${key}.title`)}</strong> {t(`about.steps.${key}.body`)}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
