import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../firebase/config'

const HEARTBEAT_MS = 30_000
/** A heartbeat older than this means the tab was closed or crashed without cleaning up. */
const STALE_MS = 90_000

/**
 * Lets members see who else has the tree open right now. Each open, visible tab refreshes
 * `giaPha/{id}/presence/{uid}` every 30s and removes it on close; a doc whose `lastSeen` is
 * stale is ignored, which covers tabs that die without running cleanup. Nothing else is
 * recorded — no page, no edits. Returns the uids of the *other* members currently online.
 */
export function usePresence(giaPhaId: string | undefined, uid: string | undefined, enabled: boolean): string[] {
  const [online, setOnline] = useState<string[]>([])

  useEffect(() => {
    if (!giaPhaId || !uid || !enabled) return
    const ref = doc(db, 'giaPha', giaPhaId, 'presence', uid)
    const beat = () => void setDoc(ref, { lastSeen: serverTimestamp() }).catch(() => {})
    const leave = () => void deleteDoc(ref).catch(() => {})

    let timer: number | undefined
    const start = () => {
      if (timer !== undefined) return
      beat()
      timer = window.setInterval(beat, HEARTBEAT_MS)
    }
    const stop = () => {
      if (timer === undefined) return
      window.clearInterval(timer)
      timer = undefined
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') start()
      else {
        stop()
        leave()
      }
    }

    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', leave)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', leave)
      stop()
      leave()
    }
  }, [giaPhaId, uid, enabled])

  useEffect(() => {
    if (!giaPhaId || !uid || !enabled) {
      setOnline([])
      return
    }
    let seen: Record<string, number> = {}
    const recompute = () => {
      const now = Date.now()
      const next = Object.entries(seen)
        .filter(([id, t]) => id !== uid && now - t < STALE_MS)
        .map(([id]) => id)
        .sort()
      setOnline((prev) => (prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next))
    }
    const unsubscribe = onSnapshot(
      collection(db, 'giaPha', giaPhaId, 'presence'),
      (snap) => {
        seen = {}
        // A write still pending on this device has no server timestamp yet: treat it as fresh.
        for (const d of snap.docs) seen[d.id] = d.data().lastSeen?.toMillis?.() ?? Date.now()
        recompute()
      },
      () => setOnline([]),
    )
    const tick = window.setInterval(recompute, HEARTBEAT_MS)
    return () => {
      unsubscribe()
      window.clearInterval(tick)
    }
  }, [giaPhaId, uid, enabled])

  return online
}
