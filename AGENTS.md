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

## Deploy och testflöde (automatiskt, rör inte manuellt)

| Branch / händelse | Workflow | Miljö |
|---|---|---|
| Push till `main` | `deploy.yml` | Produktion (vaktlista-d0efd) |
| Push till `test` | `deploy-staging.yml` | Staging (separat Firebase-projekt, kräver `*_STAGING`-secrets) |
| PR mot `main` | `firebase-hosting-pull-request.yml` + Vercel | Tillfällig preview-URL per PR |

- Använd alltid en task-branch (`vibe/<slug>`) för ändringar, committa löpande, öppna draft-PR.
- **Flow per ändringstyp (rekommenderat av agent):**
  - Mindre ändringar (UI, mindre funktioner, bugfixar): task-branch → PR → användaren testar på PR-preview-url → merge direkt till `main`.
  - Större ändringar (Cloud Functions, datamodell, auth eller flöden som är svåra att se i en PR-preview): task-branch → PR → merge till `test` → användaren verifierar på staging → merge till `main`.
- Pusha aldrig direkt till `main` eller `test` — alltid via PR så användaren kan testa på preview först.
- Staging-workflowen avbryter om `FIREBASE_SERVICE_ACCOUNT_STAGING`, `FIREBASE_DEPLOY_TOKEN_STAGING` eller `VITE_FIREBASE_CONFIG_STAGING` saknas (avsiktligt, för att inte skriva över prod).
- I varje session: föreslå för användaren vilket flow som passar den aktuella ändringen.

## Aktuellt läge
*(Senast uppdaterad av agent: skriv över den här sektionen i slutet av varje session.)*

- `main`-tips: `a603ccb` (merge av PR #3). PR #2 (AGENTS.md) och PR #3 (periodval i adminstatistiken, `AdminStats.jsx`) är mergade och deployade till produktion.
- Äldre branches på remote (från tidigare sessioner, ej mergade): `vibe/fix-ical-tidssone-f804ba` (iCal-tidszonsfix + OverviewCalendar-förbättringar), `vibe/test-miljo-245bff` (fixar för PR-preview/firebase.json/iCal), `test` (staging-branch). Kontrollera med användaren innan dessa raderas.
- Kända observationer: ingen README ännu; skolferier hårdkodade i `src/App.jsx` (2026); inga tester.

## Nästa steg
- Lägg till README.
- Flytta hårdkodade ferier/högtidsdatum till konfiguration.
- Överväg testsvit för `useWorkLawValidation`.
