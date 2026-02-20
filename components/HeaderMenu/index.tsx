"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut, Settings, User, Trophy, Award } from "lucide-react"
import { supabase } from "@/lib/supabase"
import "./HeaderMenu.sass"

export default function HeaderMenu() {
  const router = useRouter()
  const [sessionUser, setSessionUser] = useState<any>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [wins, setWins] = useState<number>(0)
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const syncSession = async () => {
      const { data } = await supabase.auth.getSession()
      setSessionUser(data.session?.user ?? null)
      
      if (data.session?.user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.session.user.id)
          .single()
        
        setDisplayName(profile?.display_name ?? null)
      }
    }

    syncSession()
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        setSessionUser(currentSession?.user ?? null)
        
        if (currentSession?.user?.id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", currentSession.user.id)
            .single()
          
          setDisplayName(profile?.display_name ?? null)
        } else {
          setDisplayName(null)
        }
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
      <>
        <div className="header-menu__display-rank">
          <Trophy className="header-menu__icon" />
          {sessionUser ? "N/A" : "Login to see"}
        </div>
        <div className="header-menu__display-wins">
          <Award className="header-menu__icon" />
          {wins}
        </div>
        <span className="header-menu__display-name">
          {displayName}
        </span>
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
      </>
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
