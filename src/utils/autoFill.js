// Automatisk utfylling av vakter basert på omsetning, søndager, helligdager
// og jämn fördelning. Ren funksjon uten sideeffekter — kalleren viser
// forslaget og bestemmer selv om det lagres.
//
// Regler:
// - Minst minPerDay (standard 2) ansatte från kategorin varje dag —
//   aldrig bara 1 person från kategorin en dag.
// - Omsetning/bemanningskonfig ger behov utöver minimum; söndagar och
//   helligdager kan lägga till extra per kjøring.
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
 * @param {string[]} arg.holidays         ['YYYY-MM-DD', ...]
 * @param {Array}    arg.revenues         Rå omsättningsdokument { date, amount, location }
 * @param {Object}   arg.staffingConfigs  { total, st, øst } eller null
 * @param {Function} arg.recommend        (amount, config) => { staff, label }
 * @param {Object}   arg.options
 * @param {string}   arg.options.departmentId
 * @param {string}   arg.options.startTime
 * @param {string}   arg.options.endTime
 * @param {number}   arg.options.sundayBoost
 * @param {number}   arg.options.holidayBoost
 * @param {number}   [arg.options.minPerDay=2]      Minst så mange fra kategorien per dag
 * @param {Array}    [arg.options.pairIds=[]]      «Alltid en på jobb»-par (max 2 id)
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
    sundayBoost = 0,
    holidayBoost = 0,
    minPerDay = 2,
    pairIds = []
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

  const deptNameById = new Map((departments || []).map(d => [d.id, (d?.name || '').toLowerCase()]));
  const candidates = [...employees];
  const candIds = new Set(candidates.map(e => String(e.id)));

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

  for (const date of dates) {
    const dateStr = toDateStr(date);
    const isSunday = date.getDay() === 0;
    const isHoliday = (holidays || []).includes(dateStr);
    const wk = weekKeyFor(date);

    let recommended = null;
    if (revenueMap.has(`${revLoc}_${dateStr}`)) {
      const rec = recommend ? recommend(revenueMap.get(`${revLoc}_${dateStr}`), config) : null;
      recommended = rec ? rec.staff : null;
    }
    // Minst minPerDay från kategorin varje dag — aldrig bara 1 person.
    let need = Math.max(recommended != null ? recommended : 0, minPerDay);
    if (isSunday) need += Number(sundayBoost) || 0;
    if (isHoliday) need += Number(holidayBoost) || 0;

    const existing = catStaffingByDate.get(dateStr) || 0;
    let missing = Math.max(0, need - existing);
    const names = [];

    const daysThisWeek = (empId) => workDaysByEmpWeek.get(`${String(empId)}_${wk}`) || 0;
    const addAssignment = (emp) => {
      workDaysByEmpWeek.set(`${emp.id}_${wk}`, daysThisWeek(emp.id) + 1);
      plannedCount.set(emp.id, (plannedCount.get(emp.id) || 0) + 1);
      busyByEmpDate.add(`${emp.id}_${dateStr}`);
      assignments.push({
        employeeId: emp.id,
        employeeName: emp.name,
        date: dateStr,
        departmentId: departmentId || (emp.deptIds && emp.deptIds[0]) || null,
        startTime,
        endTime,
        comment: 'Auto-utfylt',
        breaks: []
      });
      names.push(emp.name);
    };

    // «Alltid en på jobb»: om ett par valts och ingen ur paret jobbar
    // (eller är bokad) denna dag, fylls en ur paret först.
    const pairEmps = pairIds
      .map(id => candidates.find(c => String(c.id) === String(id)))
      .filter(Boolean);
    if (missing > 0 && pairEmps.length > 0 && !pairEmps.some(emp => busyByEmpDate.has(`${emp.id}_${dateStr}`))) {
      const pickPair = pairEmps
        .filter(emp => daysThisWeek(emp.id) < MAX_DAYS_PER_WEEK)
        .sort((a, b) =>
          daysThisWeek(a.id) - daysThisWeek(b.id) ||
          String(a.id).localeCompare(String(b.id)))[0];
      if (pickPair) {
        addAssignment(pickPair);
        missing -= 1;
      } else {
        warnings.push(
          `${dateStr}: ingen av det valda paret kan jobba ` +
          `(max ${MAX_DAYS_PER_WEEK} arbetsdagar/vecka nådd).`
        );
      }
    }

    for (let i = 0; i < missing; i++) {
      const pick = candidates
        .filter(emp => !busyByEmpDate.has(`${emp.id}_${dateStr}`))
        .filter(emp => daysThisWeek(emp.id) < MAX_DAYS_PER_WEEK)
        .sort((a, b) => {
          const ad = daysThisWeek(a.id);
          const bd = daysThisWeek(b.id);
          if (ad !== bd) return ad - bd;
          return (plannedCount.get(a.id) || 0) - (plannedCount.get(b.id) || 0);
        })[0];
      if (!pick) {
        warnings.push(
          `${dateStr}: ${missing - i} ${missing - i === 1 ? 'vakt' : 'vakter'} kunde ikke fylles — ` +
          `ingen ledig ansatt (max ${MAX_DAYS_PER_WEEK} arbetsdager/vecka nådd eller redan bokad).`
        );
        break;
      }
      addAssignment(pick);
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
