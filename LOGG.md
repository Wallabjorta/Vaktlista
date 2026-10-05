# Arbetlogg

## 2026-02-14 (session)

**Fokus:** Minska Firestore-reads för att hålla sig under 50 000/dag vid ~20 användare.

### Genomfört
- **PR #48 (mergat):** Aktiverade Firestore offline-persistence (`persistentLocalCache` + `persistentMultipleTabManager`) i `src/firebase.js`. Återkommande användare betjänas från lokal cache; förväntas minska reads 50–80 %.
- **PR #49 (öppen, draft):** Begränsade shifts-läsning till rullande datumfönster — från kontraktsårets start till +92 dagar. `subscribeToShifts` stöder nu `{ start, end }`, och den redundanta `getShifts()`-initialläsningen i `useFirebaseData` togs bort. Realtime-uppdateringar behålls; historik- och statistikvyer fungerar oförändrat.

### Analys
- Kostnadsdrivare: alla lyssnare prenumererade på hela samlingar (`shifts`, `employees`, `departments`, `revenues` m.fl.) utan filter.
- Budgetvarningar 50/90/100 % är redan uppsatta i Google Cloud Console.

### Nästa steg (i prioritetsordning)
1. Kolla faktisk reads/dag i Firebase Console → Firestore → Usage efter att PR #49 mergeats och varit live några dagar.
2. Konsolidera extra revenues-lyssnare (`OverviewCalendar`, `StaffingPlanner`) till delad hook.
3. Ev. arkivering av pass äldre än kontraktståret (on-demand-visning av arkiv) om reads fortfarande är höga.

**Verifiering:** `npm run build` passerar efter varje ändring.
