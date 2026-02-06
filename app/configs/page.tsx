'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CharacterTable from '@/components/CharacterTable';
import Button from '@/components/Button';
import { supabase } from '@/lib/supabase';
import { Character } from '@/types';
import './page.css';

export default function ConfigsPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchCharacters();
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Simple authentication (in production, this should be server-side)
    const adminUsername = process.env.NEXT_PUBLIC_ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin123';

    if (username === adminUsername && password === adminPassword) {
      setIsAuthenticated(true);
    } else {
      setError('Invalid credentials');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername('');
    setPassword('');
  };

  const fetchCharacters = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCharacters(data || []);
    } catch (error) {
      console.error('Error fetching characters:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCharacter = async (character: Omit<Character, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { error } = await supabase
        .from('characters')
        .insert([character]);

      if (error) throw error;
      fetchCharacters();
    } catch (error) {
      console.error('Error adding character:', error);
      alert('Error adding character. Please check your Supabase configuration.');
    }
  };

  const handleEditCharacter = async (id: string, character: Partial<Character>) => {
    try {
      const { error } = await supabase
        .from('characters')
        .update(character)
        .eq('id', id);

      if (error) throw error;
      fetchCharacters();
    } catch (error) {
      console.error('Error updating character:', error);
      alert('Error updating character. Please check your Supabase configuration.');
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    if (!confirm('Are you sure you want to delete this character?')) return;

    try {
      const { error } = await supabase
        .from('characters')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchCharacters();
    } catch (error) {
      console.error('Error deleting character:', error);
      alert('Error deleting character. Please check your Supabase configuration.');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="configs">
        <div className="configs__login">
          <h1 className="configs__title">Admin Login</h1>
          <form className="configs__form" onSubmit={handleLogin}>
            <div className="configs__field">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className="configs__field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && <p className="configs__error">{error}</p>}
            <div className="configs__actions">
              <Button type="submit">Login</Button>
              <Button variant="secondary" onClick={() => router.push('/')}>
                Back to Home
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="configs">
      <div className="configs__container">
        <div className="configs__header">
          <h1 className="configs__title">Character Management</h1>
          <Button variant="secondary" onClick={handleLogout}>
            Logout
          </Button>
        </div>

        {loading ? (
          <p>Loading characters...</p>
        ) : (
          <CharacterTable
            characters={characters}
            onAdd={handleAddCharacter}
            onEdit={handleEditCharacter}
            onDelete={handleDeleteCharacter}
          />
        )}
      </div>
    </div>
  );
}
