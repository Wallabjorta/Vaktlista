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

// Hook for bruk i komponenter
export const useWorkLawValidation = (shifts, holidays, departments = []) => {
  const validate = (employeeId, dateStr, newDeptId = null) => {
    return validateShift(employeeId, dateStr, shifts, holidays, departments, newDeptId);
  };
  return { validate };
};

export default useWorkLawValidation;