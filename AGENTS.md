# AGENTS.md — Vaktlista (skiutleia)

Vägledning för AI-agenter som arbetar i det här repot. **Uppdatera "Aktuellt läge" i slutet av varje session** så att nästa session kan fortsätta utan omstart.

## Projekt
Webbapp för vaktlistor/schema för ett skidanläggningens personal (norwegiska användare, gränssnitt på norska). React 18 + Vite + Tailwind, Firebase (Firestore + Auth + Hosting + Cloud Functions). Appen heter internt `skiutleia`.

## Struktur
- `src/` — React-appen (`App.jsx` är huvudkomponenten)
  - `src/components/` — UI-komponenter (modaler, kalendrar, admin)
  - `src/hooks/` — `useFirebaseData`, `useWorkLawValidation` (validering mot arbetsmarknadslagen), `useNorwegianHolidays`
  - `src/firebase.js` — Firestore-config + CRUD-funktioner och anrop till Cloud Functions
  - `src/utils/icalGenerator.js` — iCal-export på klientsidan
- `functions/` — Cloud Functions (Node 22, firebase-admin). Endpointar: `/api/export/ical` och `/api/export/ical/:employeeId` (omskrivna i `firebase.json`)
- `server/` — lokal utvecklingsserver (`server.js`)
- `.agents/skills/` och `.claude/skills/` — genererade Firebase-referenser; **redigera inte**

## Kommandon
- `npm run dev` — Vite dev-server
- `npm run build` — produktionbuild (alias för `vite build`), output till `dist/`
- `npm run preview` — förhandsgranska build
- `cd functions && npm install` — Cloud Functions-beroenden

## Konventioner
- Språk i UI och kommentarer: norska. Commitmeddelanden: svenska (se git-historik).
- Ingen testsvit finns ännu; verifiera med `npm run build` + manuell granskning.
- Miljövariabler enligt `.env.example` (lagra aldrig `.env` i repot).

## Deploy (automatisk, rör inte manuellt)
- `main`-push deployar Firebase Hosting + Functions (`.github/workflows/deploy.yml`).
- Staging: `deploy-staging.yml` (manuellt eller via branch).
- Använd alltid en task-branch (`vibe/<slug>`) för ändringar, committa löpande.

## Aktuellt läge
*(Senast uppdaterad av agent: skriv över den här sektionen i slutet av varje session.)*

- Senaste commit på `main`: `1e41fde` — "Visa varningar för arbetslagsbrott vid bulk-schemaläggning (rätta även validering inom samma bulk)".
- Inga öppna issues eller PR:er just nu.
- Kända observationer: ingen README ännu; skolferier hårdkodade i `src/App.jsx` (2026); inga tester.

## Nästa steg
- Lägg till README.
- Flytta hårdkodade ferier/högtidsdatum till konfiguration.
- Överväg testsvit för `useWorkLawValidation`.
