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
// - Ingen ansatt får jobba mer æn 2 helgedagar (lør/sön) på rad —
//   efter två helgedagar i följd följs nästa helgedag av någon annan.
// - Timmar/ansettelsesprocent begränsar INTE — men max MAX_DAYS_PER_WEEK
//   arbetsdagar per ansatt och vecka (befintliga vakter räknas med).
// - Grundbemanningen fördelas jämnt över dagarna (den med minst
//   arbetsdagar den veckan väljs först).
// - Valfritt «alltid en på jobb»-par: om ingen ur paret jobbar en dag
//   som ska bemannas, fylls en ur paret först.

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

// Kartlegg avdelingsnavn til plats-nyckel som i StaffingPlanner/OverviewCalendar
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
    weekendOnlyIds = []
  } = options;

  const warnings = [];
  const assignments = [];

  const dept = (departments || []).find(d => d && d.id === departmentId);
  const deptNameLower = (dept?.name || '').toLowerCase();
  if (deptNameLower === 'fri' || deptNameLower === 'ferie') {
    warnings.push('Valgt avdeling er fri/ferie — ingen vakter genereres.');
    return { assignments, warnings, perDate: [] };
  }

  const loc = locationForDepartmentName(dept?.name);
  // Kategorier utan platskoppling (t.ex. Skiskole/Ekstra) använder total-konfigen
  const revLoc = loc || 'total';
  const config = staffingConfigs
    ? (staffingConfigs[loc] || staffingConfigs.total || null)
    : null;
  const revenueMap = buildRevenueMap(revenues);

  const deptNameById = new Map((departments || []).map(d => [d.id, (d?.name || '').toLowerCase()]));
  const candidates = [...employees];
  const candIds = new Set(candidates.map(e => String(e.id)));
  const weekendOnly = new Set((weekendOnlyIds || []).map(String));

  // Kategoribemanning per dato: kategorins anställda som redan jobbar
  // (icke-fri/ferie) + hvem som är upptagen per dag + arbetsdagar per vecka.
  const catStaffingByDate = new Map();
  const busyByEmpDate = new Set();
  const workDaysByEmpWeek = new Map();
  for (const s of shifts || []) {
    if (!s.date) continue;
    busyByEmpDate.add(`${s.employeeId}_${s.date}`);
    const dn = deptNameById.get(s.departmentId) || '';
    if (dn === 'fri' || dn === 'ferie') continue;
    const [sy, sm, sd] = s.date.split('-').map(Number);
    const swk = weekKeyFor(new Date(sy, sm - 1, sd));
    workDaysByEmpWeek.set(`${s.employeeId}_${swk}`, (workDaysByEmpWeek.get(`${s.employeeId}_${swk}`) || 0) + 1);
    if (candIds.has(String(s.employeeId))) {
      catStaffingByDate.set(s.date, (catStaffingByDate.get(s.date) || 0) + 1);
    }
  }

  // Fördelningstillstånd: antal nya vakter per ansatt (rotation vid lika många dagar)
  const plannedCount = new Map();

  // Helgedags-sekvens (lør/sön i kronologisk ordning) och streak-state:
  // ingen ansatt får jobba mer æn MAX_WEEKEND_STREAK helgedagar på rad.
  // Befintliga vakter på helger seedar streaken.
  const weekendDates = dates
    .filter(d => d.getDay() === 0 || d.getDay() === 6)
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
    !info.isWeekend ||
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
    noteWeekendWork(emp.id, info.dateStr);
    catStaffingByDate.set(info.dateStr, (catStaffingByDate.get(info.dateStr) || 0) + 1);
    assignments.push({
      employeeId: emp.id,
      employeeName: emp.name,
      date: info.dateStr,
      departmentId: departmentId || (emp.deptIds && emp.deptIds[0]) || null,
      startTime,
      endTime,
      comment: 'Auto-utfylt',
      breaks: []
    });
    namesByDate.get(info.dateStr).push(emp.name);
  };

  const pairCovered = (info) =>
    pairEmps.length > 0 && pairEmps.some(emp => busyByEmpDate.has(`${emp.id}_${info.dateStr}`));

  const pickPairFor = (info) => {
    if (pairEmps.length === 0 || pairCovered(info)) return null;
    const wk = weekKeyFor(info.date);
    return pairEmps
      .filter(emp => (workDaysByEmpWeek.get(`${emp.id}_${wk}`) || 0) < MAX_DAYS_PER_WEEK)
      .filter(emp => weekendOk(emp.id, info))
      .sort((a, b) =>
        (workDaysByEmpWeek.get(`${a.id}_${wk}`) || 0) - (workDaysByEmpWeek.get(`${b.id}_${wk}`) || 0) ||
        String(a.id).localeCompare(String(b.id)))[0] || null;
  };

  const pickFor = (info) => {
    const wk = weekKeyFor(info.date);
    return candidates
      .filter(emp => !busyByEmpDate.has(`${emp.id}_${info.dateStr}`))
      // Helgansatte jobbar bare helger (lør/sön)
      .filter(emp => info.isWeekend || !weekendOnly.has(String(emp.id)))
      .filter(emp => (workDaysByEmpWeek.get(`${emp.id}_${wk}`) || 0) < MAX_DAYS_PER_WEEK)
      // Max 2 helgedagar på rad per ansatt
      .filter(emp => weekendOk(emp.id, info))
      .sort((a, b) => {
        // På helger väljs helgansatte först — sparar ordinares dagar till vardagarna
        const aw = weekendOnly.has(String(a.id)) ? 0 : 1;
        const bw = weekendOnly.has(String(b.id)) ? 0 : 1;
        if (info.isWeekend && aw !== bw) return aw - bw;
        const ad = (workDaysByEmpWeek.get(`${a.id}_${wk}`) || 0);
        const bd = (workDaysByEmpWeek.get(`${b.id}_${wk}`) || 0);
        if (ad !== bd) return ad - bd;
        return (plannedCount.get(a.id) || 0) - (plannedCount.get(b.id) || 0);
      })[0] || null;
  };

  // Pass 1: minimumsbemanning (minst minPerDay från kategorin) jämnt över
  // ALLA dagar i perioden först — så att helgen reserveras innan vardagarnas
  // extras förbrukar veckodagarstaket.
  for (const info of dayInfos) {
    const existing = catStaffingByDate.get(info.dateStr) || 0;
    if (existing >= minPerDay) {
      if (pairEmps.length > 0 && !pairCovered(info)) {
        warnings.push(`${info.dateStr}: kategorin är bemannad, men ingen ur det valda paret jobbar.`);
      }
      continue;
    }
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
      const pick = pickFor(info);
      if (!pick) {
        warnings.push(
          `${info.dateStr}: minimum ${minPerDay} per dag kunde inte nås — ` +
          `för få lediga i kategorin (max ${MAX_DAYS_PER_WEEK} arbetsdagar/vecka).`
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
      const pick = pickFor(info);
      if (!pick) {
        warnings.push(
          `${info.dateStr}: ${missing - i} ${missing - i === 1 ? 'vakt' : 'vakter'} kunde ikke fylles — ` +
          `ingen ledig ansatt (max ${MAX_DAYS_PER_WEEK} arbetsdager/vecka nådd eller redan bokad).`
        );
        break;
      }
      addAssignment(info, pick);
    }
  }

  const perDate = dayInfos.map(info => ({
    date: info.dateStr,
    recommended: info.recommended,
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
