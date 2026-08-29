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
  // Inkluder det nye skiftet i listen
  const allShiftsWithNew = [...allShifts, { employeeId, date: dateStr }];
  
  // Finn alle skift for denne ansatte, sortert på dato
  const employeeShifts = allShiftsWithNew
    .filter(shift => shift.employeeId === employeeId)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Finn alle påfølgende spesialdager
  let maxConsecutive = 0;
  let currentStreak = 0;
  
  for (let i = 0; i < employeeShifts.length; i++) {
    const shiftDateStr = employeeShifts[i].date;
    const isSpecial = isSpecialDay(shiftDateStr, holidays);
    
    if (isSpecial) {
      currentStreak++;
      maxConsecutive = Math.max(maxConsecutive, currentStreak);
    } else {
      currentStreak = 0;
    }
  }
  
  // Varning vid 3 eller fler på rad (tillåt men varna)
  // Returner true om det är OK (< 3), false om det är 3 eller fler
  return maxConsecutive < 3;
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