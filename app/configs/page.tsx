'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CharacterTable from '@/components/CharacterTable';
import Button from '@/components/Button';
import { supabase } from '@/lib/supabase';
import { fetchCharacters } from '@/lib/characters';
import {
  Association,
  Character,
  CharacterFormData,
  Class,
  Occupation,
  Place,
  Race,
  State,
} from '@/types';
import './page.css';

export default function ConfigsPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [races, setRaces] = useState<Race[]>([]);
  const [occupations, setOccupations] = useState<Occupation[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);

  useEffect(() => {
    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      setIsAuthenticated(Boolean(data.session));
    };

    syncSession();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session));
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadData();
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAuthenticating(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;
    } catch (authError) {
      console.error('Error verifying user:', authError);
      setError('Unable to login. Please try again.');
    } finally {
      setAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setEmail('');
    setPassword('');
    setCharacters([]);
    setError('');
  };

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([fetchCharactersList(), fetchLookups()]);
    } catch (error) {
      console.error('Error loading configs data:', error);
      setError('Unable to load data. Please check your Supabase configuration.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCharactersList = async () => {
    const data = await fetchCharacters({ ascending: false });
    setCharacters(data);
  };

  const fetchLookups = async () => {
    const [statesRes, classesRes, racesRes, occupationsRes, associationsRes, placesRes] =
      await Promise.all([
        supabase.from('states').select('*').order('name', { ascending: true }),
        supabase.from('classes').select('*').order('name', { ascending: true }),
        supabase.from('races').select('*').order('name', { ascending: true }),
        supabase.from('occupations').select('*').order('name', { ascending: true }),
        supabase.from('associations').select('*').order('name', { ascending: true }),
        supabase.from('places').select('*').order('name', { ascending: true }),
      ]);

    const responses = [
      statesRes,
      classesRes,
      racesRes,
      occupationsRes,
      associationsRes,
      placesRes,
    ];

    const responseError = responses.find((response) => response.error)?.error;
    if (responseError) {
      throw responseError;
    }

    setStates((statesRes.data as State[]) || []);
    setClasses((classesRes.data as Class[]) || []);
    setRaces((racesRes.data as Race[]) || []);
    setOccupations((occupationsRes.data as Occupation[]) || []);
    setAssociations((associationsRes.data as Association[]) || []);
    setPlaces((placesRes.data as Place[]) || []);
  };

  const buildCharacterPayload = (character: CharacterFormData, imageUrl?: string | null) => ({
    name: character.name.trim(),
    description: character.description.trim() || null,
    image_url: imageUrl ?? (character.image_url.trim() || null),
    age: character.age === '' ? null : character.age,
    state_id: character.state_id || null,
  });

  const uploadCharacterImage = async (file: File) => {
    const bucket = 'characters_images';
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-');
    const filePath = `characters/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  };

  const resolveImageUrl = async (character: CharacterFormData) => {
    if (!character.image_file) return null;
    return uploadCharacterImage(character.image_file);
  };

  const syncJoinTable = async (
    table: string,
    column: string,
    characterId: string,
    ids: string[],
  ) => {
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq('character_id', characterId);

    if (deleteError) {
      throw deleteError;
    }

    if (ids.length === 0) return;

    const payload = ids.map((id) => ({
      character_id: characterId,
      [column]: id,
    }));

    const { error: insertError } = await supabase.from(table).insert(payload);
    if (insertError) {
      throw insertError;
    }
  };

  const syncCharacterRelations = async (characterId: string, character: CharacterFormData) => {
    await Promise.all([
      syncJoinTable('character_classes', 'class_id', characterId, character.class_ids),
      syncJoinTable('character_races', 'race_id', characterId, character.race_ids),
      syncJoinTable('character_occupations', 'occupation_id', characterId, character.occupation_ids),
      syncJoinTable('character_associations', 'association_id', characterId, character.association_ids),
      syncJoinTable('character_places', 'place_id', characterId, character.place_ids),
    ]);
  };

  const handleAddCharacter = async (character: CharacterFormData) => {
    try {
      const uploadedImageUrl = await resolveImageUrl(character);
      const { data, error } = await supabase
        .from('characters')
        .insert([buildCharacterPayload(character, uploadedImageUrl)])
        .select('id')
        .single();

      if (error) throw error;

      await syncCharacterRelations(data.id, character);

      await fetchCharactersList();
    } catch (error) {
      console.error('Error adding character:', error);
      alert('Error adding character. Please check your Supabase configuration.');
    }
  };

  const handleEditCharacter = async (id: string, character: CharacterFormData) => {
    try {
      const uploadedImageUrl = await resolveImageUrl(character);
      const { error } = await supabase
        .from('characters')
        .update(buildCharacterPayload(character, uploadedImageUrl))
        .eq('id', id);

      if (error) throw error;
      await syncCharacterRelations(id, character);
      await fetchCharactersList();
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
      await fetchCharactersList();
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
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
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
              <Button type="submit" disabled={authenticating}>
                {authenticating ? 'Logging in...' : 'Login'}
              </Button>
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

        {error && <p className="configs__error">{error}</p>}

        {loading ? (
          <p>Loading characters...</p>
        ) : (
          <CharacterTable
            characters={characters}
            states={states}
            classes={classes}
            races={races}
            occupations={occupations}
            associations={associations}
            places={places}
            onAdd={handleAddCharacter}
            onEdit={handleEditCharacter}
            onDelete={handleDeleteCharacter}
          />
        )}
      </div>
    </div>
  );
}
