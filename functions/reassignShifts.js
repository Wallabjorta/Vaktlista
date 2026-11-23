import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Engångsfunktion: pekar om vakter från en raderad anställd-kopia till den
// anställd som behölls. Anropas med JSON-body:
// { "fromEmployeeId": "<gammalt id>", "toEmployeeId": "<nytt id>" }
// Skyddad med X-Backup-Token. Stödjer dryRun via ?dryRun=1.
export const reassignShifts = onRequest(
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

    const fromId = req.body?.fromEmployeeId;
    const toId = req.body?.toEmployeeId;
    if (!fromId || !toId) {
      return res.status(400).json({ error: 'Kräver fromEmployeeId och toEmployeeId i JSON-body' });
    }
    if (fromId === toId) {
      return res.status(400).json({ error: 'fromEmployeeId och toEmployeeId får inte vara samma' });
    }

    const dryRun = req.query.dryRun === '1';
    const firestore = getFirestore();

    const targetSnap = await firestore.collection('employees').doc(toId).get();
    if (!targetSnap.exists) {
      return res.status(404).json({ error: `Anställd ${toId} finns inte – kontrollera toEmployeeId` });
    }

    const shiftsSnap = await firestore.collection('shifts')
      .where('employeeId', '==', fromId)
      .get();
    const matching = shiftsSnap.docs.map(d => d.ref.id);

    if (dryRun) {
      return res.status(200).json({
        dryRun: true,
        fromEmployeeId: fromId,
        toEmployeeId: toId,
        matchingShifts: matching.length,
        shiftIds: matching
      });
    }

    const batch = firestore.batch();
    for (const doc of shiftsSnap.docs) {
      batch.update(doc.ref, { employeeId: toId });
    }
    if (matching.length > 0) {
      await batch.commit();
    }

    await firestore.collection('auditLogs').add({
      action: 'reassign-shifts',
      details: `Flyttade ${matching.length} vakter från ${fromId} till ${toId}`,
      timestamp: Timestamp.now()
    });

    logger.info(`Flyttade ${matching.length} vakter från ${fromId} till ${toId}`);
    return res.status(200).json({ updated: matching.length, fromEmployeeId: fromId, toEmployeeId: toId });
  }
);
