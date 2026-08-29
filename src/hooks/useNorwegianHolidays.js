// Norske helligdager - statisk definisjon
// Basert på offisielle norske helligdager
// Alle datoer er i norsk lokal tid (Europe/Oslo)

const FIXED_HOLIDAYS = {
  '01-01': 'Nyttårsdag',
  '05-01': '1. mai',
  '05-17': 'Grunnlovsdag',
  '12-24': 'Juleaften',
  '12-25': '1. juledag',
  '12-26': '2. juledag'
};

const MOVABLE_HOLIDAYS = {
  2024: {
    '03-28': 'Skjærtorsdag',
    '03-29': 'Langfredag',
    '03-30': 'Påskeaften',
    '03-31': '1. påskedag',
    '04-01': '2. påskedag',
    '05-09': 'Kristi Himmelfartsdag',
    '05-19': '1. pinsedag',
    '05-20': '2. pinsedag'
  },
  2025: {
    '04-17': 'Skjærtorsdag',
    '04-18': 'Langfredag',
    '04-19': 'Påskeaften',
    '04-20': '1. påskedag',
    '04-21': '2. påskedag',
    '05-29': 'Kristi Himmelfartsdag',
    '06-08': '1. pinsedag',
    '06-09': '2. pinsedag'
  },
  2026: {
    '04-02': 'Skjærtorsdag',
    '04-03': 'Langfredag',
    '04-04': 'Påskeaften',
    '04-05': '1. påskedag',
    '04-06': '2. påskedag',
    '05-14': 'Kristi Himmelfartsdag',
    '05-24': '1. pinsedag',
    '05-25': '2. pinsedag'
  },
  2027: {
    '03-25': 'Skjærtorsdag',
    '03-26': 'Langfredag',
    '03-27': 'Påskeaften',
    '03-28': '1. påskedag',
    '03-29': '2. påskedag',
    '05-06': 'Kristi Himmelfartsdag',
    '05-16': '1. pinsedag',
    '05-17': '2. pinsedag'
  },
  2028: {
    '04-13': 'Skjærtorsdag',
    '04-14': 'Langfredag',
    '04-15': 'Påskeaften',
    '04-16': '1. påskedag',
    '04-17': '2. påskedag',
    '05-25': 'Kristi Himmelfartsdag',
    '06-04': '1. pinsedag',
    '06-05': '2. pinsedag'
  }
};

const generateNorwegianHolidays = (year) => {
  const holidays = {};
  for (const [monthDay, name] of Object.entries(FIXED_HOLIDAYS)) {
    const dateStr = `${year}-${monthDay}`;
    holidays[dateStr] = name;
  }
  if (MOVABLE_HOLIDAYS[year]) {
    for (const [monthDay, name] of Object.entries(MOVABLE_HOLIDAYS[year])) {
      const dateStr = `${year}-${monthDay}`;
      holidays[dateStr] = name;
    }
  }
  return holidays;
};

export const getNorwegianHolidays = (years = [2024, 2025, 2026, 2027, 2028]) => {
  const allHolidays = {};
  years.forEach(year => {
    const yearHolidays = generateNorwegianHolidays(year);
    Object.assign(allHolidays, yearHolidays);
  });
  return allHolidays;
};

export const useNorwegianHolidays = (years = [2024, 2025, 2026, 2027, 2028]) => {
  const holidays = getNorwegianHolidays(years);
  return { holidays };
};

export default useNorwegianHolidays;