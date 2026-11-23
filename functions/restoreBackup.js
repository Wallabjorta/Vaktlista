import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Återställ en samling från en nattlig backup i Firebase Storage.
// Skapa ett dokument i samlingen restoreJobs (i Firebase-konsollen) med:
//   date: "<backup-datum, t.ex. 2026-09-27>"   (string)
//   collection: "<samling, t.ex. shifts>"      (string, en av RESTORE_COLLECTIONS)
//   confirm: "JA"                              (string – exakt "JA", säkerhetslucka)
// Funktionen läser backups/<date>/<collection>.json, tömmer samlingen och
// skriver tillbaka dokumenten (dokument-ID från det sparade id-fältet).
// Jobb-dokumentet uppdateras med status: done/error och antal.
const RESTORE_COLLECTIONS = [
  'shifts',
  'employees',
  'departments',
  'users',
  'leaveRequests',
  'swapRequests',
  'notifications'
];

export const restoreOnJob = onDocumentCreated(
  { region: 'us-central1', document: 'restoreJobs/{jobId}' },
  async (event) => {
    const ref = event.data?.ref;
    const data = event.data?.data();
    if (!ref || !data) return;

    const fail = async (error) => {
      logger.error(`Restore misslyckades: ${error}`);
      await ref.set({ status: 'error', error: String(error) }, { merge: true });
    };

    const { date, collection, confirm } = data;
    if (confirm !== 'JA') {
      return fail('Bekräftelse saknas: sätt fältet confirm till strängen "JA" för att köra återställningen.');
    }
    const dryRun = data.dryRun === true || data.dryRun === 'true' || data.dryRun === 1;
    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return fail('Fältet date måste vara ett backup-datum på formen YYYY-MM-DD.');
    }
    if (!RESTORE_COLLECTIONS.includes(collection)) {
      return fail(`Okänd samling "${collection}". Tillåtna: ${RESTORE_COLLECTIONS.join(', ')}.`);
    }

    try {
      const firestore = getFirestore();
      const bucket = getStorage().bucket();
      const file = bucket.file(`backups/${date}/${collection}.json`);
      const [exists] = await file.exists();
      if (!exists) {
        return fail(`Ingen backup hittad: backups/${date}/${collection}.json. Kontrollera datumet i Storage.`);
      }
      const [content] = await file.download();
      const docs = JSON.parse(content.toString('utf8'));
      if (!Array.isArray(docs)) {
        return fail('Backupfilen har oväntat format (väntade en JSON-array).');
      }

      if (dryRun) {
        const currentSnapshot = await firestore.collection(collection).get();
        const currentIds = new Set(currentSnapshot.docs.map(d => d.id));
        const backupIds = docs.map(d => String(d.id)).filter(Boolean);
        const inBackupOnly = backupIds.filter(id => !currentIds.has(id));
        const inCurrentOnly = [...currentIds].filter(id => !backupIds.includes(id));
        await ref.set({
          status: 'dryRun',
          backupDocuments: docs.length,
          currentDocuments: currentIds.size,
          wouldRestore: backupIds.length,
          newFromBackup: inBackupOnly.length,
          wouldDeleteFromCurrent: inCurrentOnly.length,
          backupIdsOnlySample: inBackupOnly.slice(0, 20),
          currentIdsOnlySample: inCurrentOnly.slice(0, 20),
          completedAt: Timestamp.now()
        }, { merge: true });
        logger.info('Torrkörning klar (inget ändrades)');
        return;
      }

      // Töm nuvarande samling innan återställning
      const existing = await firestore.collection(collection).get();
      let deleted = 0;
      const deleteBatch = firestore.batch();
      for (const doc of existing.docs) {
        deleteBatch.delete(doc.ref);
        deleted++;
      }
      if (deleted > 0) {
        await deleteBatch.commit();
      }

      // Skriv tillbaka dokumenten med ursprungligt dokument-ID
      let restored = 0;
      const writeBatch = firestore.batch();
      for (const doc of docs) {
        const { id, ...fields } = doc;
        if (!id) continue;
        writeBatch.set(firestore.collection(collection).doc(String(id)), fields);
        restored++;
      }
      if (restored > 0) {
        await writeBatch.commit();
      }

      await ref.set({
        status: 'done',
        deletedCurrent: deleted,
        restored,
        completedAt: Timestamp.now()
      }, { merge: true });

      await firestore.collection('auditLogs').add({
        action: 'restore-backup',
        details: `Återställde ${collection} från backup ${date}: tog bort ${deleted} befintliga, skrev tillbaka ${restored}`,
        timestamp: Timestamp.now()
      });

      logger.info(`Återställde ${restored} dokument till ${collection} från ${date}`);
    } catch (error) {
      await fail(error.message);
    }
  }
);
