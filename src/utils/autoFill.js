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
// - Valfritt «alltid en på jobb»-par (HÅRT): en ur paret jobbar VARJE dag
//   i perioden — även om behovet redan är nått. Kan ingen ur paret jobba
//   blir det ett hårt fel (⚠️-varning, manuell åtgärd).

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
  if (!n || n === 'fri' || n === 'ferie') return null;
  if (n.includes('skolegrupper')) return 'Skiutleie Vest';
  if (n.includes('butikk')) return n.includes('øst') || n.includes('ost') ? 'Butikk Øst' : 'Butikk Vest';
  if (n.includes('øst') || n.includes('ost')) return 'Skiutleie Øst';
  if (n.includes('vest')) return 'Skiutleie Vest';
  if (n.includes('skiskole')) return 'Skiskole';
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
      const countsForRun = !category || shiftCat == null || shiftCat === category;
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
  const plannedCount = new Map();

  // Helgedags-sekvens (lør/sön OCH helligdager — dvs alla «røde» dagar —
  // i kronologisk ordning) och streak-state: ingen ansatt får jobba mer æn
  // MAX_WEEKEND_STREAK helgedagar/helligdagar på rad (t.ex. aldrig 8 dagar
  // i jula). Befintliga vakter på dessa dagar seedar streaken.
  const holidaySetForStreak = new Set((holidays || []));
  const weekendDates = dates
    .filter(d => d.getDay() === 0 || d.getDay() === 6 ||
      holidaySetForStreak.has(toDateStr(d)))
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
  const weekendOk = (empId, info) =>
    (!info.isWeekend && !info.isHoliday) ||
    weekendStreakBefore(empId, weekendIdx.get(info.dateStr)) < 2;

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

  const namesByDate = new Map(dayInfos.map(d => [d.dateStr, []]));
  const pairEmps = (pairIds || [])
    .map(id => candidates.find(c => String(c.id) === String(id)))
    .filter(Boolean);

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
      endTime,
      comment: '',
      autoFilled: true,
      breaks: []
    });
    namesByDate.get(info.dateStr).push(emp.name);
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

  const pickPairFor = (info) => {
    if (pairEmps.length === 0 || pairCovered(info)) return null;
    const wk = weekKeyFor(info.date);
    return pairEmps
      .filter(emp => (workDaysByEmpWeek.get(`${emp.id}_${wk}`) || 0) < MAX_DAYS_PER_WEEK)
      .filter(emp => weekendOk(emp.id, info))
      .sort((a, b) => {
        if (info.isWeekend || info.isHoliday) {
          const ah = (holidayCountByEmp.get(String(a.id)) || 0);
          const bh = (holidayCountByEmp.get(String(b.id)) || 0);
          if (ah !== bh) return ah - bh;
        }
        return (workDaysByEmpWeek.get(`${a.id}_${wk}`) || 0) - (workDaysByEmpWeek.get(`${b.id}_${wk}`) || 0) ||
          String(a.id).localeCompare(String(b.id));
      })[0] || null;
  };

  // relaxed=true: nödfall när mer æn 1 vakt skulle bli ofylld — då får
  // helgansatte (weekendOnly) också användas på vanliga vardagar.
  const pickFor = (info, relaxed = false) => {
    const wk = weekKeyFor(info.date);
    const eligible = candidates
      .filter(emp => !busyByEmpDate.has(`${emp.id}_${info.dateStr}`))
      // Helgansatte jobbar bare helger (lør/sön) — utom i juleferien/røda dager,
      // eller i nödfall (relaxed) när annars 2+ vakter blir ofyllda
      .filter(emp => info.isWeekend || info.isHoliday || relaxed || !weekendOnly.has(String(emp.id)))
      .filter(emp => (workDaysByEmpWeek.get(`${emp.id}_${wk}`) || 0) < MAX_DAYS_PER_WEEK)
      // Max 2 helgedagar på rad per ansatt
      .filter(emp => weekendOk(emp.id, info));
    const rank = (a, b) => {
      // På helger (och i juleferien) väljs helgansatte först —
      // sparar ordinares dagar till vardagarna
      const isRedDay = info.isWeekend || info.isHoliday;
      // Jämna røda dagar: den med färst røda dagar (fasta + extra lika) först
      if (isRedDay) {
        const ah = (holidayCountByEmp.get(String(a.id)) || 0);
        const bh = (holidayCountByEmp.get(String(b.id)) || 0);
        if (ah !== bh) return ah - bh;
      }
      // Därefter helgansatte först på helgerna
      const aw = weekendOnly.has(String(a.id)) ? 0 : 1;
      const bw = weekendOnly.has(String(b.id)) ? 0 : 1;
      if (isRedDay && aw !== bw) return aw - bw;
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
    const preferred = eligible.filter(emp => keepsTwoConsecutiveFree(emp.id, wk, info.dateStr));
    const pool = preferred.length > 0 ? preferred : eligible;
    return [...pool].sort(rank)[0] || null;
  };

  // Pass 0: «Alltid en på jobb»-paret är HÅRT — en ur paret jobbar VARJE dag
  // i perioden, även om bemanningsbehovet redan är nått. Väljs innan allt
  // annat så att veckodagarstaket inte förbrukas först. Om ingen ur paret
  // kan jobba en dag (5-dagarstak / 2-helgedagar-regeln / redan bokad) är
  // det ett hårt fel som måste lösas manuellt.
  for (const info of dayInfos) {
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

  // Pass 1: minimumsbemanning (minst minPerDay från kategorin) jämnt över
  // ALLA dagar i perioden först — så att helgen reserveras innan vardagarnas
  // extras förbrukar veckodagarstaket.
  for (const info of dayInfos) {
    const existing = catStaffingByDate.get(info.dateStr) || 0;
    if (existing >= minPerDay) continue;
    let missing = minPerDay - existing;
    const pickPair = pickPairFor(info);
    if (pickPair) {
      addAssignment(info, pickPair);
      missing -= 1;
    } else if (pairEmps.length > 0 && !pairCovered(info)) {
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
      addAssignment(info, pick);
    }
  }

  // Pass 2: extra bemanning (omsetning/söndag/helligdag) ovanpå minimum,
  // fortfarande jämnt fördelat (den med minst dagar den veckan väljs först).
  for (const info of dayInfos) {
    const existing = catStaffingByDate.get(info.dateStr) || 0;
    let missing = Math.max(0, info.fullNeed - existing);
    if (missing <= 0) continue;
    const pickPair = pickPairFor(info);
    if (pickPair) {
      addAssignment(info, pickPair);
      missing -= 1;
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
      addAssignment(info, pick);
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
