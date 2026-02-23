"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuthSession } from "@/components/AuthSessionProvider"
import Button from "@/components/Button"
import Loading from "@/components/Loading"
import { supabase } from "@/lib/supabase"
import "./page.sass"

type AuthMode = "login" | "signup"

function AuthPageContent() {
  const router = useRouter()
  const { user: sessionUser, isLoading: isSessionLoading } = useAuthSession()
  const searchParams = useSearchParams()
  const nextPath = useMemo(
    () => searchParams.get("next") || "/game-settings",
    [searchParams],
  )
  const [mode, setMode] = useState<AuthMode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (isSessionLoading) {
      return
    }

    if (sessionUser) {
      router.replace(nextPath)
    }
  }, [router, nextPath, sessionUser, isSessionLoading])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")
    setMessage("")
    setLoading(true)

    try {
      if (mode === "signup") {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match")
        }

        const { error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: 'https://lx-xz.github.io/realingdle/',
          },
        })

        if (signupError) throw signupError
        setMessage("Account created! Please confirm your email to continue.")
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (loginError) throw loginError
        router.replace(nextPath)
      }
    } catch (err: any) {
      setError(err.message || "Unable to continue. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = (nextMode: AuthMode) => {
    if (nextMode === mode) return
    setMode(nextMode)
    setError("")
    setMessage("")
  }

  return (
    <div className="auth">
      <div className="auth__card">
        <div className="auth__tabs">
          <button
            type="button"
            className={`auth__tab ${mode === "login" ? "auth__tab--active" : ""}`}
            onClick={() => toggleMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={`auth__tab ${mode === "signup" ? "auth__tab--active" : ""}`}
            onClick={() => toggleMode("signup")}
          >
            Sign up
          </button>
        </div>

        <form className="auth__form" onSubmit={handleSubmit}>
          <div className="auth__field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="auth__field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
            />
          </div>

          {mode === "signup" && (
            <div className="auth__field">
              <label htmlFor="auth-confirm">Confirm Password</label>
              <input
                id="auth-confirm"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
          )}

          {message && <p className="auth__message">{message}</p>}
          {error && <p className="auth__error">{error}</p>}

          <div className="auth__actions">
            <Button type="submit" disabled={loading}>
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Login"
                  : "Create account"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.push("/")}
              type="button"
            >
              Back to Home
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="auth">
          <div className="auth__card">
            <Loading label="Loading..." />
          </div>
        </div>
      }
    >
      <AuthPageContent />
    </Suspense>
  )
}
