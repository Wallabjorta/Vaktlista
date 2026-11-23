import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Engångsfunktion: tar bort dubletter i shifts- och employees-samlingarna.
// Dubletter uppstod när localStorage-migreringen skapade dokument med addDoc
// (auto-ID) samtidigt som samma data senare migrerades med ursprungligt id.
// Behåller det äldsta dokumentet per nyckel och tar bort de övriga.
// Skyddad med X-Backup-Token, samma hemlighet som backupen. Stödjer dryRun.
const dedupe = (docs, keyFn) => {
  const seen = new Map();
  const toDelete = [];
  for (const d of docs) {
    const key = keyFn(d);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, d);
    } else if (d.createdAt < existing.createdAt) {
      toDelete.push(existing);
      seen.set(key, d);
    } else {
      toDelete.push(d);
    }
  }
  return toDelete;
};

export const dedupShifts = onRequest(
  {
    region: 'us-central1',
    secrets: ['BACKUP_TOKEN'],
    cors: {
      origin: '*',
      methods: ['POST', 'OPTIONS'],
      maxAge: 86400,
      allowHeaders: ['Content-Type', 'Origin', 'X-Backup-Token']
    }
  },
  async (req, res) => {
    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }
    const expectedToken = process.env.BACKUP_TOKEN;
    if (!expectedToken) {
      logger.error('BACKUP_TOKEN är inte konfigurerad');
      return res.status(503).send('Rensning är inte konfigurerad');
    }
    if (req.get('X-Backup-Token') !== expectedToken) {
      return res.status(401).send('Ogiltig token');
    }
    if (req.method !== 'POST') {
      return res.status(405).send('Använd POST');
    }

    const dryRun = req.query.dryRun === '1' || req.body?.dryRun === true;
    const firestore = getFirestore();

    const shiftsSnapshot = await firestore.collection('shifts').get();
    const shiftDocs = shiftsSnapshot.docs.map(d => ({
      ref: d.ref,
      createdAt: d.createTime?.toMillis() ?? 0,
      employeeId: d.data().employeeId,
      date: d.data().date,
      startTime: d.data().startTime,
      endTime: d.data().endTime
    }));
    const shiftsToDelete = dedupe(
      shiftDocs,
      d => `${d.employeeId}|${d.date}|${d.startTime}|${d.endTime}`
    );

    const employeesSnapshot = await firestore.collection('employees').get();
    const employeeDocs = employeesSnapshot.docs.map(d => ({
      ref: d.ref,
      createdAt: d.createTime?.toMillis() ?? 0,
      name: String(d.data().name || '').trim(),
      email: String(d.data().email || '').trim().toLowerCase()
    }));
    const employeesToDelete = dedupe(
      employeeDocs,
      d => d.email ? `email:${d.email}` : `name:${d.name}`
    );

    if (dryRun) {
      return res.status(200).json({
        dryRun: true,
        shifts: { total: shiftDocs.length, duplicates: shiftsToDelete.length },
        employees: { total: employeeDocs.length, duplicates: employeesToDelete.length },
        wouldDelete: {
          shifts: shiftsToDelete.map(d => d.ref.id),
          employees: employeesToDelete.map(d => d.ref.id)
        }
      });
    }

    let deleted = 0;
    const batch = firestore.batch();
    for (const d of [...shiftsToDelete, ...employeesToDelete]) {
      batch.delete(d.ref);
      deleted++;
    }
    if (deleted > 0) {
      await batch.commit();
    }

    await firestore.collection('auditLogs').add({
      action: 'dedup-shifts-employees',
      details: `Tog bort ${shiftsToDelete.length} dublett-vakter och ${employeesToDelete.length} dublett-anställda`,
      timestamp: Timestamp.now()
    });

    logger.info(
      `Tog bort ${shiftsToDelete.length} dublett-vakter av ${shiftDocs.length}, ` +
      `${employeesToDelete.length} dublett-anställda av ${employeeDocs.length}`
    );
    return res.status(200).json({
      shifts: { total: shiftDocs.length, deleted: shiftsToDelete.length },
      employees: { total: employeeDocs.length, deleted: employeesToDelete.length }
    });
  }
);
