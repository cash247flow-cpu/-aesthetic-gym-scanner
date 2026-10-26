# Aesthetic Gym Scanner

Snap one photo of your gym, pick **Push / Pull / Legs**, and get that session of the Natty Blueprint program using only the equipment Gemini can see — with sets × reps, rest, a form cue, and an aesthetic badge per exercise. Missing equipment is swapped for a labeled substitute or the slot is dropped (never invented).

## Setup

```bash
npm install
cp .env.example .env.local   # then paste your key into .env.local
npm run dev
```

Get a Gemini API key at https://aistudio.google.com/app/apikey and set `GEMINI_API_KEY` in `.env.local`. The key is only read server-side (`app/api/identify/route.ts`) and never ships to the browser.

## Open on your phone (same Wi-Fi)

```bash
npm run dev -- -H 0.0.0.0
```

Find your laptop's LAN IP (Windows: `ipconfig` → IPv4 Address; macOS: `ipconfig getifaddr en0`; Linux: `hostname -I`) and open `http://<that-ip>:3000` on the phone. If it doesn't load, allow Node through the laptop firewall on private networks.

## Layout

| Path | What it does |
| --- | --- |
| `lib/programs.ts` | Program data: sessions, substitutes, aesthetic rankings |
| `lib/equipment.ts` | Canonical equipment whitelist + normalizer |
| `lib/plan.ts` | Pure planner: keep / swap / drop, badges, counts, missing note |
| `app/api/identify/route.ts` | Image → Gemini → `{ equipment: string[] }` (with model fallback + timeout) |
| `app/api/plan/route.ts` | `{ session, equipment }` → plan JSON |
| `app/page.tsx`, `components/ResultView.tsx` | Upload → loading → result UI |
