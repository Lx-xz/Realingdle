"use client"

declare global {
  interface Window {
    __headerMenuDragY?: number;
    __headerMenuDragStart?: number;
  }
}

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut, Settings, User, Award, Medal } from "lucide-react"
import { useAuthSession } from "@/components/AuthSessionProvider"
import { supabase } from "@/lib/supabase"
import "./HeaderMenu.sass"

interface RankWinsRpcRow {
  rank: number | null
  wins: number | null
  games_played: number | null
  display_name: string | null
}

interface HeaderCache {
  userId: string
  displayName: string | null
  wins: number
  rank: number | null
  gamesPlayed: number
  updatedAt: number
}

const HEADER_CACHE_KEY = "realingdle:header-cache:v1"

const withTimeout = async <T,>(
  promise: Promise<T> | PromiseLike<T>,
  timeoutMs: number,
  label: string,
) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race<T>([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out`))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

const withRetry = async <T,>(
  run: () => Promise<T>,
  attempts: number,
  label: string,
) => {
  let lastError: unknown
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await run()
    } catch (error) {
      lastError = error
      if (index < attempts - 1) {
        await sleep(300 * 2 ** index)
      }
    }
  }

  throw new Error(
    `${label} failed after ${attempts} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  )
}

export default function HeaderMenu() {
  const router = useRouter()
  const { user: sessionUser, isLoading: isSessionLoading } = useAuthSession()
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [wins, setWins] = useState<number>(0)
  const [rank, setRank] = useState<number | null>(null)
  const [gamesPlayed, setGamesPlayed] = useState<number>(0)
  const [isStale, setIsStale] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const sessionUserIdRef = useRef<string | null>(null)
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRefreshAtRef = useRef(0)

  useEffect(() => {
    const readHeaderCache = (): HeaderCache | null => {
      if (typeof window === "undefined") return null

      try {
        const raw = window.localStorage.getItem(HEADER_CACHE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw) as HeaderCache
        if (!parsed.userId) return null
        return parsed
      } catch {
        window.localStorage.removeItem(HEADER_CACHE_KEY)
        return null
      }
    }

    const writeHeaderCache = (cache: HeaderCache) => {
      if (typeof window === "undefined") return
      window.localStorage.setItem(HEADER_CACHE_KEY, JSON.stringify(cache))
    }

    const syncStats = async (
      userId: string,
      preferredDisplayName: string | null,
    ) => {
      try {
        const { data, error } = await withRetry(
          () =>
            withTimeout(
              supabase.rpc("get_my_rank_and_wins", { p_user_id: userId }),
              3500,
              "Header rank+wins fetch",
            ),
          1,
          "Header rank+wins fetch",
        )

        if (error || !data) {
          return
        }

        const row = (Array.isArray(data) ? data[0] : data) as RankWinsRpcRow
        const nextRank = typeof row?.rank === "number" ? row.rank : null
        const nextWins = typeof row?.wins === "number" ? row.wins : 0
        const nextGamesPlayed =
          typeof row?.games_played === "number" ? row.games_played : 0
        const nextDisplayName = row?.display_name?.trim() || preferredDisplayName

        setRank(nextRank)
        setWins(nextWins)
        setGamesPlayed(nextGamesPlayed)
        setDisplayName(nextDisplayName)
        setIsStale(false)
        lastRefreshAtRef.current = Date.now()

        writeHeaderCache({
          userId,
          displayName: nextDisplayName,
          wins: nextWins,
          rank: nextRank,
          gamesPlayed: nextGamesPlayed,
          updatedAt: Date.now(),
        })
      } catch {
        setIsStale(true)
      }
    }

    const queueRefresh = (
      userId: string,
      preferredDisplayName: string | null,
      markAsStale: boolean,
    ) => {
      const minIntervalMs = 2500
      const elapsed = Date.now() - lastRefreshAtRef.current
      const waitMs = Math.max(0, minIntervalMs - elapsed)

      if (refreshTimeoutRef.current) {
        return
      }

      if (markAsStale) {
        setIsStale(true)
      }
      refreshTimeoutRef.current = setTimeout(async () => {
        refreshTimeoutRef.current = null
        await syncStats(userId, preferredDisplayName)
      }, waitMs)
    }

    const userId = sessionUser?.id ?? null
    sessionUserIdRef.current = userId

    if (!userId) {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(HEADER_CACHE_KEY)
      }
      setDisplayName(null)
      setWins(0)
      setRank(null)
      setGamesPlayed(0)
      setIsStale(false)
      return () => {
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current)
          refreshTimeoutRef.current = null
        }
      }
    }

    const fallbackDisplayName =
      sessionUser?.user_metadata?.full_name ||
      sessionUser?.email?.split("@")[0] ||
      null

    const cached = readHeaderCache()
    if (cached?.userId === userId) {
      setDisplayName(cached.displayName)
      setWins(cached.wins)
      setRank(cached.rank)
      setGamesPlayed(typeof cached.gamesPlayed === "number" ? cached.gamesPlayed : 0)
      setIsStale(true)
    } else {
      setDisplayName(fallbackDisplayName)
      setWins(0)
      setRank(null)
      setGamesPlayed(0)
      setIsStale(false)
    }

    queueRefresh(userId, fallbackDisplayName, cached?.userId === userId)

    const realtimeChannel = supabase
      .channel("header-menu-profiles")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        async () => {
          const nextUserId = sessionUserIdRef.current
          if (nextUserId) {
            queueRefresh(nextUserId, fallbackDisplayName, false)
          }
        },
      )
      .subscribe()

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
        refreshTimeoutRef.current = null
      }
      supabase.removeChannel(realtimeChannel)
    }
  }, [sessionUser])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isOpen) return;
      // For mobile bottomsheet
      const bottomsheet = document.querySelector('.header-menu__bottomsheet');
      if (bottomsheet && event.target instanceof Node && !bottomsheet.contains(event.target)) {
        setIsOpen(false);
      }
      // For desktop dropdown
      if (menuRef.current && event.target instanceof Node && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut()
    if (typeof window !== "undefined") {
      try {
        window.localStorage.clear()
      } catch {
        window.localStorage.removeItem(HEADER_CACHE_KEY)
      }

      try {
        window.sessionStorage.clear()
      } catch {
        // ignore
      }

      if (typeof caches !== "undefined") {
        try {
          const cacheKeys = await caches.keys()
          await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)))
        } catch {
          // ignore
        }
      }
    }
    setDisplayName(null)
    setWins(0)
    setRank(null)
    setGamesPlayed(0)
    setIsOpen(false)
    router.replace("/")
    router.refresh()
  }

  const avatarUrl = sessionUser?.user_metadata?.avatar_url as string | undefined
  const isAdmin = sessionUser?.app_metadata?.role === "admin"
  const avatarLabel = sessionUser?.email?.charAt(0)?.toUpperCase() || "?"

  if (isSessionLoading) {
    return <div className="header-menu__blank" aria-hidden="true" />
  }

  return (
    <div className="header-menu" ref={menuRef}>
      {sessionUser ? (
        <>
          {/* Desktop: full menu */}
          <div className="header-menu__desktop">
            <Link className="header-menu__display-rank" href="/rank" title="Seu rank">
              <Medal className="header-menu__icon" />
              {sessionUser ? (gamesPlayed > 0 && rank ? `#${rank}` : "No rank") : "Login to see"}
            </Link>
            <div className="header-menu__display-wins" title="Vitórias">
              <Award className="header-menu__icon" />
              {wins}
            </div>
            {isStale && <span className="header-menu__stale">cache</span>}
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
          </div>
          {/* Mobile: only avatar */}
          <div className="header-menu__mobile">
            <button
              type="button"
              className="header-menu__trigger"
              onClick={() => setIsOpen(true)}
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
          </div>
        </>
      ) : (
        <Link className="header-menu__login" href="/auth?next=/profile">
          Login
        </Link>
      )}

      {/* Desktop dropdown */}
      {sessionUser && isOpen && typeof window !== "undefined" && window.innerWidth > 600 && (
        <div className="header-menu__dropdown">
          <Link className="header-menu__link" href="/rank">
            <Medal className="header-menu__icon" />
            Rank
          </Link>
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

      {/* Mobile bottom sheet menu */}
      {sessionUser && (isOpen || isClosing) && typeof window !== "undefined" && window.innerWidth <= 600 && (
        <div
          className={`header-menu__bottomsheet${isClosing ? ' header-menu__bottomsheet--closing' : ''}`}
          onClick={e => {
            if (e.target === e.currentTarget) {
              setIsClosing(true);
              setTimeout(() => {
                setIsOpen(false);
                setIsClosing(false);
              }, 220);
            }
          }}
        >
          <div
            className="header-menu__bottomsheet-content"
            style={{ touchAction: 'none' }}
            onTouchStart={e => {
              e.stopPropagation();
              window.__headerMenuDragY = e.touches[0].clientY;
              window.__headerMenuDragStart = e.touches[0].clientY;
            }}
            onTouchMove={e => {
              e.stopPropagation();
              const dragY = e.touches[0].clientY;
              const diff = dragY - (window.__headerMenuDragStart || dragY);
              if (diff > 0) {
                e.currentTarget.style.transform = `translateY(${diff}px)`;
              }
            }}
            onTouchEnd={e => {
              e.stopPropagation();
              const dragY = e.changedTouches[0].clientY;
              const diff = dragY - (window.__headerMenuDragStart || dragY);
              e.currentTarget.style.transform = '';
              if (diff > 60) {
                setIsClosing(true);
                setTimeout(() => {
                  setIsOpen(false);
                  setIsClosing(false);
                }, 220);
              }
              window.__headerMenuDragY = undefined;
              window.__headerMenuDragStart = undefined;
            }}
          >
            <button
              className="header-menu__bottomsheet-close"
              type="button"
              onClick={() => {
                setIsClosing(true);
                setTimeout(() => {
                  setIsOpen(false);
                  setIsClosing(false);
                }, 220);
              }}
              aria-label="Fechar menu"
            >
              <svg width="36" height="36" viewBox="0 0 36 36"><polyline points="10,16 18,24 26,16" fill="none" stroke="#222" strokeWidth="2"/></svg>
            </button>
            <Link className="header-menu__link" href="/rank" onClick={() => setIsOpen(false)}>
              <Medal className="header-menu__icon" />
              Rank
            </Link>
            <Link className="header-menu__link" href="/profile" onClick={() => setIsOpen(false)}>
              <User className="header-menu__icon" />
              Profile
            </Link>
            {isAdmin && (
              <Link className="header-menu__link" href="/game-settings" onClick={() => setIsOpen(false)}>
                <Settings className="header-menu__icon" />
                Game settings
              </Link>
            )}
            <button
              type="button"
              className="header-menu__link header-menu__link--button header-menu__link--danger"
              onClick={() => { setIsOpen(false); handleLogout(); }}
            >
              <LogOut className="header-menu__icon" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}