import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore } from 'firebase-admin/firestore';

// Tar bort ALLE vakter i ett datumintervall (t.ex. allt som auto-utfyllning skapat),
// så man slipper klicka bort dem en och en.
// Skyddad med X-Backup-Token (samma hemlighet som backupen). Stödjer dryRun.
//
// Anrop (POST):
//   /deleteShiftsInRange?startDate=2026-11-01&endDate=2026-11-30&dryRun=1
//   valfritt: employeeId=... eller departmentId=... för att begränsa
// Svar: JSON { ok, dryRun, deleted, wouldDelete, sampleIds }
export const deleteShiftsInRange = onRequest(
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
      return res.status(503).send('Funktionen är inte konfigurerad');
    }
    if (req.get('X-Backup-Token') !== expectedToken) {
      return res.status(401).send('Ogiltig token');
    }
    if (req.method !== 'POST') {
      return res.status(405).send('Använd POST');
    }

    const startDate = req.query.startDate || req.body?.startDate;
    const endDate = req.query.endDate || req.body?.endDate;
    const employeeId = req.query.employeeId || req.body?.employeeId || null;
    const departmentId = req.query.departmentId || req.body?.departmentId || null;
    const dryRun = req.query.dryRun === '1' || req.body?.dryRun === true;

    if (!startDate || !endDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return res.status(400).send('Ange startDate och endDate på formen YYYY-MM-DD');
    }
    if (startDate > endDate) {
      return res.status(400).send('startDate måste vara före eller lika med endDate');
    }

    const firestore = getFirestore();
    // ISO-datumsträngar (YYYY-MM-DD) kan jämföras lexikografiskt
    let q = firestore.collection('shifts').where('date', '>=', startDate).where('date', '<=', endDate);
    if (employeeId) q = q.where('employeeId', '==', String(employeeId));
    if (departmentId) q = q.where('departmentId', '==', departmentId);

    const snap = await q.get();
    const docs = snap.docs;
    logger.info(`deleteShiftsInRange ${startDate}..${endDate} emp=${employeeId || '-'} dept=${departmentId || '-'}: ${docs.length} vakter (dryRun=${dryRun})`);

    if (!dryRun && docs.length > 0) {
      // batch max 500 — chunka
      for (let i = 0; i < docs.length; i += 450) {
        const batch = firestore.batch();
        docs.slice(i, i + 450).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    }

    return res.status(200).json({
      ok: true,
      dryRun,
      startDate,
      endDate,
      employeeId,
      departmentId,
      deleted: dryRun ? 0 : docs.length,
      wouldDelete: docs.length,
      sampleIds: docs.slice(0, 20).map(d => d.id)
    });
  }
);
