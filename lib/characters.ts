import { supabase } from "@/lib/supabase"
import { Character, CharacterRow } from "@/types"

const characterSelect = `
  id,
  name,
  description,
  image_url,
  age,
  created_at,
  updated_at,
  state:states(id, name),
  classes:character_classes(class:classes(id, name)),
  races:character_races(race:races(id, name)),
  occupations:character_occupations(occupation:occupations(id, name)),
  associations:character_associations(association:associations(id, name)),
  places:character_places(place:places(id, name))
`

const normalizeCharacter = (row: CharacterRow): Character => ({
  id: row.id,
  name: row.name,
  description: row.description,
  image_url: row.image_url,
  age: row.age,
  created_at: row.created_at,
  updated_at: row.updated_at,
  state: Array.isArray(row.state) ? row.state[0] : row.state,
  classes: row.classes?.map((item) => item.class) ?? [],
  races: row.races?.map((item) => item.race) ?? [],
  occupations: row.occupations?.map((item) => item.occupation) ?? [],
  associations: row.associations?.map((item) => item.association) ?? [],
  places: row.places?.map((item) => item.place) ?? [],
})

interface FetchCharactersOptions {
  ascending?: boolean
}

export const fetchCharacters = async (options: FetchCharactersOptions = {}) => {
  const { data, error } = await supabase
    .from("characters")
    .select(characterSelect)
    .order("name", { ascending: options.ascending ?? true })

  if (error) {
    throw error
  }

  return (data as unknown as CharacterRow[]).map(normalizeCharacter)
}
