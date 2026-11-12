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
*(Senast uppdaterad av agent: 2026-11-12, session om auto-utfylling av vakter + radmarkering + helligdagsstatistik-fix + Superadmin-låsning + extravakt «Heis» + 24.12 + fasta-före-extra + kontraktsminimum + bulker.)*
*(Tidigare: 2026-02-14, session om Firestore-kostnadsoptimering – hålla reads under 50 000/dag vid ~20 användare. Budgetvarningar 50/90/100 % redan uppsatta i GCP Console.)*

- **PR #48 (mergat):** Firestore offline-persistence aktiverat i `src/firebase.js` (`persistentLocalCache` + `persistentMultipleTabManager`). Återkommande användare betjänas från lokal cache; väntas minska reads 50–80 %.
- **PR #49 (mergat):** `subscribeToShifts` stöder `{ start, end }`-fönster (Firestore `where` på `date`); `useFirebaseData` prenumererar rullande från kontraktsårets start till +92 dagar (täcker kalender, historikvy, AdminStats alla periodlägen). Redundant `getShifts()`-initialläsning bortagen – halverar start-reads. Realtime-uppdateringar behålls; ingen påverkan på användarnas historikvisning.
- **PR #50 (stängd utan merge):** `LOGG.md` i roten – overflödig, denna fil är fortsättningsloggen. Stäng PR #50 utan merge.
- Kostnadsanalys: samtliga lyssnare prenumererade tidigare på hela samlingar utan filter; `shifts` växer obegränsat över säsonger och är största read-drivern.

