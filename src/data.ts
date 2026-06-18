import { Siswa, Guru, Kelas, AbsenLog, AppState } from './types';

export const INITIAL_SISWA: Siswa[] = [
  { nis: "12345", nama: "Budi Santoso", kelas: "XII-RPL-1", password: "siswa123", status: "Aktif" },
  { nis: "12346", nama: "Siti Aminah", kelas: "XII-RPL-1", password: "siswa123", status: "Aktif" },
  { nis: "12347", nama: "Andi Wijaya", kelas: "XI-TKJ-2", password: "siswa123", status: "Aktif" },
  { nis: "12348", nama: "Rina Lestari", kelas: "XI-TKJ-2", password: "siswa123", status: "Aktif" },
  { nis: "12349", nama: "Fajar Nugraha", kelas: "X-RPL-2", password: "siswa123", status: "Aktif" },
  { nis: "12350", nama: "Dewi Sartika", kelas: "XII-RPL-1", password: "siswa123", status: "Aktif" },
  { nis: "12351", nama: "Joko Widodo", kelas: "X-RPL-2", password: "siswa123", status: "Aktif" },
  { nis: "12352", nama: "Megawati", kelas: "XI-TKJ-2", password: "siswa123", status: "Aktif" }
];

export const INITIAL_GURU: Guru[] = [
  { nip: "admin", nama: "Pak Admin Guru, M.Kom.", jabatan: "Administrator / Guru TI", password: "admin123" },
  { nip: "19800101", nama: "Sri Wahyuni, S.Pd.", jabatan: "Wali Kelas XII-RPL-1", password: "guru123" },
  { nip: "19850202", nama: "Eko Prasetyo, S.Pd.", jabatan: "Wali Kelas XI-TKJ-2", password: "guru123" },
  { nip: "19900303", nama: "Diana Lestari, S.Si.", jabatan: "Wali Kelas X-RPL-2", password: "guru123" }
];

export const INITIAL_KELAS: Kelas[] = [
  { namaKelas: "XII-RPL-1", kelas: "XII", jurusan: "RPL-1", waliKelas: "Sri Wahyuni, S.Pd.", guruMapel: "Sri Wahyuni, S.Pd.", mapel: "Rekayasa Perangkat Lunak" },
  { namaKelas: "XI-TKJ-2", kelas: "XI", jurusan: "TKJ-2", waliKelas: "Eko Prasetyo, S.Pd.", guruMapel: "Eko Prasetyo, S.Pd.", mapel: "Teknik Komputer Jaringan" },
  { namaKelas: "X-RPL-2", kelas: "X", jurusan: "RPL-2", waliKelas: "Diana Lestari, S.Si.", guruMapel: "Diana Lestari, S.Si.", mapel: "Dasar Desain Grafis" }
];

