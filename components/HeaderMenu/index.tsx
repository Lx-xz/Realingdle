"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut, Settings, User } from "lucide-react"
import { supabase } from "@/lib/supabase"
import "./HeaderMenu.sass"

export default function HeaderMenu() {
  const router = useRouter()
  const [sessionUser, setSessionUser] = useState<any>(null)
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const syncSession = async () => {
      const { data } = await supabase.auth.getSession()
      setSessionUser(data.session?.user ?? null)
    }

    syncSession()
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSessionUser(currentSession?.user ?? null)
      },
    )

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return
      if (!menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsOpen(false)
    router.push("/")
  }

  const avatarUrl = sessionUser?.user_metadata?.avatar_url as string | undefined
  const isAdmin = sessionUser?.app_metadata?.role === "admin"
  const avatarLabel = sessionUser?.email?.charAt(0)?.toUpperCase() || "?"

  return (
    <div className="header-menu" ref={menuRef}>
      {sessionUser ? (
        <button
          type="button"
          className="header-menu__trigger"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="User avatar"
              className="header-menu__avatar"
            />
          ) : (
            <span className="header-menu__avatar header-menu__avatar--placeholder">
              {avatarLabel}
            </span>
          )}
        </button>
      ) : (
        <Link className="header-menu__login" href="/auth?next=/profile">
          Login
        </Link>
      )}

      {sessionUser && isOpen && (
        <div className="header-menu__dropdown">
          <Link className="header-menu__link" href="/profile">
            <User className="header-menu__icon" />
            Profile
          </Link>
          {isAdmin && (
            <Link className="header-menu__link" href="/game-settings">
              <Settings className="header-menu__icon" />
              Game settings
            </Link>
          )}
          <button
            type="button"
            className="header-menu__link header-menu__link--button header-menu__link--danger"
            onClick={handleLogout}
          >
            <LogOut className="header-menu__icon" />
            Logout
          </button>
        </div>
      )}
    </div>
  )
}
