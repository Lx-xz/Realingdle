# Realingdle

A character guessing game for the Realing RPG universe created by Carlos Jair "Cajá" Veronez.

## Features

- **Home Page**: Simple landing page with a play button
- **Game Page**: Character guessing game with 10 lives
- **Admin Panel**: Manage characters (add, edit, delete) with authentication

## Technologies

- Next.js 16 (App Router)
- TypeScript
- Supabase
- Vanilla CSS (nested)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run the database setup scripts in Supabase SQL Editor:

- Schema: [supabase/schema.sql](supabase/schema.sql)
- Seed data (optional): [supabase/seed.sql](supabase/seed.sql)

3. Create a Storage bucket named `characters_images` (public) for uploads.

3. Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

4. Update `.env.local` with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### 4. Add Characters

1. Navigate to [http://localhost:3000/configs](http://localhost:3000/configs)
2. Login with your Supabase Auth admin user (create in Supabase Dashboard > Authentication > Users)
3. Add characters to the database

## Pages

- `/` - Home page with play button
- `/game` - Character guessing game
- `/configs` - Admin panel for character management

## Building for Production

```bash
npm run build
npm start
```

## License

This project is for the Realing RPG community.
