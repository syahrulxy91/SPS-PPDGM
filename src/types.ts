export type Unit = 
  | 'UNIT SWASTA' 
  | 'UNIT RENDAH' 
  | 'UNIT MENENGAH' 
  | 'UNIT MENENGAH & TINGKATAN 6'
  | 'UNIT PRASEKOLAH'
  | 'SIP'
  | 'SIP+';

export function getUnitDisplayName(unit: string | undefined): string {
  if (!unit) return '';
  const sanitized = unit.toUpperCase().replace(/_/g, ' ').trim();
  
  if (sanitized === 'UNIT MENENGAH' || sanitized === 'UNIT_MENENGAH' || sanitized.includes('MENENGAH')) {
    return 'Unit Menengah & Tingkatan 6';
  }
  if (sanitized === 'UNIT SWASTA' || sanitized === 'SWASTA') {
    return 'Unit Swasta';
  }
  if (sanitized === 'UNIT RENDAH' || sanitized === 'RENDAH') {
    return 'Unit Rendah';
  }
  if (sanitized === 'UNIT PRASEKOLAH' || sanitized === 'PRASEKOLAH') {
    return 'Unit Prasekolah';
  }
  if (sanitized.includes('SIP') || sanitized.includes('SUKAN')) {
    return 'SIP+';
  }
  
  return sanitized
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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
}

