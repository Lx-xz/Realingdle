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

## Supabase setup

Before running the app, execute the SQL in `supabase/ranking_rpc.sql` in your Supabase SQL editor.
It creates the RPC used by the header (`get_my_rank_and_wins`) and the global ranking page (`get_rank_profiles`).

## License

This project is for the Realing RPG community.
