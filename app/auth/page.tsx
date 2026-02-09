"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Button from "@/components/Button"
import { supabase } from "@/lib/supabase"
import "./page.sass"

type AuthMode = "login" | "signup"

export default function AuthPage() {
  const router = useRouter()
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
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        router.replace(nextPath)
      }
    }

    checkSession()
  }, [router, nextPath])

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
        <div className="auth__header">
          <h1 className="auth__title">Admin Access</h1>
          <p className="auth__subtitle">
            {mode === "login"
              ? "Login to manage characters and game data."
              : "Create an admin account to manage content."}
          </p>
        </div>

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
