import express from 'express';
import cors from 'cors';
import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ============ KONFIGURASJON ============
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = 29115;

// Avdelinger
const DEPARTMENTS = [
  { id: "dept-1", name: "Vakt Vest", color: "#3B82F6" },
  { id: "dept-2", name: "Vakt Øst", color: "#10B981" },
  { id: "dept-3", name: "Vaktskole", color: "#F59E0B" },
  { id: "dept-4", name: "Butikk", color: "#EF4444" }
];

// CORS - Tillater alle lokalhost-porter
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Filstier
const dataDir = join(__dirname, 'data');
const employeesPath = join(dataDir, 'employees.json');
const shiftsPath = join(dataDir, 'shifts.json');
const notificationsPath = join(dataDir, 'notifications.json');
const turnoverPath = join(dataDir, 'turnover.json');

// ============ DATA-INITIALISERING ============
async function initializeData() {
  try {
    await import('fs').then(fs => fs.promises.mkdir(dataDir, { recursive: true }));

    const defaultEmployees = [
      { id: "1", name: "Ola Nordmann", deptIds: ["dept-1"], email: "ola@test.no", phone: "+47 123 45 678", isAdmin: false },
      { id: "2", name: "Kari Peterson", deptIds: ["dept-1", "dept-2"], email: "kari@test.no", phone: "+47 234 56 789", isAdmin: false },
      { id: "3", name: "Per Hansen", deptIds: ["dept-3"], email: "per@test.no", phone: "+47 345 67 890", isAdmin: false },
      { id: "4", name: "Admin Adminsson", deptIds: ["dept-1", "dept-2", "dept-3", "dept-4"], email: "admin@test.no", phone: "+47 987 65 432", isAdmin: true }
    ];

    try { await readFile(employeesPath); } catch { await writeFile(employeesPath, JSON.stringify(defaultEmployees, null, 2)); }
    try { await readFile(shiftsPath); } catch { await writeFile(shiftsPath, JSON.stringify([], null, 2)); }
    try { await readFile(notificationsPath); } catch { await writeFile(notificationsPath, JSON.stringify([], null, 2)); }
    try { await readFile(turnoverPath); } catch { await writeFile(turnoverPath, JSON.stringify({}, null, 2)); }

    console.log('✅ Server data initialisert');
  } catch (error) {
    console.error('❌ Feil ved initialisering:', error);
  }
}

// ============ HJELPEFUNKSJONER ============
async function readData(filePath) {
  try {
    const data = await readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Feil ved lesing av ${filePath}:`, error);
    return [];
  }
}

async function writeData(filePath, data) {
  try {
    await writeFile(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Feil ved skriving til ${filePath}:`, error);
    return false;
  }
}

// ============ API ENDPOINTS ============

// Hent alle ansatte
app.get('/api/employees', async (req, res) => {
  try {
    const employees = await readData(employeesPath);
    res.json(employees);
  } catch (error) {
    console.error('Feil i GET /api/employees:', error);
    res.status(500).json({ error: 'Kunne ikke laste ansatte', details: error.message });
  }
});

// Hent alle vakter
app.get('/api/shifts', async (req, res) => {
  try {
    const shifts = await readData(shiftsPath);
    res.json(shifts);
  } catch (error) {
    console.error('Feil i GET /api/shifts:', error);
    res.status(500).json({ error: 'Kunne ikke laste vakter', details: error.message });
  }
});

// Hent varsler for en bruker
app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const notifications = await readData(notificationsPath);
    const userNotifications = notifications.filter(n => n.userId === req.params.userId);
    res.json(userNotifications);
  } catch (error) {
    console.error('Feil i GET /api/notifications:', error);
    res.status(500).json({ error: 'Kunne ikke laste varsler', details: error.message });
  }
});

// Hent omsetningsdata
app.get('/api/turnover', async (req, res) => {
  try {
    const turnover = await readData(turnoverPath);
    res.json(turnover);
  } catch (error) {
    console.error('Feil i GET /api/turnover:', error);
    res.status(500).json({ error: 'Kunne ikke laste omsetningsdata', details: error.message });
  }
});

