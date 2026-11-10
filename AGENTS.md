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
*(Senast uppdaterad av agent: 2026-11-10, session om auto-utfylling av vakter + tidigare bugfixar på main.)*
*(Tidigare: 2026-02-14, session om Firestore-kostnadsoptimering – hålla reads under 50 000/dag vid ~20 användare. Budgetvarningar 50/90/100 % redan uppsatta i GCP Console.)*

- **PR #48 (mergat):** Firestore offline-persistence aktiverat i `src/firebase.js` (`persistentLocalCache` + `persistentMultipleTabManager`). Återkommande användare betjänas från lokal cache; väntas minska reads 50–80 %.
- **PR #49 (mergat):** `subscribeToShifts` stöder `{ start, end }`-fönster (Firestore `where` på `date`); `useFirebaseData` prenumererar rullande från kontraktsårets start till +92 dagar (täcker kalender, historikvy, AdminStats alla periodlägen). Redundant `getShifts()`-initialläsning bortagen – halverar start-reads. Realtime-uppdateringar behålls; ingen påverkan på användarnas historikvisning.
- **PR #50 (stängd utan merge):** `LOGG.md` i roten – overflödig, denna fil är fortsättningsloggen. Stäng PR #50 utan merge.
- Kostnadsanalys: samtliga lyssnare prenumererade tidigare på hela samlingar utan filter; `shifts` växer obegränsat över säsonger och är största read-drivern.

### Sammanfattning session (2026-11-10, auto-utfylling av vakter + bugfixar på main)
- Direkta commits på `main` (efter användarens uttryckliga önskan): (1) gruppebarer i 3-månedersöversikten låg ~2 dagar fel — `OverviewCalendar`/`GroupOverviewCalendar` fick `tableLayout:'fixed'` med lika datokolumnbredder (baren positioneras procentuellt och kräver lika kolumner); (2) admin-ansatte (`isAdmin` eller kategori 'Admin') räknas inte längre i faktisk bemanning (OverviewCalendar + StaffingPlanner); (3) `EditShiftModal` har dropdown för avdeling/arbeidsplass (sparas + loggas).
- **Auto-utfylling (denna PR):** ny `src/utils/autoFill.js` (ren motor: omsetning→bemanning via `recommendStaffing`, söndag-/helligdagstillägg per körning, tvåpass-fördelning: pass 1 lägger minst minPerDay på ALLA dagar först (så helgen reserveras innan vardagsextras förbrukar veckodagarstaket), pass 2 lägger omsetnings/boost-extra ovanpå, max 5 arbetsdagar per ansatt/vecka (befintliga vakter räknas med, timmar/ansettelsesprocent begränsar ej), minst 2 från kategorin per dag (minPerDay), helgansatte (weekendOnlyIds) jobbar BARE lør/sön och väljs först på helger (sparar ordinares dagar till vardagarna), helgerna (lør+sön) får alltid weekendBoost +1 via modalen, helligdagar +3 (juleferien, default i modalen) — ingen får 6-dagarsveckor; 5-dagarstaket + jämn rotation garanterar minst 2 fria dagar/vecka innan kontraktet fylls, valfritt «alltid en på jobb»-par (pairIds — en ur paret fylls först på dagar ingen av dem jobbar), fyller bara tomma celler, exkluderar admin; kategorier utan platskoppling använder total-konfig/total-omsättning, avdeling fallback till den anställdes första deptId) + `src/components/AutoFillModal.jsx` (välj **kategori** (ej avdeling) och **periode** (fra-/til-dato inom fönstret) per kjøring, tider, boost; forhåndsvisning före lagring). `inferCategory` och `deptNameToCategory` exporteras nu från `ShiftCalendar.jsx`. Knapp «Auto-fyll vakter» i OverviewCalendar-huvudet (admin), trådad via `onAutoFill(dates)` → `handleAutoFillSave` i `App.jsx` (validerar med `validateShift`, loggar `shift_add` med `autoFill: true`). Fixade även befintlig bug: OverviewCalendar:s Forrige/Neste-knappar ändrade aldrig fönstret (`dates` använde `currentDate` i stället för `overviewDate`) — state deklarationen flyttad före `getDates` och `getDates` använder nu `overviewDate`.
- Verifieras med `npm run build` (denna session) + manuell granskning på PR-preview.

### Sammanfattning session (2026-11-03, kort ukedag under dato i översiktskalendern)
- `OverviewCalendar.jsx` visar nu kort ukedag (no-NO, t.ex. «man») under dagtallet i översiktskalenderns datumrad. Verifierad med `npm run build` (godkänd).

### Sammanfattning session (2026-11-03, antall etter gruppenavn överallt)
- `participants` (antall deltakere) visas nu efter gruppenamnet överallt där namnet visas: gruppebaren i `GroupBarsRow` (huvudkalender + översikt), detaljvinduet, och både namncell och bar i `GroupOverviewCalendar`. Format: `Navn (12)`. Verifierad med `npm run build` (godkänd).

### Sammanfattning session (2026-11-03, gruppeoversikt via «Grupper»-teksten)
- Ny komponent `GroupOverviewCalendar.jsx`: 3-måneders kalender (12 veckor) med én rad per grupperevent och färgad bar från hent- till leveringsdato. Öppnas genom att klicka på «Grupper»-texten i `GroupBarsRow` (ny prop `onShowOverview`, trådas genom `ShiftCalendar`/`OverviewCalendar` via `onShowGroupOverview` i `App.jsx`). Klikk på bar öppnar `GroupEventModal`; admin får «+ Gruppe». Verifierad med `npm run build` (godkänd).

