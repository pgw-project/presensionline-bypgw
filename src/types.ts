export interface Siswa {
  nis: string;
  nama: string;
  kelas: string;
  password?: string;
  status: 'Aktif' | 'Nonaktif';
  foto?: string;
}

export interface Guru {
  nip: string;
  nama: string;
  jabatan: string;
  password?: string;
  kelasDiajar?: string[];
  foto?: string;
}

export interface Kelas {
  namaKelas: string;
  kelas?: string;
  jurusan?: string;
  waliKelas: string; // NIP or Nama of the teacher (kept for backward compatibility)
  guruMapel?: string;
  mapel?: string;
}

export interface AbsenLog {
  id: string; // Timestamp ISO or unique ID
  timestamp: string; // Time ISO
  tanggal: string; // YYYY-MM-DD
  bulan: string; // e.g. "Juni 2026"
  nis: string;
  nama: string;
  kelas: string;
  status: 'Hadir (QR)' | 'Hadir (Manual)' | 'Sakit' | 'Izin' | 'Alfa';
  guruNip?: string;
  guruNama?: string;
  mataPelajaran?: string;
  jamKe?: string;
}

export interface CurrentUser {
  username: string; // NIS or NIP
  nama: string;
  role: 'siswa' | 'guru';
  extra: string; // Class name for Siswa, Title/Jabatan for Guru
  foto?: string;
}

export interface Sekolah {
  id: string; // unique code/id
  nama: string;
  alamat?: string;
  createdAt?: string;
  jamMasuk?: string; // e.g., "06:00"
  jamPulang?: string; // e.g., "14:00"
  kontak?: string; // e.g., "081234567890"
}

export interface SystemHoliday {
  date: string; // YYYY-MM-DD
  keterangan: string;
}

export interface AppState {
  siswa: Siswa[];
  guru: Guru[];
  kelas: Kelas[];
  absensi: AbsenLog[];
  currentUser: CurrentUser | null;
}