// Opprett ny vakt
app.post('/api/shifts', async (req, res) => {
  try {
    const shifts = await readData(shiftsPath);
    const newShift = {
      ...req.body,
      id: req.body.id || Date.now().toString(),
      breaks: req.body.breaks || []
    };
    shifts.push(newShift);
    await writeData(shiftsPath, shifts);
    res.status(201).json(newShift);
  } catch (error) {
    console.error('Feil i POST /api/shifts:', error);
    res.status(500).json({ error: 'Kunne ikke opprette vakt', details: error.message });
  }
});

// Slett en vakt
app.delete('/api/shifts/:id', async (req, res) => {
  try {
    const shifts = await readData(shiftsPath);
    const filteredShifts = shifts.filter(shift => shift.id !== req.params.id);
    await writeData(shiftsPath, filteredShifts);
    res.status(200).json({ message: 'Vakt slettet' });
  } catch (error) {
    console.error('Feil i DELETE /api/shifts:', error);
    res.status(500).json({ error: 'Kunne ikke slette vakt', details: error.message });
  }
});

// Opprett ny ansatt
app.post('/api/employees', async (req, res) => {
  try {
    const employees = await readData(employeesPath);
    const newEmployee = {
      ...req.body,
      id: req.body.id || Date.now().toString()
    };
    employees.push(newEmployee);
    await writeData(employeesPath, employees);
    res.status(201).json(newEmployee);
  } catch (error) {
    console.error('Feil i POST /api/employees:', error);
    res.status(500).json({ error: 'Kunne ikke opprette ansatt', details: error.message });
  }
});

// Slett en ansatt
app.delete('/api/employees/:id', async (req, res) => {
  try {
    const employees = await readData(employeesPath);
    const filteredEmployees = employees.filter(emp => emp.id !== req.params.id);
    await writeData(employeesPath, filteredEmployees);
    res.status(200).json({ message: 'Ansatt slettet' });
  } catch (error) {
    console.error('Feil i DELETE /api/employees:', error);
    res.status(500).json({ error: 'Kunne ikke slette ansatt', details: error.message });
  }
});

// Synkroniser data
app.post('/api/sync', async (req, res) => {
  try {
    const { employees, shifts } = req.body;
    if (employees) await writeData(employeesPath, employees);
    if (shifts) await writeData(shiftsPath, shifts);
    res.status(200).json({ message: 'Data synkronisert' });
  } catch (error) {
    console.error('Feil i POST /api/sync:', error);
    res.status(500).json({ error: 'Kunne ikke synkronisere data', details: error.message });
  }
});

