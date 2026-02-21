"use client"

import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Pencil } from "lucide-react"
import { useAuthSession } from "@/components/AuthSessionProvider"
import { supabase } from "@/lib/supabase"
import Loading from "@/components/Loading"
import Button from "@/components/Button"
import "./page.sass"

interface ProfileRow {
  id: string
  display_name: string
  avatar_url: string | null
  games_played: number
  wins: number
}

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
        await sleep(350 * 2 ** index)
      }
    }
  }

  throw new Error(
    `${label} failed after ${attempts} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const { user: sessionUser, isLoading: isSessionLoading } = useAuthSession()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    displayName: "",
    avatarUrl: "",
    email: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [avatarMode, setAvatarMode] = useState<"url" | "upload">("url")
  const [avatarPreview, setAvatarPreview] = useState("")

  const normalizeAvatarUrl = (url: string | null) => {
    if (!url) return null
    if (url.includes("/storage/v1/object/avatars/")) {
      return url.replace("/storage/v1/object/avatars/", "/storage/v1/object/public/avatars/")
    }
    return url
  }

  const loadProfile = async (sessionUser: any) => {
    const { data, error: profileError } = await withRetry(
      () =>
        withTimeout(
          supabase
            .from("profiles")
            .select("id, display_name, avatar_url, games_played, wins")
            .eq("id", sessionUser.id)
            .maybeSingle(),
          5500,
          "Profile fetch",
        ),
      1,
      "Profile fetch",
    )

    if (profileError) {
      console.error("Error loading profile", profileError)
      return
    }

    if (!data) {
      const guestName = `Guest-${sessionUser.id.slice(0, 6)}`
      const { data: created, error: insertError } = await withRetry(
        () =>
          withTimeout(
            supabase
              .from("profiles")
              .insert({
                id: sessionUser.id,
                display_name: guestName,
                avatar_url: sessionUser.user_metadata?.avatar_url ?? null,
                games_played: 0,
                wins: 0,
              })
              .select("id, display_name, avatar_url, games_played, wins")
              .single(),
            5500,
            "Profile create",
          ),
        1,
        "Profile create",
      )

      if (insertError) {
        console.error("Error creating profile", insertError)
        return
      }

      setProfile(created)
      setFormData({
        displayName: created.display_name,
        avatarUrl: created.avatar_url || "",
        email: sessionUser.email || "",
        newPassword: "",
        confirmPassword: "",
      })
      return
    }

    setProfile(data)
    setFormData({
      displayName: data.display_name,
      avatarUrl: data.avatar_url || "",
      email: sessionUser.email || "",
      newPassword: "",
      confirmPassword: "",
    })
  }

  useEffect(() => {
    if (isSessionLoading) {
      return
    }

    if (!sessionUser) {
      router.replace("/auth?next=/profile")
      return
    }

    const loadCurrentProfile = async () => {
      setLoading(true)
      setLoadError("")
      try {
        setUser(sessionUser)
        await loadProfile(sessionUser)
      } catch (error) {
        console.error("Error loading profile page:", error)
        setLoadError("Unable to load profile right now. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    loadCurrentProfile()
  }, [router, sessionUser, isSessionLoading])

  useEffect(() => {
    if (!isEditing) {
      setAvatarPreview("")
      return
    }

    let objectUrl: string | null = null
    if (avatarMode === "upload" && avatarFile) {
      objectUrl = URL.createObjectURL(avatarFile)
      setAvatarPreview(objectUrl)
    } else if (avatarMode === "url" && formData.avatarUrl.trim()) {
      setAvatarPreview(formData.avatarUrl.trim())
    } else {
      setAvatarPreview("")
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [avatarFile, avatarMode, formData.avatarUrl, isEditing])

  if (loading) {
    return (
      <div className="profile">
        <div className="profile__card">
          <Loading label="Loading profile..." />
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="profile">
        <div className="profile__card">
          <p>{loadError}</p>
          <Button type="button" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="profile">
        <div className="profile__card">Redirecting to login...</div>
      </div>
    )
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!user || !profile) return
    setMessage("")
    setError("")
    setIsUploading(false)

    try {
      let nextAvatarUrl =
        avatarMode === "url" ? normalizeAvatarUrl(formData.avatarUrl.trim()) : null

      if (avatarMode === "upload" && avatarFile) {
        setIsUploading(true)
        const fileExt = avatarFile.name.split(".").pop()
        const safeExt = fileExt ? fileExt.toLowerCase() : "png"
        const filePath = `${user.id}/${Date.now()}-avatar.${safeExt}`
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, avatarFile, { upsert: true })

        if (uploadError) throw uploadError

        const { data } = supabase.storage.from("avatars").getPublicUrl(filePath)
        if (!data?.publicUrl) throw new Error("Unable to get avatar URL")

        nextAvatarUrl = normalizeAvatarUrl(data.publicUrl)
        setFormData((current) => ({
          ...current,
          avatarUrl: nextAvatarUrl || data.publicUrl,
        }))
        setAvatarFile(null)
      }

      if (formData.email && formData.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email,
        })
        if (emailError) throw emailError
      }

      if (formData.newPassword) {
        if (formData.newPassword !== formData.confirmPassword) {
          throw new Error("Passwords do not match")
        }
        const { error: passwordError } = await supabase.auth.updateUser({
          password: formData.newPassword,
        })
        if (passwordError) throw passwordError
      }

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        display_name: formData.displayName.trim() || profile.display_name,
        avatar_url: nextAvatarUrl,
      })

      if (profileError) throw profileError

      if (nextAvatarUrl) {
        const { error: metaError } = await supabase.auth.updateUser({
          data: { avatar_url: nextAvatarUrl },
        })
        if (metaError) throw metaError
      }

      await loadProfile(user)
      setIsEditing(false)
      setMessage("Profile updated")
      setFormData((current) => ({
        ...current,
        newPassword: "",
        confirmPassword: "",
      }))
    } catch (err: any) {
      setError(err.message || "Unable to update profile")
    } finally {
      setIsUploading(false)
    }
  }

  const handleCancel = () => {
    if (!user || !profile) return
    setIsEditing(false)
    setMessage("")
    setError("")
    setAvatarFile(null)
    setAvatarMode("url")
    setFormData({
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url || "",
      email: user.email || "",
      newPassword: "",
      confirmPassword: "",
    })
  }

  const avatarUrl =
    avatarPreview
    || profile?.avatar_url
    || (user.user_metadata?.avatar_url as string | undefined)
  const avatarInitial = profile?.display_name?.charAt(0)?.toUpperCase()
    || user.email?.charAt(0)?.toUpperCase()
    || "?"

  return (
    <div className="profile">
      <div className="profile__card">
        <div className="profile__header">
          <div className="profile__avatar">
            {avatarUrl ? (
              <img src={avatarUrl} alt="User avatar" />
            ) : (
              <span>{avatarInitial}</span>
            )}
          </div>
          <div>
            <h1 className="profile__title">Profile</h1>
            <p className="profile__subtitle">Account details</p>
          </div>
          <button
            type="button"
            className="profile__edit"
            onClick={() => setIsEditing(true)}
            aria-label="Edit profile"
          >
            <Pencil size={18} />
          </button>
        </div>

        {!isEditing ? (
          <div className="profile__info">
            <div className="profile__row">
              <span className="profile__label">Display name</span>
              <span className="profile__value">
                {profile?.display_name || "-"}
              </span>
            </div>
            <div className="profile__row">
              <span className="profile__label">Email</span>
              <span className="profile__value">{user.email}</span>
            </div>
            <div className="profile__row">
              <span className="profile__label">Games played</span>
              <span className="profile__value">
                {profile?.games_played ?? 0}
              </span>
            </div>
            <div className="profile__row">
              <span className="profile__label">Wins</span>
              <span className="profile__value">{profile?.wins ?? 0}</span>
            </div>
            <div className="profile__row">
              <span className="profile__label">User ID</span>
              <span className="profile__value">{user.id}</span>
            </div>
          </div>
        ) : (
          <form className="profile__form" onSubmit={handleSave}>
            <div className="profile__field">
              <label htmlFor="displayName">Display name</label>
              <input
                id="displayName"
                type="text"
                value={formData.displayName}
                onChange={(event) =>
                  setFormData({ ...formData, displayName: event.target.value })
                }
                required
              />
            </div>
            <div className="profile__field">
              <label>Avatar source</label>
              <div className="profile__switch">
                <button
                  type="button"
                  className={avatarMode === "url" ? "is-active" : ""}
                  onClick={() => setAvatarMode("url")}
                >
                  URL
                </button>
                <button
                  type="button"
                  className={avatarMode === "upload" ? "is-active" : ""}
                  onClick={() => setAvatarMode("upload")}
                >
                  Upload
                </button>
              </div>
            </div>
            {avatarMode === "url" ? (
              <div className="profile__field">
                <label htmlFor="avatarUrl">Avatar URL</label>
                <input
                  id="avatarUrl"
                  type="url"
                  value={formData.avatarUrl}
                  onChange={(event) =>
                    setFormData({ ...formData, avatarUrl: event.target.value })
                  }
                  placeholder="https://"
                />
              </div>
            ) : (
              <div className="profile__field">
                <label htmlFor="avatarFile">Upload avatar</label>
                <div className="profile__upload">
                  <input
                    id="avatarFile"
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      setAvatarFile(event.target.files?.[0] ?? null)
                    }
                  />
                  <label htmlFor="avatarFile" className="profile__file-button">
                    Choose image
                  </label>
                  <span className="profile__file-name">
                    {avatarFile?.name || "No file selected"}
                  </span>
                </div>
                <p className="profile__upload-note">
                  The file will be uploaded when you save changes.
                </p>
              </div>
            )}
            <div className="profile__field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(event) =>
                  setFormData({ ...formData, email: event.target.value })
                }
              />
            </div>
            <div className="profile__field">
              <label htmlFor="newPassword">New password</label>
              <input
                id="newPassword"
                type="password"
                value={formData.newPassword}
                onChange={(event) =>
                  setFormData({ ...formData, newPassword: event.target.value })
                }
                autoComplete="new-password"
              />
            </div>
            <div className="profile__field">
              <label htmlFor="confirmPassword">Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    confirmPassword: event.target.value,
                  })
                }
                autoComplete="new-password"
              />
            </div>
            {message && <p className="profile__message">{message}</p>}
            {error && <p className="profile__error">{error}</p>}
            <div className="profile__actions">
              <button type="submit" className="profile__save">
                {isUploading ? "Saving..." : "Save changes"}
              </button>
              <button type="button" className="profile__cancel" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
