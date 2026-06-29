// Firestore-backed Sektor Pengurusan Sekolah Data Provider
// This completely replaces the local mock simulator with durable cloud persistence in Firestore.
import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';

export async function initSheets(): Promise<string> {
  // Bypassed: Real-time Firestore handles dynamic auto-creation of collections on the fly.
  return 'real_firestore_backend';
}

/**
 * Appends a row of values to the specified Firestore collection.
 * Maintains chronological order via the createdAt field.
 */
export async function appendRow(sheetName: string, values: any[]): Promise<void> {
  const collectionName = sheetName.toLowerCase();
  try {
    const collRef = collection(db, collectionName);
    const rowValues = values.map(v => v === null || v === undefined ? '' : String(v));
    await addDoc(collRef, {
      values: rowValues,
      createdAt: Date.now()
    });
    console.log(`[FIRESTORE] Berjaya menulis rekod baru ke koleksi: ${collectionName}`);
  } catch (error) {
    console.error(`[FIRESTORE ERROR] Gagal menulis ke koleksi ${collectionName}:`, error);
    handleFirestoreError(error, OperationType.CREATE, collectionName);
  }
}

/**
 * Reads all rows from the specified Firestore collection, ordered chronologically.
 * Always returns a standard tabular representation with the exact required header as the first row.
 */
export async function readRows(sheetName: string): Promise<any[][]> {
  const collectionName = sheetName.toLowerCase();

  // Define hardcoded headers strictly based on schema requirements to maintain full compatibility
  let header: string[] = [];
  if (sheetName === 'Laporan') {
    header = ['id', 'name', 'kategori', 'keterangan', 'tahun', 'bulan', 'url', 'size', 'unit', 'uploadedAt', 'uploadedBy', 'uploadedByEmail'];
  } else if (sheetName === 'Rujukan') {
    header = ['id', 'name', 'kategori', 'keterangan', 'tahun', 'bulan', 'url', 'size', 'unit', 'uploadedAt', 'uploadedBy', 'uploadedByEmail'];
  } else if (sheetName === 'Pengumuman') {
    header = ['id', 'title', 'content', 'date', 'author'];
  } else if (sheetName === 'Audit') {
    header = ['id', 'date', 'time', 'userName', 'email', 'activity', 'unit'];
  }

  const rows: any[][] = [header];

  try {
    const collRef = collection(db, collectionName);
    const q = query(collRef, orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);

    snap.forEach((doc) => {
      const data = doc.data();
      if (data && Array.isArray(data.values)) {
        rows.push(data.values);
      }
    });
    return rows;
  } catch (error) {
    console.error(`[FIRESTORE ERROR] Gagal membaca data dari koleksi: ${collectionName}`, error);
    handleFirestoreError(error, OperationType.LIST, collectionName);
  }
}
