import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { fetchCharacters } from "@/lib/characters"

export async function GET() {
  try {
    console.log("[DAILY-CHARACTER] Starting request")
    const today = new Date().toISOString().split("T")[0]
    console.log("[DAILY-CHARACTER] Today:", today)

    // Verifica se já existe para hoje
    const { data: existingDaily, error: queryError } = await supabase
      .from("daily_characters")
      .select("character_id")
      .eq("date", today)
      .single()

    console.log("[DAILY-CHARACTER] Query result:", { existingDaily, queryError })

    // PGRST116 = no rows returned (esperado na primeira vez)
    if (queryError && queryError.code !== "PGRST116") {
      console.error("[DAILY-CHARACTER] Query error:", queryError)
      throw queryError
    }

    let characterId = existingDaily?.character_id
    console.log("[DAILY-CHARACTER] Existing character ID:", characterId)

    // Se não existir, cria um novo
    if (!characterId) {
      console.log("[DAILY-CHARACTER] Fetching all characters...")
      const allCharacters = await fetchCharacters({ ascending: true })
      console.log("[DAILY-CHARACTER] Total characters:", allCharacters.length)

      if (allCharacters.length === 0) {
        return NextResponse.json(
          { error: "No characters available" },
          { status: 404 },
        )
      }

      const dayOfYear = Math.floor(
        (new Date().getTime() -
          new Date(new Date().getFullYear(), 0, 0).getTime()) /
          86400000,
      )
      const characterIndex = dayOfYear % allCharacters.length
      characterId = allCharacters[characterIndex].id
      console.log("[DAILY-CHARACTER] Selected character:", characterId)

      // Salva no banco
      const { error: insertError } = await supabase
        .from("daily_characters")
        .insert({
          date: today,
          character_id: characterId,
        })

      if (insertError) {
        console.error("[DAILY-CHARACTER] Insert error:", insertError)
        throw insertError
      }
    }

    console.log("[DAILY-CHARACTER] Fetching character data for:", characterId)

    // Busca o personagem completo
    const { data: character, error } = await supabase
      .from("characters")
      .select(
        `
        *,
        state:state_id(id, name),
        classes:character_classes(class:class_id(id, name)),
        races:character_races(race:race_id(id, name)),
        occupations:character_occupations(occupation:occupation_id(id, name)),
        associations:character_associations(association:association_id(id, name)),
        places:character_places(place:place_id(id, name))
      `,
      )
      .eq("id", characterId)
      .single()

    if (error) {
      console.error("[DAILY-CHARACTER] Character fetch error:", error)
      throw error
    }

    console.log("[DAILY-CHARACTER] Success, returning character")
    return NextResponse.json(character)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorCode = error instanceof Object && "code" in error ? (error as any).code : "UNKNOWN"
    console.error("[DAILY-CHARACTER] Caught error:", { errorMessage, errorCode, error })

    return NextResponse.json(
      {
        error: "Failed to fetch daily character",
        details: errorMessage,
        code: errorCode,
      },
      { status: 500 },
    )
  }
}
