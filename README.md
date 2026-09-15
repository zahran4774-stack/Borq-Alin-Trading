# نظام محاسبة ليروق العين للتجارة | Al-Ain Trading Accounting System

Bilingual (AR/EN) double-entry accounting system built on Next.js 15 + Supabase.

## Setup

1. `npm install`
2. Copy `.env.local.example` to `.env.local` (already points to the live Supabase project).
3. `npm run dev`

## Supabase project

- Project: `al-ain-trading-accounting`
- Project ID: `byhkwkltpyugrnitfmep`
- Region: `ap-south-1`
- URL: `https://byhkwkltpyugrnitfmep.supabase.co`

## Structure

- `src/app/[locale]/` — locale-routed pages (`ar` / `en`)
- `src/lib/supabase/` — server, browser, and middleware Supabase clients
- `src/i18n/` — translation dictionaries
- `middleware.ts` — locale detection/redirect + Supabase session refresh

## Roles

New signups default to `viewer`. Promote a user to `admin` or `accountant` by updating
their row in the `profiles` table (`role` column) from the Supabase dashboard or SQL editor.
