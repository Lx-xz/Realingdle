# Realingdle - Implementation Guide

## Overview
Realingdle is a character guessing game for the Realing RPG universe. Players have 10 lives to guess the character of the day.

## Architecture

### Directory Structure
```
/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Home page
│   ├── page.css           # Home page styles
│   ├── layout.tsx         # Root layout
│   ├── globals.css        # Global styles
│   ├── game/              # Game page
│   │   ├── page.tsx
│   │   └── page.css
│   └── configs/           # Admin panel
│       ├── page.tsx
│       └── page.css
├── components/            # Reusable components
│   ├── Button.tsx
│   ├── Button.css
│   ├── SearchBar.tsx
│   ├── SearchBar.css
│   ├── LifeBar.tsx
│   ├── LifeBar.css
│   ├── CharacterTable.tsx
│   └── CharacterTable.css
├── lib/                   # Utilities
│   └── supabase.ts        # Supabase client
└── types/                 # TypeScript types
    └── index.ts
```

## Database Schema

Run the Supabase SQL scripts:

- Schema: [supabase/schema.sql](supabase/schema.sql)
- Seed data (optional): [supabase/seed.sql](supabase/seed.sql)

## Environment Variables

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
Admin credentials are managed via Supabase Auth (Dashboard > Authentication > Users).

## Storage

Create a public Storage bucket named `characters_images` for image uploads.

## Game Logic

### Character of the Day Selection
The game selects a character based on the current day of the year:
```typescript
const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
const characterIndex = dayOfYear % data.length;
```

This ensures the same character appears for all players on the same day.

### Life System
- Players start with 10 lives
- Each incorrect guess reduces lives by 1
- Game ends when lives reach 0 or character is guessed correctly
- Lives are represented visually with heart icons (♥)

### Guess Validation
- Guesses are case-insensitive
- Whitespace is trimmed
- Exact name match required to win

## Components

### Button
Reusable button component with three variants:
- **primary**: Main action button (blue)
- **secondary**: Alternative action button (outlined)
- **danger**: Destructive action button (red)

### SearchBar
Search input with submit button for character guessing.
- Disabled when game is over
- Clears after each guess
- Requires non-empty input

### LifeBar
Visual representation of remaining lives using heart icons.
- Shows filled hearts (red) for remaining lives
- Shows empty hearts (gray) for lost lives
- Displays numerical count (e.g., "Lives: 7/10")

### CharacterTable
Admin interface for character management:
- Displays all characters in a table
- Add new characters with name and description
- Edit existing characters
- Delete characters with confirmation
- Form validation

## Styling

All styling uses vanilla CSS with nested selectors (no Tailwind or CSS-in-JS).

### CSS Variables
Defined in `globals.css`:
```css
--background: #ffffff;
--foreground: #171717;
--primary: #4f46e5;
--primary-hover: #4338ca;
--success: #10b981;
--danger: #ef4444;
--border: #e5e7eb;
--shadow: rgba(0, 0, 0, 0.1);
```

### Design System
- Gradient backgrounds for all pages
- Consistent border radius (8px for inputs/buttons, 16px for cards)
- Hover effects with transform and box-shadow
- Smooth transitions (0.2s ease)

## Security Considerations

⚠️ **Important**: The current admin authentication uses a custom `users` table and client-side RPC call. This is suitable for development but **NOT for production**.

For production deployment:
1. Implement server-side authentication with Next.js API routes
2. Use Supabase Auth for user management
3. Implement Row Level Security (RLS) in Supabase
4. Use server actions for mutations
5. Never store passwords in environment variables

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Deployment

1. Set up a Supabase project
2. Create the characters table
3. Configure environment variables in your hosting platform
4. Deploy the Next.js application

Recommended platforms:
- Vercel (optimal for Next.js)
- Netlify
- Railway
- Render

## Future Enhancements

Potential improvements:
- Add hints system (reveal characters gradually)
- Implement leaderboard with Supabase
- Add character images
- Multi-language support
- Character categories/tags
- Statistics tracking
- Social sharing
- Progressive Web App (PWA) support
- Server-side authentication
- Character search autocomplete
- Difficulty levels
