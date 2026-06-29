export type Unit = 
  | 'UNIT PRASEKOLAH'
  | 'UNIT SWASTA'
  | 'UNIT RENDAH'
  | 'UNIT MENENGAH & TINGKATAN 6'
  | 'UNIT SIP+'
  | 'RUJUKAN_BERSAMA';

export function getUnitDisplayName(unit: string | undefined): string {
  if (!unit) return '';
  const sanitized = unit.trim();
  
  if (sanitized === 'UNIT PRASEKOLAH') return 'Unit Prasekolah';
  if (sanitized === 'UNIT SWASTA') return 'Unit Swasta';
  if (sanitized === 'UNIT RENDAH') return 'Unit Rendah';
  if (sanitized === 'UNIT MENENGAH & TINGKATAN 6') return 'Unit Menengah & Tingkatan 6';
  if (sanitized === 'UNIT SIP+') return 'Unit SIP+';
  if (sanitized === 'RUJUKAN_BERSAMA') return 'Bahan Rujukan Bersama';
  
  return sanitized;
}

export function getStandardUnitFromSlugOrTitle(input: string | undefined): string {
  if (!input) return '';
  const upper = input.toUpperCase().replace(/-/g, ' ').trim();
  if (upper.includes('PRASEKOLAH')) return 'UNIT PRASEKOLAH';
  if (upper.includes('SWASTA')) return 'UNIT SWASTA';
  if (upper.includes('RENDAH')) return 'UNIT RENDAH';
  if (upper.includes('MENENGAH')) return 'UNIT MENENGAH & TINGKATAN 6';
  if (upper.includes('SIP')) return 'UNIT SIP+';
  if (upper.includes('RUJUKAN') || upper.includes('BERSAMA')) return 'RUJUKAN_BERSAMA';
  return upper;
}

export type Kategori = 
  | 'Mesyuarat' 
  | 'Pemantauan' 
  | 'Data' 
  | 'Surat' 
  | 'Program' 
  | 'Taklimat' 
  | 'Pekeliling' 
  | 'SOP' 
  | 'Template' 
  | 'Laporan Khas' 
  | 'Lain-Lain';

export interface ReportContent {
  id: string; // Drive File ID
  name: string; // Nama Dokumen
  kategori: Kategori;
  keterangan: string;
  tahun: string;
  bulan: string;
  url: string; // Drive URL
  size: number;
  unit: Unit;
  uploadedAt: string; // ISO date
  uploadedBy: string; // User Name
  uploadedByEmail: string; // User Email
}

export interface Pengumuman {
  id: string;
  title: string;
  content: string;
  date: string;
  author: string;
}

export interface AuditLog {
  id: string;
  date: string;
  time: string;
  userName: string;
  email: string;
  activity: string;
  unit: Unit | 'Sistem';
}

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  role?: 'SUPER_ADMIN' | 'ADMIN' | 'USER';
}

export type AuditEventType = 
  | 'UPLOAD'
  | 'DELETE'
  | 'UPDATE'
  | 'DOWNLOAD'
  | 'VIEW'
  | 'LOGIN'
  | 'LOGOUT';

export interface AuditUploadRecord {
  id?: string;
  eventType?: AuditEventType; // Optional for backward compatibility
  uploadStatus?: 'SUCCESS' | 'FAILED';
  uploadedByEmail?: string;
  uploadedByName?: string;
  unit?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  uploadTimestamp?: any; // Firestore serverTimestamp or Date string
  driveFileId?: string;
  driveFileUrl?: string;
  userUid?: string;
  userRole?: string;
  originalFileName?: string;
  
  // Reka bentuk sedia untuk masa hadapan (Future-ready fields)
  deletedBy?: string;
  deletedAt?: string;
  updatedBy?: string;
  updatedAt?: string;
  downloadedBy?: string;
  downloadedAt?: string;
}