// ============ iCal-EKSPORT (ALLE VAKTER) ============
app.get('/api/export/ical', async (req, res) => {
  try {
    const shifts = await readData(shiftsPath);
    const employees = await readData(employeesPath);

    const formatICalDate = (dateStr, timeStr) => {
      const date = new Date(`${dateStr}T${timeStr}`);
      const pad = (n) => n.toString().padStart(2, '0');
      return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00Z`;
    };

    let icalContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID://Vaktlista//NO
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Vaktlista - Alle ansatte
X-WR-TIMEZONE:Europe/Oslo
REFRESH-INTERVAL;VALUE=DURATION:PT15M
`;

    shifts.forEach(shift => {
      const employee = employees.find(e => e.id === shift.employeeId);
      const dept = DEPARTMENTS.find(d => d.id === shift.departmentId);
      const startDate = formatICalDate(shift.date, shift.startTime);
      const endDate = formatICalDate(shift.date, shift.endTime);
      const summary = `${employee?.name || 'Ukjent'} - ${dept?.name || shift.departmentId}`;
      const description = `Vakt: ${dept?.name || shift.departmentId}\nAnsatt: ${employee?.name || 'Ukjent'}\nStart: ${shift.startTime}\nSlutt: ${shift.endTime}`;

      icalContent += `BEGIN:VEVENT
UID:${shift.id}@vaktlista
DTSTART:${startDate}
DTEND:${endDate}
SUMMARY:${summary}
DESCRIPTION:${description.replace(/\n/g, '\\n')}
LOCATION:${dept?.name || 'Ukjent avdeling'}
STATUS:CONFIRMED
TRANSP:OPAQUE
END:VEVENT
`;
    });

    icalContent += `END:VCALENDAR`;

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="vaktlista-alle.ics"');
    res.send(icalContent);
  } catch (error) {
    console.error('Feil i GET /api/export/ical:', error);
    res.status(500).json({ error: 'Kunne ikke generere iCal-fil', details: error.message });
  }
});

// ============ PERSONLIG iCal-FEED FOR HVER ANSATT ============
app.get('/api/export/ical/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const shifts = await readData(shiftsPath);
    const employees = await readData(employeesPath);

    const employeeShifts = shifts.filter(shift => shift.employeeId === employeeId);
    const employee = employees.find(e => e.id === employeeId);

    if (!employee) {
      return res.status(404).json({
        error: 'Ansatt ikke funnet',
        availableEmployees: employees.map(e => ({ id: e.id, name: e.name }))
      });
    }

    const formatICalDate = (dateStr, timeStr) => {
      const date = new Date(`${dateStr}T${timeStr}`);
      const pad = (n) => n.toString().padStart(2, '0');
      return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00Z`;
    };

    let icalContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID://Vaktlista//NO
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Vaktlista - ${employee.name.replace(/[^a-zA-Z0-9]/g, '')}
X-WR-TIMEZONE:Europe/Oslo
REFRESH-INTERVAL;VALUE=DURATION:PT15M
`;

    employeeShifts.forEach(shift => {
      const dept = DEPARTMENTS.find(d => d.id === shift.departmentId);
      const startDate = formatICalDate(shift.date, shift.startTime);
      const endDate = formatICalDate(shift.date, shift.endTime);
      const summary = `Vakt - ${dept?.name || shift.departmentId}`;
      const description = `Vakt: ${dept?.name || shift.departmentId}\nStart: ${shift.startTime}\nSlutt: ${shift.endTime}\nAvdeling: ${dept?.name || 'Ukjent'}`;

      icalContent += `BEGIN:VEVENT
UID:${shift.id}@vaktlista-${employeeId}
DTSTART:${startDate}
DTEND:${endDate}
SUMMARY:${summary}
DESCRIPTION:${description.replace(/\n/g, '\\n')}
LOCATION:${dept?.name || 'Ukjent avdeling'}
STATUS:CONFIRMED
TRANSP:OPAQUE
END:VEVENT
`;
    });

    icalContent += `END:VCALENDAR`;

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="vaktlista-${employee.name}.ics"`);
    res.send(icalContent);
  } catch (error) {
    console.error('Feil ved generering av personlig iCal:', error);
    res.status(500).json({
      error: 'Kunne ikke generere personlig iCal-fil',
      details: error.message
    });
  }
});

// ============ START SERVER ============
async function startServer() {
  await initializeData();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server kjører på http://localhost:${PORT}`);
    console.log('📡 Tilgjengelige API-endepunkter:');
    console.log('  GET  /api/employees             - Hent alle ansatte');
    console.log('  GET  /api/shifts                - Hent alle vakter');
    console.log('  GET  /api/export/ical           - Eksporter alle vakter til iCal');
    console.log('  GET  /api/export/ical/:id       - Eksporter en ansatts vakter til iCal');
    console.log('  POST /api/shifts                - Opprett ny vakt');
    console.log('  DELETE /api/shifts/:id         - Slett en vakt');
    console.log('  POST /api/employees             - Opprett ny ansatt');
    console.log('  DELETE /api/employees/:id       - Slett en ansatt');
    console.log('  POST /api/sync                  - Synkroniser data');
  });
}

startServer();