### Sammanfattning session (2026-11-03, 3-månadersöversikten grupperar efter skiftkategori)
- `OverviewCalendar.jsx` grupperar nu anställda med `groupByShiftCategory` (samma som huvudkalendern) över översiktens 12-veckorsfönster: anställda med vakter i flera avdelningar visas under varje berörd kategori, och cellerna filtreras med `SHIFTS_BY_CATEGORY` (fri/ferie visas fortfarande överallt). `groupByShiftCategory`/`SHIFTS_BY_CATEGORY` exporteras nu från `ShiftCalendar.jsx`. Kategorirader sticky vid horisontell scroll redan fixat i PR #60 (samma markup i båda kalendrarna).
- **PR #62 och #63 (mergade 2026-11-03, verifierade i produktion av användaren).**

### Sammanfattning session (2026-11-03, PR #60 + #61 mergade, CI-fix)
- **PR #61 (mergat):** `const [emps, depts]` → `let` i `src/hooks/useFirebaseData.js:67` – const-reassignering bröt `npm run dev` (vite dep-scan: "Cannot assign to 'depts' because it is a constant", npx exit 1). `npm run build` hade gått bra hela tiden. Verifierat: dev + build OK.
- **PR #60 (mergat):** sticky kategorirader vid horisontell scroll (se 2026-10-15 nedan).
- **PR #57 och #59 (mergade):** sessionslogg + dynamiskt lasningsfönster för skift.
- **CI:** Firebase Hosting PR-preview (`firebase-hosting-pull-request.yml`) failade 2026-11-03 med 403 `serviceusage.services.get` på projekt `vaktlista-d0efd` (senast grön 2026-10-15). Token var giltig (testIamPermissions 200) men service account saknade behörighet. Löst i GCP IAM/API – workflowen är grön igen. Vercel-preview var grön hela tiden.

### Sammanfattning session (2026-10-15, sticky kategorirader vid horisontell scroll)
- Kategoriraderna i `ShiftCalendar.jsx` och `OverviewCalendar.jsx` hade en enda `<td>` med `colSpan` över hela raden; en fullbred sticky-celle kan inte fästa vid horisontell scroll, så kategoriet försvann åt vänster. Raden delas nu upp i en sticky första cell (samma min-bredd/z-index som namnkolumnen, mörk bakgrund `#374151`) + en utfyllnadscell med `colSpan={dates.length}`. Verifierad med `npm run build` (godkänd).

### Sammanfattning tidigare session (2026-09-28, Firestore-regler, dubletter, kategorier, backup/restore)

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
- Kolla reads/dag i Firebase Console → Firestore → Usage när PR #49 mergeats och varit live några dagar; avgör om mer optimering behövs.
- Konsolidera extra revenues-lyssnare (`OverviewCalendar`, `StaffingPlanner`) till delad hook.
- Ev. arkivering av pass äldre än kontraktståret (on-demand-visning av arkiv) om reads fortfarande är höga.
- Lägg till README.
- Flytta hårdkodade ferier/högtidsdatum till konfiguration.
- Överväg testsvit för `useWorkLawValidation`.

### Sammanfattning session (2026-10-14, fri-visning i kalendern + kalenderprestanda)

- **PR #55 (mergat):** `shiftsInCategory` i `ShiftCalendar.jsx` filtrerade tidigare bort `fri`/`ferie` helt, så fri-pass syntes aldrig på personen. Nu returneras fri/ferie för personen (syns i personens kategorigrupp), men `deptNameToCategory` returnerar `null` för fri/ferie så de skapar aldrig egen kategori eller påverkar sorteringen. OBS vid merge: bara fri-fixen hann med — se PR #56.
- **PR #56 (mergat):** Prestandaoptimering av `ShiftCalendar.jsx` för Safari-trehet: `buildShiftIndex` (Map per `employeeId|date`, en gång per render) ersätter O(n²)-`shifts.filter()` i varje cell; `useMemo` på `dates`, `categoryGroups`, `deptNameById`, `shiftIndex`; `useCallback` för `shiftsForCell`. Kalendern renderar ~231 dagkolumner × anställda; nästa optimering om det behövs är färre renderade veckor åt gången (steg 1, kräver designbeslut om historikvy).
- Lektion: vid merge, verifiera att alla commits i PR:et finns i `main` (`git merge-base --is-ancestor <sha> origin/main`) — PR #55 mergeades innan sista pushen hann med.
- Firestore reads kunde ej kollas från agent-sandlådan (inga Firebase-verktyg/credentials); användaren ska kolla Firebase Console → Firestore → Usage manuellt enligt målet <50 000 reads/dag.

### Sammanfattning session (2026-10-12, egen kategori högst upp i kalendern)
- `sortCategoriesForUser` tillagd i `ShiftCalendar.jsx` och `OverviewCalendar.jsx`: icke-admin-inloggade användare ser sin egen kategori (via `inferCategory`) först i kalenderns kategorigrupper; admin ser standardordning.
- Verifierad med `npm run build` (godkänt).
- Passordbytte för anställda: `ChangePasswordModal.jsx` (ny komponent) + `handleChangePassword` i `App.jsx`. Verifierar nuvarande lösenord, hashar nya med PBKDF2 och sparar `passwordSalt`/`passwordHash` via `updateEmployeeFirebase`; localStorage-sessionen uppdateras. Knapp "Endre passord" i headern för inloggade användare.
