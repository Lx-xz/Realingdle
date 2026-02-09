export interface State {
  id: string
  name: string
  created_at?: string
  updated_at?: string
}

export interface Class {
  id: string
  name: string
  created_at?: string
  updated_at?: string
}

export interface Race {
  id: string
  name: string
  created_at?: string
  updated_at?: string
}

export interface Occupation {
  id: string
  name: string
  created_at?: string
  updated_at?: string
}

export interface Association {
  id: string
  name: string
  created_at?: string
  updated_at?: string
}

export interface Place {
  id: string
  name: string
  created_at?: string
  updated_at?: string
}

export interface Character {
  id: string
  name: string
  description?: string | null
  image_url?: string | null
  age?: number | null
  state?: State | null
  classes: Class[]
  races: Race[]
  occupations: Occupation[]
  associations: Association[]
  places: Place[]
  created_at?: string
  updated_at?: string
}

export interface CharacterRow {
  id: string
  name: string
  description: string | null
  image_url: string | null
  age: number | null
  created_at?: string
  updated_at?: string
  state: State | State[] | null
  classes: { class: Class }[] | null
  races: { race: Race }[] | null
  occupations: { occupation: Occupation }[] | null
  associations: { association: Association }[] | null
  places: { place: Place }[] | null
}

export interface CharacterFormData {
  name: string
  description: string
  image_url: string
  image_file?: File | null
  age: number | ""
  state_id: string
  class_ids: string[]
  race_ids: string[]
  occupation_ids: string[]
  association_ids: string[]
  place_ids: string[]
}

export interface GameState {
  lives: number
  guesses: string[]
  gameOver: boolean
  won: boolean
}
