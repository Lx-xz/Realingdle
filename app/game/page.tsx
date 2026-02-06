'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SearchBar from '@/components/SearchBar';
import LifeBar from '@/components/LifeBar';
import Button from '@/components/Button';
import { supabase } from '@/lib/supabase';
import { Character } from '@/types';
import './page.css';

export default function GamePage() {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState('');
  const [lives, setLives] = useState(10);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [characterOfDay, setCharacterOfDay] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCharacterOfDay();
  }, []);

  const fetchCharacterOfDay = async () => {
    try {
      // Get all characters
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        // Select a character based on the day (simple implementation)
        const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
        const characterIndex = dayOfYear % data.length;
        setCharacterOfDay(data[characterIndex]);
      }
    } catch (error) {
      console.error('Error fetching character:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGuess = (guess: string) => {
    if (gameOver || !characterOfDay) return;

    const newGuesses = [...guesses, guess];
    setGuesses(newGuesses);

    // Check if the guess is correct (case-insensitive)
    if (guess.toLowerCase() === characterOfDay.name.toLowerCase()) {
      setWon(true);
      setGameOver(true);
    } else {
      const newLives = lives - 1;
      setLives(newLives);
      
      if (newLives === 0) {
        setGameOver(true);
      }
    }

    setSearchValue('');
  };

  const handleRestart = () => {
    setLives(10);
    setGuesses([]);
    setGameOver(false);
    setWon(false);
    setSearchValue('');
    fetchCharacterOfDay();
  };

  if (loading) {
    return (
      <div className="game">
        <div className="game__container">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!characterOfDay) {
    return (
      <div className="game">
        <div className="game__container">
          <h2>No characters available</h2>
          <p>Please contact the administrator to add characters.</p>
          <Button onClick={() => router.push('/')}>Back to Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="game">
      <div className="game__container">
        <h1 className="game__title">Guess the Character</h1>
        
        <LifeBar lives={lives} maxLives={10} />

        {!gameOver && (
          <div className="game__search">
            <SearchBar
              value={searchValue}
              onChange={setSearchValue}
              onSubmit={handleGuess}
              disabled={gameOver}
            />
          </div>
        )}

        {gameOver && (
          <div className={`game__result ${won ? 'game__result--win' : 'game__result--lose'}`}>
            <h2>{won ? '🎉 Congratulations!' : '😢 Game Over'}</h2>
            <p>
              {won 
                ? `You guessed the character "${characterOfDay.name}" correctly!`
                : `The character was "${characterOfDay.name}"`
              }
            </p>
            <div className="game__actions">
              <Button onClick={handleRestart}>Play Again</Button>
              <Button variant="secondary" onClick={() => router.push('/')}>
                Back to Home
              </Button>
            </div>
          </div>
        )}

        <div className="game__guesses">
          <h3>Your Guesses ({guesses.length})</h3>
          <ul className="game__guesses-list">
            {guesses.map((guess, index) => (
              <li 
                key={index} 
                className={`game__guess ${
                  guess.toLowerCase() === characterOfDay.name.toLowerCase() 
                    ? 'game__guess--correct' 
                    : 'game__guess--wrong'
                }`}
              >
                {guess}
                {guess.toLowerCase() === characterOfDay.name.toLowerCase() ? ' ✓' : ' ✗'}
              </li>
            ))}
          </ul>
        </div>

        {characterOfDay.description && (
          <div className="game__hint">
            <h3>Hint</h3>
            <p>{characterOfDay.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
