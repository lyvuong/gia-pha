import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type ConfirmationResult,
  type User,
} from 'firebase/auth'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { auth } from '../firebase/config'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithPhone: (phoneNumber: string, recaptchaContainerId: string) => Promise<ConfirmationResult>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setLoading(false)
    })
    return () => {
      unsubscribe()
      recaptchaRef.current?.clear()
      recaptchaRef.current = null
    }
  }, [])

  async function signInWithGoogle() {
    await signInWithPopup(auth, new GoogleAuthProvider())
  }

  async function signInWithPhone(phoneNumber: string, recaptchaContainerId: string) {
    // A verifier stays rendered in its container, and rendering a second one into the same
    // element throws "reCAPTCHA has already been rendered" — which is what a retry after a
    // failed or repeated attempt would hit. So drop the previous one (and anything it left in
    // the DOM) before making a new one.
    clearRecaptcha()
    const container = document.getElementById(recaptchaContainerId)
    if (container) container.innerHTML = ''

    const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, { size: 'invisible' })
    recaptchaRef.current = verifier
    try {
      return await signInWithPhoneNumber(auth, phoneNumber, verifier)
    } catch (err) {
      // A verifier that already failed can't be reused for the next attempt.
      clearRecaptcha()
      throw err
    }
  }

  function clearRecaptcha() {
    recaptchaRef.current?.clear()
    recaptchaRef.current = null
  }

  async function signOut() {
    await firebaseSignOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithPhone, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