### Sammanfattning session (2026-11-10, auto-utfylling av vakter + bugfixar på main)
- Direkta commits på `main` (efter användarens uttryckliga önskan): (1) gruppebarer i 3-månedersöversikten låg ~2 dagar fel — `OverviewCalendar`/`GroupOverviewCalendar` fick `tableLayout:'fixed'` med lika datokolumnbredder (baren positioneras procentuellt och kräver lika kolumner); (2) admin-ansatte (`isAdmin` eller kategori 'Admin') räknas inte längre i faktisk bemanning (OverviewCalendar + StaffingPlanner); (3) `EditShiftModal` har dropdown för avdeling/arbeidsplass (sparas + loggas).
- **Auto-utfylling (denna PR):** ny `src/utils/autoFill.js` (ren motor: omsetning→bemanning via `recommendStaffing`, söndag-/helligdagstillägg per körning, tvåpass-fördelning: pass 1 lägger minst minPerDay på ALLA dagar först (så helgen reserveras innan vardagsextras förbrukar veckodagarstaket), pass 2 lägger omsetnings/boost-extra ovanpå, max 5 arbetsdagar per ansatt/vecka (HÅRT tak för alla), DAGPRIORITERING (2026-11-12): pass 1 och 2 fyller i ordningen helligdager → søndager → övriga ukedagar (orderedDays i autoFill.js) — vid personbrist är det alltid vardagarna som blir ofyllda först, kontraktsprocenten är ett MINIMUM (targetDaysFor i autoFill.js: 50 % → ~3 dagar/vecka, saknas procent antas 100 %) — den som är UNDER sitt kontraktsminimum väljs före andra (rank-steg 1 i pickFor), men procenten är INTE ett tak: vid högt behov kan alla jobba upp till 5 dagar/vecka, BULKORDBNING (2026-11-12): den som jobbade föregående dag prioriteras så vakter klustras i sammanhängande block i stället för utspritt — med LEDNINGSVAKT: blocket får bara fortsätta om man ligger max 1 arbetsdag före den minst arbetade i poolen (annars slår kontraktsjämnheten till), (befintliga vakter i alla avdelingar räknas med), minst 2 från kategorin per dag (minPerDay), helgansatte (weekendOnlyIds) jobbar BARE lør/sön (nödfall/relaxed: även vardagar) och är RESERV — fasta i kategorin väljs ALLTID först; extra får en vakt bara när ingen fast kan ta dagen (2026-11-12: tidigare «helgansatte först på helger» togs bort på användarens begäran), ingen ansatt får jobba mer æn 2 helgedagar/HELLIGDAGAR (lør/sön/røde dager — OBS 2026-11-12: röd-dag-sekvensen pad:as 10 dagar BAKÅT före periodstart så streak-regeln även gäller vakter skapade i tidigare körningar/för periodens start: någon med 25+26/12 kan inte få 27/12 i en körning som börjar 27/12 — sekvensen weekendDates i autoFill.js innehåller BÅDE helger och helligdager, så ingen kan t.ex. få 8 røda dagar på rad i jula) på rad (weekendStreak — gäller även «alltid en på jobb»-par), i juleferien/røda dager kan helgansatte også sättas på UKEDAGER (isHoliday-lucka i weekendOnly-filtret — där väljs de också först), JULEFERIEN (19/12–03/01, datumbaserad varje år — isJuleferie i autoFill.js): julferiens dagar räknas som «extra får jobba»-dagar, så extra/helgansatte (efter fasta, som reserv) fyller ofyllda juleferiedagar utan att nödfallsregeln (2+ ofyllda) krävs; 5 % kontrakt är ett minimum och begränsar inte — extra kan jobba upp till 5 dagar/vecka (2026-11-12), mjuk prioritering av 2 dagar fri på rad: pickFor väljer först bland kandidater som kan behålla två sammanhängande lediga dagar samma vecka (keepsTwoConsecutiveFree, faller tillbaka på vanlig rotation om ingen klarar det), jämna RØDE DAGAR: räkningen omfattar helger + helligdager sammanlagt (holidayCountByEmp + weekendIdx-sekvensen) och gäller fasta OCH extra — på røda dager väljs den med färst røda dagar först, helgansatte-prioriteten är sekundär, så fasta och extra delar røda dagarna lika, det får ALDRIG bli 2 vakter som ikke kan fylles på en dag (1 er ok) — i nödfall (pickFor relaxed) används helgansatte på vanliga vardagar så att högst 1 vakt förblir tom (5-dagarstaket och helgestreaken bryts ALDRIG, så vid verklig personbrist kan ändå 2 bli tomma — varningen talar om det), helgerna (lør+sön) bemannas till EXAKT bemanningsbehovet som vardagarna (INGET extra på helger — tidigare weekendBoost/sundayBoost borttaget ur motor+modal), juleferien/røda dager följer OCKSÅ exakt omsetningsbehovet (holidayBoost borttagen) — ingen får 6-dagarsveckor; 5-dagarstaket + jämn rotation garanterar minst 2 fria dagar/vecka innan kontraktet fylls, valfritt «alltid en på jobb»-par (pairIds) är HÅRT: pass 0 i autoFill.js lägger en ur paret på VARJE dag i perioden — även om behovet redan är nått (paret väljs före all annan fyllning); par-täckning räknas bara med vakt i KATEGORINS EGNA avdelingar (runBusyByEmpDate) — en pair-medlem som jobbar Øst är upptagen men täcker INTE Vest-den dagen (då tar den andra medlemmen, eller ⚠️ om ingen kan); kan ingen ur paret jobba en dag (5-dagarstak/2-helgedagar-regeln/bokad) blir det ⚠️-hårt fel-variant som kräver manuell åtgärd, fyller bara tomma celler, exkluderar admin; en vakt i en ANNAN kategoris avdeling (t.ex. Vest-anställd schemalagt på Øst) räknas INTE som bemanning för Vest-körningen — bara som upptagen (5-dagarstaket gäller) (options.category + categoryForDeptName i autoFill.js); platshärledning: modalen skickar options.location per kategori (Skiutleie/Butikk Vest→'st', Øst→'øst', Skiskole/Ekstra→total) — SAMMA mappning som OverviewCalendar:s bemanningsstatistik så auto-fyllen bemannar till exakt det behov statistiken visar rött för (avdelingsnamnet används bara som fallback), kategorier utan platskoppling använder total-konfig/total-omsättning, avdeling fallback till den anställdes första deptId) + `src/components/AutoFillModal.jsx` (välj **kategori** (ej avdeling) och **periode** (fra-/til-dato inom fönstret) per kjøring, tider, boost; forhåndsvisning före lagring). `inferCategory` och `deptNameToCategory` exporteras nu från `ShiftCalendar.jsx`. Knapp «Auto-fyll vakter» i OverviewCalendar-huvudet (admin), trådad via `onAutoFill(dates)` → `handleAutoFillSave` i `App.jsx` (validerar med `validateShift`, loggar `shift_add` med `autoFill: true`). Fixade även befintlig bug: OverviewCalendar:s Forrige/Neste-knappar ändrade aldrig fönstret (`dates` använde `currentDate` i stället för `overviewDate`) — state deklarationen flyttad före `getDates` och `getDates` använder nu `overviewDate`.
- Verifieras med `npm run build` (denna session) + manuell granskning på PR-preview.
- **Superadmin-låsning (denna PR):** bemanningsverktygen (Bemanning V/Ø-rad i OverviewCalendar, Auto-fyll-knappen, AutoFillModal och StaffingPlanner «Bemanning från omsättning») syns NU BARA för `currentUser.isSuperadmin`. Superadmin-flaggan sätts i EditEmployeeModal — vippknappen syns bara för superadmin, eller för admin när ingen superadmin finns än (bootstrap; efteråt kan bara superadmin ändra den). När Björn sparar sig själv uppdateras currentUser + localStorage direkt (ingen re-login krävs). Auto-fyllade vakter sparas med internt fält `autoFilled: true` i stället för synlig kommentar «Auto-utfylt»; endast superadmin ser «(auto-utfylt)» i verktygstips. logAdminAction accepterar superadmin.
- **24. desember (denna PR):** juleaften räknas INTE som helligdag — den är borttagen ur FIXED_HOLIDAYS (useNorwegianHolidays.js), så ingen röd färg, räknas inte som helligdag i AdminStats och 2-helgedagar-regeln gäller ej. Den är en vanlig öppen dag, men stänger tidigt: auto-fyllen ger vakter den dagen sluttid 13:00 (EARLY_CLOSE i autoFill.js, datum-nyckel 'MM-DD' så det gäller varje år).
- **Extravakt-typ «Heis» (denna PR):** Heis är INTE en egen kategori — det är en extravakt (som Fri/Ferce). Avdelingar vars namn innehåller «heis» hanteras som extravakt: vakten syns på den anställdes VANLIGA kategorirad i kalendern (SHIFTS_BY_CATEGORY i ShiftCalendar.jsx returnerar true för heis i alla rader), personen räknas som upptagen + arbetsdag i auto-fill men vakten räknas INTE som bemanning för kategorin (autoFill.js: isHeis-undantag i befintlig-bemanning-loopen) och inte heller som Vest/Ø-bemanning i OverviewCalendar:s statistikrad. Timene i AdminStats räknas som vanlig arbetstid. OBS: avdelingen «Heis» är Firestore-data — admin lägger till den i appens avdelingsadmin (namnet måste innehålla «heis»). Standardtider 08:45–16:00 gäller redan.
- **Radmarkering i 3-månadsvyn (denna PR):** klick på en anställds namn i OverviewCalendar markerar hela raden (amber namncell + orange ring på dagcellerna) så det är lätt att se när den anställda jobbar. Andra klick avmarkerar. State: `highlightEmployeeId` i OverviewCalendar.jsx.

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

