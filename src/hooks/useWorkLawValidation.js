/**
 * Norsk arbeidslov validering:
 * - Max 5 arbeidsdager per uke per ansatt
 * - Ikke mer enn 2 søndager/helligdager på rad
 * - Minst 1 fridag per uke (24 timer sammenhengende hvile)
 */

// Lokal dato-streng (unngår toISOString/UTC — i norsk tid ville mandag blitt til søndag)
const toLocalDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Hjelpefunksjon: uken starter MANDAG (norsk uke, ISO 8601)
const getWeekStartDate = (dateStr) => {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - daysToSubtract);
  return toLocalDateStr(weekStart);
};

// Hjelpefunksjon: søndag samme uke (lokal, mandagsbasert uke)
const getWeekEndDate = (weekStartStr) => {
  const ws = new Date(weekStartStr + 'T00:00:00');
  ws.setDate(ws.getDate() + 6);
  return toLocalDateStr(ws);
};

// Hjelpefunksjon for å sjekke om en dato er søndag eller helligdag
const isSpecialDay = (dateStr, holidays) => {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay();
  const isSunday = dayOfWeek === 0;
  const isHoliday = holidays && holidays[dateStr];
  return isSunday || isHoliday;
};

// Hjelpefunksjon: er et skift en Fri/Ferie-markering (ikke en arbeidsdag)?
const isDayOffShift = (shift, dayOffDeptIds) => {
  if (!shift) return false;
  const raw = String(shift.departmentId || '').toLowerCase();
  return dayOffDeptIds.has(shift.departmentId) || raw === 'fri' || raw === 'ferie';
};

const dayOffDeptIdsFrom = (departments) => new Set(
  (departments || [])
    .filter(d => d && ['fri', 'ferie'].includes((d.name || '').toLowerCase()))
    .map(d => d.id)
);

// Regel 1: Sjekk max 5 arbeidsdager per uke (Fri/Ferie teller ikke som arbeidsdager)
const checkMax5DaysPerWeek = (employeeId, dateStr, allShifts, holidays, dayOffDeptIds) => {
  const weekStart = getWeekStartDate(dateStr);
  const weekEnd = getWeekEndDate(weekStart);
  
  // Finn alle skift for denne ansatte i denne uken (man–søn), uten Fri/Ferie
  const weekShifts = allShifts.filter(shift => 
    shift.employeeId === employeeId && 
    shift.date >= weekStart &&
    shift.date <= weekEnd &&
    !isDayOffShift(shift, dayOffDeptIds)
  );
  
  const workDays = weekShifts.length;
  
  return workDays < 5;
};

// Regel 2: Sjekk max 2 søndager/helligdager på rad
const checkMax2SpecialDaysInRow = (employeeId, dateStr, allShifts, holidays) => {
  // Inkluder det nye skiftet i listen
  const allShiftsWithNew = [...allShifts, { employeeId, date: dateStr }];
  
  // Finn alle skift for denne ansatte, sortert på dato
  const employeeShifts = allShiftsWithNew
    .filter(shift => shift.employeeId === employeeId)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Finn alle påfølgende spesialdager med skift
  let maxConsecutive = 0;
  let currentStreak = 1; // Start with 1 for the current shift
  
  for (let i = 1; i < employeeShifts.length; i++) {
    const prevShiftDate = new Date(employeeShifts[i-1].date + 'T00:00:00');
    const currentShiftDate = new Date(employeeShifts[i].date + 'T00:00:00');
    
    // Sjekk om dagene er påfølgende (1 dag mellom)
    const daysDiff = (currentShiftDate - prevShiftDate) / (1000 * 60 * 60 * 24);
    
    const prevIsSpecial = isSpecialDay(employeeShifts[i-1].date, holidays);
    const currentIsSpecial = isSpecialDay(employeeShifts[i].date, holidays);
    
    if (daysDiff === 1 && prevIsSpecial && currentIsSpecial) {
      currentStreak++;
      maxConsecutive = Math.max(maxConsecutive, currentStreak);
    } else {
      currentStreak = 1;
    }
  }
  
  // Varning vid 3 eller fler på rad (tillåt men varna)
  // Returner true om det är OK (< 3), false om det är 3 eller fler
  return maxConsecutive < 3;
};

// Regel 3: Sjekk minst 1 fridag per uke
const checkMin1DayOffPerWeek = (employeeId, dateStr, allShifts) => {
  const weekStart = getWeekStartDate(dateStr);
  const weekEnd = getWeekEndDate(weekStart);
  
  // Finn alle skift for denne ansatte i denne uken
  const weekShifts = allShifts.filter(shift => 
    shift.employeeId === employeeId && 
    shift.date >= weekStart &&
    shift.date <= weekEnd
  );
  
  // Hvis det allerede er 7 skift i uken, er det ingen fridag
  if (weekShifts.length >= 7) {
    return false;
  }
  
  // Hvis vi legger til dette skiftet, vil det bli for mange?
  // Vi teller antall dager med skift i uken INKLUDERT det nye skiftet
  const totalShiftsInWeek = weekShifts.length + 1; // +1 for det nye skiftet
  
  return totalShiftsInWeek < 7;
};

