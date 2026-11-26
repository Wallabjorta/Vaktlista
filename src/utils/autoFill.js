// Automatisk utfylling av vakter basert på omsetning, søndager, helligdager
// og jämn fördelning. Ren funksjon uten sideeffekter — kalleren viser
// forslaget og bestemmer selv om det lagres.
//
// Regler:
// - Minst minPerDay (standard 2) ansatte från kategorin varje dag —
//   aldrig bara 1 person från kategorin en dag.
// - Omsetning/bemanningskonfig ger behovet VARJE dag — helger, juleferien
//   och røda dager bemannas till EXAKT samma behov (inga boost-tillägg).
// - Helgansatte (weekendOnlyIds) jobbar BARE lördag/söndag — de väljs
//   först på helger, så de ordinaries dagar sparas till vardagarna.
// - Ingen ansatt får jobba mer æn 2 helgedagar/helligdagar (lør/sön/røde
//   dager) på rad — efter två på rad följs nästa av någon annan (ingen
//   får t.ex. 8 dagar i jula).
// - I juleferien/røda dager kan helgansatte (weekendOnly) også sättas
//   på ukedager, inte bara helger.
// - Det får ALDRIG bli 2 vakter som ikke kan fylles på en dag (1 er ok):
//   i nödfall används helgansatte på vardagar så att högst 1 vakt blir tom.
// - 2 dagar fri på rad prioriteras: den som väljs till en dag ska helst
//   kunna behålla två sammanhängande lediga dagar samma vecka (mjuk regel —
//   faller tillbaka på vanlig rotation om ingen kandidat klarar det).
// - Timmar/ansettelsesprocent begränsar INTE — men max MAX_DAYS_PER_WEEK
//   arbetsdagar per ansatt och vecka (befintliga vakter räknas med).
// - Grundbemanningen fördelas jämnt över dagarna (den med minst
//   arbetsdagar den veckan väljs först).
// - Jämna RØDE DAGAR: fasta och extra anställda delar helger + helligdager
//   lika — på røda dager väljs den med färst røda dagar först.
// - Valfritt «alltid en på jobb»-par (HÅRT): minst en ur paret jobbar VARJE dag
//   i perioden — även om behovet redan är nått. Övriga vakter fördelas rättvist
//   (alla ska minst fylla sitt kontrakt; extra kan fylla flera vakter samma dag).
//   Kan ingen ur paret jobba blir det ett hårt fel (⚠️-varning, manuell åtgärd).

const MAX_DAYS_PER_WEEK = 5;

export const toDateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Antall timer i et vaktpass (f.eks. '08:45'–'16:00' => 7.25)
export const shiftHours = (startTime, endTime) => {
  const [sh, sm] = String(startTime || '0:0').split(':').map(Number);
  const [eh, em] = String(endTime || '0:0').split(':').map(Number);
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
};

// Kartlegg avdelingsnavn till plats-nyckel som i StaffingPlanner/OverviewCalendar
const locationForDepartmentName = (name) => {
  const n = (name || '').toLowerCase();
  if (n.includes('vest')) return 'st';
  if (n.includes('øst') || n.includes('ost')) return 'øst';
  return null;
};

// Omsättningsdatum är från sist säsong — mappa framåt hela säsonger
// (364 dagar = samma veckodag) så datumen täcker aktuell kalender.
export const buildRevenueMap = (revenues) => {
  const map = new Map();
  for (const rev of revenues || []) {
    if (!rev.date) continue;
    const [y, m, d] = rev.date.split('-').map(Number);
    const base = new Date(y, m - 1, d);
    for (let offset = 0; offset <= 3; offset++) {
      const dt = new Date(base);
      dt.setDate(dt.getDate() + offset * 364);
      map.set(`${rev.location || 'total'}_${toDateStr(dt)}`, rev.amount);
    }
  }
  return map;
};

// Avdelingsnamn → kategori (samma logik som deptNameToCategory i ShiftCalendar):
// en vakt på en ØST-avdeling räknas INTE som Vest-bemanning även om den
// anställdes kategori är Vest — men personen är fortfarande upptagen den dagen.
const categoryForDeptName = (name) => {
  const n = (name || '').toLowerCase();
  if (!n || n === 'fri' || n === 'ferie' || n.includes('heis')) return null;
  // Skiskole måste kollas FÖRE øst/vest: en avdeling som heter t.ex.
  // «Skiskole Vest» är Skiskole — inte Skiutleie Vest-bemanning.
  if (n.includes('skiskole')) return 'Skiskole';
  if (n.includes('skolegrupper')) return 'Skiutleie Vest';
  if (n.includes('butikk')) return n.includes('øst') || n.includes('ost') ? 'Butikk Øst' : 'Butikk Vest';
  if (n.includes('øst') || n.includes('ost')) return 'Skiutleie Øst';
  if (n.includes('vest')) return 'Skiutleie Vest';
  return null;
};

// Mandag som ukenøkkel
const weekKeyFor = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return toDateStr(d);
};

/**
 * Generera förslag på nya vakter.
 *
 * @param {Object} arg
 * @param {Date[]}   arg.dates            Datoer i perioden
 * @param {Array}    arg.employees        Kandidater (valgt kategori, utan admin)
 * @param {Array}    arg.shifts           Eksisterende vakter (perioden)
 * @param {Array}    arg.departments
 * @param {string[]} arg.holidays         ['YYYY-MM-DD', ...] (visning i perDate)
 * @param {Array}    arg.revenues         Rå omsättningsdokument { date, amount, location }
 * @param {Object}   arg.staffingConfigs  { total, st, øst } eller null
 * @param {Function} arg.recommend        (amount, config) => { staff, label }
 * @param {Object}   arg.options
 * @param {string}   arg.options.departmentId
 * @param {string}   [arg.options.location]  'st'/'øst' — samma platsmappning som
 *                                           OverviewCalendar:s bemanningsstatistik
 * @param {string}   [arg.options.category]   Vald kategori — en vakt i en annan
 *                                           kategoris avdeling (Vest-ansatt på Øst)
 *                                           räknas INTE som bemanning, bara som upptagen
 * @param {string}   arg.options.startTime
 * @param {string}   arg.options.endTime
 * @param {number}   [arg.options.minPerDay=2]      Minst så mange fra kategorien per dag
 * @param {Array}    [arg.options.pairIds=[]]      «Alltid en på jobb»-par (max 2 id)
 * @param {Array}    [arg.options.weekendOnlyIds=[]] Helgansatte — jobbar bare lør/sön
 * @returns {{ assignments: Array, warnings: string[], perDate: Array }}
 */