export const getInitialAbsensi = (): AbsenLog[] => {
  const logs: AbsenLog[] = [];
  
  // June 2026 as current month
  const monthName = "Juni 2026";
  
  // Helper to generate ISO time for specific days
  const makeTime = (day: number, hour: number, min: number) => {
    return `2026-06-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:00Z`;
  };

  const makeDate = (day: number) => {
    return `2026-06-${day.toString().padStart(2, '0')}`;
  };

  // Day 9 June (Tuesday)
  logs.push({
    id: "log_1",
    timestamp: makeTime(9, 7, 5),
    tanggal: makeDate(9),
    bulan: monthName,
    nis: "12345",
    nama: "Budi Santoso",
    kelas: "XII-RPL-1",
    status: "Hadir (QR)"
  });
  logs.push({
    id: "log_2",
    timestamp: makeTime(9, 7, 12),
    tanggal: makeDate(9),
    bulan: monthName,
    nis: "12346",
    nama: "Siti Aminah",
    kelas: "XII-RPL-1",
    status: "Hadir (QR)"
  });
  logs.push({
    id: "log_3",
    timestamp: makeTime(9, 7, 15),
    tanggal: makeDate(9),
    bulan: monthName,
    nis: "12347",
    nama: "Andi Wijaya",
    kelas: "XI-TKJ-2",
    status: "Hadir (QR)"
  });
  logs.push({
    id: "log_4",
    timestamp: makeTime(9, 7, 20),
    tanggal: makeDate(9),
    bulan: monthName,
    nis: "12348",
    nama: "Rina Lestari",
    kelas: "XI-TKJ-2",
    status: "Hadir (Manual)"
  });
  logs.push({
    id: "log_5",
    timestamp: makeTime(9, 8, 0),
    tanggal: makeDate(9),
    bulan: monthName,
    nis: "12349",
    nama: "Fajar Nugraha",
    kelas: "X-RPL-2",
    status: "Izin"
  });

  // Day 10 June (Wednesday)
  logs.push({
    id: "log_6",
    timestamp: makeTime(10, 7, 2),
    tanggal: makeDate(10),
    bulan: monthName,
    nis: "12345",
    nama: "Budi Santoso",
    kelas: "XII-RPL-1",
    status: "Hadir (QR)"
  });
  logs.push({
    id: "log_7",
    timestamp: makeTime(10, 7, 8),
    tanggal: makeDate(10),
    bulan: monthName,
    nis: "12346",
    nama: "Siti Aminah",
    kelas: "XII-RPL-1",
    status: "Hadir (QR)"
  });
  logs.push({
    id: "log_8",
    timestamp: makeTime(10, 7, 14),
    tanggal: makeDate(10),
    bulan: monthName,
    nis: "12347",
    nama: "Andi Wijaya",
    kelas: "XI-TKJ-2",
    status: "Sakit"
  });
  logs.push({
    id: "log_9",
    timestamp: makeTime(10, 7, 22),
    tanggal: makeDate(10),
    bulan: monthName,
    nis: "12348",
    nama: "Rina Lestari",
    kelas: "XI-TKJ-2",
    status: "Hadir (QR)"
  });
  logs.push({
    id: "log_10",
    timestamp: makeTime(10, 7, 30),
    tanggal: makeDate(10),
    bulan: monthName,
    nis: "12349",
    nama: "Fajar Nugraha",
    kelas: "X-RPL-2",
    status: "Hadir (QR)"
  });

  // Day 11 June (Thursday) - Present Date
  logs.push({
    id: "log_11",
    timestamp: makeTime(11, 7, 4),
    tanggal: makeDate(11),
    bulan: monthName,
    nis: "12345",
    nama: "Budi Santoso",
    kelas: "XII-RPL-1",
    status: "Hadir (QR)"
  });
  logs.push({
    id: "log_12",
    timestamp: makeTime(11, 7, 9),
    tanggal: makeDate(11),
    bulan: monthName,
    nis: "12346",
    nama: "Siti Aminah",
    kelas: "XII-RPL-1",
    status: "Hadir (QR)"
  });
  logs.push({
    id: "log_13",
    timestamp: makeTime(11, 7, 25),
    tanggal: makeDate(11),
    bulan: monthName,
    nis: "12348",
    nama: "Rina Lestari",
    kelas: "XI-TKJ-2",
    status: "Hadir (QR)"
  });
  logs.push({
    id: "log_14",
    timestamp: makeTime(11, 7, 31),
    tanggal: makeDate(11),
    bulan: monthName,
    nis: "12349",
    nama: "Fajar Nugraha",
    kelas: "X-RPL-2",
    status: "Hadir (Manual)"
  });
  logs.push({
    id: "log_15",
    timestamp: makeTime(11, 9, 0),
    tanggal: makeDate(11),
    bulan: monthName,
    nis: "12347",
    nama: "Andi Wijaya",
    kelas: "XI-TKJ-2",
    status: "Alfa"
  });

  return logs;
};

export const loadStoredState = (): AppState => {
  const STORAGE_KEY = 'qr_absensi_state';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Ensure essential fields exist
      if (parsed.siswa && parsed.guru && parsed.kelas && parsed.absensi) {
        return {
          siswa: parsed.siswa,
          guru: parsed.guru,
          kelas: parsed.kelas,
          absensi: parsed.absensi,
          currentUser: parsed.currentUser || null
        };
      }
    }
  } catch (e) {
    console.error("Error loading localStorage state:", e);
  }

  // Backup or initial seed
  return {
    siswa: INITIAL_SISWA,
    guru: INITIAL_GURU,
    kelas: INITIAL_KELAS,
    absensi: getInitialAbsensi(),
    currentUser: null
  };
};

export const saveStoredState = (state: AppState) => {
  const STORAGE_KEY = 'qr_absensi_state';
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Error saving localStorage state:", e);
  }
};