### Sammanfattning session (2026-11-12, auto-fyll PR #68: streak-fix båda riktningar)
- **PRAGMATISK BUGG FIXAD:** rapporter om 5 helligdager/søndager på rad trots MAX 2-regeln. Rotorsak: dagprioriteringen (helligdager → søndager → ukedagar, `orderedDays`) behandlar dagarna i icke-kronologisk ordning — `weekendOk` kontrollerade bara streak BAKÅT, så en ansatt kunde få 1/1 + 3/1 (vardera «OK» vid tilldelningstillfället) och när 2/1 fylldes senare blev det 3 på rad. Reproducerat med brute-force-test (streak 3 för E5).
- **Fix i `src/utils/autoFill.js`:** ny `weekendStreakAfter` (räknar sammanhängande røde dager FRAMÅT i `weekendDates`); `weekendOk` kräver nu `streakBefore + streakAfter < MAX_WEEKEND_STREAK` (2). Gäller både `pickFor` och `pickPairFor`, och fungerar även över flera auto-fyll-körningar eftersom `workedWeekendByEmp` seedas från existerande `shifts`.
- **Verifierat med node-tester:** hela dec/jan-perioden (6 fasta + 2 extra, helligdager 25+26/12 + 1/1) → max streak 2; två sekventiella körningar med gammal data som seed → max 2; separata körningar där 2/1 fylls mellan 1/1 och 3/1 → blockerad. Stressfall med bara 3 anställda: lagregeln vinner, vissa røde dager får bara 1 vakt + varning (avsett — «måste fölga norsk lov»).


### Sammanfattning session (2026-11-12, skiskole räknas inte i skiutleie-bemanningen)
- **BUGG:** En avdeling som heter t.ex. «Skiskole Vest» mappades till **Skiutleie Vest** eftersom `skiskole`-checken kom EFTER `vest`/`øst` i kategoriseringen — skiskole-vakter räknades då som skiutleie-bemanning i auto-fyll-motorn, kalendern, OverviewCalendar («faktisk bemanning») och StaffingPlanner.
- **Fix (5 filer, direkt till main):** `categoryForDeptName` (autoFill.js) + `deptNameToCategory` (ShiftCalendar.jsx): `skiskole` kollas nu FÖRE øst/vest. `SHIFTS_BY_CATEGORY` (ShiftCalendar.jsx): skiskole-vakter syns bara under Skiskole-kategorin. OverviewCalendar.jsx: skiskole-skift hoppas över i `actualByDateAndLocation`. StaffingPlanner.jsx: ny `departments`-prop (skickas från App.jsx) + skiskole-vakter räknas inte i faktisk bemanning för st/øst-vyerna (total-vyn räknar fortfarande allt).
- **Verifierat med node-test:** E1 med en skiskole-vakt 15/12 → `existing: 0` för Skiutleie Vest den dagen (2 nya vakter fylls), men E1 är fortfarande upptagen (ingen dubbelvakt).

- (2026-11-12, main) Statistiken: nytt periodval «Neste måned» i AdminStats (monthBounds(1), periodMode 'nextMonth'). OBS kontraktsuträkningen: Kontraktsprocent räknas bara om Kontraktstart OCH Kontraktslutt är satta — fel år i Kontraktslutt ger fel/saknad uträkning (användarfall 2026-11-12).
