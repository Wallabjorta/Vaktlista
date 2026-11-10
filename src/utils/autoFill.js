// Automatisk utfylling av vakter basert på omsetning, søndager, helligdager
// och jämn fördelning. Ren funksjon uten sideeffekter — kalleren viser
// forslaget og bestemmer selv om det lagres.
//
// Regler:
// - Timmar/ansettelsesprocent begränsar INTE — men max MAX_DAYS_PER_WEEK
//   arbetsdagar per ansatt och vecka (befintliga vakter räknas med).
// - Grundbemanningen i kategorin fördelas jämnt över dagarna (den med
//   minst arbetsdagar den veckan väljs först); dagar med högre behov
//   (omsetning/söndag/helligdag) får extra folk på samma sätt.

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
 * @param {Date[]}   arg.dates          Datoer i vinduet
 * @param {Array}    arg.employees      Kandidater (valgt avdeling, utan admin)
 * @param {Array}    arg.shifts         Eksisterande vakter (vinduet)
 * @param {Array}    arg.allEmployees   Alla anställda (för admin-exkludering)
 * @param {Array}    arg.departments
 * @param {string[]} arg.holidays       ['YYYY-MM-DD', ...]
 * @param {Array}    arg.revenues       Rå omsättningsdokument { date, amount, location }
 * @param {Object}   arg.staffingConfigs  { total, st, øst } eller null
 * @param {Function} arg.recommend      (amount, config) => { staff, label }
 * @param {Object}   arg.options         { departmentId, startTime, endTime, sundayBoost, holidayBoost }
 * @returns {{ assignments: Array, warnings: string[], perDate: Array }}
 */
export const generateAutoFill = ({
  dates = [],
  employees = [],
  shifts = [],
  allEmployees,
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
    sundayBoost = 0,
    holidayBoost = 0
  } = options;

  const warnings = [];
  const assignments = [];
  const perDate = [];

  const dept = (departments || []).find(d => d && d.id === departmentId);
  const deptNameLower = (dept?.name || '').toLowerCase();
  if (deptNameLower === 'fri' || deptNameLower === 'ferie') {
    warnings.push('Valgt avdeling er fri/ferie — ingen vakter genereres.');
    return { assignments, warnings, perDate };
  }

  const loc = locationForDepartmentName(dept?.name);
  // Kategorier utan platskoppling (t.ex. Skiskole/Ekstra) använder total-konfigen
  const revLoc = loc || 'total';
  const config = staffingConfigs
    ? (staffingConfigs[loc] || staffingConfigs.total || null)
    : null;
  const revenueMap = buildRevenueMap(revenues);

  const employeeById = new Map((allEmployees || employees).map(e => [String(e.id), e]));
  const deptNameById = new Map((departments || []).map(d => [d.id, (d?.name || '').toLowerCase()]));

  // Faktisk bemanning per dato (samme räknereglar som Bemanning V/Ø-raden:
  // fri/ferie och admin räknas inte) + hvem som är upptagen per dag
  // + hur många arbetsdagar varje ansatt redan har den veckan.
  const staffingByDate = new Map();
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
    const emp = employeeById.get(String(s.employeeId));
    if (emp && (emp.isAdmin || emp.category === 'Admin')) continue;
    const isLoc = !loc
      ? true
      : (loc === 'st' ? dn.includes('vest') : (dn.includes('øst') || dn.includes('ost')));
    if (isLoc) {
      staffingByDate.set(s.date, (staffingByDate.get(s.date) || 0) + 1);
    }
  }

  // Fördelningstillstånd: arbetsdagar per vecka (max 5, jämn fördelning —
  // den med minst dagar den veckan väljs först) + antal nya vakter (rotation)
  const plannedCount = new Map();
  const candidates = [...employees];

  for (const date of dates) {
    const dateStr = toDateStr(date);
    const isSunday = date.getDay() === 0;
    const isHoliday = (holidays || []).includes(dateStr);

    let recommended = null;
    if (revenueMap.has(`${revLoc}_${dateStr}`)) {
      const rec = recommend ? recommend(revenueMap.get(`${revLoc}_${dateStr}`), config) : null;
      recommended = rec ? rec.staff : null;
    }
    let need = recommended != null ? recommended : 0;
    if (isSunday) need += Number(sundayBoost) || 0;
    if (isHoliday) need += Number(holidayBoost) || 0;

    const existing = staffingByDate.get(dateStr) || 0;
    const missing = Math.max(0, need - existing);
    const names = [];
    for (let i = 0; i < missing; i++) {
      const wk = weekKeyFor(date);
      const daysThisWeek = (emp) => workDaysByEmpWeek.get(`${emp.id}_${wk}`) || 0;
      const pick = candidates
        .filter(emp => !busyByEmpDate.has(`${emp.id}_${dateStr}`))
        .filter(emp => daysThisWeek(emp) < MAX_DAYS_PER_WEEK)
        .sort((a, b) => {
          const ad = daysThisWeek(a);
          const bd = daysThisWeek(b);
          if (ad !== bd) return ad - bd;
          return (plannedCount.get(a.id) || 0) - (plannedCount.get(b.id) || 0);
        })[0];
      if (!pick) {
        warnings.push(
          `${dateStr}: ${missing - i} ${missing - i === 1 ? 'vakt' : 'vakter'} kunde ikke fylles — ` +
          `ingen ledig ansatt (max ${MAX_DAYS_PER_WEEK} arbetsdagar/vecka nådd eller redan bokad).`
        );
        break;
      }
      workDaysByEmpWeek.set(`${pick.id}_${wk}`, daysThisWeek(pick) + 1);
      plannedCount.set(pick.id, (plannedCount.get(pick.id) || 0) + 1);
      busyByEmpDate.add(`${pick.id}_${dateStr}`);
      assignments.push({
        employeeId: pick.id,
        employeeName: pick.name,
        date: dateStr,
        departmentId: departmentId || (pick.deptIds && pick.deptIds[0]) || null,
        startTime,
        endTime,
        comment: 'Auto-utfylt',
        breaks: []
      });
      names.push(pick.name);
    }
    perDate.push({
      date: dateStr,
      recommended,
      isSunday,
      isHoliday,
      existing,
      generated: names.length,
      names
    });
  }

  return { assignments, warnings, perDate };
};

export default generateAutoFill;