// Hovedfunksjon for validering
// departments brukes for å kjenne igjen Fri/Ferie-avdelinger; newDeptId er avdelingen til vakten som skal legges til
// (en Fri/Ferie-vakt gir aldri arbeidslov-varsler, og teller ikke som arbeidsdag)
export const validateShift = (employeeId, dateStr, allShifts, holidays, departments = [], newDeptId = null) => {
  const dayOffDeptIds = dayOffDeptIdsFrom(departments);

  // Fri/Ferie-vakter skal ikke gi varsler om «for mange dager»
  if (newDeptId != null && isDayOffShift({ departmentId: newDeptId }, dayOffDeptIds)) {
    return { isValid: true, errors: [] };
  }

  const errors = [];

  // Regel 1: Max 5 dager per uke
  if (!checkMax5DaysPerWeek(employeeId, dateStr, allShifts, holidays, dayOffDeptIds)) {
    errors.push('Maksimum 5 arbeidsdager per uke (norsk arbeidslov)');
  }

  // Regel 2: Ikke mer enn 2 søndager/helligdager på rad
  if (!checkMax2SpecialDaysInRow(employeeId, dateStr, allShifts, holidays)) {
    errors.push('Maksimum 2 søndager/helligdager på rad');
  }

  // Regel 3: Minst 1 fridag per uke
  if (!checkMin1DayOffPerWeek(employeeId, dateStr, allShifts)) {
    errors.push('Minst 1 fridag per uke kreves');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// ===== FELSØK: scan alle eksisterende vakter og returner brudd + forslag =====
// holidays kan være array av dato-strenger eller objekt (map)
export const auditShifts = (employees = [], shifts = [], departments = [], holidays = {}) => {
  const dayOffDeptIds = dayOffDeptIdsFrom(departments);
  const holidayArr = Array.isArray(holidays) ? holidays : Object.keys(holidays || {});
  const holidaySet = new Set(holidayArr);
  const empName = new Map((employees || []).map(e => [String(e.id), e.name || e.id]));
  const isSpecial = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.getDay() === 0 || holidaySet.has(dateStr);
  };

  // Kun faktiske arbeidsvakter (ikke Fri/Ferie)
  const workShifts = (shifts || []).filter(s => s.date && !isDayOffShift(s, dayOffDeptIds));
  const byEmp = new Map();
  for (const s of workShifts) {
    const k = String(s.employeeId);
    if (!byEmp.has(k)) byEmp.set(k, []);
    byEmp.get(k).push(s);
  }

  const issues = [];
  for (const [empId, empShifts] of byEmp) {
    const name = empName.get(empId) || empId;

    // Regel 1 + 3: per uke (man–søn)
    const byWeek = new Map();
    for (const s of empShifts) {
      const wk = getWeekStartDate(s.date);
      if (!byWeek.has(wk)) byWeek.set(wk, []);
      byWeek.get(wk).push(s);
    }
    for (const [wk, weekShifts] of byWeek) {
      const sorted = weekShifts.slice().sort((a, b) => a.date.localeCompare(b.date));
      if (sorted.length > 5) {
        issues.push({
          type: 'max5days',
          employeeId: empId,
          employeeName: name,
          shiftIds: sorted.map(s => s.id).filter(Boolean),
          dates: sorted.map(s => s.date),
          message: `${name}: ${sorted.length} arbeidsdager i uken fra ${wk} (maks 5 tillatt)`,
          suggestion: `Fjern eller flytt ${sorted.length - 5} vakt(er) — f.eks. ${sorted.slice(5).map(s => s.date).join(', ')}`
        });
      }
      if (sorted.length >= 7) {
        issues.push({
          type: 'noDayOff',
          employeeId: empId,
          employeeName: name,
          shiftIds: sorted.map(s => s.id).filter(Boolean),
          dates: sorted.map(s => s.date),
          message: `${name}: ingen fridag i uken fra ${wk} (7 arbeidsdager)`,
          suggestion: `Fjern eller flytt minst én vakt — f.eks. ${sorted[sorted.length - 1].date}`
        });
      }
    }

    // Regel 2: 3+ søndager/helligdager på rad (sammenhengende kalenderdager med vakt)
    const specialShifts = empShifts.filter(s => isSpecial(s.date)).sort((a, b) => a.date.localeCompare(b.date));
    let run = [];
    const flushRun = () => {
      if (run.length >= 3) {
        issues.push({
          type: 'specialStreak',
          employeeId: empId,
          employeeName: name,
          shiftIds: run.map(s => s.id).filter(Boolean),
          dates: run.map(s => s.date),
          message: `${name}: ${run.length} søndager/helligdager på rad (${run[0].date} – ${run[run.length - 1].date})`,
          suggestion: `Fjern eller flytt vakt ${run[run.length - 1].date} for å bryte rekken`
        });
      }
      run = [];
    };
    for (let i = 0; i < specialShifts.length; i++) {
      if (i > 0) {
        const prev = new Date(specialShifts[i - 1].date + 'T00:00:00');
        const cur = new Date(specialShifts[i].date + 'T00:00:00');
        if ((cur - prev) / 86400000 !== 1) flushRun();
      }
      run.push(specialShifts[i]);
    }
    flushRun();
  }

  return issues;
};

// ===== FELSØK: dagar som inte är fullt bemannade (Skiutleie Vest/Øst) =====
// needsByDate: Map(dateStr -> { st?: { need, actual }, 'øst'?: { need, actual } })
// categoryOf: (employee) => kategori-sträng (t.ex. 'Skiutleie Vest')
export const auditUnderstaffedDays = ({
  dates = [],
  employees = [],
  shifts = [],
  departments = [],
  needsByDate = new Map(),
  categoryOf = (e) => e.category || null,
  locationCategories = { st: ['Skiutleie Vest'], 'øst': ['Skiutleie Øst'] }
}) => {
  const dayOffDeptIds = dayOffDeptIdsFrom(departments);
  // Opptatt denna dag (alla avdelningar) + arbetsdagar per vecka (man–søn, ej Fri/Ferie)
  const busyByEmp = new Map();
  const workDaysByEmpWeek = new Map();
  for (const s of shifts || []) {
    if (!s.date) continue;
    if (!busyByEmp.has(String(s.employeeId))) busyByEmp.set(String(s.employeeId), new Set());
    busyByEmp.get(String(s.employeeId)).add(s.date);
    if (isDayOffShift(s, dayOffDeptIds)) continue;
    const wk = getWeekStartDate(s.date);
    workDaysByEmpWeek.set(`${s.employeeId}_${wk}`, (workDaysByEmpWeek.get(`${s.employeeId}_${wk}`) || 0) + 1);
  }

  const issues = [];
  for (const dateStr of dates) {
    const needs = needsByDate.get(dateStr);
    if (!needs) continue;
    const wk = getWeekStartDate(dateStr);
    for (const loc of ['st', 'øst']) {
      const n = needs[loc];
      if (!n || n.need == null) continue;
      const actual = n.actual || 0;
      const missing = n.need - actual;
      if (missing <= 0) continue;
      const locName = loc === 'st' ? 'Vest' : 'Øst';
      // Kandidater: skiutleie-ansatte för denna plats som är LEDIGA denna dag
      // och inte redan nått 5 arbetsdagar denna vecka — sortera på minst
      // arbetade dagar först, sedan högst kontraktsprocent.
      const cats = locationCategories[loc] || [];
      const candidates = (employees || [])
        .filter(e => {
          if (!e || e.isAdmin || e.category === 'Admin') return false;
          if (!cats.includes(categoryOf(e))) return false;
          if ((busyByEmp.get(String(e.id)) || new Set()).has(dateStr)) return false;
          if ((workDaysByEmpWeek.get(`${e.id}_${wk}`) || 0) >= 5) return false;
          return true;
        })
        .sort((a, b) => {
          const wa = workDaysByEmpWeek.get(`${a.id}_${wk}`) || 0;
          const wb = workDaysByEmpWeek.get(`${b.id}_${wk}`) || 0;
          if (wa !== wb) return wa - wb;
          return (Number(b.contractPercent) || 100) - (Number(a.contractPercent) || 100);
        });
      const suggested = candidates.slice(0, missing)
        .map(c => `${c.name || c.id} (${workDaysByEmpWeek.get(`${c.id}_${wk}`) || 0} dager denne uken, ${Number(c.contractPercent) || 100} %)`)
        .join(', ');
      issues.push({
        type: 'understaffed',
        date: dateStr,
        location: loc,
        actual,
        need: n.need,
        missing,
        shiftIds: [],
        dates: [dateStr],
        message: `${dateStr} Skiutleie ${locName}: ${actual} av ${n.need} på jobb — ${missing} vakt${missing > 1 ? 'er' : ''} mangler`,
        suggestion: suggested
          ? `Forslag: legg til vakt 08:45–16:00 for ${suggested}` +
            (candidates.length < missing ? ` (kun ${candidates.length} ledig${candidates.length === 1 ? '' : 'e'} — resten må flyttes eller dekkes av ekstra)` : '')
          : 'Ingen ledige skiutleie-ansatte denne dagen — vurder å flytte vakt fra en annen dag eller bruke ekstra'
      });
    }
  }
  issues.sort((a, b) => a.date.localeCompare(b.date) || a.location.localeCompare(b.location));
  return issues;
};

// Hook for bruk i komponenter
export const useWorkLawValidation = (shifts, holidays, departments = []) => {
  const validate = (employeeId, dateStr, newDeptId = null) => {
    return validateShift(employeeId, dateStr, shifts, holidays, departments, newDeptId);
  };
  return { validate };
};

export default useWorkLawValidation;