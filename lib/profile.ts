import { supabase } from "@/lib/supabase"

export const incrementGamesPlayed = async (userId: string) => {
  const { error } = await supabase
    .from("profiles")
    .update({ games_played: supabase.rpc("increment", { x: 1 }) })
    .eq("id", userId)

  if (error) {
    console.error("Error incrementing games_played:", error)
    throw error
  }
}

export const incrementWins = async (userId: string) => {
  const { error } = await supabase
    .from("profiles")
    .update({ wins: supabase.rpc("increment", { x: 1 }) })
    .eq("id", userId)

  if (error) {
    console.error("Error incrementing wins:", error)
    throw error
  }
}

// Abordagem alternativa sem RPC
export const incrementGamesPlayedDirect = async (userId: string) => {
  // Primeiro busca o valor atual
  const { data: profile } = await supabase
    .from("profiles")
    .select("games_played")
    .eq("id", userId)
    .single()

  if (!profile) return

  // Depois atualiza com o novo valor
  const { error } = await supabase
    .from("profiles")
    .update({ games_played: (profile.games_played || 0) + 1 })
    .eq("id", userId)

  if (error) {
    console.error("Error incrementing games_played:", error)
    throw error
  }
}

export const incrementWinsDirect = async (userId: string) => {
  // Primeiro busca o valor atual
  const { data: profile } = await supabase
    .from("profiles")
    .select("wins")
    .eq("id", userId)
    .single()

  if (!profile) return

  // Depois atualiza com o novo valor
  const { error } = await supabase
    .from("profiles")
    .update({ wins: (profile.wins || 0) + 1 })
    .eq("id", userId)

  if (error) {
    console.error("Error incrementing wins:", error)
    throw error
  }
}
