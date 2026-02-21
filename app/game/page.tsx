"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, ChevronDown } from "lucide-react"
import { useAuthSession } from "@/components/AuthSessionProvider"
import SearchBar from "@/components/SearchBar"
import LifeBar from "@/components/LifeBar"
import Button from "@/components/Button"
import Loading from "@/components/Loading"
import { fetchCharacters } from "@/lib/characters"
import { incrementGamesPlayedDirect, incrementWinsDirect } from "@/lib/profile"
import { supabase } from "@/lib/supabase"
import { Character } from "@/types"
import "./page.sass"

interface GamePageContentProps {
  forcedDate?: string
}

const isValidDateString = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)

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
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
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
        await sleep(400 * 2 ** index)
      }
    }
  }

  throw new Error(
    `${label} failed after ${attempts} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  )
}

export default function GamePage() {
  return <GamePageContent />
}

export function GamePageContent({ forcedDate }: GamePageContentProps) {
  const router = useRouter()
  const { user: sessionUser } = useAuthSession()
  const MAX_LIVES = 10
  const [searchValue, setSearchValue] = useState("")
  const [lives, setLives] = useState(MAX_LIVES)
  const [guesses, setGuesses] = useState<string[]>([])
  const [gameOver, setGameOver] = useState(false)
  const [won, setWon] = useState(false)
  const [found, setFound] = useState(false)
  const [characterOfDay, setCharacterOfDay] = useState<Character | null>(null)
  const [allCharacters, setAllCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [attemptHydrated, setAttemptHydrated] = useState(false)
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [dateMenuOpen, setDateMenuOpen] = useState(false)
  const [datesLoaded, setDatesLoaded] = useState(false)
  const [datesLoading, setDatesLoading] = useState(false)
  const [dateStatusMap, setDateStatusMap] = useState<Record<string, "won" | "lost" | "in-progress">>({})
  const fetchInFlightRef = useRef<Promise<void> | null>(null)
  const fetchSequenceRef = useRef(0)

  const getTodayKey = () => new Date().toISOString().slice(0, 10)
  const gameDate = useMemo(() => {
    if (forcedDate && isValidDateString(forcedDate)) {
      return forcedDate
    }
    return getTodayKey()
  }, [forcedDate])
  const sessionUserId = sessionUser?.id ?? null
  const isTodayGame = gameDate === getTodayKey()
  const storageKey = `realingdle:game-state:v3:${gameDate}`
  const formatDateLabel = (value: string) => {
    const [year, month, day] = value.split("-")
    if (!year || !month || !day) return value
    return `${day}/${month}/${year}`
  }

  const formatDateShort = (value: string) => {
    const [, month, day] = value.split("-")
    if (!month || !day) return value
    return `${day}/${month}`
  }

  useEffect(() => {
    fetchCharacterOfDay()
  }, [gameDate])

  const loadAvailableDates = async () => {
    if (datesLoading) return
    setDatesLoading(true)

    const { data: dateRows, error: datesError } = await withRetry(
      () =>
        withTimeout(
          supabase
            .from("daily_characters")
            .select("date")
            .order("date", { ascending: false }),
          10000,
          "Available dates fetch",
        ),
      2,
      "Available dates fetch",
    )

    if (datesError) {
      console.error("Error loading available game dates:", datesError)
      setDatesLoading(false)
      return
    }

    const dates = (dateRows ?? [])
      .map((item) => item.date)
      .filter((item): item is string => typeof item === "string")

    setAvailableDates(dates)

    const currentUserId = sessionUser?.id

    if (!currentUserId) {
      setDateStatusMap({})
      setDatesLoaded(true)
      setDatesLoading(false)
      return
    }

    const { data: attempts, error: attemptsError } = await withRetry(
      () =>
        withTimeout(
          supabase
            .from("daily_game_attempts")
            .select("game_date, won, found, lives_remaining")
            .eq("user_id", currentUserId),
          10000,
          "Date statuses fetch",
        ),
      2,
      "Date statuses fetch",
    )

    if (attemptsError) {
      console.error("Error loading date statuses:", attemptsError)
      setDateStatusMap({})
      setDatesLoaded(true)
      setDatesLoading(false)
      return
    }

    const statusMap: Record<string, "won" | "lost" | "in-progress"> = {}

    ;(attempts ?? []).forEach((attempt) => {
      const attemptDate = attempt.game_date
      if (typeof attemptDate !== "string") return

      if (attempt.won || attempt.found) {
        statusMap[attemptDate] = "won"
      } else if ((attempt.lives_remaining ?? 0) <= 0) {
        statusMap[attemptDate] = "lost"
      } else {
        statusMap[attemptDate] = "in-progress"
      }
    })

    setDateStatusMap(statusMap)
    setDatesLoaded(true)
    setDatesLoading(false)
  }

  const handleToggleDateMenu = () => {
    setDateMenuOpen((current) => !current)

    if (!dateMenuOpen && !datesLoaded) {
      loadAvailableDates()
    }
  }

  useEffect(() => {
    if (!datesLoaded && !datesLoading) {
      loadAvailableDates()
    }
  }, [sessionUser?.id])

  const handleSelectDate = (date: string) => {
    if (date === getTodayKey()) {
      router.push("/game")
      setDateMenuOpen(false)
      return
    }

    router.push(`/game/${date}`)
    setDateMenuOpen(false)
  }

  const fetchCharacterOfDay = async () => {
    if (fetchInFlightRef.current) {
      return fetchInFlightRef.current
    }

    const run = async () => {
      const sequence = ++fetchSequenceRef.current
      const charactersCacheKey = "realingdle:characters-cache:v1"
      const charactersCacheTtlMs = 5 * 60 * 1000

      setAttemptHydrated(false)
      setLoadError("")

      let optimisticHydrated = false

      if (typeof window !== "undefined") {
        try {
          const rawCharactersCache = window.localStorage.getItem(charactersCacheKey)
          const rawGameCache = window.localStorage.getItem(storageKey)

          if (rawCharactersCache && rawGameCache) {
            const parsedCharactersCache = JSON.parse(rawCharactersCache) as {
              data?: Character[]
              expiresAt?: number
            }
            const parsedGameCache = JSON.parse(rawGameCache) as {
              dateKey: string
              characterId: string
              guesses: string[]
              lives: number
              won: boolean
              found?: boolean
            }

            const hasValidCharactersCache =
              Array.isArray(parsedCharactersCache.data) &&
              typeof parsedCharactersCache.expiresAt === "number" &&
              parsedCharactersCache.expiresAt > Date.now()

            if (hasValidCharactersCache && parsedGameCache.dateKey === gameDate) {
              const cachedCharacters = parsedCharactersCache.data as Character[]
              const cachedCharacterOfDay = cachedCharacters.find(
                (character) => character.id === parsedGameCache.characterId,
              )

              if (cachedCharacterOfDay) {
                setAllCharacters(cachedCharacters)
                setCharacterOfDay(cachedCharacterOfDay)
                setGuesses(
                  Array.isArray(parsedGameCache.guesses)
                    ? parsedGameCache.guesses
                    : [],
                )
                const cachedLives = Math.max(
                  0,
                  Math.min(parsedGameCache.lives ?? MAX_LIVES, MAX_LIVES),
                )
                const cachedWon = Boolean(parsedGameCache.won)
                const cachedFound = Boolean(
                  parsedGameCache.found ?? parsedGameCache.won,
                )
                setLives(cachedLives)
                setWon(cachedWon)
                setFound(cachedFound)
                setGameOver(cachedFound || cachedLives === 0)
                optimisticHydrated = true
              }
            }
          }
        } catch {
          window.localStorage.removeItem(charactersCacheKey)
          window.localStorage.removeItem(storageKey)
        }
      }

      if (!optimisticHydrated) {
        setGuesses([])
        setLives(MAX_LIVES)
        setWon(false)
        setFound(false)
        setGameOver(false)
        setLoading(true)
      } else {
        setLoading(false)
      }

      try {
        const allCharactersData = await withRetry(
          () =>
            withTimeout(
              fetchCharacters({ ascending: true }),
              15000,
              "Characters fetch",
            ),
          3,
          "Characters fetch",
        )

        if (sequence !== fetchSequenceRef.current) return

        setAllCharacters(allCharactersData)

        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            charactersCacheKey,
            JSON.stringify({
              data: allCharactersData,
              expiresAt: Date.now() + charactersCacheTtlMs,
            }),
          )
        }

        const currentUserId = sessionUser?.id ?? null

        const { data: dailyCharacter, error: dailyError } = await withRetry(
          () =>
            withTimeout(
              supabase
                .from("daily_characters")
                .select("character_id")
                .eq("date", gameDate)
                .maybeSingle(),
              12000,
              "Daily character fetch",
            ),
          3,
          "Daily character fetch",
        )

        if (dailyError) {
          throw dailyError
        }

        const selectedCharacter = allCharactersData.find(
          (character) => character.id === dailyCharacter?.character_id,
        )

        if (!selectedCharacter) {
          throw new Error("Daily character not found")
        }

        if (sequence !== fetchSequenceRef.current) return
        setCharacterOfDay(selectedCharacter)

        if (currentUserId) {
          const { data: savedAttempt, error: attemptError } = await withRetry(
            () =>
              withTimeout(
                supabase
                  .from("daily_game_attempts")
                  .select("guesses, lives_remaining, won, found")
                  .eq("user_id", currentUserId)
                  .eq("game_date", gameDate)
                  .maybeSingle(),
                12000,
                "Saved attempt fetch",
              ),
            2,
            "Saved attempt fetch",
          )

          if (attemptError) {
            console.error("Error loading saved attempt:", attemptError)
          }

          if (savedAttempt) {
            const savedGuesses = Array.isArray(savedAttempt.guesses)
              ? savedAttempt.guesses.filter(
                  (item): item is string => typeof item === "string",
                )
              : []

            if (sequence !== fetchSequenceRef.current) return
            setGuesses(savedGuesses)
            const savedLives = Math.max(
              0,
              Math.min(savedAttempt.lives_remaining ?? MAX_LIVES, MAX_LIVES),
            )
            const savedWon = Boolean(savedAttempt.won)
            const savedFound = Boolean(savedAttempt.found || savedAttempt.won)
            setLives(savedLives)
            setWon(savedWon)
            setFound(savedFound)
            setGameOver(savedFound || savedLives === 0)

            setAttemptHydrated(true)
            return
          }
        }

        if (typeof window !== "undefined") {
          const raw = window.localStorage.getItem(storageKey)
          if (raw) {
            try {
              const saved = JSON.parse(raw) as {
                dateKey: string
                characterId: string
                guesses: string[]
                lives: number
                won: boolean
                found?: boolean
              }

              if (
                saved.dateKey === gameDate &&
                saved.characterId === selectedCharacter.id
              ) {
                setGuesses(saved.guesses)
                const savedLives = Math.max(0, Math.min(saved.lives, MAX_LIVES))
                const savedWon = Boolean(saved.won)
                const savedFound = Boolean(saved.found ?? saved.won)
                setLives(savedLives)
                setWon(savedWon)
                setFound(savedFound)
                setGameOver(savedFound || savedLives === 0)
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
        if (!optimisticHydrated) {
          setLoadError("Unable to load game right now. Please try again.")
        }
      } finally {
        if (sequence === fetchSequenceRef.current) {
          setAttemptHydrated(true)
          setLoading(false)
        }
      }
    }

    const inFlight = run().finally(() => {
      if (fetchInFlightRef.current === inFlight) {
        fetchInFlightRef.current = null
      }
    })

    fetchInFlightRef.current = inFlight
    return inFlight
  }

  const validateGuessOnBackend = async (guessCharacterId: string) => {
    const { data, error } = await supabase.rpc("daily_guess", {
      guess_character_id: guessCharacterId,
      game_date: gameDate,
    })

    if (error) {
      throw error
    }

    if (!data || typeof data !== "object") {
      return null
    }

    const result = data as { is_correct?: unknown }
    return typeof result.is_correct === "boolean" ? result.is_correct : null
  }

  const revealCharacterOnDefeat = async () => {
    const { data, error } = await supabase.rpc("daily_character_reveal", {
      game_date: gameDate,
    })
    if (error) {
      throw error
    }

    const revealedCharacter = allCharacters.find((character) => character.id === data)
    if (revealedCharacter) {
      setCharacterOfDay(revealedCharacter)
    }
  }

  useEffect(() => {
    if (!characterOfDay || typeof window === "undefined") return
    const payload = {
      dateKey: gameDate,
      characterId: characterOfDay.id,
      guesses,
      lives,
      won,
      found,
    }
    window.localStorage.setItem(storageKey, JSON.stringify(payload))
  }, [characterOfDay, guesses, lives, won, found, gameDate, storageKey])

  useEffect(() => {
    if (!characterOfDay || !attemptHydrated || !sessionUserId) return
    if (guesses.length === 0) return

    const saveAttempt = async () => {
      const { error } = await supabase.from("daily_game_attempts").upsert(
        {
          user_id: sessionUserId,
          game_date: gameDate,
          lives_remaining: lives,
          guesses,
          won,
          found,
        },
        { onConflict: "user_id,game_date" },
      )

      if (error) {
        console.error("Error saving daily attempt:", error)
      }
    }

    saveAttempt()
  }, [
    characterOfDay,
    guesses,
    lives,
    won,
    found,
    sessionUserId,
    attemptHydrated,
    gameDate,
  ])

  const handleGuess = async (guess: string) => {
    if (gameOver || !characterOfDay) return

    const matchedCharacter = allCharacters.find(
      (character) => character.name.toLowerCase() === guess.toLowerCase(),
    )

    if (!matchedCharacter) {
      setSearchValue("")
      return
    }

    const newGuesses = [...guesses, matchedCharacter.id]
    const isFirstGuess = guesses.length === 0

    // Se é o primeiro chute, incrementa games_played
    if (isFirstGuess && isTodayGame) {
      if (sessionUserId) {
        try {
          await incrementGamesPlayedDirect(sessionUserId)
        } catch (error) {
          console.error("Failed to increment games_played:", error)
        }
      }
    }

    setGuesses(newGuesses)

    let backendIsCorrect: boolean | null = null
    try {
      backendIsCorrect = await validateGuessOnBackend(matchedCharacter.id)
    } catch (error) {
      console.error("Failed to validate guess on backend:", error)
    }

    const isCorrectGuess =
      backendIsCorrect ??
      matchedCharacter.name.toLowerCase() === characterOfDay.name.toLowerCase()

    if (isCorrectGuess) {
      setFound(true)
      setWon(isTodayGame)
      setGameOver(true)

      // Se encontrou no dia atual, incrementa wins
      if (isTodayGame) {
        if (sessionUserId) {
          try {
            await incrementWinsDirect(sessionUserId)
          } catch (error) {
            console.error("Failed to increment wins:", error)
          }
        }
      }
    } else {
      const newLives = lives - 1
      setLives(newLives)

      if (newLives === 0) {
        setGameOver(true)
        try {
          await revealCharacterOnDefeat()
        } catch (error) {
          console.error("Failed to reveal character on defeat:", error)
        }
      }
    }

    setSearchValue("")
  }

  const resolveGuessCharacter = (guessToken: string) =>
    allCharacters.find((character) => character.id === guessToken) || null

  const guessedCharacterIds = new Set(
    guesses
      .map((guessToken) => resolveGuessCharacter(guessToken)?.id)
      .filter((id): id is string => Boolean(id)),
  )

  const suggestions = searchValue.trim().length
    ? allCharacters
        .filter((character) =>
          character.name.toLowerCase().includes(searchValue.toLowerCase()),
        )
        .filter((character) => !guessedCharacterIds.has(character.id))
        .map((character) => ({
          name: character.name,
          image_url: character.image_url,
        }))
    : []

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
          <Loading label="Loading..." />
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="game">
        <div className="game__container">
          <h2>Loading failed</h2>
          <p>{loadError}</p>
          <Button onClick={fetchCharacterOfDay}>Try again</Button>
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
        <div className="game__header">
          <h1 className="game__title">Guess the Character</h1>
          <div className="game__date-dropdown-wrap">
            <button
              type="button"
              className="game__date-trigger"
              onClick={handleToggleDateMenu}
            >
              <CalendarDays className="game__date-trigger-icon" />
              <span>{formatDateLabel(gameDate)}</span>
              <ChevronDown
                className={`game__date-trigger-chevron ${dateMenuOpen ? "game__date-trigger-chevron--open" : ""}`}
              />
            </button>

            {dateMenuOpen && (
              <div className="game__date-dropdown">
                {datesLoading && (
                  <div className="game__date-loading">
                    <Loading label="Carregando datas..." compact light />
                  </div>
                )}
                <div className="game__date-grid">
                  {availableDates.map((availableDate) => {
                    const dateStatus = dateStatusMap[availableDate]
                    const statusClass =
                      dateStatus === "won"
                        ? "game__date-chip--won"
                        : dateStatus === "lost"
                          ? "game__date-chip--lost"
                          : dateStatus === "in-progress"
                            ? "game__date-chip--in-progress"
                            : ""
                    const selectedClass =
                      availableDate === gameDate ? "game__date-chip--selected" : ""

                    return (
                      <button
                        key={availableDate}
                        type="button"
                        className={`game__date-chip ${statusClass} ${selectedClass}`}
                        onClick={() => handleSelectDate(availableDate)}
                      >
                        {formatDateShort(availableDate)}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <LifeBar lives={lives} maxLives={MAX_LIVES} />

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
            className={`game__result ${found ? "game__result--win" : "game__result--lose"}`}
          >
            <h2>{found ? "🎉 Congratulations!" : "😢 Game Over"}</h2>
            <p>
              {found
                ? `You guessed the character "${characterOfDay.name}" correctly!`
                : `The character was "${characterOfDay.name}"`}
            </p>
          </div>
        )}

        <div className="game__guesses">
          <ul className="game__guesses-list">
            {[...guesses].reverse().map((guessToken, index) => {
              const guessedCharacter = resolveGuessCharacter(guessToken)
              const isCorrect =
                guessedCharacter?.id === characterOfDay?.id

              if (!guessedCharacter || !characterOfDay) {
                return (
                  <li
                    key={index}
                    className="game__guess-card game__guess-card--unknown"
                  >
                    <div className="game__guess-header">
                      <span className="game__guess-name">Unknown character</span>
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
