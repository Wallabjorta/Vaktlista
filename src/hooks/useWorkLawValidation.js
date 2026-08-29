/**
 * Norsk arbeidslov validering:
 * - Max 5 arbeidsdager per uke per ansatt
 * - Ikke mer enn 2 søndager/helligdager på rad
 * - Minst 1 fridag per uke (24 timer sammenhengende hvile)
 */

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