import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const db = () => getFirestore();

const BACKUP_COLLECTIONS = [
  'shifts',
  'employees',
  'departments',
  'users',
  'leaveRequests',
  'swapRequests',
  'notifications',
  'auditLogs'
];

const csvEscape = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes('"') || str.includes(';') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const toCsv = (rows) => {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(';')];
  for (const row of rows) {
    lines.push(headers.map(h => csvEscape(row[h])).join(';'));
  }
  return lines.join('\r\n');
};

const jsonReplacer = (key, value) => {
  if (value instanceof Timestamp) {
    return { __type: 'timestamp', value: value.toDate().toISOString() };
  }
  return value;
};

const runBackup = async () => {
  const firestore = db();
  const bucket = getStorage().bucket();
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const base = `backups/${dateStr}`;

  let totalDocs = 0;
  const files = [];

  for (const collectionName of BACKUP_COLLECTIONS) {
    const snapshot = await firestore.collection(collectionName).get();
    const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    totalDocs += docs.length;

    const jsonContent = JSON.stringify(docs, jsonReplacer, 2);
    const jsonFile = bucket.file(`${base}/${collectionName}.json`);
    await jsonFile.save(jsonContent, {
      contentType: 'application/json; charset=utf-8',
      metadata: { backupDate: dateStr }
    });
    files.push(`${base}/${collectionName}.json`);
    logger.info(`Backup: ${collectionName} (${docs.length} dokumenter)`);
  }

  const shiftsSnapshot = await firestore.collection('shifts').get();
  const employeesSnapshot = await firestore.collection('employees').get();
  const departmentsSnapshot = await firestore.collection('departments').get();

  const employees = employeesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  const departments = departmentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  const shiftRows = shiftsSnapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .map(s => ({
      Dato: s.date || '',
      Ansatt: employees.find(e => e.id === s.employeeId)?.name || s.employeeId || '',
      Avdeling: departments.find(dep => dep.id === s.departmentId)?.name || s.departmentId || '',
      Start: s.startTime || '',
      Slutt: s.endTime || '',
      VaktID: s.id
    }))
    .sort((a, b) => String(a.Dato).localeCompare(String(b.Dato)) || String(a.Ansatt).localeCompare(String(b.Ansatt)));

  const csvContent = '\uFEFF' + toCsv(shiftRows);
  const csvFile = bucket.file(`${base}/vaktliste-${dateStr}.csv`);
  await csvFile.save(csvContent, {
    contentType: 'text/csv; charset=utf-8',
    metadata: { backupDate: dateStr }
  });
  files.push(`${base}/vaktlista-${dateStr}.csv`);

  const backupDoc = {
    date: dateStr,
    createdAt: Timestamp.now(),
    totalDocuments: totalDocs,
    shiftCount: shiftRows.length,
    files
  };
  await firestore.collection('backups').doc(dateStr).set(backupDoc);
  await firestore.collection('auditLogs').add({
    action: 'system-backup',
    details: `Automatisk backup: ${totalDocs} dokumenter, ${files.length} filer`,
    timestamp: Timestamp.now()
  });

  logger.info(`Backup fullført: ${totalDocs} dokumenter, ${files.length} filer`);
  return backupDoc;
};

const cleanupOldBackups = async () => {
  const bucket = getStorage().bucket();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const [files] = await bucket.getFiles({ prefix: 'backups/' });
  let deleted = 0;
  for (const file of files) {
    const [meta] = await file.getMetadata();
    const timeCreated = new Date(meta.timeCreated);
    if (timeCreated < cutoff) {
      await file.delete();
      deleted++;
    }
  }
  if (deleted > 0) {
    logger.info(`Slettet ${deleted} backup-filer eldre enn 90 dager`);
  }
};

// Nattlig backup kl 03:00 (Europe/Oslo) av alle samlinger til Firebase Storage.
// Lager både JSON (for eksakt gjenoppretting) og CSV (lesbar i Excel).
export const nightlyBackup = onSchedule(
  {
    region: 'us-central1',
    schedule: '0 3 * * *',
    timeZone: 'Europe/Oslo'
  },
  async () => {
    await runBackup();
    await cleanupOldBackups();
  }
);

// Manuell backup via HTTP. Krever X-Backup-Token-header som må matche
// miljøvariabelen BACKUP_TOKEN (settes via firebase functions:config eller
// deploy-hemlighet), slik at endpointen ikke er offentlig misbrukbar.
export const backupNow = onRequest(
  {
    region: 'us-central1',
    secrets: ['BACKUP_TOKEN'],
    cors: {
      origin: '*',
      methods: ['GET', 'OPTIONS'],
      maxAge: 86400,
      allowHeaders: ['Content-Type', 'Origin', 'X-Backup-Token']
    }
  },
  async (req, res) => {
    const expectedToken = process.env.BACKUP_TOKEN;
    if (!expectedToken) {
      logger.error('BACKUP_TOKEN er ikke konfigurert');
      return res.status(503).send('Backup er ikke konfigurert');
    }
    if (req.get('X-Backup-Token') !== expectedToken) {
      return res.status(401).send('Ugyldig token');
    }
    try {
      const result = await runBackup();
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      logger.error('Error running backup:', error);
      res.status(500).send('Error running backup: ' + error.message);
    }
  }
);
