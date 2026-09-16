import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '../common/Avatar'
import { uploadMemberPhoto } from '../../lib/photoUpload'

interface PhotoUploaderProps {
  giaPhaId: string
  memberId: string
  memberName: string
  photoUrl: string | null
  onUploaded: (url: string) => void
}

export function PhotoUploader({ giaPhaId, memberId, memberName, photoUrl, onUploaded }: PhotoUploaderProps) {
  const { t } = useTranslation()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const url = await uploadMemberPhoto(giaPhaId, memberId, file)
      onUploaded(url)
    } catch {
      setError('Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="photo-uploader">
      <Avatar name={memberName} photoUrl={photoUrl} size={80} />
      <label className="photo-uploader-label">
        {t('member.photo')}
        <input type="file" accept="image/*" capture="user" onChange={handleChange} disabled={uploading} />
      </label>
      {uploading && <span>{t('common.loading')}</span>}
      {error && <span className="error-text">{error}</span>}
    </div>
  )
}
