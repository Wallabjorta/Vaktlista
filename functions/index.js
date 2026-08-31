import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
initializeApp();

const db = getFirestore();

const DEFAULT_DEPARTMENTS = [
  { id: "dept-1", name: "Vest", color: "#3B82F6" },
  { id: "dept-2", name: "\u00d8st", color: "#10B981" },
  { id: "dept-3", name: "Skiskole", color: "#F59E0B" },
  { id: "dept-4", name: "Butikk", color: "#EF4444" },
  { id: "dept-5", name: "Skolegrupper", color: "#8B5CF6" },
  { id: "dept-6", name: "Fri", color: "#6B7280" }
];

const formatICalDate = (dateStr, timeStr) => {
  const date = new Date(`${dateStr}T${timeStr}`);
  const pad = (n) => n.toString().padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00Z`;
};

const escapeICal = (str) => {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
};

const generateICalContent = async (employeeId = null) => {
  const shiftsSnapshot = await db.collection('shifts').get();
  const employeesSnapshot = await db.collection('employees').get();
  const departmentsSnapshot = await db.collection('departments').get();

  const shifts = shiftsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const employees = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const departments = departmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const allDepartments = departments.length > 0 ? departments : DEFAULT_DEPARTMENTS;

  // Filter shifts by employeeId (using Firebase doc.id)
  const filteredShifts = employeeId 
    ? shifts.filter(shift => shift.employeeId === employeeId)
    : shifts;

  const employee = employeeId 
    ? employees.find(e => e.id === employeeId)
    : null;

  const calName = employeeId 
    ? `Vaktlista - ${employee?.name || 'Ukjent'}`
    : 'Vaktlista - Alle ansatte';

  let icalContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID://Vaktlista//NO
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${escapeICal(calName)}
X-WR-TIMEZONE:Europe/Oslo
`;

  filteredShifts.forEach(shift => {
    const emp = employees.find(e => e.id === shift.employeeId);
    const dept = allDepartments.find(d => d.id === shift.departmentId);

    if (!emp || !dept) return;

    const startDate = formatICalDate(shift.date, shift.startTime);
    const endDate = formatICalDate(shift.date, shift.endTime);
    const summary = `${emp.name} - ${dept.name}`;
    const description = `Vakt: ${dept.name}\nAnsatt: ${emp.name}\nStart: ${shift.startTime}\nSlutt: ${shift.endTime}`;

    icalContent += `BEGIN:VEVENT
UID:${shift.id}@vaktlista
DTSTART:${startDate}
DTEND:${endDate}
SUMMARY:${escapeICal(summary)}
DESCRIPTION:${escapeICal(description)}
LOCATION:${escapeICal(dept.name)}
STATUS:CONFIRMED
TRANSP:OPAQUE
END:VEVENT
`;
  });

  icalContent += `END:VCALENDAR`;
  return icalContent;
};

// Main iCal endpoint (alle vakter)
export const ical = onRequest(async (req, res) => {
  try {
    logger.info('Generating iCal file for all employees...');
    const icalContent = await generateICalContent();
    
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="vaktlista.ics"');
    res.status(200).send(icalContent);
  } catch (error) {
    logger.error('Error generating iCal:', error);
    res.status(500).send('Error generating iCal: ' + error.message);
  }
});

// Person-spesifikk iCal endpoint
export const icalEmployee = onRequest(async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    if (!employeeId) {
      return res.status(400).send('Employee ID is required');
    }
    
    logger.info(`Generating iCal file for employee ${employeeId}...`);
    const icalContent = await generateICalContent(employeeId);
    
    const employeesSnapshot = await db.collection('employees').get();
    const employees = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const employee = employees.find(e => e.id === employeeId);
    const filename = employee 
      ? `vaktlista-${employee.name.replace(/\s+/g, '-').toLowerCase()}.ics`
      : `vaktlista-${employeeId}.ics`;
    
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.status(200).send(icalContent);
  } catch (error) {
    logger.error('Error generating employee iCal:', error);
    res.status(500).send('Error generating iCal: ' + error.message);
  }
});
