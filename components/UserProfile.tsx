'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Button from './Button';
import './UserProfile.css';

interface UserProfileProps {
  onLogout: () => void;
}

export default function UserProfile({ onLogout }: UserProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [formData, setFormData] = useState({
    email: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      setUser(session.user);
      setSession(session);
      setFormData({ ...formData, email: session.user.email || '' });
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    try {
      // Update email if changed
      if (formData.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email,
        });
        if (emailError) throw emailError;
        setMessage('Profile updated! Check your new email for confirmation.');
      }

      // Update password if provided
      if (formData.newPassword) {
        if (formData.newPassword !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        const { error: passwordError } = await supabase.auth.updateUser({
          password: formData.newPassword,
        });
        if (passwordError) throw passwordError;
        setMessage('Password updated successfully!');
      }

      setIsEditing(false);
      setFormData({ ...formData, newPassword: '', confirmPassword: '' });
      await loadUserData();
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({
      email: user?.email || '',
      newPassword: '',
      confirmPassword: '',
    });
    setMessage('');
    setError('');
  };

  if (!user) {
    return <div className="user-profile">Loading...</div>;
  }

  return (
    <div className="user-profile">
      <div className="user-profile__content">
        <div className="user-profile__section">
          <h3 className="user-profile__title">User Information</h3>
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
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="user-profile__field">
                <label htmlFor="newPassword">New Password (leave blank to keep current)</label>
                <input
                  id="newPassword"
                  type="password"
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
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
                      setFormData({ ...formData, confirmPassword: e.target.value })
                    }
                    autoComplete="new-password"
                  />
                </div>
              )}
              {message && <p className="user-profile__message">{message}</p>}
              {error && <p className="user-profile__error">{error}</p>}
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
                  : '-'}
              </span>
            </div>
            <div className="user-profile__row">
              <span className="user-profile__label">Last Sign In:</span>
              <span className="user-profile__value">
                {session?.user?.last_sign_in_at
                  ? new Date(session.user.last_sign_in_at).toLocaleString()
                  : '-'}
              </span>
            </div>
            <Button variant="danger" onClick={onLogout}>
              Logout
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
