import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Engångsfunktion: tar bort dublett-vakter i shifts-samlingen.
// Dubletter uppstod när localStorage-migreringen la in vakter med addDoc
// (nya dokument-ID:n) trots att samma vakt redan fanns i Firestore.
// Behåller det äldsta dokumentet per (employeeId, date, startTime, endTime)
// och tar bort de övriga. Skyddad med X-Backup-Token, samma hemlighet som backupen.
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
    const snapshot = await firestore.collection('shifts').get();
    const docs = snapshot.docs.map(d => ({
      ref: d.ref,
      createdAt: d.createTime?.toMillis() ?? 0,
      employeeId: d.data().employeeId,
      departmentId: d.data().departmentId,
      date: d.data().date,
      startTime: d.data().startTime,
      endTime: d.data().endTime
    }));

    const seen = new Map();
    const toDelete = [];
    for (const d of docs) {
      const key = `${d.employeeId}|${d.date}|${d.startTime}|${d.endTime}`;
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

    if (dryRun) {
      return res.status(200).json({
        total: docs.length,
        duplicates: toDelete.length,
        dryRun: true,
        wouldDelete: toDelete.map(d => d.ref.id)
      });
    }

    let deleted = 0;
    const batch = firestore.batch();
    for (const d of toDelete) {
      batch.delete(d.ref);
      deleted++;
    }
    if (deleted > 0) {
      await batch.commit();
    }

    await firestore.collection('auditLogs').add({
      action: 'dedup-shifts',
      details: `Tog bort ${deleted} dublett-vakter av totalt ${docs.length}`,
      timestamp: Timestamp.now()
    });

    logger.info(`Tog bort ${deleted} dublett-vakter av totalt ${docs.length}`);
    return res.status(200).json({ total: docs.length, deleted });
  }
);
