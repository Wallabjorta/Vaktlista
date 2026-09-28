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
*(Senast uppdaterad av agent: 2026-09-28, session om Firestore-regler, dubletter, kategorier, backup/restore.)*

- `main` innehåller nu PR #15–#21 (+ #22 om den mergas): Firestore-säkerhetsregler (Test Mode hade upphört och blockerade ALLÅT – därför försvann data i appen), ID-mapping-fiks (`{ ...doc.data(), id: doc.id }` i `src/firebase.js`, tidigare skrev gamla id-fältet över dokument-ID:t vilket skapade «osläppna» dubletter), idempotent localStorage-migrering (`setDoc` med ursprungligt id), sticky-rubrik + scrollfönster i `ShiftCalendar`, anställdkategorier (`EMPLOYEE_CATEGORIES` = Skiutleie/Butikk/Skiskole i `ShiftCalendar.jsx`, mörk separatorrad per kategori, dropdown i Ny/Redigera ansatt; befintliga utan kategori härleds från deptIds).
- Cloud Functions (alla token-skyddade med `BACKUP_TOKEN` om de är HTTP, triggas annars via Firestore-dokument – INGEN curl behövs): `dedupShifts` (rensar dubletter i shifts+employees), `reassignShifts`/`reassignOnJob` (flytta vakter mellan anställd-ID – skapa dokument i `reassignJobs` med fromEmployeeId/toEmployeeId), `restoreOnJob` (återställ samling från Storage-backup – skapa dokument i `restoreJobs` med date/collection/confirm="JA"/dryRun).
- VIKTIGT: dryRun-buggen – torrkörningskoden saknades i mergad version (PR #21) vilket gjorde att en «test»-restore kördes på riktigt. PR #22 fixar det (accepterar true/"true"/1). Rutin: ALLTID dryRun först och kontrollera `wouldDeleteFromCurrent` innan riktig restore.
- Backup-lösning (`functions/backup.js`): `nightlyBackup` (03:00 Europe/Oslo) exporterar alla samlingar som JSON + CSV till Storage (`backups/<datum>/...`), 90 dagars retention. `backupNow` = samma på begäran via HTTP med `X-Backup-Token`.
- Eventarc Service Agent-rollen behövdes läggas till i GCP IAM för Firestore-triggers (reassignOnJob/restoreOnJob) – done, deploy går grönt.
- BACKUP_TOKEN har råkat exponeras i chatt – bör roteras (`firebase functions:secrets:set BACKUP_TOKEN` + omdeploy).
- Äldre branches på remote (från tidigare sessioner, ej mergade): `vibe/fix-ical-tidssone-f804ba`, `vibe/test-miljo-245bff`, `test` (staging-branch). Kontrollera med användaren innan dessa raderas.
- Lösenord hashade (PBKDF2/SHA-256, 100k iterationer) via `src/utils/passwords.js` (`passwordSalt` + `passwordHash` i `employees`). Ny ansatt-modalen har obligatoriskt lösenordsfält; inloggning migrerar gamla klartextlösenord till hash automatiskt vid första lyckade inloggning. Admin-fallbacken i `App.jsx` skapar fortfarande konto med klartext `admin123` (migreras vid första inloggning).
- Kända observationer: ingen README ännu; skolferier hårdkodade i `src/App.jsx` (2026); inga tester (utom ad-hoc CSV-test för `toCsv` och hash-test för `passwords.js`).

## Nästa steg
- Lägg till README.
- Flytta hårdkodade ferier/högtidsdatum till konfiguration.
- Överväg testsvit för `useWorkLawValidation`.
