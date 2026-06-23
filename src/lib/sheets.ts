// Local Storage-based Sheets Simulator
// This completely replaces Google Sheets API calls to run locally with zero scopes
import { getCurrentAppUser } from './auth';

const SPREADSHEET_NAME = 'e-Laporan SPS Metadata Local';

// Default data seed
const DEFAULT_SHEETS: Record<string, string[][]> = {
  'Laporan': [
    ['id', 'name', 'kategori', 'keterangan', 'tahun', 'bulan', 'url', 'size', 'unit', 'uploadedAt', 'uploadedBy', 'uploadedByEmail'],
    ['l1', 'Laporan Prestasi Akademik Rendah Semester 1', 'Laporan Berkala', 'Laporan pencapaian penilaian akademik sekolah rendah', '2026', '06', 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80', '1048576', 'UNIT_RENDAH', '2026-06-15T08:30:00.000Z', 'Ali bin Ahmad', 'ali.ahmad@moe.gov.my'],
    ['l2', 'Statistik Kemasukan Tingkatan 1 Gua Musang', 'Statistik', 'Pendaftaran terkini murid tingkatan 1 mengikut zon', '2026', '06', 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80', '2097152', 'UNIT_MENENGAH', '2026-06-20T04:15:00.000Z', 'Siti Aminah', 'siti.aminah@moe.gov.my'],
    ['l3', 'Laporan Kewangan Unit Swasta Q1', 'Kewangan', 'Pengauditan dan pemantauan yuran tadika swasta', '2026', '03', 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80', '524288', 'UNIT_SWASTA', '2026-03-31T09:00:00.000Z', 'Zainal Abidin', 'zainal.abidin@moe.gov.my'],
  ],
  'Rujukan': [
    ['id', 'name', 'kategori', 'keterangan', 'tahun', 'bulan', 'url', 'size', 'unit', 'uploadedAt', 'uploadedBy', 'uploadedByEmail'],
    ['r1', 'Pekeliling Am Pengurusan Sekolah PPD GM v2', 'Manual & Pekeliling', 'Prosedur operasi standard pengurusan sekolah harian 2026', '2026', '01', 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80', '1572864', 'RUJUKAN_BERSAMA', '2026-01-10T02:00:00.000Z', 'Syahrul Ramadhan', 'syahrulxy91@gmail.com'],
    ['r2', 'Takwim Aktiviti Kokurikulum Gua Musang', 'Takwim', 'Jadual kejohanan MSSD dan perkhemahan perdana', '2026', '02', 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80', '819200', 'RUJUKAN_BERSAMA', '2026-02-15T11:45:00.000Z', 'Syahrul Ramadhan', 'syahrulxy91@gmail.com'],
  ],
  'Pengumuman': [
    ['id', 'title', 'content', 'date', 'author'],
    ['p1', 'Mesyuarat Penyelarasan Penghantaran Laporan Swasta & Prasekolah Bulanan', 'Sila pastikan semua penyelaras unit memuat naik laporan bulanan sebelum tarikh 25 haribulan pada setiap bulan. Kerjasama anda amatlah dihargai.', '2026-06-20T08:30:00.000Z', 'Pentadbir Sektor'],
    ['p2', 'Hebahan Penggunaan Sistem e-Laporan SPS Gua Musang', 'Sistem e-Laporan Sektor Pengurusan Sekolah Gua Musang kini dilancarkan secara rasmi untuk memudahkan urusan penyimpanan dan pengumpulan fail secara digital bersepadu melangkaui awan.', '2026-06-18T10:00:00.000Z', 'Syahrul Ramadhan'],
  ],
  'Audit': [
    ['id', 'date', 'time', 'userName', 'email', 'activity', 'unit'],
    ['a1', '2026-06-21', '14:30:22', 'Syahrul Ramadhan', 'syahrulxy91@gmail.com', 'Memuat naik rujukan Takwim Kokurikulum', 'RUJUKAN_BERSAMA'],
    ['a2', '2026-06-22', '09:12:05', 'Ali bin Ahmad', 'ali.ahmad@moe.gov.my', 'Memuat naik laporan Prestasi Akademik Sem 1', 'UNIT_RENDAH'],
  ]
};

export async function initSheets(): Promise<string> {
  // Clear potential memory errors
  for (const sheetName of Object.keys(DEFAULT_SHEETS)) {
    const key = `sps_sheet_${sheetName}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify(DEFAULT_SHEETS[sheetName]));
    }
  }
  return 'local_mock_spreadsheet_id';
}

export async function appendRow(sheetName: string, values: any[]): Promise<void> {
  await initSheets();
  const key = `sps_sheet_${sheetName}`;
  let currentSheet: string[][] = [];
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      currentSheet = JSON.parse(stored);
    } catch (e) {
      currentSheet = DEFAULT_SHEETS[sheetName] || [];
    }
  } else {
    currentSheet = DEFAULT_SHEETS[sheetName] || [];
  }

  // Convert values cleanly to string representation
  const rowValues = values.map(v => v === null || v === undefined ? '' : String(v));
  currentSheet.push(rowValues);
  localStorage.setItem(key, JSON.stringify(currentSheet));
}

export async function readRows(sheetName: string): Promise<any[][]> {
  await initSheets();
  const key = `sps_sheet_${sheetName}`;
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      // ignore, fallback
    }
  }

  const defaultVal = DEFAULT_SHEETS[sheetName] || [];
  localStorage.setItem(key, JSON.stringify(defaultVal));
  return defaultVal;
}
