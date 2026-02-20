"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import SearchBar from "@/components/SearchBar"
import LifeBar from "@/components/LifeBar"
import Button from "@/components/Button"
import { fetchCharacters } from "@/lib/characters"
import { incrementGamesPlayedDirect, incrementWinsDirect } from "@/lib/profile"
import { supabase } from "@/lib/supabase"
import { Character } from "@/types"
import "./page.sass"

export default function GamePage() {
  const router = useRouter()
  const [searchValue, setSearchValue] = useState("")
  const [lives, setLives] = useState(10)
  const [guesses, setGuesses] = useState<string[]>([])
  const [gameOver, setGameOver] = useState(false)
  const [won, setWon] = useState(false)
  const [characterOfDay, setCharacterOfDay] = useState<Character | null>(null)
  const [allCharacters, setAllCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  const getTodayKey = () => new Date().toISOString().slice(0, 10)
  const storageKey = "realingdle:game-state"

  useEffect(() => {
    fetchCharacterOfDay()
  }, [])

  useEffect(() => {
    const syncSession = async () => {
      const { data } = await supabase.auth.getSession()
      setIsAdmin(data.session?.user?.app_metadata?.role === "admin")
    }

    syncSession()
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setIsAdmin(session?.user?.app_metadata?.role === "admin")
      },
    )

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const fetchCharacterOfDay = async () => {
    try {
      // Busca o personagem do dia do servidor
      const response = await fetch("/api/daily-character")
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error("API Error:", errorData)
        throw new Error(`Failed to fetch daily character: ${response.status}`)
      }

      const selectedCharacter = await response.json()
      setCharacterOfDay(selectedCharacter)

      // Busca todos os personagens para o searchbar
      const allCharactersData = await fetchCharacters({ ascending: true })
      setAllCharacters(allCharactersData)

      if (typeof window !== "undefined") {
        const raw = window.localStorage.getItem(storageKey)
        if (raw) {
          try {
            const saved = JSON.parse(raw) as {
              dateKey: string
              characterId: string
              guesses: string[]
              lives: number
              gameOver: boolean
              won: boolean
            }

            if (
              saved.dateKey === getTodayKey() &&
              saved.characterId === selectedCharacter.id
            ) {
              setGuesses(saved.guesses)
              setLives(saved.lives)
              setGameOver(saved.gameOver)
              setWon(saved.won)
            } else {
              window.localStorage.removeItem(storageKey)
            }
          } catch {
            window.localStorage.removeItem(storageKey)
          }
        }
      }
    } catch (error) {
      console.error("Error fetching character:", error)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!characterOfDay || typeof window === "undefined") return
    const payload = {
      dateKey: getTodayKey(),
      characterId: characterOfDay.id,
      guesses,
      lives,
      gameOver,
      won,
    }
    window.localStorage.setItem(storageKey, JSON.stringify(payload))
  }, [characterOfDay, guesses, lives, gameOver, won])

  const handleGuess = async (guess: string) => {
    if (gameOver || !characterOfDay) return

    const matchedCharacter = allCharacters.find(
      (character) => character.name.toLowerCase() === guess.toLowerCase(),
    )

    if (!matchedCharacter) {
      setSearchValue("")
      return
    }

    const newGuesses = [...guesses, matchedCharacter.name]
    const isFirstGuess = guesses.length === 0

    // Se é o primeiro chute, incrementa games_played
    if (isFirstGuess) {
      const { data: sessionData } = await supabase.auth.getSession()
      if (sessionData.session?.user?.id) {
        try {
          await incrementGamesPlayedDirect(sessionData.session.user.id)
        } catch (error) {
          console.error("Failed to increment games_played:", error)
        }
      }
    }

    setGuesses(newGuesses)

    // Check if the guess is correct (case-insensitive)
    if (
      matchedCharacter.name.toLowerCase() === characterOfDay.name.toLowerCase()
    ) {
      setWon(true)
      setGameOver(true)

      // Se ganhou, incrementa wins
      const { data: sessionData } = await supabase.auth.getSession()
      if (sessionData.session?.user?.id) {
        try {
          await incrementWinsDirect(sessionData.session.user.id)
        } catch (error) {
          console.error("Failed to increment wins:", error)
        }
      }
    } else {
      const newLives = lives - 1
      setLives(newLives)

      if (newLives === 0) {
        setGameOver(true)
      }
    }

    setSearchValue("")
  }

  const handleRestart = () => {
    setLives(10)
    setGuesses([])
    setGameOver(false)
    setWon(false)
    setSearchValue("")
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey)
    }
    fetchCharacterOfDay()
  }

  const guessedNames = new Set(guesses.map((guess) => guess.toLowerCase()))
  const suggestions = searchValue.trim().length
    ? allCharacters
        .filter((character) =>
          character.name.toLowerCase().includes(searchValue.toLowerCase()),
        )
        .filter((character) => !guessedNames.has(character.name.toLowerCase()))
        .map((character) => ({
          name: character.name,
          image_url: character.image_url,
        }))
    : []

  const getCharacterByName = (name: string) =>
    allCharacters.find(
      (character) => character.name.toLowerCase() === name.toLowerCase(),
    ) || null

  const formatList = (items: { name: string }[]) =>
    items.length > 0 ? items.map((item) => item.name).join(", ") : "-"

  const renderChips = (
    items: { id: string; name: string }[],
    matchItems: { id: string }[],
    emptyLabel = "None",
  ) => {
    const matchIds = new Set(matchItems.map((item) => item.id))
    if (items.length === 0) {
      return <span className="guess-chip guess-chip--miss">{emptyLabel}</span>
    }

    return items.map((item) => (
      <span
        key={item.id}
        className={`guess-chip ${matchIds.has(item.id) ? "guess-chip--match" : "guess-chip--miss"}`}
      >
        {item.name}
      </span>
    ))
  }

  if (loading) {
    return (
      <div className="game">
        <div className="game__container">
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (!characterOfDay) {
    return (
      <div className="game">
        <div className="game__container">
          <h2>No characters available</h2>
          <p>Please contact the administrator to add characters.</p>
          <Button onClick={() => router.push("/")}>Back to Home</Button>
        </div>
      </div>
    )
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
              suggestions={suggestions}
              onSelectSuggestion={(value) => setSearchValue(value)}
              noResultsText="No characters found"
              disabled={gameOver}
            />
          </div>
        )}

        {gameOver && (
          <div
            className={`game__result ${won ? "game__result--win" : "game__result--lose"}`}
          >
            <h2>{won ? "🎉 Congratulations!" : "😢 Game Over"}</h2>
            <p>
              {won
                ? `You guessed the character "${characterOfDay.name}" correctly!`
                : `The character was "${characterOfDay.name}"`}
            </p>
            {isAdmin && (
              <div className="game__actions">
                <Button onClick={handleRestart}>Play Again</Button>
              </div>
            )}
          </div>
        )}

        <div className="game__guesses">
          <ul className="game__guesses-list">
            {[...guesses].reverse().map((guess, index) => {
              const guessedCharacter = getCharacterByName(guess)
              const isCorrect =
                guessedCharacter?.id === characterOfDay?.id ||
                guess.toLowerCase() === characterOfDay?.name.toLowerCase()

              if (!guessedCharacter || !characterOfDay) {
                return (
                  <li
                    key={index}
                    className="game__guess-card game__guess-card--unknown"
                  >
                    <div className="game__guess-header">
                      <span className="game__guess-name">{guess}</span>
                      <span className="game__guess-status">Unknown</span>
                    </div>
                    <p className="game__guess-missing">Character not found.</p>
                  </li>
                )
              }

              const comparisons = {
                state: guessedCharacter.state?.id === characterOfDay.state?.id,
                age:
                  (guessedCharacter.age ?? null) ===
                  (characterOfDay.age ?? null),
              }

              const backgroundStyle = guessedCharacter.image_url
                ? ({
                    ["--guess-image" as string]: `url(${guessedCharacter.image_url})`,
                  } as React.CSSProperties)
                : undefined

              return (
                <li
                  key={index}
                  className={`game__guess-card ${
                    isCorrect
                      ? "game__guess-card--correct"
                      : "game__guess-card--wrong"
                  }`}
                  style={backgroundStyle}
                >
                  <div className="guess-card__content">
                    <div className="guess-card__info">
                      <div className="guess-card__title">
                        <h4>{guessedCharacter.name}</h4>
                        {guessedCharacter.description && (
                          <p className="guess-card__quote">
                            “{guessedCharacter.description}”
                          </p>
                        )}
                      </div>
                      <div className="guess-card__row-group">
                        <div className="guess-card__row guess-card__row--compact">
                          <span className="guess-card__label">Age</span>
                          <div className="guess-card__chips">
                            <span
                              className={`guess-chip ${
                                comparisons.age
                                  ? "guess-chip--match"
                                  : "guess-chip--miss"
                              }`}
                            >
                              {guessedCharacter.age ?? "-"}
                            </span>
                          </div>
                        </div>

                        <div className="guess-card__row guess-card__row--compact">
                          <span className="guess-card__label">State</span>
                          <div className="guess-card__chips">
                            <span
                              className={`guess-chip ${
                                comparisons.state
                                  ? "guess-chip--match"
                                  : "guess-chip--miss"
                              }`}
                            >
                              {guessedCharacter.state?.name || "-"}
                            </span>
                          </div>
                        </div>

                        <div className="guess-card__row guess-card__row--compact">
                          <span className="guess-card__label">Classes</span>
                          <div className="guess-card__chips">
                            {renderChips(
                              guessedCharacter.classes,
                              characterOfDay.classes,
                            )}
                          </div>
                        </div>

                        <div className="guess-card__row guess-card__row--compact">
                          <span className="guess-card__label">Races</span>
                          <div className="guess-card__chips">
                            {renderChips(
                              guessedCharacter.races,
                              characterOfDay.races,
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="guess-card__row guess-card__row--stacked">
                        <span className="guess-card__label">Occupations</span>
                        <div className="guess-card__chips">
                          {renderChips(
                            guessedCharacter.occupations,
                            characterOfDay.occupations,
                          )}
                        </div>
                      </div>

                      <div className="guess-card__row guess-card__row--stacked">
                        <span className="guess-card__label">Associations</span>
                        <div className="guess-card__chips">
                          {renderChips(
                            guessedCharacter.associations,
                            characterOfDay.associations,
                          )}
                        </div>
                      </div>

                      <div className="guess-card__row guess-card__row--stacked">
                        <span className="guess-card__label">Places</span>
                        <div className="guess-card__chips">
                          {renderChips(
                            guessedCharacter.places,
                            characterOfDay.places,
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
