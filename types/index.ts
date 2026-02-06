export interface Character {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface GameState {
  lives: number;
  guesses: string[];
  gameOver: boolean;
  won: boolean;
}