export const generateAutoFill = ({
  dates = [],
  employees = [],
  shifts = [],
  departments = [],
  holidays = [],
  revenues = [],
  staffingConfigs = null,
  recommend,
  options = {}
}) => {
  const {
    departmentId,
    startTime = '08:45',
    endTime = '16:00',
    minPerDay = 2,
    pairIds = [],
    weekendOnlyIds = [],
    departmentIdByEmp = {},
    location = null,
    category = null
  } = options;

  const warnings = [];
  const assignments = [];

  const dept = (departments || []).find(d => d && d.id === departmentId);
  const deptNameLower = (dept?.name || '').toLowerCase();
  if (deptNameLower === 'fri' || deptNameLower === 'ferie') {
    warnings.push('Valgt avdeling er fri/ferie — ingen vakter genereres.');
    return { assignments, warnings, perDate: [] };
  }

  // Plats: options.location (kategori-baserad, samma som bemanningsstatistiken)
  // har företräde — annars härleds den från avdelingsnamnet.
  const loc = location || locationForDepartmentName(dept?.name);
  // Kategorier utan platskoppling (t.ex. Skiskole/Ekstra) använder total-konfigen
  const revLoc = loc || 'total';
  const config = staffingConfigs
    ? (staffingConfigs[loc] || staffingConfigs.total || null)
    : null;
  const revenueMap = buildRevenueMap(revenues);

  const deptNameById = new Map((departments || []).map(d => [d.id, (d?.name || '').toLowerCase()]));
  const validDeptIds = new Set((departments || []).filter(Boolean).map(d => d.id));
  // Spök-vakter: departmentId saknas eller finns inte bland avdelingarna —
  // de syns ikke i kalendern och räknas därför inte som befintlig bemanning.
  const ghostDates = new Set();
  const candidates = [...employees];
  const candIds = new Set(candidates.map(e => String(e.id)));
  const weekendOnly = new Set((weekendOnlyIds || []).map(String));

  // Kategoribemanning per dato: kategorins anställda som redan jobbar
  // (icke-fri/ferie) + hvem som är upptagen per dag + arbetsdagar per vecka.
  const catStaffingByDate = new Map();
  const busyByEmpDate = new Set();
  // Upptagen i DENNA körningens avdelingar (par-täckning): en Øst-vakt gör
  // en Vest-ansatt upptagen men täcker INTE «alltid en på jobb» för Vest.
  const runBusyByEmpDate = new Set();
  const workDaysByEmpWeek = new Map();
  for (const s of shifts || []) {
    if (!s.date) continue;
    busyByEmpDate.add(`${s.employeeId}_${s.date}`);
    if (!s.departmentId || !validDeptIds.has(s.departmentId)) {
      ghostDates.add(s.date);
      continue; // okänd/saknad avdeling: personen är upptagen men räknas inte som bemanning
    }
    const dn = deptNameById.get(s.departmentId) || '';
    if (dn === 'fri' || dn === 'ferie') continue;
    const [sy, sm, sd] = s.date.split('-').map(Number);
    const swk = weekKeyFor(new Date(sy, sm - 1, sd));
    workDaysByEmpWeek.set(`${s.employeeId}_${swk}`, (workDaysByEmpWeek.get(`${s.employeeId}_${swk}`) || 0) + 1);
    if (candIds.has(String(s.employeeId))) {
      // Vakten räknas som befintlig bemanning för kategorin ENDAST om den
      // ligger i kategorins egna avdelingar. En Vest-anställd med vakt på en
      // Øst-avdeling är upptagen (dagar/vecka räknas) men bemannar INTE Vest.
      const shiftCat = categoryForDeptName(dn);
      // Heis är en extravakt: personen är upptagen (busyByEmpDate satt ovan,
      // arbetsdag räknas nedan) men den räknas INTE som bemanning för kategorin.
      const isHeis = (dn || '').toLowerCase().includes('heis');
      const isSkolegrupper = (dn || '').toLowerCase().includes('skolegrupper');
      const countsForRun = !isHeis && !isSkolegrupper && (!category || shiftCat == null || shiftCat === category);
      if (countsForRun) {
        catStaffingByDate.set(s.date, (catStaffingByDate.get(s.date) || 0) + 1);
        runBusyByEmpDate.add(`${s.employeeId}_${s.date}`);
      }
    }
  }

  if (ghostDates.size > 0) {
    warnings.push(
      `⚠️ ${ghostDates.size} dag(ar) har vakter med okänd/saknad avdeling (syns ikke i kalendern). ` +
      `De räknas inte som bemanning — fylls på nytt: ${[...ghostDates].sort().join(', ')}`
    );
  }

  // Fördelningstillstånd: antal nya vakter per ansatt (rotation vid lika många dagar)
  const MAX_WEEKEND_STREAK = 2; // norsk arbetslag: max 2 helligdager/søndager på rad
  const plannedCount = new Map();

  // Helgedags-sekvens (lør/sön OCH helligdager — dvs alla «røde» dagar —
  // i kronologisk ordning) och streak-state: ingen ansatt får jobba mer æn
  // MAX_WEEKEND_STREAK helgedagar/helligdagar på rad (t.ex. aldrig 8 dagar
  // i jula). Befintliga vakter på dessa dagar seedar streaken.
  const holidaySetForStreak = new Set((holidays || []));
  // Röd-dag-sekvensen måste börja FÖRE körningens fönster: en ansatt som
  // redan jobbat 2 røde dager (t.ex. 25 + 26/12) precis före perioden ska
  // inte kunna få den NÄSTA røde dagen (t.ex. 27/12) — annars blir det 3 på
  // rad i strid med norsk lag. Därför fylls ~10 kalenderdagar innan
  // periodstart in i sekvensen (enbart för streak-räkning — inga vakter
  // genereras där).
  const padDates = [];
  if (dates.length > 0) {
    const first = new Date(dates[0]);
    first.setHours(0, 0, 0, 0);
    for (let back = 10; back >= 1; back--) {
      const d = new Date(first);
      d.setDate(d.getDate() - back);
      padDates.push(d);
    }
  }
  const isRedDay = (d) =>
    d.getDay() === 0 || d.getDay() === 6 ||
    holidaySetForStreak.has(toDateStr(d));

  // Juleferien (19/12–03/01, datumbaserad varje år): extra/helgansatte ska
  // nyttjas ordentligt här — de får (som reserv, efter fasta) jobga vilken
  // juleferiedag som helst, inte bara lør/sön/helligdager. Kontraktsprocenten
  // (t.ex. 5 %) är ett MINIMUM och begränsar inte — upp till 5 dagar/vecka.
  const isJuleferie = (dateStr) => {
    const md = dateStr.slice(5);
    return md >= '12-19' || md <= '01-03';
  };
  const weekendDates = [...padDates, ...dates]
    .filter(isRedDay)
    .map(toDateStr);
  const weekendIdx = new Map(weekendDates.map((d, i) => [d, i]));
  const workedWeekendByEmp = new Map();
  const noteWeekendWork = (empId, dateStr) => {
    if (!weekendIdx.has(dateStr)) return;
    if (!workedWeekendByEmp.has(String(empId))) workedWeekendByEmp.set(String(empId), new Set());
    workedWeekendByEmp.get(String(empId)).add(dateStr);
  };
  for (const s of shifts || []) {
    if (!s.date || !weekendIdx.has(s.date)) continue;
    noteWeekendWork(s.employeeId, s.date);
  }
  // Antal helgedagar på rad (bakåt, utan avbrott) som emp jobbat innan helge-index idx
  const weekendStreakBefore = (empId, idx) => {
    const worked = workedWeekendByEmp.get(String(empId));
    if (!worked) return 0;
    let streak = 0;
    for (let i = idx - 1; i >= 0 && worked.has(weekendDates[i]); i--) streak += 1;
    return streak;
  };
  // Streak EFTER idx (framåt): dagprioriteringen (helligdager → søndager
  // → ukedager) behandlar dagarna i icke-kronologisk ordning, så en ansatt
  // kan redan ha vakter på senare røde dager när en tidigare dag fylls.
  // Kolla därför BÅDA riktningarna: dagar före + dagar efter + denna dag
  // får aldrig överstiga MAX_WEEKEND_STREAK.
  const weekendStreakAfter = (empId, idx) => {
    const worked = workedWeekendByEmp.get(String(empId));
    if (!worked) return 0;
    let streak = 0;
    for (let i = idx + 1; i < weekendDates.length && worked.has(weekendDates[i]); i++) streak += 1;
    return streak;
  };
  const weekendOk = (empId, info) => {
    if (!info.isWeekend && !info.isHoliday) return true;
    const idx = weekendIdx.get(info.dateStr);
    return (
      weekendStreakBefore(empId, idx) + weekendStreakAfter(empId, idx) <
      MAX_WEEKEND_STREAK
    );
  };

  // Behov per dag
  const dayInfos = dates.map(date => {
    const dateStr = toDateStr(date);
    const isSunday = date.getDay() === 0;
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const isHoliday = (holidays || []).includes(dateStr);
    let recommended = null;
    if (revenueMap.has(`${revLoc}_${dateStr}`)) {
      const rec = recommend ? recommend(revenueMap.get(`${revLoc}_${dateStr}`), config) : null;
      recommended = rec ? rec.staff : null;
    }
    // Minst minPerDay från kategorin varje dag — aldrig bara 1 person.
    let fullNeed = Math.max(recommended != null ? recommended : 0, minPerDay);
    return {
      date,
      dateStr,
      isSunday,
      isWeekend,
      isHoliday,
      recommended,
      fullNeed,
      existing0: catStaffingByDate.get(dateStr) || 0
    };
  });

  // PRIORITERAD DAGORDNING (2026-11-12): helligdager fylles FÖRST, sen
  // søndager, sen övriga ukedagar — inom varje grupp kronologiskt. Pass 1
  // och 2 fyller i den ordningen, så när veckotaket/personbristen tar slut
  // är det alltid vardagarna som blir ofyllda först — aldrig røde dager.
  const dayPrio = (info) => (info.isHoliday ? 0 : info.isSunday ? 1 : 2);
  const orderedDays = [...dayInfos].sort((a, b) =>
    dayPrio(a) - dayPrio(b) || a.dateStr.localeCompare(b.dateStr));

  // HØYSESONG per uke: ukedagsbehovet (etter eksisterende vakter) per fast ansatt
  // > 3.5 → ekstra/helgansatte FÅR jobbe ukedager denne uken (for å fylle behovet).
  // Terskel 3.5 (ikke 3): desember-uker med ~3.5 ukedager per fast ansatt telles
  // som LAVSESONG — ekstra skal da kun jobbe lør+søn (+helligdager/juleferie),
  // ikke ukedager (per Bjørn 2026-11-25).
  // I lavsesong gjelder fortsatt: ekstra kun lør+søn+helligdager+juleferie.
  const fastePoolSize = Math.max(1, candidates.filter(e => !weekendOnly.has(String(e.id))).length);
  const weekdayNeedByWk = new Map();
  for (const info of dayInfos) {
    const dow = info.date.getDay();
    if (dow === 0 || dow === 6) continue;
    const wk = weekKeyFor(info.date);
    const remaining = Math.max(0, info.fullNeed - (info.existing0 || 0));
    weekdayNeedByWk.set(wk, (weekdayNeedByWk.get(wk) || 0) + remaining);
  }
  const highSeasonWeek = (wk) => (weekdayNeedByWk.get(wk) || 0) / fastePoolSize > 3.5;

  const namesByDate = new Map(dayInfos.map(d => [d.dateStr, []]));
  const pairEmps = (pairIds || [])
    .map(id => candidates.find(c => String(c.id) === String(id)))
    .filter(Boolean);

  // Tidig stängning: 24. desember (juleaften) är en vanlig dag men stänger
  // kl 13:00 — auto-genererade vakter den dagen får sluttid 13:00.
  const EARLY_CLOSE = { '12-24': '13:00' };
  const endTimeFor = (dateStr) => {
    const md = dateStr.slice(5);
    return EARLY_CLOSE[md] || endTime;
  };

  const addAssignment = (info, emp) => {
    const wk = weekKeyFor(info.date);
    workDaysByEmpWeek.set(`${emp.id}_${wk}`, (workDaysByEmpWeek.get(`${emp.id}_${wk}`) || 0) + 1);
    plannedCount.set(emp.id, (plannedCount.get(emp.id) || 0) + 1);
    busyByEmpDate.add(`${emp.id}_${info.dateStr}`);
    runBusyByEmpDate.add(`${emp.id}_${info.dateStr}`);
    noteBusy(emp.id, info.dateStr);
    noteHolidayWork(emp.id, info.dateStr);
    noteWeekendWork(emp.id, info.dateStr);
    catStaffingByDate.set(info.dateStr, (catStaffingByDate.get(info.dateStr) || 0) + 1);
    assignments.push({
      employeeId: emp.id,
      employeeName: emp.name,
      date: info.dateStr,
      departmentId: departmentId ||
        (departmentIdByEmp && departmentIdByEmp[String(emp.id)]) ||
        (emp.deptIds && emp.deptIds.find(id => validDeptIds.has(id))) ||
        null,
      startTime,
      endTime: endTimeFor(info.dateStr),
      comment: '',
      autoFilled: true,
      breaks: []
    });
    namesByDate.get(info.dateStr).push(emp.name);
  };

  // HELA HELGER FÖR EXTRA/helgansatte: när en helgansatt (weekendOnly) får en
  // helgedag, försök ge samma person även den andra dagen i samma helg
  // (lördag+söndag tillsammans) — inte en lördag här och en söndag där.
  const dayInfoByDate = new Map(dayInfos.map(d => [d.dateStr, d]));
  const weekendPartnerOf = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay(); // 0=sön, 6=lör
    if (dow !== 0 && dow !== 6) return null;
    return toDateStr(new Date(y, m - 1, d + (dow === 6 ? 1 : -1)));
  };
  const addAssignmentWithWeekendPair = (info, emp) => {
    addAssignment(info, emp);
    if (!emp || !info.isWeekend || !weekendOnly.has(String(emp.id))) return;
    const partnerStr = weekendPartnerOf(info.dateStr);
    if (!partnerStr) return;
    const pInfo = dayInfoByDate.get(partnerStr);
    if (!pInfo || !pInfo.isWeekend) return;
    if ((catStaffingByDate.get(partnerStr) || 0) >= pInfo.fullNeed) return; // redan täckt
    const wk = weekKeyFor(pInfo.date);
    if (busyByEmpDate.has(`${emp.id}_${partnerStr}`)) return;
    if ((workDaysByEmpWeek.get(`${emp.id}_${wk}`) || 0) >= MAX_DAYS_PER_WEEK) return;
    if (!weekendOk(emp.id, pInfo)) return; // max 2 helgedagar på rad
    if (!consecOk(emp.id, partnerStr)) return; // max 8 i rad
    addAssignment(pInfo, emp);
  };

  // Datum per vecka (för «2 dagar fri på rad»-kontrollen)
  const weekDatesMap = new Map();
  for (const d of dates) {
    const wk = weekKeyFor(d);
    if (!weekDatesMap.has(wk)) weekDatesMap.set(wk, []);
    weekDatesMap.get(wk).push(toDateStr(d));
  }
  const busyDatesByEmp = new Map();
  for (const s of shifts || []) {
    if (!s.date) continue;
    if (!busyDatesByEmp.has(String(s.employeeId))) busyDatesByEmp.set(String(s.employeeId), new Set());
    busyDatesByEmp.get(String(s.employeeId)).add(s.date);
  }
  const noteBusy = (empId, dateStr) => {
    if (!busyDatesByEmp.has(String(empId))) busyDatesByEmp.set(String(empId), new Set());
    busyDatesByEmp.get(String(empId)).add(dateStr);
  };
  // HÅRT TAK: max 8 arbeidsdagar i rad (ändrat från 7 per Bjørn 2026-11-24) — även över veckogräns.
  const MAX_CONSECUTIVE_WORKDAYS = 8;
  // Pågående följd av arbetsdagar BAKÅT från dagen före dateStr (befintliga + planerade)
  const consecutiveWorkBefore = (empId, dateStr) => {
    const busy = busyDatesByEmp.get(String(empId));
    if (!busy) return 0;
    const [y, m, d] = dateStr.split('-').map(Number);
    let streak = 0;
    let cur = new Date(y, m - 1, d - 1);
    while (busy.has(toDateStr(cur))) {
      streak++;
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - 1);
    }
    return streak;
  };

  // Pågående följd av arbetsdagar FRAMÅT från dagen efter dateStr (befintliga + planerade)
  const consecutiveWorkAfter = (empId, dateStr) => {
    const busy = busyDatesByEmp.get(String(empId));
    if (!busy) return 0;
    const [y, m, d] = dateStr.split('-').map(Number);
    let streak = 0;
    let cur = new Date(y, m - 1, d + 1);
    while (busy.has(toDateStr(cur))) {
      streak++;
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
    }
    return streak;
  };
  // HÅRT TAK: max 8 arbeidsdagar i rad — räknas både BAKÅT och FRAMÅT från dagen
  // (dagar tilldelas i prio-ordning helligdag → söndag → vardag, så enbart bakåt
  // räcker inte: en söndag kan redan vara tilldelad när vardagen väljs).
  const consecOk = (empId, dateStr) =>
    consecutiveWorkBefore(empId, dateStr) + consecutiveWorkAfter(empId, dateStr) < MAX_CONSECUTIVE_WORKDAYS;

  // Har emp två sammanhängande lediga dagar kvar i veckan OM även info.dateStr blir arbetad?
  const keepsTwoConsecutiveFree = (empId, wk, dateStr) => {
    const wds = weekDatesMap.get(wk);
    if (!wds || wds.length < 3) return true;
    const busy = new Set(busyDatesByEmp.get(String(empId)) || []);
    busy.add(dateStr);
    // sammanhängande = på varandra följande kalenderdagar
    for (let i = 0; i + 1 < wds.length; i++) {
      const a = wds[i];
      const [ay, am, ad] = a.split('-').map(Number);
      const aNextStr = toDateStr(new Date(ay, am - 1, ad + 1));
      if (!busy.has(a) && !busy.has(aNextStr)) return true;
    }
    return false;
  };

  // Jämna RØDE DAGAR (helger + helligdager sammanlagt): räkna per ansatt
  // (befintliga + nya) — på røda dager väljs den med färst røda dagar först,
  // så att fasta och extra anställda delar røda dagarna lika.
  const holidayCountByEmp = new Map();
  const noteHolidayWork = (empId, dateStr) => {
    if (!weekendIdx.has(dateStr)) return; // weekendIdx = hela røda-dag-sekvensen
    const k = String(empId);
    holidayCountByEmp.set(k, (holidayCountByEmp.get(k) || 0) + 1);
  };
  for (const s of shifts || []) {
    if (s.date && s.departmentId && validDeptIds.has(s.departmentId) && weekendIdx.has(s.date)) {
      noteHolidayWork(s.employeeId, s.date);
    }
  }

  // Paret täcker dagen bara med en vakt i KATEGORINS EGNA avdelingar —
  // en pair-medlem som jobbar Øst är inte «på jobb» för Vest-den dagen.
  const pairCovered = (info) =>
    pairEmps.length > 0 && pairEmps.some(emp => runBusyByEmpDate.has(`${emp.id}_${info.dateStr}`));

  // Alla par-medlemmar som KAN jobba info, sorterade enligt parets rankning
  // (samma bulkordning som i pickFor — den som jobbade föregående dag fortsätter).
  const sortedPairCandidates = (info) => {
    const wk = weekKeyFor(info.date);
    // Paret ska inte bränna hela 5-dagarstaket i pass 0 i lavsäsong — då blir det
    // ojämnt mot övriga med samma kontrakts%. Cap = max(täckningsbehov för veckan,
    // veckobehov per fast anställd), hårt tak MAX_DAYS_PER_WEEK.
    const wds = weekDatesMap.get(wk) || [];
    const wkNeed = wds.reduce((sum, ds) => sum + ((dayInfoByDate.get(ds) || {}).fullNeed || 0), 0);
    const fasteCount = Math.max(1, candidates.filter(e => !weekendOnly.has(String(e.id))).length);
    const pairCap = Math.min(MAX_DAYS_PER_WEEK, Math.max(
      Math.ceil(wds.length / Math.max(1, pairEmps.length || 1)),
      Math.ceil(wkNeed / fasteCount)
    ));
    // Föregående kalenderdag (för bulkordning — samma som i pickFor)
    const [py, pm, pd] = info.dateStr.split('-').map(Number);
    const prevDateStr = toDateStr(new Date(py, pm - 1, pd - 1));
    const eligible = pairEmps
      .filter(emp => (workDaysByEmpWeek.get(`${emp.id}_${wk}`) || 0) < MAX_DAYS_PER_WEEK)
      .filter(emp => (workDaysByEmpWeek.get(`${emp.id}_${wk}`) || 0) < pairCap)
      .filter(emp => weekendOk(emp.id, info))
      .filter(emp => consecOk(emp.id, info.dateStr));
    // Minst arbetade dagar denna vecka i paret — för bulker-ledningsvakten
    const minWorked = eligible.length > 0
      ? Math.min(...eligible.map(emp => (workDaysByEmpWeek.get(`${emp.id}_${wk}`) || 0)))
      : null;
    // Blocket får fortsätta max 2 dagar över den minst arbetade i paret —
    // då blir det block på 2-3 dagar i rad för alla (även i lavsæsong), inte
    // hela veckan för samma person (varannan vecka) eller varannan dag.
    const workedOf = (emp) => (workDaysByEmpWeek.get(`${emp.id}_${wk}`) || 0);
    // Blocket bryts när någon ligger före minst arbetade ELLER vid kontraktsmål (minimum).
    const lead = (emp) => {
      if (minWorked == null) return 1;
      return (workedOf(emp) - minWorked < 1) ? 0 : 1;
    };
    return eligible.sort((a, b) => {
      if (info.isWeekend || info.isHoliday) {
        const ah = (holidayCountByEmp.get(String(a.id)) || 0);
        const bh = (holidayCountByEmp.get(String(b.id)) || 0);
        // Röd-dag-balans (hård, samma som i pickFor) + rotation vid lika — annars
        // låser sig id-tiebreaken så samma parmedlem får alla lördagar/söndagar.
        if (ah !== bh) return ah - bh;
        const ap = (plannedCount.get(String(a.id)) || 0);
        const bp = (plannedCount.get(String(b.id)) || 0);
        if (ap !== bp) return ap - bp;
        return (redFlip++ % 2 === 0) ? -1 : 1;
      }
      // BULKORDNING: den i paret som jobbade FÖREGÅENDE dag fortsätter —
      // paret får då flera dagar i rad i stället för varannan dag.
      const pa = ((busyDatesByEmp.get(String(a.id)) || new Set()).has(prevDateStr) ? 0 : 1) + lead(a);
      const pb = ((busyDatesByEmp.get(String(b.id)) || new Set()).has(prevDateStr) ? 0 : 1) + lead(b);
      if (pa !== pb) return pa - pb;
      const ad = workedOf(a);
      const bd = workedOf(b);
      if (ad !== bd) return ad - bd;
      // Växla mellan parets medlemmar över körningar/veckor
      const ap = (plannedCount.get(a.id) || 0);
      const bp = (plannedCount.get(b.id) || 0);
      if (ap !== bp) return ap - bp;
      return String(a.id).localeCompare(String(b.id));
    });
  };

  // Pass 0 (hård regel): minst EN ur paret — första lediga som inte redan är bokad
  const pickPairFor = (info) => {
    if (pairEmps.length === 0 || pairCovered(info)) return null;
    return sortedPairCandidates(info)
      .find(emp => !busyByEmpDate.has(`${emp.id}_${info.dateStr}`)) || null;
  };

  // (Pass 1/2 förlitar sig på vanlig pickFor — rättvis fördelning efter
  // kontrakt/fyllnadsgrad — så att alla minst fyller sitt kontrakt och extra
  // kan fylla flera vakter samma dag. Paret garanteras av pass 0.)

  // Måldagar/vecka per kontraktsprocent: ansettelsesprocenten är ett MINIMUM —
  // en 50 %-anställd ska få ~2,5 dagar/vecka INNAN 100 %-anställda får mer
  // (fillRatio rangordnar per arbetsdagar/måldagar). Den är INTE ett tak: vid
  // högt behov kan alla jobba upp till MAX_DAYS_PER_WEEK. Saknas procent antas 100 %.
  const targetDaysFor = (emp) => {
    const pct = Number(emp && emp.contractPercent);
    if (pct > 0) {
      return Math.min(MAX_DAYS_PER_WEEK, Math.max(1, Math.round(MAX_DAYS_PER_WEEK * pct / 100)));
    }
    return MAX_DAYS_PER_WEEK;
  };

  // relaxed=true: nödfall när mer æn 1 vakt skulle bli ofylld — då får
  // helgansatte (weekendOnly) också användas på vanliga vardagar.
  const pickFor = (info, relaxed = false) => {
    const wk = weekKeyFor(info.date);
    // HØYSESONG denne uken → ekstra får jobbe ukedager OG behandles likt faste
    // (opp til MAX_DAYS_PER_WEEK = 5 dager/uke, ikke bara som reserv sist).
    const highSeason = highSeasonWeek(wk);
    // Föregående kalenderdag (för bulkordningning)
    const [py, pm, pd] = info.dateStr.split('-').map(Number);
    const prevDateStr = toDateStr(new Date(py, pm - 1, pd - 1));
    const eligible = candidates
      .filter(emp => !busyByEmpDate.has(`${emp.id}_${info.dateStr}`))
      // Helgansatte jobbar normalt bare helger (lør/sön) + helligdager — men
      // i juleferien (19/12–03/01) får de jobga ALLA dagar (efter fasta, som
      // reserv), och i nödfall (relaxed) när annars 2+ vakter blir ofyllda
// får ekstra også jobbe UKEDAGER (etter fasta, faste velges først lenger ned). Hele helger tildeles parvis.
// aldri ukedager i LAVSESONG. I HØYSESONG (ukedagsbehov per fast ansatt > 3.5 denne uken)
      .filter(emp => info.isWeekend || info.isHoliday || isJuleferie(info.dateStr) || highSeason || !weekendOnly.has(String(emp.id)))
      // Hårt veckotak för ALLA: MAX_DAYS_PER_WEEK dagar/vecka. Kontraktsprocenten
      // är ett MINIMUM (se targetDaysFor/fillRatio nedan), inte ett tak — vid
      // högt bemanningsbehov får även en 50 %-anställd fler dagar (upp till 5).
      .filter(emp => (workDaysByEmpWeek.get(`${emp.id}_${wk}`) || 0) < MAX_DAYS_PER_WEEK)
      // Max 2 helgedagar på rad per ansatt
      .filter(emp => weekendOk(emp.id, info))
      // Hårt tak: max 8 arbeidsdagar i rad
      .filter(emp => consecOk(emp.id, info.dateStr));
    const rank = (a, b) => {
      const isRedDay = info.isWeekend || info.isHoliday;
      // Jämna røda dagar: den med färst røda dagar först (gäller fasta och
      // extra lika)
      if (isRedDay) {
        const ah = (holidayCountByEmp.get(String(a.id)) || 0);
        const bh = (holidayCountByEmp.get(String(b.id)) || 0);
        if (ah !== bh) return ah - bh;
        // Vid lika antal röda dagar: växla (färst planlagda totalt vinner) så att
        // inte samma person får alla söndagar/helger för evigt.
        const ap = (plannedCount.get(a.id) || 0);
        const bp = (plannedCount.get(b.id) || 0);
        if (ap !== bp) return ap - bp;
      }
      // BULKORDBNING MED LEDNINGSVAKT: den som jobbade FÖREGÅENDE dag
      // väljs först — vakter klustras till sammanhängande bulker (block) i
      // stället för utspridda enkeldagar, och fri-dagarna samlas ihop.
      //    Vakten: blocket får bara fortsätta om den anställda INTE ligger före
      //    den som arbetat minst i poolen denna vecka — annars
      //    slår jämnheten till och blocket bryts (kluster på ~2 dagar
      //    före nästa tar över). Så blir det flera dagar i rad i stället för
      //    varannan dag, MEN inte hela veckan för samma person — i lavsæsong ska
      //    alla få några arbetsdagar (och några dagar fri, t.ex. 3) varje vecka,
      //    inte varannan vecka.
      const workedOf = (emp) => (workDaysByEmpWeek.get(`${emp.id}_${wk}`) || 0);
      // Inget kontraktsmål längre (per Bjørn 2026-11-25): fyll upp veckorna jämnt upp till 5.
      const lead = (emp) => {
        if (minWorkedThisWeek == null) return 1;
        return (workedOf(emp) - minWorkedThisWeek < 1) ? 0 : 1;
      };
      const pa = ((busyDatesByEmp.get(String(a.id)) || new Set()).has(prevDateStr) ? 0 : 1) + lead(a);
      const pb = ((busyDatesByEmp.get(String(b.id)) || new Set()).has(prevDateStr) ? 0 : 1) + lead(b);
      if (pa !== pb) return pa - pb;
      // Fördela dagar LIKS: råa arbetsdagar denna vecka först — både när båda ligger
      // under kontraktsmålet och när båda nått det (överskott liks, inte efter %).
      if (workedOf(a) !== workedOf(b)) return workedOf(a) - workedOf(b);
      // Vid lika fyllnadsgrad: högst kontraktsprocent först — en 80 %-anställd
      // ska aldrig få mindre jobb än en 70 %-anställd (får gärna gå över %).
      const pctOf = (emp) => {
        const p = Number(emp && emp.contractPercent);
        return p > 0 ? p : 100;
      };
      if (pctOf(a) !== pctOf(b)) return pctOf(b) - pctOf(a);
      // Mjuk prioritering: den som kan behålla 2 dagar fri på rad väljs först
      const af = keepsTwoConsecutiveFree(a.id, wk, info.dateStr) ? 0 : 1;
      const bf = keepsTwoConsecutiveFree(b.id, wk, info.dateStr) ? 0 : 1;
      if (af !== bf) return af - bf;
      const ad = (workDaysByEmpWeek.get(`${a.id}_${wk}`) || 0);
      const bd = (workDaysByEmpWeek.get(`${b.id}_${wk}`) || 0);
      if (ad !== bd) return ad - bd;
      return (plannedCount.get(a.id) || 0) - (plannedCount.get(b.id) || 0);
    };
    // Prova först de som behåller 2 fria dagar på rad; fall tillbaka på alla
    const pickFrom = (pool) => {
      const preferred = pool.filter(emp => keepsTwoConsecutiveFree(emp.id, wk, info.dateStr));
      const p = preferred.length > 0 ? preferred : pool;
      return [...p].sort(rank)[0] || null;
    };
    // Minst arbetade dagar denna vecka i poolen — för bulker-ledningsvakten
    let minWorkedThisWeek = null;
    if (eligible.length > 0) {
      minWorkedThisWeek = Math.min(...eligible.map(emp =>
        (workDaysByEmpWeek.get(`${emp.id}_${wk}`) || 0)));
    }
    // FASTA FÖRST — helgansatte (weekendOnly) är en RESERVPOOL: de får en
    // vakt bara när ingen fast ansatt i kategorin kan ta dagen enligt
    // reglene (bokad, 5-dagarstak, 2-helgedagar-regeln).
    const faste = eligible.filter(emp => !weekendOnly.has(String(emp.id)));
    const extras = eligible.filter(emp => weekendOnly.has(String(emp.id)));
    // I høysæsong konkurrerer ekstra på like vilkår (opp til 5 dager/uke) —
    // i lavsesong er de fortsatt RESERV etter fasta. HØYSESONG = ukedagsbehov per
// fast ansatt > 3.5 denne uken (desember-uker med ~3.5 er lavsesong).
    return pickFrom(faste) || pickFrom(extras); // FASTA FÖRST alltid; ekstra bara utöver det
  };

  // Pass 0: «Alltid en på jobb»-paret är HÅRT — MINST en ur paret jobbar VARJE
  // dag i perioden, även om bemanningsbehovet redan är nått. Väljs innan allt
  // annat så att veckodagarstaket inte förbrukas först. Övriga vakter (pass 1/2)
  // fördelas rättvist via pickFor så alla minst fyller sitt kontrakt. Om ingen
  // ur paret kan jobba en dag (5-dagarstak / 2-helgedagar-regeln / redan bokad)
  // är det ett hårt fel som måste lösas manuellt.
  // RÖDA DAGAR FÖRST (lör+sön+helligdag): paret ska täcka alla røda dagar innan
  // veckodagarna — annars kan 5-dagarstaket vara förbrukat när helgen kommer
  // (t.ex. lørdag 28.11 kunde inte täckas). Max 2 røde dagar i rad gäller fortfarande.
  const pairOrderDays = [...dayInfos].sort((a, b) =>
    ((b.isWeekend || b.isHoliday) - (a.isWeekend || a.isHoliday)) || a.dateStr.localeCompare(b.dateStr));
  let redFlip = 0; // växlar parmedlem vid fullständigt lika på røde dager (annars låser id-tiebreaken)
  for (const info of pairOrderDays) {
    if (pairEmps.length === 0 || pairCovered(info)) continue;
    const pick = pickPairFor(info);
    if (pick) {
      addAssignment(info, pick);
    } else {
      warnings.push(
        `⚠️ ${info.dateStr}: «alltid en på jobb»-paret kan INTE täcka dagen ` +
        `(max ${MAX_DAYS_PER_WEEK} arbetsdagar/vecka, 2-helgedagar-regeln eller redan bokad) ` +
        `— kräver manuell åtgärd!`
      );
    }
  }

  // Pass 1: minimumsbemanning (minst minPerDay från kategorin) — i
  // prioriterad ordning: helligdager → søndager → ukedagar.
  for (const info of orderedDays) {
    const existing = catStaffingByDate.get(info.dateStr) || 0;
    if (existing >= minPerDay) continue;
    let missing = minPerDay - existing;
    // Pass 0 har redan gett dagen till paret när det gick. Övriga vakter
    // fördelas RÄTTVIST via pickFor (fillRatio/kontrakt först) — så att alla
    // minst fyller sitt kontrakt och extra/andra kan fylla flera vakter samma dag.
    if (pairEmps.length > 0 && !pairCovered(info)) {
      warnings.push(
        `${info.dateStr}: ingen av det valda paret kan jobba (max ${MAX_DAYS_PER_WEEK} arbetsdagar/vecka nådd).`
      );
    }
    for (let i = 0; i < missing; i++) {
      let pick = pickFor(info);
      // Det får aldrig bli 2 vakter som ikke kan fylles — 1 er ok.
      // Nödfall: om mer æn 1 vakt skulle bli ofylld tas helgansatte
      // in på vardagar också.
      if (!pick && missing - i > 1) pick = pickFor(info, true);
      if (!pick) {
        warnings.push(
          `${info.dateStr}: 1 vakt kunde ikke fylles — ` +
          `inga lediga (max ${MAX_DAYS_PER_WEEK} arbetsdagar/vecka nådd eller redan bokad).`
        );
        break;
      }
      addAssignmentWithWeekendPair(info, pick);
    }
  }

  // Pass 2: extra bemanning (omsetning/söndag/helligdag) ovanpå minimum,
  // fortfarande jämnt fördelat — i prioriterad ordning: helligdager →
  // söndager → ukedagar.
  for (const info of orderedDays) {
    const existing = catStaffingByDate.get(info.dateStr) || 0;
    let missing = Math.max(0, info.fullNeed - existing);
    if (missing <= 0) continue;
    // Ingen par-prioritet här: resterande behov fördelas rättvist via pickFor
    // (fillRatio/kontrakt), så alla minst fyller kontraktet och extra kan fylla
    // flera vakter samma dag (hela helger via addAssignmentWithWeekendPair).
    for (let i = 0; i < missing; i++) {
      let pick = pickFor(info);
      // Det får aldrig bli 2 vakter som ikke kan fylles — 1 er ok.
      // Nödfall: om mer æn 1 vakt skulle bli ofylld tas helgansatte
      // in på vardagar också.
      if (!pick && missing - i > 1) pick = pickFor(info, true);
      if (!pick) {
        warnings.push(
          `${info.dateStr}: 1 vakt kunde ikke fylles — ` +
          `inga lediga (max ${MAX_DAYS_PER_WEEK} arbetsdagar/vecka nådd eller redan bokad).`
        );
        break;
      }
      addAssignmentWithWeekendPair(info, pick);
    }
  }

  // Pass 3: REBALANSERING inom varje vecka — högre kontrakts% ska aldrig ha färre
  // dagar än lägre % samma vecka (per Bjørn 2026-11-25: "alla fasta under 80% medan en
  // 70% ligger över — tex 8-9 dec"). Flytta från mest till minst arbetade, men bara
  // från lägre/samma % till högre/samma % (så 80% aldrig hamnar under 70%). Hårda
  // regler + par-täckning gäller fortfarande.
  const pctOf = (emp) => { const p = Number(emp && emp.contractPercent); return p > 0 ? p : 100; };
  for (const wk of [...weekDatesMap.keys()]) {
    const wds = weekDatesMap.get(wk);
    let guard = 0;
    while (guard++ < 40) {
      const worked = candidates.map(emp => {
        let c = 0;
        for (const ds of wds) if ((busyDatesByEmp.get(String(emp.id)) || new Set()).has(ds)) c++;
        return { id: String(emp.id), emp, c };
      }).sort((a, b) => b.c - a.c);
      // välj donor (mest) -> receiver (minst) med diff >= 2 där donor% <= receiver%
      let chosen = null;
      outer: for (const A of worked) {
        for (let i = worked.length - 1; i >= 0; i--) {
          const B = worked[i];
          const minDiff = pctOf(A.emp) < pctOf(B.emp) ? 1 : 2; // högre % ska aldrig ha färre dagar
          if (A.c - B.c < minDiff) continue;
          if (pctOf(A.emp) > pctOf(B.emp)) continue; // aldrig från högre % till lägre %
          chosen = [A, B];
          break outer;
        }
      }
      if (!chosen) break;
      const [A, B] = chosen;
      const aId = A.id, bId = B.id;
      let moved = false;
      for (const ds of wds) {
        if (!(busyDatesByEmp.get(aId) || new Set()).has(ds)) continue;
        if ((busyDatesByEmp.get(bId) || new Set()).has(ds)) continue;
        const info = dayInfoByDate.get(ds);
        if (!info) continue;
        if (!(info.isWeekend || info.isHoliday || isJuleferie(ds) || highSeasonWeek(wk) || !weekendOnly.has(bId))) continue;
        if ((workDaysByEmpWeek.get(`${bId}_${wk}`) || 0) >= MAX_DAYS_PER_WEEK) continue;
        if ((workDaysByEmpWeek.get(`${aId}_${wk}`) || 0) <= 2) continue; // töm inte ur veckan helt
        if (!weekendOk(bId, info)) continue;
        if (!consecOk(bId, ds)) continue;
        const pairStillCovered =
          pairEmps.some(pe => String(pe.id) === bId) ||
          pairEmps.some(pe => String(pe.id) !== aId && runBusyByEmpDate.has(`${pe.id}_${ds}`));
        if (pairEmps.length > 0 && !pairStillCovered) continue;
        // --- flytta A -> B ---
        const ai = assignments.findIndex(x => String(x.employeeId) === aId && x.date === ds);
        if (ai >= 0) { assignments[ai].employeeId = B.emp.id; assignments[ai].employeeName = B.emp.name; }
        busyDatesByEmp.get(aId)?.delete(ds);
        runBusyByEmpDate.delete(`${aId}_${ds}`);
        busyByEmpDate.delete(`${aId}_${ds}`);
        noteBusy(bId, ds);
        busyByEmpDate.add(`${bId}_${ds}`);
        runBusyByEmpDate.add(`${bId}_${ds}`);
        workDaysByEmpWeek.set(`${aId}_${wk}`, (workDaysByEmpWeek.get(`${aId}_${wk}`) || 1) - 1);
        workDaysByEmpWeek.set(`${bId}_${wk}`, (workDaysByEmpWeek.get(`${bId}_${wk}`) || 0) + 1);
        plannedCount.set(aId, (plannedCount.get(aId) || 1) - 1);
        plannedCount.set(bId, (plannedCount.get(bId) || 0) + 1);
        if (weekendIdx.has(ds)) {
          holidayCountByEmp.set(aId, (holidayCountByEmp.get(aId) || 1) - 1);
          holidayCountByEmp.set(bId, (holidayCountByEmp.get(bId) || 0) + 1);
        }
        const names = namesByDate.get(ds);
        const ni = names ? names.indexOf(A.emp.name) : -1;
        if (ni >= 0) names[ni] = B.emp.name; else names?.push(B.emp.name);
        moved = true;
        break;
      }
      if (!moved) break;
    }
  }

  // Pass 3b: global utjämning inom SAMMA kontrakts% (totalt över perioden inom 2 dagar)
  {
    let guard = 0;
    while (guard++ < 200) {
      const worked = candidates.map(emp => {
        const busy = busyDatesByEmp.get(String(emp.id)) || new Set();
        let c = 0;
        for (const ds of busy) if (dayInfoByDate.has(ds)) c++;
        return { id: String(emp.id), emp, c };
      }).sort((a, b) => b.c - a.c);
      let chosen = null;
      outer: for (const A of worked) {
        for (let i = worked.length - 1; i >= 0; i--) {
          const B = worked[i];
          if (A.c - B.c < 2) continue;
          if (pctOf(A.emp) !== pctOf(B.emp)) continue; // bara inom samma %
          chosen = [A, B];
          break outer;
        }
      }
      if (!chosen) break;
      const [A, B] = chosen;
      const aId = A.id, bId = B.id;
      let moved = false;
      for (const ds of [...(busyDatesByEmp.get(aId) || [])].sort()) {
        if ((busyDatesByEmp.get(bId) || new Set()).has(ds)) continue;
        const info = dayInfoByDate.get(ds);
        if (!info) continue;
        const wk = weekKeyFor(info.date);
        if (!(info.isWeekend || info.isHoliday || isJuleferie(ds) || highSeasonWeek(wk) || !weekendOnly.has(bId))) continue;
        if ((workDaysByEmpWeek.get(`${bId}_${wk}`) || 0) >= MAX_DAYS_PER_WEEK) continue;
        if ((workDaysByEmpWeek.get(`${aId}_${wk}`) || 0) <= 2) continue;
        if (!weekendOk(bId, info)) continue;
        if (!consecOk(bId, ds)) continue;
        const pairStillCovered =
          pairEmps.some(pe => String(pe.id) === bId) ||
          pairEmps.some(pe => String(pe.id) !== aId && runBusyByEmpDate.has(`${pe.id}_${ds}`));
        if (pairEmps.length > 0 && !pairStillCovered) continue;
        const ai = assignments.findIndex(x => String(x.employeeId) === aId && x.date === ds);
        if (ai >= 0) { assignments[ai].employeeId = B.emp.id; assignments[ai].employeeName = B.emp.name; }
        busyDatesByEmp.get(aId)?.delete(ds);
        runBusyByEmpDate.delete(`${aId}_${ds}`);
        busyByEmpDate.delete(`${aId}_${ds}`);
        noteBusy(bId, ds);
        busyByEmpDate.add(`${bId}_${ds}`);
        runBusyByEmpDate.add(`${bId}_${ds}`);
        workDaysByEmpWeek.set(`${aId}_${wk}`, (workDaysByEmpWeek.get(`${aId}_${wk}`) || 1) - 1);
        workDaysByEmpWeek.set(`${bId}_${wk}`, (workDaysByEmpWeek.get(`${bId}_${wk}`) || 0) + 1);
        plannedCount.set(aId, (plannedCount.get(aId) || 1) - 1);
        plannedCount.set(bId, (plannedCount.get(bId) || 0) + 1);
        if (weekendIdx.has(ds)) {
          holidayCountByEmp.set(aId, (holidayCountByEmp.get(aId) || 1) - 1);
          holidayCountByEmp.set(bId, (holidayCountByEmp.get(bId) || 0) + 1);
        }
        const names = namesByDate.get(ds);
        const ni = names ? names.indexOf(A.emp.name) : -1;
        if (ni >= 0) names[ni] = B.emp.name; else names?.push(B.emp.name);
        moved = true;
        break;
      }
      if (!moved) break;
    }
  }

  const perDate = dayInfos.map(info => ({
    date: info.dateStr,
    recommended: info.recommended,
    need: info.fullNeed,
    isSunday: info.isSunday,
    isWeekend: info.isWeekend,
    isHoliday: info.isHoliday,
    existing: info.existing0,
    generated: namesByDate.get(info.dateStr).length,
    names: namesByDate.get(info.dateStr)
  }));

  return { assignments, warnings, perDate };
};

export default generateAutoFill;
