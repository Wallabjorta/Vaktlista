/**
 * Norsk arbeidslov validering:
 * - Max 5 arbeidsdager per uke per ansatt
 * - Ikke mer enn 2 søndager/helligdager på rad
 * - Minst 1 fridag per uke (24 timer sammenhengende hvile)
 */

// Hjelpefunksjon for å få ukenummer fra dato
const getWeekStartDate = (dateStr) => {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - daysToSubtract);
  return weekStart.toISOString().split('T')[0];
};

// Hjelpefunksjon for å sjekke om en dato er søndag eller helligdag
const isSpecialDay = (dateStr, holidays) => {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay();
  const isSunday = dayOfWeek === 0;
  const isHoliday = holidays && holidays[dateStr];
  return isSunday || isHoliday;
};

// Regel 1: Sjekk max 5 arbeidsdager per uke
const checkMax5DaysPerWeek = (employeeId, dateStr, allShifts, holidays) => {
  const weekStart = getWeekStartDate(dateStr);
  
  // Finn alle skift for denne ansatte i denne uken
  const weekShifts = allShifts.filter(shift => 
    shift.employeeId === employeeId && 
    shift.date >= weekStart &&
    shift.date <= new Date(new Date(weekStart).setDate(new Date(weekStart).getDate() + 6)).toISOString().split('T')[0]
  );
  
  // Tell arbeidsdager (ekskluder helger som ikke er skift)
  const workDays = weekShifts.length;
  
  return workDays < 5;
};

// Regel 2: Sjekk max 2 søndager/helligdager på rad
const checkMax2SpecialDaysInRow = (employeeId, dateStr, allShifts, holidays) => {
  const date = new Date(dateStr + 'T00:00:00');
  
  // Finn alle skift for denne ansatte, sortert på dato
  const employeeShifts = allShifts
    .filter(shift => shift.employeeId === employeeId)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Sjekk de siste 2 dagene før dette skiftet
  const consecutiveSpecialDays = [];
  
  // Gå tilbake i tid for å finne påfølgende spesielle dager
  let currentDate = new Date(date);
  let count = 0;
  
  // Sjekk dagen før
  for (let i = 1; i <= 2; i++) {
    const prevDate = new Date(currentDate);
    prevDate.setDate(currentDate.getDate() - i);
    const prevDateStr = prevDate.toISOString().split('T')[0];
    
    // Sjekk om forrige dag var en spesialdag med skift
    const hasShift = employeeShifts.some(shift => shift.date === prevDateStr);
    const isSpecial = isSpecialDay(prevDateStr, holidays);
    
    if (hasShift && isSpecial) {
      count++;
    } else {
      break;
    }
  }
  
  // Sjekk om dette er en spesialdag
  const isCurrentSpecial = isSpecialDay(dateStr, holidays);
  
  // Hvis dette er en spesialdag, tell med
  if (isCurrentSpecial) {
    count++;
  }
  
  return count <= 2;
};

// Regel 3: Sjekk minst 1 fridag per uke
const checkMin1DayOffPerWeek = (employeeId, dateStr, allShifts) => {
  const weekStart = getWeekStartDate(dateStr);
  const weekEnd = new Date(new Date(weekStart).setDate(new Date(weekStart).getDate() + 6)).toISOString().split('T')[0];
  
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
export const validateShift = (employeeId, dateStr, allShifts, holidays) => {
  const errors = [];

  // Regel 1: Max 5 dager per uke
  if (!checkMax5DaysPerWeek(employeeId, dateStr, allShifts, holidays)) {
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
export const useWorkLawValidation = (shifts, holidays) => {
  const validate = (employeeId, dateStr) => {
    return validateShift(employeeId, dateStr, shifts, holidays);
  };
  return { validate };
};

export default useWorkLawValidation;