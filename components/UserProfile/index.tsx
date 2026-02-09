"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import Button from "@/components/Button"
import "./UserProfile.sass"

interface UserProfileProps {
  onLogout: () => void
}

export default function UserProfile({ onLogout }: UserProfileProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [formData, setFormData] = useState({
    email: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [avatarUrl, setAvatarUrl] = useState("")
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState("")
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    loadUserData()
  }, [])

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview("")
      return
    }

    const previewUrl = URL.createObjectURL(avatarFile)
    setAvatarPreview(previewUrl)

    return () => {
      URL.revokeObjectURL(previewUrl)
    }
  }, [avatarFile])

  const loadUserData = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session) {
      setUser(session.user)
      setSession(session)
      setAvatarUrl(session.user.user_metadata?.avatar_url || "")
      setFormData({
        email: session.user.email || "",
        newPassword: "",
        confirmPassword: "",
      })
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage("")
    setError("")

    try {
      if (formData.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email,
        })
        if (emailError) throw emailError
        setMessage("Profile updated! Check your new email for confirmation.")
      }

      if (formData.newPassword) {
        if (formData.newPassword !== formData.confirmPassword) {
          throw new Error("Passwords do not match")
        }
        const { error: passwordError } = await supabase.auth.updateUser({
          password: formData.newPassword,
        })
        if (passwordError) throw passwordError
        setMessage("Password updated successfully!")
      }

      setIsEditing(false)
      setFormData({
        ...formData,
        newPassword: "",
        confirmPassword: "",
      })
      await loadUserData()
    } catch (err: any) {
      setError(err.message || "Failed to update profile")
    }
  }

  const handleAvatarUpload = async () => {
    if (!avatarFile || !user) return
    setUploadingAvatar(true)
    setMessage("")
    setError("")

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      console.log('avatar upload session', sessionData.session?.user?.id)
      const safeName = avatarFile.name.replace(/[^a-zA-Z0-9.-]/g, "-")
      const filePath = `${user.id}/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, avatarFile, { upsert: true })

      if (uploadError) {
        console.log('uploadError', uploadError)
        throw uploadError
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath)
      const publicUrl = data.publicUrl

      const { error: profileError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      })

      if (profileError) throw profileError

      setAvatarUrl(publicUrl)
      setAvatarFile(null)
      setMessage("Avatar updated successfully!")
      await loadUserData()
    } catch (err: any) {
      setError(err.message || "Failed to update avatar")
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setFormData({
      email: user?.email || "",
      newPassword: "",
      confirmPassword: "",
    })
    setMessage("")
    setError("")
  }

  const avatarInitial = useMemo(() => {
    const seed = user?.email || user?.id || ""
    return seed ? seed.charAt(0).toUpperCase() : "?"
  }, [user])

  if (!user) {
    return <div className="user-profile">Loading...</div>
  }

  return (
    <div className="user-profile">
      <div className="user-profile__content">
        <div className="user-profile__section">
          <h3 className="user-profile__title">User Information</h3>

          <div className="user-profile__avatar-block">
            <div className="user-profile__avatar">
              {avatarPreview || avatarUrl ? (
                <img
                  src={avatarPreview || avatarUrl}
                  alt="User avatar"
                  className="user-profile__avatar-image"
                />
              ) : (
                <span className="user-profile__avatar-placeholder">
                  {avatarInitial}
                </span>
              )}
            </div>
            <div className="user-profile__avatar-actions">
              <input
                id="avatar-file"
                type="file"
                accept="image/*"
                className="user-profile__avatar-input"
                onChange={(event) =>
                  setAvatarFile(event.target.files?.[0] ?? null)
                }
              />
              <label
                htmlFor="avatar-file"
                className="user-profile__avatar-button"
              >
                Choose avatar
              </label>
              <Button
                variant="secondary"
                onClick={handleAvatarUpload}
                disabled={!avatarFile || uploadingAvatar}
              >
                {uploadingAvatar ? "Uploading..." : "Update Avatar"}
              </Button>
            </div>
          </div>
          {message && <p className="user-profile__message">{message}</p>}
          {error && <p className="user-profile__error">{error}</p>}

          {!isEditing ? (
            <div className="user-profile__info">
              <div className="user-profile__row">
                <span className="user-profile__label">Email:</span>
                <span className="user-profile__value">{user.email}</span>
              </div>
              <div className="user-profile__row">
                <span className="user-profile__label">User ID:</span>
                <span className="user-profile__value">{user.id}</span>
              </div>
              <Button variant="secondary" onClick={() => setIsEditing(true)}>
                Edit Profile
              </Button>
            </div>
          ) : (
            <form className="user-profile__form" onSubmit={handleUpdateProfile}>
              <div className="user-profile__field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                />
              </div>
              <div className="user-profile__field">
                <label htmlFor="newPassword">
                  New Password (leave blank to keep current)
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={formData.newPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, newPassword: e.target.value })
                  }
                  autoComplete="new-password"
                />
              </div>
              {formData.newPassword && (
                <div className="user-profile__field">
                  <label htmlFor="confirmPassword">Confirm New Password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        confirmPassword: e.target.value,
                      })
                    }
                    autoComplete="new-password"
                  />
                </div>
              )}
              <div className="user-profile__actions">
                <Button type="submit">Save Changes</Button>
                <Button variant="secondary" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>

        <div className="user-profile__section">
          <h3 className="user-profile__title">Session Information</h3>
          <div className="user-profile__info">
            <div className="user-profile__row">
              <span className="user-profile__label">Created:</span>
              <span className="user-profile__value">
                {session?.user?.created_at
                  ? new Date(session.user.created_at).toLocaleString()
                  : "-"}
              </span>
            </div>
            <div className="user-profile__row">
              <span className="user-profile__label">Last Sign In:</span>
              <span className="user-profile__value">
                {session?.user?.last_sign_in_at
                  ? new Date(session.user.last_sign_in_at).toLocaleString()
                  : "-"}
              </span>
            </div>
            <Button variant="danger" onClick={onLogout}>
              Logout
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
