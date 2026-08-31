/**
 * Generates iCal content from shifts data
 * @param {Array} shifts - Array of shift objects
 * @param {Array} employees - Array of employee objects
 * @param {Array} departments - Array of department objects
 * @returns {string} iCal content as string
 */
export function generateICal(shifts, employees, departments) {
  // Default departments if not provided
  const DEFAULT_DEPARTMENTS = [
    { id: "dept-1", name: "Vest", color: "#3B82F6" },
    { id: "dept-2", name: "\u00d8st", color: "#10B981" },
    { id: "dept-3", name: "Skiskole", color: "#F59E0B" },
    { id: "dept-4", name: "Butikk", color: "#EF4444" },
    { id: "dept-5", name: "Skolegrupper", color: "#8B5CF6" },
    { id: "dept-6", name: "Fri", color: "#6B7280" }
  ];

  const allDepartments = departments?.length > 0 ? departments : DEFAULT_DEPARTMENTS;

  // Format date for iCal (UTC)
  const formatICalDate = (dateStr, timeStr) => {
    const date = new Date(`${dateStr}T${timeStr}`);
    const pad = (n) => n.toString().padStart(2, '0');
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00Z`;
  };

  // Escape special characters for iCal
  const escapeICal = (str) => {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  };

  let icalContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID://Vaktlista//NO
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Vaktlista - Alle ansatte
X-WR-TIMEZONE:Europe/Oslo
`;

  shifts.forEach(shift => {
    const employee = employees?.find(e => e.id === shift.employeeId);
    const dept = allDepartments.find(d => d.id === shift.departmentId);
    
    if (!employee || !dept) return;
    
    const startDate = formatICalDate(shift.date, shift.startTime);
    const endDate = formatICalDate(shift.date, shift.endTime);
    const summary = escapeICal(`${employee.name} - ${dept.name}`);
    const description = escapeICal(`Vakt: ${dept.name}\nAnsatt: ${employee.name}\nStart: ${shift.startTime}\nSlutt: ${shift.endTime}`);

    icalContent += `BEGIN:VEVENT
UID:${shift.id}@vaktlista
DTSTART:${startDate}
DTEND:${endDate}
SUMMARY:${summary}
DESCRIPTION:${description}
LOCATION:${escapeICal(dept.name)}
STATUS:CONFIRMED
TRANSP:OPAQUE
END:VEVENT
`;
  });

  icalContent += `END:VCALENDAR`;

  return icalContent;
}

/**
 * Triggers download of iCal file
 * @param {string} icalContent - iCal content
 * @param {string} filename - Filename without extension
 */
export function downloadICal(icalContent, filename = 'vaktlista') {
  const blob = new Blob([icalContent], { type: 'text/calendar; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
