import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from '../firebase/config'

const MAX_DIMENSION = 512
const JPEG_QUALITY = 0.8

function resizeAndCompress(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height))
      const width = Math.round(img.width * scale)
      const height = Math.round(img.height * scale)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode image'))),
        'image/jpeg',
        JPEG_QUALITY,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }
    img.src = objectUrl
  })
}

export async function uploadMemberPhoto(giaPhaId: string, memberId: string, file: File): Promise<string> {
  const blob = await resizeAndCompress(file)
  const photoRef = ref(storage, `giaPha/${giaPhaId}/members/${memberId}/photo.jpg`)
  await uploadBytes(photoRef, blob, { contentType: 'image/jpeg' })
  return getDownloadURL(photoRef)
}
