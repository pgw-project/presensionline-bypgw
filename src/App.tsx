import React, { useState, useEffect } from 'react';
import { 
  Users, 
  User,
  GraduationCap, 
  School, 
  ClipboardCheck, 
  ListTodo, 
  FileText, 
  CalendarDays, 
  Sparkles, 
  LogOut, 
  LogIn, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  AlertTriangle, 
  RefreshCw,
  Bell,
  Check,
  ChevronRight,
  Download,
  BookOpen,
  CalendarCheck2,
  Upload,
  FileSpreadsheet,
  Sliders,
  Sun,
  Moon,
  Menu,
  Clock,
  X,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

import { Siswa, Guru, Kelas, AbsenLog, CurrentUser, Sekolah, AppState, SystemHoliday } from './types';
import { loadStoredState, saveStoredState, INITIAL_SISWA, INITIAL_GURU, INITIAL_KELAS, getInitialAbsensi } from './data';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import PanduanCenter from './components/PanduanCenter';
import {
  seedInitialDataIfEmpty,
  dbSaveSiswa,
  dbDeleteSiswa,
  dbSaveGuru,
  dbDeleteGuru,
  dbSaveKelas,
  dbDeleteKelas,
  dbSaveAbsen,
  dbDeleteAbsen,
  dbClearAllAbsensi,
  dbResetToFactorySeed,
  dbSaveSekolah,
  dbDeleteSekolah,
  dbGetSchoolStatistics,
  handleFirestoreError,
  OperationType
} from './lib/firebaseSync';

import SiswaSection from './components/SiswaSection';
import ScannerComponent from './components/ScannerComponent';
import LaporanHarian from './components/LaporanHarian';
import RekapBulanan from './components/RekapBulanan';
import KenaikanKelas from './components/KenaikanKelas';

export const MAPEL_OPTIONS = [
  'Matematika',
  'Bahasa Indonesia',
  'Bahasa Inggris',
  'Sejarah',
  'Pendidikan Agama & Budi Pekerti',
  'Pendidikan Pancasila (PPKn)',
  'Informatika',
  'Fisika',
  'Kimia',
  'Biologi',
  'Ekonomi',
  'Geografi',
  'Sosiologi',
  'Penjasorkes (PJOK)',
  'Seni Budaya',
  'Produktif Kejuruan',
  'Bimbingan Konseling (BK)',
];

export const normalizeClassName = (name: string): string => {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
};

export const cleanCompareTeacher = (t1: string, t2: string): boolean => {
  if (!t1 || !t2) return false;
  const n1 = t1.trim().toLowerCase().replace(/[^a-z]/g, '');
  const n2 = t2.trim().toLowerCase().replace(/[^a-z]/g, '');
  return n1.includes(n2) || n2.includes(n1);
};

export const getBaseClassGroup = (fullClassName: string, kelasList: { namaKelas: string; kelas?: string; jurusan?: string }[]): string => {
  const found = kelasList.find(k => k.namaKelas === fullClassName);
  if (found && found.kelas && found.jurusan) {
    return `${found.kelas}-${found.jurusan}`;
  }
  if (fullClassName.includes(' - ')) {
    return fullClassName.split(' - ')[0];
  }
  return fullClassName;
};

export const isTeacherWaliOfClass = (teacher: { nama: string; jabatan?: string }, k: { namaKelas: string; kelas?: string; jurusan?: string }): boolean => {
  if (!teacher || !k) return false;
  const jab = (teacher.jabatan || '').toLowerCase();
  if (!jab.includes('wali kelas') && !jab.includes('walikelas') && !jab.includes('wali')) return false;
  const normalizedJab = normalizeClassName(teacher.jabatan || '');
  const baseClass = k.namaKelas.split(' - ')[0];
  const normalizedBase = normalizeClassName(baseClass);
  return normalizedJab.includes(normalizedBase);
};

export const getWaliKelasForClass = (
  k: { namaKelas: string; kelas?: string; jurusan?: string },
  guruList: { nama: string; jabatan?: string }[]
): string => {
  const found = guruList.find(g => isTeacherWaliOfClass(g, k));
  return found ? found.nama : '';
};

export const checkGuruAttendancePermission = (
  guru: CurrentUser | null,
  guruDetail: Guru | undefined,
  student: Siswa,
  subjectName: string,
  kelasList: Kelas[]
): { isAuthorized: boolean; reason?: string } => {
  if (!guru) return { isAuthorized: false, reason: 'Pengguna tidak login.' };
  if (guru.username === 'admin') {
    return { isAuthorized: true };
  }

  if (!guruDetail) {
    return { isAuthorized: false, reason: 'Detail data guru tidak ditemukan.' };
  }

  const normalizedStudentClass = normalizeClassName(student.kelas);

  // 1. Is the guru the Wali Kelas for this student's class group?
  const isWali = isTeacherWaliOfClass(guruDetail, { namaKelas: student.kelas });
  if (isWali) {
    return { isAuthorized: true };
  }

  // 2. Is the guru a Guru Mapel for this class group and this subject?
  const matchMapelClass = kelasList.find(k => {
    const normK = normalizeClassName(k.namaKelas);
    const matchesClassName = (normalizedStudentClass === normK || normalizedStudentClass.includes(normK) || normK.includes(normalizedStudentClass));
    if (!matchesClassName) return false;

    const matchesTeacherName = cleanCompareTeacher(k.guruMapel || '', guruDetail.nama) || k.guruMapel === guruDetail.nip || k.guruMapel === guru.username;
    const matchesSubject = (k.mapel || '').trim().toLowerCase() === subjectName.trim().toLowerCase();
    
    return matchesTeacherName && matchesSubject;
  });

  if (matchMapelClass) {
    return { isAuthorized: true };
  }

  // 3. Is the class in classesTaughtByGuru (kelasDiajar), and does the subject match the subject they are assigned to teach for that class?
  const classesTaughtByGuru = guruDetail.kelasDiajar || [];
  const matchesTaughtClass = classesTaughtByGuru.some(cName => {
    const normC = normalizeClassName(cName);
    return normalizedStudentClass === normC || normalizedStudentClass.includes(normC) || normC.includes(normalizedStudentClass);
  });

  if (matchesTaughtClass) {
    const matchTaughtMapel = kelasList.find(k => {
      const normK = normalizeClassName(k.namaKelas);
      const matchesClassName = (normalizedStudentClass === normK || normalizedStudentClass.includes(normK) || normK.includes(normalizedStudentClass));
      if (!matchesClassName) return false;
      const matchesTeacherName = cleanCompareTeacher(k.guruMapel || '', guruDetail.nama) || k.guruMapel === guruDetail.nip || k.guruMapel === guru.username;
      return matchesTeacherName;
    });

    if (matchTaughtMapel) {
      const subjectMatches = (matchTaughtMapel.mapel || '').trim().toLowerCase() === subjectName.trim().toLowerCase();
      if (!subjectMatches) {
        return { 
          isAuthorized: false, 
          reason: `Otoritas Terbatas! Anda ditugaskan mengajar di kelas ${student.kelas}, namun mata pelajaran aktif Anda ("${subjectName}") tidak cocok dengan mata pelajaran rujukan Anda ("${matchTaughtMapel.mapel}").` 
        };
      }
      return { isAuthorized: true };
    }
    
    return { isAuthorized: true };
  }

  return { 
    isAuthorized: false, 
    reason: `Bukan Hak Otoritas! Anda tidak diizinkan mengisi presensi untuk siswa ${student.nama} (${student.kelas}) pada mata pelajaran "${subjectName}" karena tidak tercatat sebagai Wali Kelas atau Guru Mapel yang sesuai.` 
  };
};


export default function App() {
  // Load and manage our persistent sandbox database state
  const [appState, setAppState] = useState<AppState>(() => loadStoredState());
  const [activeSection, setActiveSection] = useState<string>('g-dash');
  const [activeSiswaTab, setActiveSiswaTab] = useState<'dash' | 'card' | 'laporan' | 'rekap'>('dash');

  // Multi-school configuration states
  const [sekolahList, setSekolahList] = useState<Sekolah[]>([]);
  const [holidays, setHolidays] = useState<SystemHoliday[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState<string>('');
  const [newHolidayKeterangan, setNewHolidayKeterangan] = useState<string>('');

  // Helper to determine if a date is a holiday or a Sunday
  const getHoliday = (dateStr: string): { date: string; keterangan: string } | null => {
    // 1. Check database holidays
    const dbHoliday = holidays.find(h => h.date === dateStr);
    if (dbHoliday) {
      return { date: dateStr, keterangan: dbHoliday.keterangan };
    }

    // 2. Check if Sunday (0 is Sunday in JS Date)
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const dateObj = new Date(year, month, day);
      if (dateObj.getDay() === 0) {
        return { date: dateStr, keterangan: 'Hari Minggu (Hari Libur Rutin)' };
      }
    }

    return null;
  };
  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(() => localStorage.getItem('active-school-id'));
  const [newSekolahId, setNewSekolahId] = useState<string>('');
  const [newSekolahNama, setNewSekolahNama] = useState<string>('');
  const [newSekolahAlamat, setNewSekolahAlamat] = useState<string>('');
  const [showAddSekolahForm, setShowAddSekolahForm] = useState<boolean>(false);
  const [schoolInputValue, setSchoolInputValue] = useState<string>('');
  const [newSekolahJamMasuk, setNewSekolahJamMasuk] = useState<string>('07:15');
  const [newSekolahJamPulang, setNewSekolahJamPulang] = useState<string>('14:00');
  const [newSekolahKontak, setNewSekolahKontak] = useState<string>('');
  const [editingSekolah, setEditingSekolah] = useState<Sekolah | null>(null);
  const [schoolStats, setSchoolStats] = useState<Record<string, { siswa: number; guru: number; kelas: number; absensi: number }>>({});

  // Load and refresh school statistics dynamically
  useEffect(() => {
    if (sekolahList.length === 0) return;
    const fetchAllStats = async () => {
      const statsObj: Record<string, { siswa: number; guru: number; kelas: number; absensi: number }> = {};
      for (const sch of sekolahList) {
        try {
          const stats = await dbGetSchoolStatistics(sch.id);
          statsObj[sch.id] = stats;
        } catch (e) {
          console.error("Gagal memuat stats:", e);
        }
      }
      setSchoolStats(prev => ({ ...prev, ...statsObj }));
    };
    fetchAllStats();
  }, [sekolahList]);

  // Sync manual school input value when activeSchoolId or sekolahList changes
  useEffect(() => {
    if (activeSchoolId && sekolahList.length > 0) {
      const activeSchObj = sekolahList.find(s => s.id === activeSchoolId);
      if (activeSchObj) {
        setSchoolInputValue(activeSchObj.nama);
      } else {
        setSchoolInputValue(activeSchoolId);
      }
    } else if (!activeSchoolId) {
      setSchoolInputValue('');
    }
  }, [activeSchoolId, sekolahList]);

  // 1. Real-time list of schools
  useEffect(() => {
    const unsubSekolah = onSnapshot(collection(db, 'sekolah'), (snapshot) => {
      const list: Sekolah[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as Sekolah);
      });
      // Sort alphabetically
      list.sort((a, b) => a.nama.localeCompare(b.nama));
      setSekolahList(list);
    }, (err) => {
      console.error("Realtime sekolah list error:", err);
      handleFirestoreError(err, OperationType.GET, 'sekolah');
    });

    return () => unsubSekolah();
  }, []);

  // 1.5 Real-time list of holidays
  useEffect(() => {
    const unsubHolidays = onSnapshot(collection(db, 'holidays'), (snapshot) => {
      const list: SystemHoliday[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as SystemHoliday);
      });
      // Sort ascending by date
      list.sort((a, b) => a.date.localeCompare(b.date));
      setHolidays(list);
    }, (err) => {
      console.error("Realtime holidays list error:", err);
      handleFirestoreError(err, OperationType.GET, 'holidays');
    });

    return () => unsubHolidays();
  }, []);

  // Holiday CRUD helpers
  const handleAddHoliday = async () => {
    if (!newHolidayDate || !newHolidayKeterangan.trim()) {
      triggerToast('Mohon lengkapi tanggal dan keterangan libur!', 'warning');
      return;
    }
    try {
      const docRef = doc(db, 'holidays', newHolidayDate);
      await setDoc(docRef, {
        date: newHolidayDate,
        keterangan: newHolidayKeterangan.trim()
      } as SystemHoliday);
      setNewHolidayDate('');
      setNewHolidayKeterangan('');
      triggerToast('Hari libur berhasil didaftarkan!', 'success');
    } catch (err) {
      console.error("Failed to add holiday:", err);
      triggerToast('Gagal mendaftarkan hari libur baru.', 'error');
    }
  };

  const handleDeleteHoliday = async (dateStr: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus hari libur untuk tanggal ${dateStr}?`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'holidays', dateStr));
      triggerToast('Hari libur berhasil dihapus.', 'success');
    } catch (err) {
      console.error("Failed to delete holiday:", err);
      triggerToast('Gagal menghapus hari libur.', 'error');
    }
  };


  // 2. Real-time school-specific data subscription
  useEffect(() => {
    if (!activeSchoolId) {
      setAppState(prev => ({ ...prev, siswa: [], guru: [], kelas: [], absensi: [] }));
      return;
    }

    // Seed school code if empty
    const initDbConnection = async () => {
      try {
        await seedInitialDataIfEmpty(activeSchoolId, INITIAL_SISWA, INITIAL_GURU, INITIAL_KELAS, getInitialAbsensi());
      } catch (err) {
        console.error("Failed to seed initial data:", err);
      }
    };
    initDbConnection();

    const unsubSiswa = onSnapshot(collection(db, 'schools', activeSchoolId, 'siswa'), (snapshot) => {
      const list: Siswa[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as Siswa);
      });
      setAppState(prev => ({ ...prev, siswa: list }));
    }, (err) => {
      console.error("Realtime siswa error:", err);
      handleFirestoreError(err, OperationType.GET, `schools/${activeSchoolId}/siswa`);
    });

    const unsubGuru = onSnapshot(collection(db, 'schools', activeSchoolId, 'guru'), (snapshot) => {
      const list: Guru[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as Guru);
      });
      setAppState(prev => ({ ...prev, guru: list }));
    }, (err) => {
      console.error("Realtime guru error:", err);
      handleFirestoreError(err, OperationType.GET, `schools/${activeSchoolId}/guru`);
    });

    const unsubKelas = onSnapshot(collection(db, 'schools', activeSchoolId, 'kelas'), (snapshot) => {
      const list: Kelas[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as Kelas);
      });
      setAppState(prev => ({ ...prev, kelas: list }));
    }, (err) => {
      console.error("Realtime kelas error:", err);
      handleFirestoreError(err, OperationType.GET, `schools/${activeSchoolId}/kelas`);
    });

    const unsubAbsen = onSnapshot(collection(db, 'schools', activeSchoolId, 'absensi'), (snapshot) => {
      const list: AbsenLog[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as AbsenLog);
      });
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAppState(prev => ({ ...prev, absensi: list }));
    }, (err) => {
      console.error("Realtime absensi error:", err);
      handleFirestoreError(err, OperationType.GET, `schools/${activeSchoolId}/absensi`);
    });

    return () => {
      unsubSiswa();
      unsubGuru();
      unsubKelas();
      unsubAbsen();
    };
  }, [activeSchoolId]);

  // Theme & Mobile layout states
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('theme-mode') === 'dark';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('theme-mode', next ? 'dark' : 'light');
      return next;
    });
  };

  const isSystemAdmin = (user: { username: string } | null | undefined): boolean => {
    if (!user) return false;
    return user.username === 'admin' || user.username === 'creator' || user.username === 'asriantofistek015@gmail.com';
  };

  const isServerAdmin = (user: { username: string } | null | undefined): boolean => {
    if (!user) return false;
    return user.username === 'creator' || user.username === 'asriantofistek015@gmail.com';
  };
  
  // Login form state
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginRole, setLoginRole] = useState<'siswa' | 'guru'>('siswa');

  // Modal Dialog toggle states
  const [showMuridModal, setShowMuridModal] = useState<boolean>(false);
  const [muridModalMode, setMuridModalMode] = useState<'ADD' | 'EDIT'>('ADD');
  const [targetMuridNis, setTargetMuridNis] = useState<string>('');
  
  const [showGuruModal, setShowGuruModal] = useState<boolean>(false);
  const [guruModalMode, setGuruModalMode] = useState<'ADD' | 'EDIT'>('ADD');
  const [targetGuruNip, setTargetGuruNip] = useState<string>('');

  const [showKelasModal, setShowKelasModal] = useState<boolean>(false);
  const [kelasModalMode, setKelasModalMode] = useState<'ADD' | 'EDIT'>('ADD');
  const [targetKelasNama, setTargetKelasNama] = useState<string>('');

  const [showAbsenManualModal, setShowAbsenManualModal] = useState<boolean>(false);

  // Guru Control Panel inspect states
  const [showGuruControlModal, setShowGuruControlModal] = useState<boolean>(false);
  const [selectedInspectGuru, setSelectedInspectGuru] = useState<Guru | null>(null);

  // Form Fields
  const [fieldMuridNis, setFieldMuridNis] = useState<string>('');
  const [fieldMuridNama, setFieldMuridNama] = useState<string>('');
  const [fieldMuridKelas, setFieldMuridKelas] = useState<string>('');
  const [fieldMuridKelasLevel, setFieldMuridKelasLevel] = useState<string>('X');
  const [fieldMuridJurusan, setFieldMuridJurusan] = useState<string>('ATPH');
  const [fieldMuridPass, setFieldMuridPass] = useState<string>('siswa123');
  const [fieldMuridStatus, setFieldMuridStatus] = useState<'Aktif' | 'Nonaktif'>('Aktif');

  const [fieldGuruNip, setFieldGuruNip] = useState<string>('');
  const [fieldGuruNama, setFieldGuruNama] = useState<string>('');
  const [fieldGuruJabatan, setFieldGuruJabatan] = useState<string>('');
  const [fieldGuruPass, setFieldGuruPass] = useState<string>('guru123');

  const [fieldKelasNama, setFieldKelasNama] = useState<string>('');
  const [fieldKelasWali, setFieldKelasWali] = useState<string>('');
  const [fieldKelasLevel, setFieldKelasLevel] = useState<string>('');
  const [fieldKelasJurusan, setFieldKelasJurusan] = useState<string>('');
  const [fieldKelasGuruMapel, setFieldKelasGuruMapel] = useState<string>('');
  const [fieldKelasMapel, setFieldKelasMapel] = useState<string>('');

  const [fieldManualAbsenNis, setFieldManualAbsenNis] = useState<string>('');
  const [fieldManualAbsenDate, setFieldManualAbsenDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [fieldManualAbsenTime, setFieldManualAbsenTime] = useState<string>('');
  const [fieldManualAbsenStatus, setFieldManualAbsenStatus] = useState<any>('Hadir (Manual)');
  const [fieldManualAbsenFilterTingkat, setFieldManualAbsenFilterTingkat] = useState<string>('');
  const [fieldManualAbsenFilterJurusan, setFieldManualAbsenFilterJurusan] = useState<string>('');
  const [fieldManualAbsenJamKe, setFieldManualAbsenJamKe] = useState<string>('1');

  // Search/Filters
  const [searchSiswaQuery, setSearchSiswaQuery] = useState<string>('');
  const [filterSiswaTingkat, setFilterSiswaTingkat] = useState<string>('');
  const [filterSiswaJurusan, setFilterSiswaJurusan] = useState<string>('');
  const [filterSiswaKelas, setFilterSiswaKelas] = useState<string>('');
  const [searchLogQuery, setSearchLogQuery] = useState<string>('');
  const [filterLogTingkat, setFilterLogTingkat] = useState<string>('');
  const [filterLogJurusan, setFilterLogJurusan] = useState<string>('');

  // Active states for Subject Teachers (Guru Mata Pelajaran)
  const [activeMataPelajaran, setActiveMataPelajaran] = useState<string>('Matematika');
  const [customMataPelajaran, setCustomMataPelajaran] = useState<string>('');
  const [activeSessionTingkat, setActiveSessionTingkat] = useState<string>('');
  const [activeSessionJurusan, setActiveSessionJurusan] = useState<string>('');
  const [activeSessionJamKe, setActiveSessionJamKe] = useState<string>('1');
  const [ignoreSchoolHours, setIgnoreSchoolHours] = useState<boolean>(() => {
    return localStorage.getItem('ignore-school-hours') !== 'false';
  });

  // Server Admin Center internal states
  const [resetUserRole, setResetUserRole] = useState<'siswa' | 'guru'>('guru');
  const [resetUserNip, setResetUserNip] = useState<string>('');
  const [resetUserNis, setResetUserNis] = useState<string>('');
  const [resetUserNewPass, setResetUserNewPass] = useState<string>('');

  // New filters for log lists (Subject and Teacher) to avoid tumpang tindih
  const [filterLogMapel, setFilterLogMapel] = useState<string>('');
  const [filterLogGuru, setFilterLogGuru] = useState<string>('');

  // Filters for Class Management
  const [filterKelasTingkat, setFilterKelasTingkat] = useState<string>('');
  const [filterKelasJurusan, setFilterKelasJurusan] = useState<string>('');

  // Toast alert states
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'warning' | 'error' }>>([]);

  // Custom confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const requestConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Save changes to localStorage whenever state modifies
  useEffect(() => {
    saveStoredState(appState);
  }, [appState]);

  // Handle toast timers
  const triggerToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    const id = Date.now().toString() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Quick preset developer profiles login
  const handleQuickLogin = (user: string, pass: string, role: 'siswa' | 'guru') => {
    setLoginUsername(user);
    setLoginPassword(pass);
    setLoginRole(role);
  };

  const executeLogin = () => {
    if (!loginUsername || !loginPassword) {
      triggerToast('Masukkan ID Pengguna dan Kata Sandi!', 'error');
      return;
    }

    const trimmedUser = loginUsername.trim();

    let effectiveSchoolId = activeSchoolId;
    if (!effectiveSchoolId && schoolInputValue.trim()) {
      const match = sekolahList.find(s => 
        s.nama.toLowerCase() === schoolInputValue.trim().toLowerCase() ||
        s.id.toLowerCase() === schoolInputValue.trim().toLowerCase()
      );
      if (match) {
        effectiveSchoolId = match.id;
        setActiveSchoolId(match.id);
        localStorage.setItem('active-school-id', match.id);
      }
    }

    if (!effectiveSchoolId && !(trimmedUser === 'creator' || trimmedUser === 'asriantofistek015@gmail.com')) {
      triggerToast('Silakan masukkan nama Asal Sekolah terdaftar Anda terlebih dahulu!', 'warning');
      return;
    }

    if (loginRole === 'siswa') {
      const student = appState.siswa.find(s => s.nis === trimmedUser && s.password === loginPassword);
      if (student) {
        if (student.status !== 'Aktif') {
          triggerToast('Akun siswa dinonaktifkan. Hubungi guru admin.', 'warning');
          return;
        }
        const user: CurrentUser = {
          username: student.nis,
          nama: student.nama,
          role: 'siswa',
          extra: student.kelas,
          foto: student.foto
        };
        setAppState(prev => ({ ...prev, currentUser: user }));
        triggerToast(`Berhasil masuk! Selamat belajar, ${student.nama}.`);
      } else {
        triggerToast('NISN atau Password salah!', 'error');
      }
    } else {
      // Find teacher or match super-admin creator credentials
      let teacher = appState.guru.find(g => g.nip === trimmedUser && g.password === loginPassword);
      
      // Developer emergency login fallback bypass
      if (!teacher && (trimmedUser === 'creator' || trimmedUser === 'asriantofistek015@gmail.com') && (loginPassword === 'creator123' || loginPassword === 'admin123')) {
        teacher = {
          nip: trimmedUser,
          nama: "Asrianto Fistek (Admin Server)",
          jabatan: "Pembuat Aplikasi / Admin Server",
          password: loginPassword,
          foto: ""
        };
      }

      if (teacher) {
        const user: CurrentUser = {
          username: teacher.nip,
          nama: teacher.nama,
          role: 'guru',
          extra: teacher.jabatan,
          foto: teacher.foto
        };
        setAppState(prev => ({ ...prev, currentUser: user }));
        setActiveSection('g-dash');
        triggerToast(`Sukses masuk! Selamat datang Pembuat Aplikasi, ${teacher.nama}.`);
      } else {
        triggerToast('ID / NIP atau Password salah!', 'error');
      }
    }
  };

  const executeLogout = () => {
    setAppState(prev => ({ ...prev, currentUser: null }));
    setLoginUsername('');
    setLoginPassword('');
    triggerToast('Anda telah keluar dari aplikasi.');
  };

  // ==========================================
  // SERVER ADMIN CENTER UTILITIES & OVERRIDES
  // ==========================================
  const resetToFactoryDefault = () => {
    requestConfirm(
      "KONTROL BAHAYA: Kembalikan ke Setelan Pabrik?",
      "Seluruh data murid, guru, kelas, dan riwayat presensi saat ini akan dihapus permanen dan digantikan dengan data bawaan awal. Tindakan ini tidak bisa dibatalkan!",
      async () => {
        const freshState: AppState = {
          siswa: [
            { nis: "12345", nama: "Anies Baswedan", kelas: "XII-RPL-1", password: "siswa123", status: "Aktif", foto: "" },
            { nis: "12346", nama: "Prabowo Subianto", kelas: "XII-RPL-1", password: "siswa123", status: "Aktif", foto: "" },
            { nis: "12347", nama: "Ganjar Pranowo", kelas: "XI-TKJ-2", password: "siswa123", status: "Aktif", foto: "" },
            { nis: "12348", nama: "Gibran Rakabuming", kelas: "XI-TKJ-2", password: "siswa123", status: "Aktif", foto: "" },
            { nis: "12349", nama: "Mahfud MD", kelas: "X-RPL-2", password: "siswa123", status: "Aktif", foto: "" },
            { nis: "12350", nama: "Muhaimin Iskandar", kelas: "X-RPL-2", password: "siswa123", status: "Aktif", foto: "" },
            { nis: "12351", nama: "Joko Widodo", kelas: "X-RPL-2", password: "siswa123", status: "Aktif", foto: "" },
            { nis: "12352", nama: "Megawati", kelas: "XI-TKJ-2", password: "siswa123", status: "Aktif", foto: "" }
          ],
          guru: [
            { nip: "admin", nama: "Pak Admin Guru, M.Kom.", jabatan: "Administrator / Guru TI", password: "admin123", foto: "" },
            { nip: "19800101", nama: "Sri Wahyuni, S.Pd.", jabatan: "Wali Kelas XII-RPL-1", password: "guru123", foto: "" },
            { nip: "19850202", nama: "Eko Prasetyo, S.Pd.", jabatan: "Wali Kelas XI-TKJ-2", password: "guru123", foto: "" },
            { nip: "19900303", nama: "Diana Lestari, S.Si.", jabatan: "Wali Kelas X-RPL-2", password: "guru123", foto: "" }
          ],
          kelas: [
            { namaKelas: "XII-RPL-1", kelas: "XII", jurusan: "RPL-1", waliKelas: "Sri Wahyuni, S.Pd.", guruMapel: "Sri Wahyuni, S.Pd.", mapel: "Rekayasa Perangkat Lunak" },
            { namaKelas: "XI-TKJ-2", kelas: "XI", jurusan: "TKJ-2", waliKelas: "Eko Prasetyo, S.Pd.", guruMapel: "Eko Prasetyo, S.Pd.", mapel: "Teknik Komputer Jaringan" },
            { namaKelas: "X-RPL-2", kelas: "X", jurusan: "RPL-2", waliKelas: "Diana Lestari, S.Si.", guruMapel: "Diana Lestari, S.Si.", mapel: "Dasar Desain Grafis" }
          ],
          absensi: [],
          currentUser: appState.currentUser
        };
        try {
          await dbResetToFactorySeed(activeSchoolId || '', freshState.siswa, freshState.guru, freshState.kelas, []);
          setAppState(freshState);
          triggerToast("Sistem server berhasil dikosongkan dan dikembalikan ke Setelan Pabrik!", "success");
        } catch (e) {
          triggerToast("Gagal melakukan penyetelan pabrik ke cloud!", "error");
        }
      }
    );
  };

  const wipeAttendanceLogs = () => {
    requestConfirm(
      "KONTROL BAHAYA: Bersihkan Semua Log Absensi?",
      "Tindakan ini akan mengosongkan seluruh log kehadiran harian dan bulanan murid tanpa menghapus akun siswa dan guru. Tindakan ini permanen!",
      async () => {
        try {
          await dbClearAllAbsensi(activeSchoolId || '');
          setAppState(prev => ({
            ...prev,
            absensi: []
          }));
          triggerToast("Seluruh riwayat log presensi berhasil dibersihkan dari server!", "success");
        } catch (e) {
          triggerToast("Gagal membersihkan log kehadiran dari cloud!", "error");
        }
      }
    );
  };

  const exportDatabaseJson = () => {
    try {
      const jsonStr = JSON.stringify(appState, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_qr_presensi_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      triggerToast("Backup data terenkripsi (.json) sukses diunduh!");
    } catch (e) {
      triggerToast("Gagal melakukan backup data!", "error");
    }
  };

  const handleRestoreDatabaseJson = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const restored = JSON.parse(content);
        
        if (Array.isArray(restored.siswa) && Array.isArray(restored.guru) && Array.isArray(restored.kelas) && Array.isArray(restored.absensi)) {
          const currentUser = appState.currentUser;
          await dbResetToFactorySeed(activeSchoolId || '', restored.siswa, restored.guru, restored.kelas, restored.absensi);
          setAppState({
            ...restored,
            currentUser: restored.currentUser || currentUser
          });
          triggerToast("Restore Database berhasil! Seluruh data disinkronkan kembali.", "success");
        } else {
          triggerToast("Format berkas restore tidak valid!", "error");
        }
      } catch (err) {
        triggerToast("Gagal mengurai fail JSON restore!", "error");
      }
    };
    reader.readAsText(file);
    // Reset target value so users can upload same file again
    event.target.value = '';
  };

  const handleMasterResetPassword = () => {
    if (resetUserRole === 'guru') {
      if (!resetUserNip) {
        triggerToast("Pilih salah satu guru!", "warning");
        return;
      }
      if (!resetUserNewPass) {
        triggerToast("Ketikkan sandi baru!", "warning");
        return;
      }
      const target = appState.guru.find(g => g.nip === resetUserNip);
      if (target) {
        dbSaveGuru(activeSchoolId || '', { ...target, password: resetUserNewPass });
      }
      setAppState(prev => {
        const updatedGuru = prev.guru.map(g => {
          if (g.nip === resetUserNip) {
            return { ...g, password: resetUserNewPass };
          }
          return g;
        });
        return { ...prev, guru: updatedGuru };
      });
      triggerToast(`Sandi Guru NIP [${resetUserNip}] berhasil diubah menjadi: ${resetUserNewPass}`, "success");
      setResetUserNewPass("");
      setResetUserNip("");
    } else {
      if (!resetUserNis) {
        triggerToast("Pilih salah satu murid!", "warning");
        return;
      }
      if (!resetUserNewPass) {
        triggerToast("Ketikkan sandi baru!", "warning");
        return;
      }
      const target = appState.siswa.find(s => s.nis === resetUserNis);
      if (target) {
        dbSaveSiswa(activeSchoolId || '', { ...target, password: resetUserNewPass });
      }
      setAppState(prev => {
        const updatedSiswa = prev.siswa.map(s => {
          if (s.nis === resetUserNis) {
            return { ...s, password: resetUserNewPass };
          }
          return s;
        });
        return { ...prev, siswa: updatedSiswa };
      });
      triggerToast(`Sandi Siswa NISN [${resetUserNis}] berhasil diubah menjadi: ${resetUserNewPass}`, "success");
      setResetUserNewPass("");
      setResetUserNis("");
    }
  };

  const savePhotoForUser = (base64Data: string) => {
    if (appState.currentUser) {
      const username = appState.currentUser.username;
      const role = appState.currentUser.role;

      if (role === 'siswa') {
        const target = appState.siswa.find(s => s.nis === username);
        if (target) {
          dbSaveSiswa(activeSchoolId || '', { ...target, foto: base64Data });
        }
      } else {
        const target = appState.guru.find(g => g.nip === username);
        if (target) {
          dbSaveGuru(activeSchoolId || '', { ...target, foto: base64Data });
        }
      }

      setAppState(prev => {
        const updatedUser = prev.currentUser ? { ...prev.currentUser, foto: base64Data } : null;
        
        if (role === 'siswa') {
          const updatedSiswa = prev.siswa.map(s => {
            if (s.nis === username) {
              return { ...s, foto: base64Data };
            }
            return s;
          });
          return {
            ...prev,
            currentUser: updatedUser,
            siswa: updatedSiswa
          };
        } else {
          const updatedGuru = prev.guru.map(g => {
            if (g.nip === username) {
              return { ...g, foto: base64Data };
            }
            return g;
          });
          return {
            ...prev,
            currentUser: updatedUser,
            guru: updatedGuru
          };
        }
      });
      
      triggerToast('Foto profil berhasil diperbarui!', 'success');
    }
  };

  const compressProfileImage = (base64Str: string, maxWidth = 150, maxHeight = 150, quality = 0.60): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(base64Str);
        }
      };
      img.onerror = () => {
        resolve(base64Str);
      };
    });
  };

  const handleSidebarPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      triggerToast('Gagal: Ukuran foto maksimal adalah 2MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      triggerToast('Mengompresi foto profil secara otomatis...', 'success');
      const compressedData = await compressProfileImage(base64Data);
      savePhotoForUser(compressedData);
    };
    reader.onerror = () => {
      triggerToast('Gagal membaca file gambar.', 'error');
    };
    reader.readAsDataURL(file);
  };

  const getActiveSchoolHoursConfig = () => {
    const activeSch = sekolahList.find(s => s.id === activeSchoolId);
    return {
      jamMasuk: activeSch?.jamMasuk || '06:00',
      jamPulang: activeSch?.jamPulang || '14:00',
    };
  };

  const isWithinSchoolHours = () => {
    if (ignoreSchoolHours) return true;
    const isAdmin = appState.currentUser?.role === 'admin' || appState.currentUser?.username === 'admin';
    if (isAdmin) return true;

    const { jamMasuk, jamPulang } = getActiveSchoolHoursConfig();
    const now = new Date();
    const currentStr = now.toTimeString().slice(0, 5); // "HH:MM"
    
    return currentStr >= jamMasuk && currentStr <= jamPulang;
  };

  // QR Processing logic
  const handleQRDetected = (nis: string) => {
    // Check school hour limits dynamically
    if (!isWithinSchoolHours()) {
      const { jamMasuk, jamPulang } = getActiveSchoolHoursConfig();
      triggerToast(`Absensi QR Ditolak! Pemindaian hanya aktif pukul ${jamMasuk} s.d ${jamPulang}.`, 'error');
      return;
    }

    // Check if system has a holiday today
    const todayStr = new Date().toISOString().split('T')[0];
    const holidayToday = getHoliday(todayStr);
    if (holidayToday) {
      triggerToast(`Absensi QR Ditolak! Hari ini libur: ${holidayToday.keterangan}`, 'error');
      return;
    }

    const cleanNis = nis.trim();
    const student = appState.siswa.find(s => s.nis === cleanNis);
    
    if (!student) {
      triggerToast(`Siswa dengan NISN ${cleanNis} tidak terdaftar!`, 'error');
      try {
        // play simple audio beep representation online
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } catch(e) {}
      return;
    }

    if (student.status !== 'Aktif') {
      triggerToast(`Murid ${student.nama} berstatus Nonaktif!`, 'warning');
      return;
    }

    // Isolate by Guru's Managed Classes & Mapel via checkGuruAttendancePermission
    if (isGuruNonAdmin) {
      const currentSubjectName = activeMataPelajaran === 'Lainnya' ? (customMataPelajaran.trim() || 'Mata Pelajaran Lain') : activeMataPelajaran;
      const permCheck = checkGuruAttendancePermission(appState.currentUser, currentGuruObj, student, currentSubjectName, appState.kelas);
      if (!permCheck.isAuthorized) {
        triggerToast(permCheck.reason || 'Bukan Hak Otoritas!', 'error');
        return;
      }
    }

    // Verification if Session is limited to a specific class level (Tingkat)
    if (activeSessionTingkat) {
      const cleanKelas = student.kelas.toUpperCase().trim();
      const targetTingkat = activeSessionTingkat.toUpperCase();
      const matchesTingkat = cleanKelas === targetTingkat ||
                             cleanKelas.startsWith(targetTingkat + '-') ||
                             cleanKelas.startsWith(targetTingkat + ' ');

      if (!matchesTingkat) {
        triggerToast(`Absensi Gagal! Siswa ${student.nama} (${student.kelas}) bukan tingkatan kelas ${activeSessionTingkat} yang ditentukan pada Sesi Aktif Anda saat ini.`, 'warning');
        return;
      }
    }

    // Verification if Session is limited to a specific major (Jurusan)
    if (activeSessionJurusan) {
      const cleanKelas = student.kelas.toUpperCase().trim();
      if (!cleanKelas.includes(activeSessionJurusan.toUpperCase())) {
        triggerToast(`Absensi Gagal! Siswa ${student.nama} (${student.kelas}) bukan jurusan ${activeSessionJurusan} yang ditentukan pada Sesi Aktif Anda saat ini.`, 'warning');
        return;
      }
    }

    const currentSubjectName = activeMataPelajaran === 'Lainnya' ? (customMataPelajaran.trim() || 'Mata Pelajaran Lain') : activeMataPelajaran;

    // Check duplicate attendance for the same day, same subject AND same Jam Ke to prevent overlap
    const today = new Date().toISOString().split('T')[0];
    const isAlreadyScanned = appState.absensi.some(log => 
      log.nis === cleanNis && 
      log.tanggal === today && 
      (log.mataPelajaran || 'Matematika') === currentSubjectName &&
      (log.jamKe || '1') === activeSessionJamKe
    );

    if (isAlreadyScanned) {
      triggerToast(`Siswa ${student.nama} sudah di-absen untuk pelajaran ${currentSubjectName} (Jam ${activeSessionJamKe}) hari ini!`, 'warning');
      return;
    }

    // Capture success
    const now = new Date();
    const newLog: AbsenLog = {
      id: `log_${Date.now()}`,
      timestamp: now.toISOString(),
      tanggal: today,
      bulan: now.toLocaleString('id-ID', { month: 'long', year: 'numeric' }),
      nis: student.nis,
      nama: student.nama,
      kelas: student.kelas,
      status: 'Hadir (QR)',
      guruNip: appState.currentUser?.username,
      guruNama: appState.currentUser?.nama,
      mataPelajaran: currentSubjectName,
      jamKe: activeSessionJamKe
    };

    dbSaveAbsen(activeSchoolId || '', newLog);

    setAppState(prev => ({
      ...prev,
      absensi: [newLog, ...prev.absensi]
    }));

    // Beep success sound
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch(e) {}

    triggerToast(`Absensi BERHASIL! ${student.nama} (${student.kelas}) tercatat Hadir.`, 'success');
  };

  // Quick Manual NISN trigger on Guru Dashboard
  const [manualNisInput, setManualNisInput] = useState<string>('');
  const executeManualNisAbsen = () => {
    if (!manualNisInput) {
      triggerToast('Masukkan NISN Terlebih Dahulu!', 'warning');
      return;
    }
    handleQRDetected(manualNisInput.trim());
    setManualNisInput('');
  };

  // CRUD STUDENTS
  const openMuridModal = (mode: 'ADD' | 'EDIT', nis?: string) => {
    setMuridModalMode(mode);
    setErrorForm('');
    if (mode === 'EDIT' && nis) {
      const s = appState.siswa.find(x => x.nis === nis);
      if (s) {
        setTargetMuridNis(nis);
        setFieldMuridNis(s.nis);
        setFieldMuridNama(s.nama);
        setFieldMuridKelas(s.kelas);
        
        // Parse level and major from student's class string
        const cleanK = s.kelas.trim().toUpperCase();
        const parts = cleanK.split(/[\s\-]+/);
        let parsedLevel = parts[0] || 'X';
        let parsedJurusan = 'ATPH';
        
        if (cleanK.includes('ATPH')) {
          parsedJurusan = 'ATPH';
        } else if (cleanK.includes('MPLB') || cleanK.includes('RPL')) {
          parsedJurusan = 'MPLB';
        } else if (cleanK.includes('TSM') || cleanK.includes('TKJ')) {
          parsedJurusan = 'TSM';
        }
        
        setFieldMuridKelasLevel(parsedLevel);
        setFieldMuridJurusan(parsedJurusan);
        setFieldMuridPass(s.password || 'siswa123');
        setFieldMuridStatus(s.status);
      }
    } else {
      setTargetMuridNis('');
      setFieldMuridNis('');
      setFieldMuridNama('');
      setFieldMuridKelasLevel('X');
      setFieldMuridJurusan('ATPH');
      setFieldMuridKelas('X ATPH');
      setFieldMuridPass('siswa123');
      setFieldMuridStatus('Aktif');
    }
    setShowMuridModal(true);
  };

  const [errorForm, setErrorForm] = useState<string>('');

  const submitStudentForm = () => {
    setErrorForm('');
    const cleanNis = fieldMuridNis.trim();
    const cleanNama = fieldMuridNama.trim();
    const combinedKelas = fieldMuridKelas.trim() || `${fieldMuridKelasLevel} ${fieldMuridJurusan}`;

    if (!cleanNis || !cleanNama || !combinedKelas) {
      setErrorForm('Semua field wajib diisi!');
      return;
    }

    if (isGuruNonAdmin) {
      const normalizedCombined = normalizeClassName(combinedKelas);
      const isAuthorized = normalizedManagedClasses.some(mc => normalizedCombined.includes(mc) || mc.includes(normalizedCombined));
      if (!isAuthorized) {
        setErrorForm(`Bukan Hak Otoritas! Anda hanya diperbolehkan mengelola siswa untuk kelas binaan Anda: ${managedClasses.join(', ') || 'Belum Ada Kelas'}`);
        return;
      }
    }

    if (muridModalMode === 'ADD') {
      const duplicate = appState.siswa.some(s => s.nis === cleanNis);
      if (duplicate) {
        setErrorForm(`Siswa dengan NISN ${cleanNis} sudah terdaftar!`);
        return;
      }
      const newSiswa: Siswa = {
        nis: cleanNis,
        nama: cleanNama,
        kelas: combinedKelas,
        password: fieldMuridPass,
        status: fieldMuridStatus
      };
      dbSaveSiswa(activeSchoolId || '', newSiswa);
      setAppState(prev => ({ ...prev, siswa: [...prev.siswa, newSiswa] }));
      triggerToast(`Berhasil menambahkan murid: ${cleanNama}`);
    } else {
      const targetPhoto = appState.siswa.find(s => s.nis === targetMuridNis)?.foto || '';
      const updatedSiswa: Siswa = {
        nis: cleanNis,
        nama: cleanNama,
        kelas: combinedKelas,
        password: fieldMuridPass,
        status: fieldMuridStatus,
        foto: targetPhoto
      };
      if (cleanNis !== targetMuridNis) {
        dbDeleteSiswa(activeSchoolId || '', targetMuridNis);
      }
      dbSaveSiswa(activeSchoolId || '', updatedSiswa);
      setAppState(prev => ({
        ...prev,
        siswa: prev.siswa.map(s => s.nis === targetMuridNis ? updatedSiswa : s)
      }));
      triggerToast(`Profil siswa ${cleanNama} berhasil diperbarui.`);
    }
    setShowMuridModal(false);
  };

  const deleteStudent = (nis: string, name: string) => {
    requestConfirm(
      'Hapus Murid',
      `Hapus permanen murid bernama ${name} (NISN: ${nis})? Seluruh log absensi mereka tidak akan terhapus namun profil akan dihilangkan.`,
      () => {
        dbDeleteSiswa(activeSchoolId || '', nis);
        setAppState(prev => ({
          ...prev,
          siswa: prev.siswa.filter(s => s.nis !== nis)
        }));
        triggerToast(`Murid ${name} berhasil dihapus.`);
      }
    );
  };

  // CRUD TEACHERS
  const openGuruModal = (mode: 'ADD' | 'EDIT', nip?: string) => {
    setGuruModalMode(mode);
    setErrorForm('');
    if (mode === 'EDIT' && nip) {
      const g = appState.guru.find(x => x.nip === nip);
      if (g) {
        setTargetGuruNip(nip);
        setFieldGuruNip(g.nip);
        setFieldGuruNama(g.nama);
        setFieldGuruJabatan(g.jabatan);
        setFieldGuruPass(g.password || 'guru123');
      }
    } else {
      setTargetGuruNip('');
      setFieldGuruNip('');
      setFieldGuruNama('');
      setFieldGuruJabatan('');
      setFieldGuruPass('guru123');
    }
    setShowGuruModal(true);
  };

  const submitGuruForm = () => {
    setErrorForm('');
    const cleanNip = fieldGuruNip.trim();
    const cleanNama = fieldGuruNama.trim();
    const cleanJabatan = fieldGuruJabatan.trim();

    if (!cleanNip || !cleanNama || !cleanJabatan) {
      setErrorForm('Semua kolom wajib diisi!');
      return;
    }

    if (guruModalMode === 'ADD') {
      const duplicate = appState.guru.some(g => g.nip === cleanNip);
      if (duplicate) {
        setErrorForm(`Guru dengan NIP/ID ${cleanNip} sudah ada!`);
        return;
      }
      const newGuru: Guru = {
        nip: cleanNip,
        nama: cleanNama,
        jabatan: cleanJabatan,
        password: fieldGuruPass
      };
      dbSaveGuru(activeSchoolId || '', newGuru);
      setAppState(prev => ({ ...prev, guru: [...prev.guru, newGuru] }));
      triggerToast(`Sukses menambahkan pendidik: ${cleanNama}`);
    } else {
      const existing = appState.guru.find(g => g.nip === targetGuruNip);
      const updatedGuru: Guru = {
        nip: cleanNip,
        nama: cleanNama,
        jabatan: cleanJabatan,
        password: fieldGuruPass,
        kelasDiajar: existing?.kelasDiajar || [],
        foto: existing?.foto || ''
      };
      if (cleanNip !== targetGuruNip) {
        dbDeleteGuru(activeSchoolId || '', targetGuruNip);
      }
      dbSaveGuru(activeSchoolId || '', updatedGuru);
      setAppState(prev => ({
        ...prev,
        guru: prev.guru.map(g => g.nip === targetGuruNip ? updatedGuru : g)
      }));
      triggerToast(`Data pendidik ${cleanNama} berhasil disimpan.`);
    }
    setShowGuruModal(false);
  };

  const deleteGuru = (nip: string, name: string) => {
    if (nip === 'admin') {
      triggerToast('Akun Administrator bawaan sistem tidak boleh dihapus!', 'error');
      return;
    }
    requestConfirm(
      'Hapus Pendidik/Guru',
      `Hapus permanen pendidik ${name}?`,
      () => {
        dbDeleteGuru(activeSchoolId || '', nip);
        setAppState(prev => ({
          ...prev,
          guru: prev.guru.filter(g => g.nip !== nip)
        }));
        triggerToast(`Data Pendidik ${name} berhasil dihapus.`);
      }
    );
  };

  // CRUD CLASSES
  const openKelasModal = (mode: 'ADD' | 'EDIT', namaKelas?: string) => {
    setKelasModalMode(mode);
    setErrorForm('');
    const firstTeacher = appState.guru[0]?.nama || '';
    if (mode === 'EDIT' && namaKelas) {
      const k = appState.kelas.find(x => x.namaKelas === namaKelas);
      if (k) {
        setTargetKelasNama(namaKelas);
        setFieldKelasNama(k.namaKelas);
        setFieldKelasWali(k.waliKelas);
        setFieldKelasLevel(k.kelas || k.namaKelas.split('-')[0] || '');
        setFieldKelasJurusan(k.jurusan || k.namaKelas.split('-').slice(1).join('-').split(' - ')[0] || '');
        setFieldKelasGuruMapel(k.guruMapel || k.waliKelas || firstTeacher);
        setFieldKelasMapel(k.mapel || '');
      }
    } else {
      setTargetKelasNama('');
      setFieldKelasNama('');
      setFieldKelasWali(firstTeacher);
      setFieldKelasLevel('');
      setFieldKelasJurusan('');
      setFieldKelasGuruMapel(firstTeacher);
      setFieldKelasMapel('');
    }
    setShowKelasModal(true);
  };

  const submitKelasForm = () => {
    setErrorForm('');
    const cleanLevel = fieldKelasLevel.trim().toUpperCase();
    const cleanJurusan = fieldKelasJurusan.trim().toUpperCase();
    const cleanMapel = fieldKelasMapel.trim();
    const cleanKelasName = cleanLevel && cleanJurusan && cleanMapel ? `${cleanLevel}-${cleanJurusan} - ${cleanMapel}` : (cleanLevel && cleanJurusan ? `${cleanLevel}-${cleanJurusan}` : '');

    if (!cleanLevel || !cleanJurusan) {
      setErrorForm('Kelas dan Jurusan wajib diisi!');
      return;
    }
    if (!fieldKelasGuruMapel) {
      setErrorForm('Guru Mapel wajib/pilihan diisi!');
      return;
    }
    if (!fieldKelasMapel.trim()) {
      setErrorForm('Mata Pelajaran wajib diisi!');
      return;
    }

    const newKelas: Kelas = {
      namaKelas: cleanKelasName,
      kelas: cleanLevel,
      jurusan: cleanJurusan,
      waliKelas: fieldKelasGuruMapel, // Keep synchronized for backwards compatibility
      guruMapel: fieldKelasGuruMapel,
      mapel: fieldKelasMapel.trim()
    };

    if (kelasModalMode === 'ADD') {
      const duplicate = appState.kelas.some(k => 
        (k.kelas || '').trim().toUpperCase() === cleanLevel && 
        (k.jurusan || '').trim().toUpperCase() === cleanJurusan && 
        (k.mapel || '').trim().toUpperCase() === cleanMapel.toUpperCase()
      );
      if (duplicate) {
        setErrorForm(`Kelas ${cleanLevel}-${cleanJurusan} dengan Mata Pelajaran "${cleanMapel}" sudah terdaftar!`);
        return;
      }
      dbSaveKelas(activeSchoolId || '', newKelas);
      setAppState(prev => ({ ...prev, kelas: [...prev.kelas, newKelas] }));
      triggerToast(`Kelas ${cleanKelasName} sukses dibentuk.`);
    } else {
      if (cleanKelasName !== targetKelasNama) {
        const duplicate = appState.kelas.some(k => 
          k.namaKelas !== targetKelasNama &&
          (k.kelas || '').trim().toUpperCase() === cleanLevel && 
          (k.jurusan || '').trim().toUpperCase() === cleanJurusan && 
          (k.mapel || '').trim().toUpperCase() === cleanMapel.toUpperCase()
        );
        if (duplicate) {
          setErrorForm(`Kelas ${cleanLevel}-${cleanJurusan} dengan Mata Pelajaran "${cleanMapel}" sudah terdaftar!`);
          return;
        }
        dbDeleteKelas(activeSchoolId || '', targetKelasNama);
      }
      dbSaveKelas(activeSchoolId || '', newKelas);
      setAppState(prev => ({
        ...prev,
        kelas: prev.kelas.map(k => k.namaKelas === targetKelasNama ? newKelas : k)
      }));
      triggerToast(`Kelas ${cleanKelasName} berhasil diperbarui.`);
    }
    setShowKelasModal(false);
  };

  const deleteKelas = (namaKelas: string) => {
    requestConfirm(
      'Hapus Rombongan Kelas',
      `Hapus rombongan kelas ${namaKelas}? Siswa di dalamnya tidak akan terhapus, namun relasi kelas akan hilang.`,
      () => {
        dbDeleteKelas(activeSchoolId || '', namaKelas);
        setAppState(prev => ({
          ...prev,
          kelas: prev.kelas.filter(k => k.namaKelas !== namaKelas)
        }));
        triggerToast(`Kelas ${namaKelas} berhasil dihapus.`);
      }
    );
  };

  // MANUAL LOG INSERTS
  const handleManualFilterTingkatChange = (val: string, currentJurusan: string) => {
    setFieldManualAbsenFilterTingkat(val);
    const isGuruNonAdminObj = appState.currentUser?.role === 'guru' && !isSystemAdmin(appState.currentUser);
    const currentGuruObjObj = appState.guru.find(g => g.nip === appState.currentUser?.username);
    const classesTaughtByGuruObj = currentGuruObjObj?.kelasDiajar || [];
    const managedClassesObj = Array.from(new Set([
      ...appState.kelas.filter(k => {
        const isWali = currentGuruObjObj ? isTeacherWaliOfClass(currentGuruObjObj, k) : false;
        const isMapel = cleanCompareTeacher(k.guruMapel || '', appState.currentUser?.nama || '') || k.guruMapel === appState.currentUser?.username;
        return isWali || isMapel;
      }).map(k => k.namaKelas),
      ...classesTaughtByGuruObj
    ]));
    const baseManagedClassesObj = managedClassesObj.map(c => getBaseClassGroup(c, appState.kelas));
    const normalizedManagedClassesObj = baseManagedClassesObj.map(c => normalizeClassName(c));
    const allowedSiswaList = isGuruNonAdminObj
      ? appState.siswa.filter(s => {
          const sc = normalizeClassName(s.kelas);
          return normalizedManagedClassesObj.some(mc => sc === mc || sc.includes(mc) || mc.includes(sc));
        })
      : appState.siswa;

    const matched = allowedSiswaList.find(s => {
      let matchesTingkat = true;
      if (val) {
        const cleanKelas = s.kelas.trim().toUpperCase();
        const targetTingkat = val.toUpperCase();
        matchesTingkat = cleanKelas === targetTingkat ||
                         cleanKelas.startsWith(targetTingkat + '-') ||
                         cleanKelas.startsWith(targetTingkat + ' ');
      }
      const matchesJurusan = currentJurusan
        ? s.kelas.toUpperCase().includes(currentJurusan.toUpperCase())
        : true;
      return matchesTingkat && matchesJurusan;
    });
    setFieldManualAbsenNis(matched ? matched.nis : '');
  };

  const handleManualFilterJurusanChange = (val: string, currentTingkat: string) => {
    setFieldManualAbsenFilterJurusan(val);
    const isGuruNonAdminObj = appState.currentUser?.role === 'guru' && !isSystemAdmin(appState.currentUser);
    const currentGuruObjObj = appState.guru.find(g => g.nip === appState.currentUser?.username);
    const classesTaughtByGuruObj = currentGuruObjObj?.kelasDiajar || [];
    const managedClassesObj = Array.from(new Set([
      ...appState.kelas.filter(k => {
        const isWali = currentGuruObjObj ? isTeacherWaliOfClass(currentGuruObjObj, k) : false;
        const isMapel = cleanCompareTeacher(k.guruMapel || '', appState.currentUser?.nama || '') || k.guruMapel === appState.currentUser?.username;
        return isWali || isMapel;
      }).map(k => k.namaKelas),
      ...classesTaughtByGuruObj
    ]));
    const baseManagedClassesObj = managedClassesObj.map(c => getBaseClassGroup(c, appState.kelas));
    const normalizedManagedClassesObj = baseManagedClassesObj.map(c => normalizeClassName(c));
    const allowedSiswaList = isGuruNonAdminObj
      ? appState.siswa.filter(s => {
          const sc = normalizeClassName(s.kelas);
          return normalizedManagedClassesObj.some(mc => sc === mc || sc.includes(mc) || mc.includes(sc));
        })
      : appState.siswa;

    const matched = allowedSiswaList.find(s => {
      let matchesTingkat = true;
      if (currentTingkat) {
        const cleanKelas = s.kelas.trim().toUpperCase();
        const targetTingkat = currentTingkat.toUpperCase();
        matchesTingkat = cleanKelas === targetTingkat ||
                         cleanKelas.startsWith(targetTingkat + '-') ||
                         cleanKelas.startsWith(targetTingkat + ' ');
      }
      const matchesJurusan = val
        ? s.kelas.toUpperCase().includes(val.toUpperCase())
        : true;
      return matchesTingkat && matchesJurusan;
    });
    setFieldManualAbsenNis(matched ? matched.nis : '');
  };

  const submitManualAbsen = () => {
    // Check school hour limits dynamically
    if (!isWithinSchoolHours()) {
      const { jamMasuk, jamPulang } = getActiveSchoolHoursConfig();
      triggerToast(`Perekaman Manual Ditolak! Pengisian presensi manual hanya aktif pukul ${jamMasuk} s.d ${jamPulang}.`, 'error');
      return;
    }

    if (!fieldManualAbsenNis) {
      triggerToast('Pilih murid terlebih dahulu!', 'warning');
      return;
    }

    // Check if the manual date is marked as a holiday
    const holidayOnDate = getHoliday(fieldManualAbsenDate);
    if (holidayOnDate) {
      triggerToast(`Tidak dapat merekam absensi! Tanggal ${fieldManualAbsenDate} adalah hari libur: ${holidayOnDate.keterangan}`, 'error');
      return;
    }

    const student = appState.siswa.find(s => s.nis === fieldManualAbsenNis);
    if (!student) return;

    if (isGuruNonAdmin) {
      const currentSubjectName = activeMataPelajaran === 'Lainnya' ? (customMataPelajaran.trim() || 'Mata Pelajaran Lain') : activeMataPelajaran;
      const permCheck = checkGuruAttendancePermission(appState.currentUser, currentGuruObj, student, currentSubjectName, appState.kelas);
      if (!permCheck.isAuthorized) {
        triggerToast(permCheck.reason || 'Bukan Hak Otoritas!', 'error');
        return;
      }
    }

    // Verification if Session is limited to a specific class level (Tingkat)
    if (activeSessionTingkat) {
      const cleanKelas = student.kelas.toUpperCase().trim();
      const targetTingkat = activeSessionTingkat.toUpperCase();
      const matchesTingkat = cleanKelas === targetTingkat ||
                             cleanKelas.startsWith(targetTingkat + '-') ||
                             cleanKelas.startsWith(targetTingkat + ' ');

      if (!matchesTingkat) {
        triggerToast(`Absensi Gagal! Siswa ${student.nama} (${student.kelas}) bukan tingkatan kelas ${activeSessionTingkat} yang ditentukan pada Sesi Aktif Anda saat ini.`, 'warning');
        return;
      }
    }

    // Verification if Session is limited to a specific major (Jurusan)
    if (activeSessionJurusan) {
      const cleanKelas = student.kelas.toUpperCase().trim();
      if (!cleanKelas.includes(activeSessionJurusan.toUpperCase())) {
        triggerToast(`Absensi Gagal! Siswa ${student.nama} (${student.kelas}) bukan jurusan ${activeSessionJurusan} yang ditentukan pada Sesi Aktif Anda saat ini.`, 'warning');
        return;
      }
    }

    const currentSubjectName = activeMataPelajaran === 'Lainnya' ? (customMataPelajaran.trim() || 'Mata Pelajaran Lain') : activeMataPelajaran;

    // Check duplicate logic per Subject and jamKe
    const duplicate = appState.absensi.some(log => 
      log.nis === student.nis && 
      log.tanggal === fieldManualAbsenDate &&
      (log.mataPelajaran || 'Matematika') === currentSubjectName &&
      (log.jamKe || '1') === fieldManualAbsenJamKe
    );
    if (duplicate) {
      triggerToast(`Siswa ${student.nama} sudah memiliki log presensi pelajaran ${currentSubjectName} (Jam ${fieldManualAbsenJamKe}) pada tanggal ${fieldManualAbsenDate}!`, 'warning');
      return;
    }

    const nowObj = new Date();
    const [year, month, day] = fieldManualAbsenDate.split('-').map(Number);
    // Use current real-time hours, minutes, and seconds
    const dObj = new Date(year, month - 1, day, nowObj.getHours(), nowObj.getMinutes(), nowObj.getSeconds(), 0);
    const newLog: AbsenLog = {
      id: `log_${Date.now()}`,
      timestamp: dObj.toISOString(),
      tanggal: fieldManualAbsenDate,
      bulan: dObj.toLocaleString('id-ID', { month: 'long', year: 'numeric' }),
      nis: student.nis,
      nama: student.nama,
      kelas: student.kelas,
      status: fieldManualAbsenStatus,
      guruNip: appState.currentUser?.username,
      guruNama: appState.currentUser?.nama,
      mataPelajaran: currentSubjectName,
      jamKe: fieldManualAbsenJamKe
    };

    dbSaveAbsen(activeSchoolId || '', newLog);

    setAppState(prev => ({
      ...prev,
      absensi: [newLog, ...prev.absensi]
    }));
    triggerToast(`Berhasil mencatatkan presensi manual untuk ${student.nama} pada mapel ${currentSubjectName}.`);
    setShowAbsenManualModal(false);
  };

  const deleteAbsenLog = (id: string) => {
    requestConfirm(
      'Hapus Log Kehadiran',
      'Hapus log kehadiran ini dari riwayat?',
      () => {
        dbDeleteAbsen(activeSchoolId || '', id);
        setAppState(prev => ({
          ...prev,
          absensi: prev.absensi.filter(x => x.id !== id)
        }));
        triggerToast('Satu log kehadiran berhasil dihapus.');
      }
    );
  };

  // Mass Promotion Execution Callback
  const handleMassMigration = (source: string, dest: string) => {
    appState.siswa.forEach(s => {
      if (s.status === 'Aktif' && s.kelas === source) {
        dbSaveSiswa(activeSchoolId || '', { ...s, kelas: dest });
      }
    });
    setAppState(prev => ({
      ...prev,
      siswa: prev.siswa.map(s => {
        if (s.status === 'Aktif' && s.kelas === source) {
          return { ...s, kelas: dest };
        }
        return s;
      })
    }));
    triggerToast(`Berhasil menonaktifkan relasi kelas lama dan memindahkan siswa ke ${dest}.`);
  };

  // DATA EXCEL EXPORT HELPERS (DIRECT TABLES EXPORTS)
  const exportTableToExcel = (tableId: string, filename: string) => {
    const tbl = document.getElementById(tableId);
    if (tbl) {
      const wb = XLSX.utils.table_to_book(tbl);
      XLSX.writeFile(wb, `${filename}_${Date.now()}.xlsx`);
      triggerToast('Berkas excel sedang diunduh...');
    } else {
      triggerToast('Gagal merujuk tabel data ekspor.', 'error');
    }
  };

  // EXCEL TEMPLATES GENERATOR
  const downloadSiswaTemplate = () => {
    const data = [
      { 'NISN': '12345', 'Nama Lengkap': 'Andi Pratama', 'Kelas': 'X-IPA-1', 'Password': 'password123', 'Status': 'Aktif' },
      { 'NISN': '12346', 'Nama Lengkap': 'Budi Santoso', 'Kelas': 'X-IPA-1', 'Password': 'password123', 'Status': 'Aktif' },
      { 'NISN': '12347', 'Nama Lengkap': 'Citra Lestari', 'Kelas': 'X-IPA-2', 'Password': 'password123', 'Status': 'Aktif' }
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Siswa');
    XLSX.writeFile(wb, 'Template_Siswa.xlsx');
    triggerToast('Berkas templat siswa berhasil diunduh.');
  };

  const downloadGuruTemplate = () => {
    const data = [
      { 'NIP': '198101012010011001', 'Nama Lengkap': 'Drs. Hermawan', 'Jabatan': 'Wali Kelas X-IPA-1', 'Password': 'guru123' },
      { 'NIP': '198402022012012002', 'Nama Lengkap': 'Sri Wahyuni, S.Pd.', 'Jabatan': 'Wali Kelas X-IPA-2', 'Password': 'guru123' }
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Guru');
    XLSX.writeFile(wb, 'Template_Guru.xlsx');
    triggerToast('Berkas templat guru berhasil diunduh.');
  };

  const downloadKelasTemplate = () => {
    const data = [
      { 'Kelas': 'XII', 'Jurusan': 'RPL-1', 'Guru Mapel': 'Sri Wahyuni, S.Pd.', 'Mapel': 'Rekayasa Perangkat Lunak' },
      { 'Kelas': 'XI', 'Jurusan': 'TKJ-2', 'Guru Mapel': 'Eko Prasetyo, S.Pd.', 'Mapel': 'Teknik Komputer Jaringan' }
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Kelas');
    XLSX.writeFile(wb, 'Template_Kelas.xlsx');
    triggerToast('Berkas templat kelas berhasil diunduh.');
  };

  // EXCEL UPLOAD READERS
  const handleUploadSiswa = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json<any>(ws);

        const importedSiswa: Siswa[] = [];
        let successCount = 0;
        let errorCount = 0;

        rawData.forEach((row: any) => {
          const nis = String(row['NISN'] || row['nisn'] || row['NIS'] || row['nis'] || '').trim();
          const nama = String(row['Nama Lengkap'] || row['Nama'] || row['nama_lengkap'] || row['nama'] || '').trim();
          const kelas = String(row['Kelas'] || row['kelas'] || '').trim().toUpperCase();
          const password = String(row['Password'] || row['password'] || '').trim() || 'siswa123';
          const rawStatus = String(row['Status'] || row['status'] || '').trim().toLowerCase();
          
          let status: 'Aktif' | 'Nonaktif' = 'Aktif';
          if (rawStatus === 'nonaktif' || rawStatus === 'non-aktif' || rawStatus === 'tidak aktif' || rawStatus === 'inactive') {
            status = 'Nonaktif';
          }

          if (nis && nama && kelas) {
            importedSiswa.push({
              nis,
              nama,
              kelas,
              password,
              status
            });
            successCount++;
          } else {
            errorCount++;
          }
        });

        if (importedSiswa.length > 0) {
          setAppState(prev => {
            const existingMap = new Map(prev.siswa.map(s => [s.nis, s]));
            importedSiswa.forEach(s => {
              existingMap.set(s.nis, s);
              dbSaveSiswa(activeSchoolId || '', s);
            });
            return {
              ...prev,
              siswa: Array.from(existingMap.values())
            };
          });
          triggerToast(`Berhasil mengimpor ${successCount} siswa.${errorCount > 0 ? ` Gagal memproses ${errorCount} data karena kolom wajib ada yang kosong.` : ''}`);
        } else {
          triggerToast('Gagal memproses data: Pastikan kolom NISN, Nama Lengkap, dan Kelas terisi.', 'error');
        }
      } catch (err) {
        triggerToast('Gagal membaca berkas Excel.', 'error');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleUploadGuru = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json<any>(ws);

        const importedGuru: Guru[] = [];
        let successCount = 0;
        let errorCount = 0;

        rawData.forEach((row: any) => {
          const nip = String(row['NIP'] || row['nip'] || row['ID'] || row['id'] || '').trim();
          const nama = String(row['Nama Lengkap'] || row['Nama'] || row['nama_lengkap'] || row['nama'] || '').trim();
          const jabatan = String(row['Jabatan'] || row['jabatan'] || '').trim();
          const password = String(row['Password'] || row['password'] || '').trim() || 'guru123';

          if (nip && nama && jabatan) {
            importedGuru.push({
              nip,
              nama,
              jabatan,
              password
            });
            successCount++;
          } else {
            errorCount++;
          }
        });

        if (importedGuru.length > 0) {
          setAppState(prev => {
            const existingMap = new Map(prev.guru.map(g => [g.nip, g]));
            importedGuru.forEach(g => {
              existingMap.set(g.nip, g);
              dbSaveGuru(activeSchoolId || '', g);
            });
            return {
              ...prev,
              guru: Array.from(existingMap.values())
            };
          });
          triggerToast(`Berhasil mengimpor ${successCount} pendidik.${errorCount > 0 ? ` Gagal memproses ${errorCount} data karena kolom wajib ada yang kosong.` : ''}`);
        } else {
          triggerToast('Gagal memproses data: Pastikan kolom NIP, Nama Lengkap, dan Jabatan terisi.', 'error');
        }
      } catch (err) {
        triggerToast('Gagal membaca berkas Excel.', 'error');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleUploadKelas = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json<any>(ws);

        const importedKelas: Kelas[] = [];
        let successCount = 0;
        let errorCount = 0;

        rawData.forEach((row: any) => {
          const kelasVal = String(row['Kelas'] || '').trim().toUpperCase();
          const jurusanVal = String(row['Jurusan'] || '').trim().toUpperCase();
          const oldNamaKelas = String(row['Nama Kelas'] || row['NamaKelas'] || row['nama_kelas'] || row['Kode Kelas'] || row['kode_kelas'] || '').trim().toUpperCase();

          const cleanKelas = kelasVal || oldNamaKelas.split('-')[0] || '';
          const cleanJurusan = jurusanVal || oldNamaKelas.split('-').slice(1).join('-').split(' - ')[0] || '';
          const guruMapel = String(row['Guru Mapel'] || row['Wali Kelas'] || row['Walikelas'] || row['wali_kelas'] || '').trim();
          const mapel = String(row['Mapel'] || row['Mata Pelajaran'] || '').trim();

          let namaKelas = cleanKelas && cleanJurusan ? `${cleanKelas}-${cleanJurusan}` : oldNamaKelas;
          if (cleanKelas && cleanJurusan && mapel) {
            namaKelas = `${cleanKelas}-${cleanJurusan} - ${mapel}`;
          }

          if (namaKelas && guruMapel) {
            importedKelas.push({
              namaKelas,
              kelas: cleanKelas,
              jurusan: cleanJurusan,
              waliKelas: guruMapel, // backwards-compatibility
              guruMapel,
              mapel
            });
            successCount++;
          } else {
            errorCount++;
          }
        });

        if (importedKelas.length > 0) {
          setAppState(prev => {
            const existingMap = new Map(prev.kelas.map(k => [k.namaKelas, k]));
            importedKelas.forEach(k => {
              existingMap.set(k.namaKelas, k);
              dbSaveKelas(activeSchoolId || '', k);
            });
            return {
              ...prev,
              kelas: Array.from(existingMap.values())
            };
          });
          triggerToast(`Berhasil mengimpor ${successCount} kelas.${errorCount > 0 ? ` Gagal memproses ${errorCount} data karena kolom wajib ada yang kosong.` : ''}`);
        } else {
          triggerToast('Gagal memproses data: Pastikan kolom Kelas, Jurusan, dan Guru Mapel terisi.', 'error');
        }
      } catch (err) {
        triggerToast('Gagal membaca berkas Excel.', 'error');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Helper for Guru Non-Admin data isolation
  const isGuruNonAdmin = appState.currentUser?.role === 'guru' && !isSystemAdmin(appState.currentUser);
  
  // Find current teacher object to fetch classes assigned to teach
  const currentGuruObj = appState.guru.find(g => g.nip === appState.currentUser?.username);
  const classesTaughtByGuru = currentGuruObj?.kelasDiajar || [];

  const managedClasses = Array.from(new Set([
    ...appState.kelas.filter(k => {
      const isWali = currentGuruObj ? isTeacherWaliOfClass(currentGuruObj, k) : false;
      const isMapel = cleanCompareTeacher(k.guruMapel || '', appState.currentUser?.nama || '') || k.guruMapel === appState.currentUser?.username;
      return isWali || isMapel;
    }).map(k => k.namaKelas),
    ...classesTaughtByGuru
  ]));

  const baseManagedClasses = managedClasses.map(c => getBaseClassGroup(c, appState.kelas));
  const normalizedManagedClasses = baseManagedClasses.map(c => normalizeClassName(c));

  // Restricted lists for components & dropdowns (supports flexible subject teacher viewing)
  const restrictedSiswaList = isGuruNonAdmin
    ? appState.siswa.filter(s => {
        const normalizedStudentClass = normalizeClassName(s.kelas);
        // Direct matching or partial matching for flexible rombel structures (e.g. "XII RPL 1" matches "XII-RPL-1")
        return normalizedManagedClasses.some(mc => normalizedStudentClass === mc || normalizedStudentClass.includes(mc) || mc.includes(normalizedStudentClass));
      })
    : appState.siswa;

  const restrictedAbsensiList = isGuruNonAdmin
    ? appState.absensi.filter(l => {
        const isMyRecord = l.guruNip === appState.currentUser?.username;
        const normalizedLogClass = normalizeClassName(l.kelas);
        const matchesClass = normalizedManagedClasses.some(mc => normalizedLogClass === mc || normalizedLogClass.includes(mc) || mc.includes(normalizedLogClass));
        const isWaliOfThisClass = currentGuruObj ? isTeacherWaliOfClass(currentGuruObj, { namaKelas: l.kelas }) : false;
        return (isMyRecord || isWaliOfThisClass) && matchesClass;
      })
    : appState.absensi;

  const restrictedKelasList = isGuruNonAdmin
    ? appState.kelas.filter(k => {
        const normalizedClassNameVal = normalizeClassName(k.namaKelas);
        return normalizedManagedClasses.some(mc => normalizedClassNameVal === mc || normalizedClassNameVal.includes(mc) || mc.includes(normalizedClassNameVal));
      })
    : appState.kelas;

  // Allowed mapels, tingkats, jurusans strictly corresponding to teacher's managed/taught classes:
  const allowedGuruMapels = isGuruNonAdmin
    ? Array.from(new Set(
        restrictedKelasList
          .map(k => k.mapel)
          .filter((m): m is string => !!m && m.trim().length > 0)
      ))
    : Array.from(new Set<string>([
        ...appState.kelas.map(k => k.mapel).filter(Boolean),
        ...MAPEL_OPTIONS
      ])).sort();

  const allowedGuruTingkat = isGuruNonAdmin
    ? Array.from(new Set<string>(
        restrictedKelasList
          .map(k => (k.kelas || k.namaKelas.split('-')[0] || k.namaKelas.split(' ')[0] || '').trim().toUpperCase())
          .filter(Boolean)
      )).sort((a: string, b: string) => {
        const standard = ['X', 'XI', 'XII'];
        const idxA = standard.indexOf(a);
        const idxB = standard.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
      })
    : Array.from(new Set<string>([
        ...appState.kelas.map(k => (k.kelas || k.namaKelas.split('-')[0] || k.namaKelas.split(' ')[0] || '').trim().toUpperCase()),
        ...appState.siswa.map(s => (s.kelas.split('-')[0] || s.kelas.split(' ')[0] || '').trim().toUpperCase())
      ])).filter(t => t.length > 0 && t !== 'CUSTOM' && t !== 'ADMIN' && t !== 'GURU').sort((a: string, b: string) => {
        const standard = ['X', 'XI', 'XII'];
        const idxA = standard.indexOf(a);
        const idxB = standard.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
      });

  const allowedGuruJurusan = isGuruNonAdmin
    ? Array.from(new Set<string>(
        restrictedKelasList
          .map(k => (k.jurusan || k.namaKelas.split('-').slice(1).join('-') || '').trim().toUpperCase())
          .filter(Boolean)
      )).sort()
    : Array.from(new Set<string>([
        ...appState.kelas.map(k => (k.jurusan || k.namaKelas.split('-').slice(1).join('-') || '').trim().toUpperCase()),
        ...appState.siswa.map(s => {
          const parts = s.kelas.split('-');
          return (parts.length > 1 ? parts.slice(1).join('-') : '').trim().toUpperCase();
        })
      ])).filter(j => j.length > 0 && j !== 'CUSTOM' && j !== 'ADMIN' && j !== 'GURU').sort();

  // Automatically adjust active states to comply with teacher's allowed values
  const currentUserUsername = appState.currentUser?.username || '';
  const allowedMapelsLength = allowedGuruMapels.length;
  const allowedTingkatLength = allowedGuruTingkat.length;
  const allowedJurusanLength = allowedGuruJurusan.length;

  useEffect(() => {
    if (isGuruNonAdmin) {
      if (allowedGuruMapels.length > 0 && !allowedGuruMapels.includes(activeMataPelajaran)) {
        setActiveMataPelajaran(allowedGuruMapels[0]);
      }
      if (activeSessionTingkat && !allowedGuruTingkat.includes(activeSessionTingkat)) {
        setActiveSessionTingkat('');
      }
      if (activeSessionJurusan && !allowedGuruJurusan.includes(activeSessionJurusan)) {
        setActiveSessionJurusan('');
      }
    }
  }, [
    isGuruNonAdmin,
    currentUserUsername,
    allowedMapelsLength,
    allowedTingkatLength,
    allowedJurusanLength,
    activeMataPelajaran,
    activeSessionTingkat,
    activeSessionJurusan
  ]);

  // Filter kelas based on UI searches
  const filteredKelasList = restrictedKelasList.filter(k => {
    let matchesTingkat = true;
    if (filterKelasTingkat) {
      const level = (k.kelas || k.namaKelas.split('-')[0] || '').trim().toUpperCase();
      matchesTingkat = level === filterKelasTingkat.toUpperCase();
    }

    let matchesJurusan = true;
    if (filterKelasJurusan) {
      const jur = (k.jurusan || k.namaKelas.split('-').slice(1).join('-') || '').trim().toUpperCase();
      matchesJurusan = jur.includes(filterKelasJurusan.toUpperCase()) || k.namaKelas.toUpperCase().includes(filterKelasJurusan.toUpperCase());
    }

    return matchesTingkat && matchesJurusan;
  });

  // Filter students based on UI searches & guru permissions
  const filteredStudents = restrictedSiswaList.filter(s => {
    const matchesSearch = s.nama.toLowerCase().includes(searchSiswaQuery.toLowerCase()) || s.nis.includes(searchSiswaQuery);
    const matchesKelas = filterSiswaKelas ? s.kelas === filterSiswaKelas : true;

    let matchesTingkat = true;
    if (filterSiswaTingkat) {
      const cleanKelas = s.kelas.trim().toUpperCase();
      const targetTingkat = filterSiswaTingkat.toUpperCase();
      matchesTingkat = cleanKelas === targetTingkat ||
                       cleanKelas.startsWith(targetTingkat + '-') ||
                       cleanKelas.startsWith(targetTingkat + ' ');
    }

    const matchesJurusan = filterSiswaJurusan 
      ? s.kelas.toUpperCase().includes(filterSiswaJurusan.toUpperCase()) 
      : true;

    return matchesSearch && matchesKelas && matchesTingkat && matchesJurusan;
  });

  // Today log list calculations
  const todayDateStr = new Date().toISOString().split('T')[0];
  const todayLogs = restrictedAbsensiList.filter(l => l.tanggal === todayDateStr);

  const totalRegisteredSiswa = restrictedSiswaList.filter(s => s.status === 'Aktif').length;
  const totalGuru = appState.guru.filter(g => isServerAdmin(appState.currentUser) || !isServerAdmin({ username: g.nip })).length;
  const totalClasses = appState.kelas.length;
  const totalHadirToday = todayLogs.filter(l => l.status.startsWith('Hadir')).length;

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50/50 text-slate-800'} font-sans leading-relaxed selection:bg-emerald-500 selection:text-white transition-colors duration-200`} id="root-web-layout">
      
      {/* GLOBAL TOAST FLOATER */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none no-print">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 20, y: -10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className={`p-4 rounded-2xl shadow-lg border flex items-start gap-3 pointer-events-auto ${
                t.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : t.type === 'warning'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
            >
              <div className="mt-0.5">
                {t.type === 'error' ? (
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                ) : t.type === 'warning' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                ) : (
                  <Check className="w-5 h-5 text-emerald-600" />
                )}
              </div>
              <div className="flex-1 text-xs font-semibold leading-relaxed">
                {t.message}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* LOGIN VIEW (PERMANENT DARK MODE) */}
      {!appState.currentUser ? (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 relative overflow-y-auto overflow-x-hidden bg-[#060c14] text-white" id="login-layout-stage">
          
          {/* HIGH-TECH FUTURISTIC CYBER GRADIENT BACKDROP */}
          <div className="absolute inset-0 z-0 select-none pointer-events-none overflow-hidden">
            {/* Ambient colorful grid pattern */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#0ea5e9_1px,transparent_1px),linear-gradient(to_bottom,#0ea5e9_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
            </div>

            {/* Glowing neon atmospheric lights mimicking the uploaded image */}
            <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none animate-pulse duration-[8000ms]" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-sky-500/15 blur-[100px] pointer-events-none animate-pulse duration-[6000ms]" />

            {/* Ambient abstract texture backdrop */}
            <img 
              src="https://images.unsplash.com/photo-1554034483-04fda0d3507b?auto=format&fit=crop&w=1920&q=80" 
              alt="Bright Sky Blue and White Aesthetic Backdrop" 
              className="w-full h-full object-cover opacity-20 mix-blend-color-dodge filter saturate-150"
              referrerPolicy="no-referrer"
            />
            
            {/* Real-time moving elegant scanning laser line */}
            <div className="absolute inset-0 opacity-[0.08] mix-blend-color-dodge">
              <div className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent absolute top-0 animate-[scan-laser_4s_ease-in-out_infinite]" />
            </div>
          </div>

          {/* Inline Animation styles for the laser scanning sweeps */}
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes scan-laser-internal {
              0% { top: 8%; }
              50% { top: 92%; }
              100% { top: 8%; }
            }
            @keyframes scan-laser {
              0% { transform: translateY(0); }
              50% { transform: translateY(100vh); }
              100% { transform: translateY(0); }
            }
          `}} />

          {/* CONTENT LAYER */}
          <div className="w-full max-w-md z-10 flex flex-col items-center">
            
            {/* 1. BRANDING TITLE (MATCHING USER'S UPLOADED IMAGE) */}
            <div className="text-center mb-6">
              <div className="inline-block px-3 py-1 mb-3 rounded-full text-[10px] font-black tracking-[0.3em] uppercase bg-gradient-to-r from-cyan-500/20 to-sky-500/20 text-cyan-300 border border-cyan-400/30 backdrop-blur-sm shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                by PGW
              </div>
              <h1 className="text-3xl font-extrabold tracking-[0.1em] transition-colors duration-300 uppercase text-white">
                Sistem Absensi
              </h1>
              <h2 className="text-4xl font-black tracking-[0.15em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 mt-1 uppercase drop-shadow-[0_0_15px_rgba(34,211,238,0.25)]">
                QR CODE
              </h2>
              <p className="text-[10px] tracking-[0.25em] font-bold uppercase mt-3 text-slate-400">
                ABSENSI MUDAH & CEPAT
              </p>
            </div>

            {/* 2. THE CENTERPIECE: REMOVED FUTURISTIC QR CODE SCANNERS PER USER'S REQUEST */}

            {/* 3. GLASSMORPHISM PORTAL ENTRY CARD (FROM IMAGE) */}
            <div className="w-full backdrop-blur-xl border transition-all duration-300 rounded-[32px] p-6 shadow-2xl bg-slate-950/50 border-white/15 shadow-[0_25px_50px_rgba(0,0,0,0.5)]">
              <h2 className="font-bold text-center text-lg mb-4 tracking-wide text-white">
                Masuk ke Portal
              </h2>
              
              <div className="space-y-4">
                
                {/* Role Switcher */}
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-2 text-center tracking-wider text-slate-400">
                    Tipe Hak Akses
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl border bg-slate-900/50 border-white/5">
                    <button
                      onClick={() => setLoginRole('siswa')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                        loginRole === 'siswa' 
                          ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      id="btn-login-role-siswa"
                    >
                      Siswa (Murid)
                    </button>
                    <button
                      onClick={() => setLoginRole('guru')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                        loginRole === 'guru' 
                          ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      id="btn-login-role-guru"
                    >
                      Guru / Staff
                    </button>
                  </div>
                </div>

                {/* ID input */}
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1.5 tracking-wide text-slate-300">
                    ID Pengguna (NISN / NIP)
                  </label>
                  <input
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder={loginRole === 'siswa' ? "Contoh: 12345 (Budi)" : "Contoh: admin / 19800101"}
                    className="w-full text-sm px-4 py-3 rounded-2xl font-medium focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all bg-slate-900/60 border border-white/10 text-white placeholder:text-slate-500"
                    id="input-login-username"
                  />
                </div>

                {/* Password input */}
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1.5 tracking-wide text-slate-300">
                    Password Login
                  </label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Masukkan sandi Anda"
                    className="w-full text-sm px-4 py-3 rounded-2xl font-medium focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all bg-slate-900/60 border border-white/10 text-white placeholder:text-slate-500"
                    id="input-login-password"
                  />
                </div>

                {/* Pilih Asal Sekolah */}
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1.5 tracking-wide text-slate-300">
                    Pilih Asal Sekolah
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={schoolInputValue}
                      onChange={(e) => {
                        const typedVal = e.target.value;
                        setSchoolInputValue(typedVal);
                        const found = sekolahList.find(s => 
                          s.nama.toLowerCase() === typedVal.toLowerCase() ||
                          s.id.toLowerCase() === typedVal.toLowerCase()
                        );
                        if (found) {
                          setActiveSchoolId(found.id);
                          localStorage.setItem('active-school-id', found.id);
                        } else {
                          setActiveSchoolId(null);
                          localStorage.removeItem('active-school-id');
                        }
                      }}
                      placeholder="Ketik manual nama sekolah binaan..."
                      className="w-full text-xs px-4 py-3.5 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all bg-slate-900/60 border border-white/10 text-white placeholder:text-slate-500"
                      id="input-login-school-manual"
                    />
                  </div>
                  
                  {schoolInputValue.trim() && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-semibold">
                      {activeSchoolId ? (
                        <span className="text-emerald-500 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Sekolah Terverifikasi: ID [{activeSchoolId}]</span>
                        </span>
                      ) : (
                        <span className="text-amber-500 flex items-center gap-1 animate-pulse">
                          <span>⚠️ Sekolah belum cocok dengan database Server Admin.</span>
                        </span>
                      )}
                    </div>
                  )}
                  {sekolahList.length === 0 && (
                    <p className="text-[10px] text-rose-500 font-semibold mt-1">Belum ada sekolah terdaftar. Hubungi Admin Server.</p>
                  )}
                </div>

                {/* Elegant glow trigger login button */}
                <button
                  onClick={executeLogin}
                  className="w-full bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 hover:from-cyan-400 hover:via-sky-400 hover:to-indigo-500 text-white font-bold text-sm py-3.5 px-4 rounded-2xl transition-all shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/20 active:scale-[0.98] mt-6 flex items-center justify-center gap-2 cursor-pointer"
                  id="btn-execute-login"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Masuk Portal Sekarang</span>
                </button>
              </div>

            </div>

          </div>
        </div>
      ) : (
        
        /* AUTHENTICATED PANEL */
        <div className={`flex flex-col md:flex-row min-h-screen ${isDarkMode ? 'dark:bg-slate-950 text-slate-100' : ''}`}>
          
          {/* MOBILE HEADER - SECURELY DESIGNED FOR HP VIEWPORTS WITHOUT OVERLAP */}
          <header className="flex md:hidden justify-between items-center bg-slate-900 text-white px-4 py-3.5 sticky top-0 z-40 shadow-md no-print border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-emerald-500 text-white rounded-lg flex items-center justify-center font-extrabold text-sm shadow-sm">
                QP
              </div>
              <div>
                <h3 className="font-extrabold text-xs tracking-wide text-white uppercase leading-none">QR Presensi</h3>
                <p className="text-[9px] text-slate-400 font-mono mt-0.5 leading-none font-bold">By PGW.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Theme Toggle Button for HP */}
              <button
                onClick={toggleTheme}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-755 text-amber-400 transition-all active:scale-95 border border-slate-700/50 cursor-pointer"
                aria-label="Toggle Dark Mode"
              >
                {isDarkMode ? (
                  <Sun className="w-4 h-4 text-emerald-400 animate-pulse" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-300" />
                )}
              </button>

              {/* Hamburger Menu toggle button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-755 text-slate-300 transition-all active:scale-95 border border-slate-700/50 cursor-pointer"
                aria-label="Toggle Menu"
              >
                {isMobileMenuOpen ? <X className="w-4.5 h-4.5 text-rose-400" /> : <Menu className="w-4.5 h-4.5" />}
              </button>
            </div>
          </header>

          {/* MOBILE NAVIGATION DRAWER - ELEGANTLY FLOATING/EXPANDING */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="md:hidden bg-slate-900 border-b border-slate-800/80 text-slate-350 shadow-xl overflow-hidden no-print z-30 sticky top-[57px] max-h-[85vh] overflow-y-auto"
              >
                {/* Mobile User Profile info */}
                <div className="p-4 border-b border-slate-800/50 bg-slate-950/40 flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-full bg-slate-100/10 text-slate-200 flex items-center justify-center font-bold text-lg border border-slate-700/40 overflow-hidden shrink-0">
                    {appState.currentUser.foto ? (
                      <img src={appState.currentUser.foto} alt="Foto Profil" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    ) : (
                      appState.currentUser.nama.charAt(0)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-white tracking-wide truncate">{appState.currentUser.nama}</h4>
                    <span className="mt-0.5 inline-block text-[8px] tracking-widest font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-600 text-emerald-55 max-w-full truncate">
                      {appState.currentUser.role === 'guru' ? appState.currentUser.extra : 'SISWA'}
                    </span>
                  </div>
                </div>

                <nav className="p-3 space-y-1 text-xs font-semibold">
                  {appState.currentUser.role === 'siswa' ? (
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest p-1">Portal Siswa</p>
                      
                      <button
                        onClick={() => {
                          setActiveSiswaTab('dash');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer min-h-[44px] ${
                          activeSiswaTab === 'dash' 
                            ? 'bg-emerald-600 text-white font-bold' 
                            : 'hover:bg-slate-800 hover:text-slate-100 text-slate-300'
                        }`}
                        id="btn-sidebar-sis-dash-mobile"
                      >
                        <School className="w-4 h-4 text-emerald-400" />
                        <span>Dashboard Siswa</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveSiswaTab('card');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer min-h-[44px] ${
                          activeSiswaTab === 'card' 
                            ? 'bg-emerald-600 text-white font-bold' 
                            : 'hover:bg-slate-800 hover:text-slate-100 text-slate-300'
                        }`}
                        id="btn-sidebar-sis-card-mobile"
                      >
                        <ClipboardCheck className="w-4 h-4 text-emerald-400" />
                        <span>Kartu Absensi QR</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveSiswaTab('laporan');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer min-h-[44px] ${
                          activeSiswaTab === 'laporan' 
                            ? 'bg-emerald-600 text-white font-bold' 
                            : 'hover:bg-slate-800 hover:text-slate-100 text-slate-300'
                        }`}
                        id="btn-sidebar-sis-laporan-mobile"
                      >
                        <Clock className="w-4 h-4 text-emerald-400" />
                        <span>Laporan Harian</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveSiswaTab('rekap');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer min-h-[44px] ${
                          activeSiswaTab === 'rekap' 
                            ? 'bg-emerald-600 text-white font-bold' 
                            : 'hover:bg-slate-800 hover:text-slate-100 text-slate-300'
                        }`}
                        id="btn-sidebar-sis-rekap-mobile"
                      >
                        <FileText className="w-4 h-4 text-emerald-400" />
                        <span>Rekap Bulanan</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest p-1">Sistem Utama</p>
                      
                      <button
                        onClick={() => {
                          setActiveSection('g-dash');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer min-h-[44px] ${
                          activeSection === 'g-dash' 
                            ? 'bg-emerald-600 text-white font-bold' 
                            : 'hover:bg-slate-800 hover:text-slate-100'
                        }`}
                      >
                        <ClipboardCheck className="w-4 h-4 text-emerald-400" />
                        <span>Dashboard</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveSection('g-murid');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer min-h-[44px] ${
                          activeSection === 'g-murid' 
                            ? 'bg-emerald-600 text-white font-bold' 
                            : 'hover:bg-slate-800 hover:text-slate-100'
                        }`}
                      >
                        <Users className="w-4 h-4 text-emerald-400" />
                        <span>Data Murid (Siswa)</span>
                      </button>

                      {isSystemAdmin(appState.currentUser) && (
                        <button
                          onClick={() => {
                            setActiveSection('g-guru');
                            setIsMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer min-h-[44px] ${
                            activeSection === 'g-guru' 
                              ? 'bg-emerald-600 text-white font-bold' 
                              : 'hover:bg-slate-800 hover:text-slate-100'
                          }`}
                        >
                          <GraduationCap className="w-4 h-4 text-emerald-400" />
                          <span>Data Guru (Staf)</span>
                        </button>
                      )}

                      {isSystemAdmin(appState.currentUser) && (
                        <button
                          onClick={() => {
                            setActiveSection('g-kelas');
                            setIsMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer min-h-[44px] ${
                            activeSection === 'g-kelas' 
                              ? 'bg-emerald-600 text-white font-bold' 
                              : 'hover:bg-slate-800 hover:text-slate-100'
                          }`}
                        >
                          <School className="w-4 h-4 text-emerald-400" />
                          <span>Manajemen Kelas</span>
                        </button>
                      )}

                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest p-1 pt-3.5">Laporan & Log</p>

                      <button
                        onClick={() => {
                          setActiveSection('g-kelola');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer min-h-[44px] ${
                          activeSection === 'g-kelola' 
                            ? 'bg-emerald-600 text-white font-bold' 
                            : 'hover:bg-slate-800 hover:text-slate-100'
                        }`}
                      >
                        <ListTodo className="w-4 h-4 text-emerald-400" />
                        <span>Kelola Log Absen</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveSection('g-hadir');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer min-h-[44px] ${
                          activeSection === 'g-hadir' 
                            ? 'bg-emerald-600 text-white font-bold' 
                            : 'hover:bg-slate-800 hover:text-slate-100'
                        }`}
                      >
                        <CalendarCheck2 className="w-4 h-4 text-emerald-400" />
                        <span>Daftar Log Presensi</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveSection('g-laporan');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer min-h-[44px] ${
                          activeSection === 'g-laporan' 
                            ? 'bg-emerald-600 text-white font-bold' 
                            : 'hover:bg-slate-800 hover:text-slate-100'
                        }`}
                      >
                        <FileText className="w-4 h-4 text-emerald-400" />
                        <span>Laporan Harian</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveSection('g-rekap');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer min-h-[44px] ${
                          activeSection === 'g-rekap' 
                            ? 'bg-emerald-600 text-white font-bold' 
                            : 'hover:bg-slate-800 hover:text-slate-100'
                        }`}
                      >
                        <CalendarDays className="w-4 h-4 text-emerald-400" />
                        <span>Rekap Bulanan</span>
                      </button>

                      {isSystemAdmin(appState.currentUser) && (
                        <button
                          onClick={() => {
                            setActiveSection('g-promotion');
                            setIsMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer min-h-[44px] ${
                            activeSection === 'g-promotion' 
                              ? 'bg-emerald-600 text-white font-bold' 
                              : 'hover:bg-slate-800 hover:text-slate-100'
                          }`}
                        >
                          <BookOpen className="w-4 h-4 text-emerald-400" />
                          <span>Kenaikan Kelas</span>
                        </button>
                      )}

                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest p-1 pt-3.5">Dokumentasi & Bantuan</p>

                      <button
                        onClick={() => {
                          setActiveSection('g-panduan');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer min-h-[44px] ${
                          activeSection === 'g-panduan' 
                            ? 'bg-emerald-600 text-white font-bold' 
                            : 'hover:bg-slate-800 hover:text-slate-100'
                        }`}
                        id="btn-sidebar-panduan"
                      >
                        <HelpCircle className="w-4 h-4 text-emerald-400" />
                        <span>Panduan & Slides PPT</span>
                      </button>

                      {isServerAdmin(appState.currentUser) && (
                        <button
                          onClick={() => {
                            setActiveSection('g-server');
                            setIsMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left border border-amber-500/20 bg-amber-950/10 transition-colors cursor-pointer min-h-[44px] ${
                            activeSection === 'g-server' 
                              ? 'bg-amber-600 text-white font-bold' 
                              : 'hover:bg-slate-800 text-amber-300'
                          }`}
                        >
                          <Sliders className="w-4 h-4 text-amber-400 rotate-90 animate-pulse" />
                          <span>Admin Server Center</span>
                        </button>
                      )}
                    </div>
                  )}
                </nav>

                <div className="p-3 bg-slate-950 border-t border-slate-820 flex gap-2">
                  <button
                    onClick={() => {
                      executeLogout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-rose-100 bg-rose-600 hover:bg-rose-700 text-xs font-bold transition-all cursor-pointer min-h-[44px]"
                  >
                    <LogOut className="w-4 h-4 text-rose-100" />
                    <span>Keluar / Log Out</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* DESKTOP SIDEBAR - VISIBLE ONLY ON LAPTOP (DESKTOP) */}
          <aside className="hidden md:flex md:w-64 bg-slate-900 text-slate-400 flex-col justify-between shrink-0 no-print" id="app-sidebar">
            <div>
              
              {/* BRAND HEADER */}
              <div className="p-5 border-b border-slate-800/60 bg-slate-950 flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-500 text-white rounded-xl flex items-center justify-center font-bold">
                  QP
                </div>
                <div>
                  <h3 className="font-black text-sm tracking-wide text-white uppercase">QR Presensi</h3>
                  <p className="text-[10px] text-slate-450 font-mono mt-0.5">By PGW.</p>
                </div>
              </div>

              {/* DESKTOP WORKSPACE THEME TOGGLE */}
              <div className="px-4 py-2 bg-slate-950 flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/50">
                <span className="font-extrabold tracking-wide uppercase text-[9px] text-slate-500">Tampilan</span>
                <button
                  onClick={toggleTheme}
                  className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white px-2 py-1 rounded-lg border border-slate-700/30 text-[10px] font-extrabold tracking-wide uppercase transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                  {isDarkMode ? (
                    <>
                      <Sun className="w-3 h-3 text-amber-400 animate-pulse" />
                      <span>Mode Terang</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3 h-3 text-indigo-400" />
                      <span>Mode Gelap</span>
                    </>
                  )}
                </button>
              </div>

              {/* USER PROFILE INFO RAILS */}
              <div className="p-4 border-b border-slate-800/40 text-center bg-slate-900/40">
                <div className="relative w-16 h-16 rounded-full bg-slate-800 text-slate-200 mx-auto flex items-center justify-center font-bold text-2xl border border-slate-700/50 overflow-hidden shadow-inner mb-3 group">
                  {appState.currentUser.foto ? (
                    <img src={appState.currentUser.foto} alt="Foto Profil" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  ) : (
                    appState.currentUser.nama.charAt(0)
                  )}
                  <label className="absolute inset-0 bg-black/60 transition-opacity duration-200 flex flex-col items-center justify-center cursor-pointer text-white opacity-0 group-hover:opacity-100">
                    <Upload className="w-4.5 h-4.5" />
                    <span className="text-[8px] font-extrabold uppercase tracking-wider mt-0.5">Unggah</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleSidebarPhotoUpload} 
                    />
                  </label>
                </div>

                <h4 className="text-xs font-bold text-white tracking-wide truncate">{appState.currentUser.nama}</h4>
                <span className="mt-1 inline-block text-[10px] tracking-widest font-extrabold uppercase px-2.5 py-0.5 rounded bg-emerald-650 text-emerald-100 border border-emerald-500/20 max-w-full truncate">
                  {appState.currentUser.role === 'guru' ? appState.currentUser.extra : 'SISWA'}
                </span>
                {appState.currentUser.role === 'siswa' && (
                  <p className="text-[10px] font-mono text-slate-400 mt-1">{appState.currentUser.extra}</p>
                )}
              </div>

              {/* CONDITIONAL NAVIGATIONS */}
              <nav className="p-2 space-y-1 text-sm font-medium">
                {appState.currentUser.role === 'siswa' ? (
                  /* Student Sidebar */
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-550 uppercase tracking-widest p-2">Portal Siswa</p>
                    
                    <button
                      onClick={() => setActiveSiswaTab('dash')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                        activeSiswaTab === 'dash' 
                          ? 'bg-emerald-600 text-white font-semibold' 
                          : 'hover:bg-slate-850 hover:text-slate-100 text-slate-350'
                      }`}
                      id="btn-sidebar-sis-dash"
                    >
                      <School className="w-4 h-4" />
                      <span>Dashboard Siswa</span>
                    </button>

                    <button
                      onClick={() => setActiveSiswaTab('card')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                        activeSiswaTab === 'card' 
                          ? 'bg-emerald-600 text-white font-semibold' 
                          : 'hover:bg-slate-850 hover:text-slate-100 text-slate-350'
                      }`}
                      id="btn-sidebar-sis-card"
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      <span>Kartu Absensi QR</span>
                    </button>

                    <button
                      onClick={() => setActiveSiswaTab('laporan')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                        activeSiswaTab === 'laporan' 
                          ? 'bg-emerald-600 text-white font-semibold' 
                          : 'hover:bg-slate-850 hover:text-slate-100 text-slate-350'
                      }`}
                      id="btn-sidebar-sis-laporan"
                    >
                      <Clock className="w-4 h-4" />
                      <span>Laporan Harian</span>
                    </button>

                    <button
                      onClick={() => setActiveSiswaTab('rekap')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                        activeSiswaTab === 'rekap' 
                          ? 'bg-emerald-600 text-white font-semibold' 
                          : 'hover:bg-slate-850 hover:text-slate-100 text-slate-350'
                      }`}
                      id="btn-sidebar-sis-rekap"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Rekap Bulanan</span>
                    </button>
                  </div>
                ) : (
                  /* Teacher Sidebar */
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-550 uppercase tracking-widest p-2">Sistem Utama</p>
                    
                    <button
                      onClick={() => setActiveSection('g-dash')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                        activeSection === 'g-dash' 
                          ? 'bg-emerald-600 text-white font-semibold' 
                          : 'hover:bg-slate-850 hover:text-slate-100'
                      }`}
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      <span>Dashboard</span>
                    </button>

                    <button
                      onClick={() => setActiveSection('g-murid')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                        activeSection === 'g-murid' 
                          ? 'bg-emerald-600 text-white font-semibold' 
                          : 'hover:bg-slate-850 hover:text-slate-100'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      <span>Data Murid (Siswa)</span>
                    </button>

                    {isSystemAdmin(appState.currentUser) && (
                      <button
                        onClick={() => setActiveSection('g-guru')}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                          activeSection === 'g-guru' 
                            ? 'bg-emerald-600 text-white font-semibold' 
                            : 'hover:bg-slate-850 hover:text-slate-100'
                        }`}
                      >
                        <GraduationCap className="w-4 h-4" />
                        <span>Data Guru (Staf)</span>
                      </button>
                    )}

                    {isSystemAdmin(appState.currentUser) && (
                      <button
                        onClick={() => setActiveSection('g-kelas')}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                          activeSection === 'g-kelas' 
                            ? 'bg-emerald-600 text-white font-semibold' 
                            : 'hover:bg-slate-850 hover:text-slate-100'
                        }`}
                      >
                        <School className="w-4 h-4" />
                        <span>Manajemen Kelas</span>
                      </button>
                    )}

                    <p className="text-[10px] font-bold text-slate-550 uppercase tracking-widest p-2 pt-4">Laporan & Log</p>

                    <button
                      onClick={() => setActiveSection('g-kelola')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                        activeSection === 'g-kelola' 
                          ? 'bg-emerald-600 text-white font-semibold' 
                          : 'hover:bg-slate-850 hover:text-slate-100'
                      }`}
                    >
                      <ListTodo className="w-4 h-4" />
                      <span>Kelola Log Absen</span>
                    </button>

                    <button
                      onClick={() => setActiveSection('g-hadir')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                        activeSection === 'g-hadir' 
                          ? 'bg-emerald-600 text-white font-semibold' 
                          : 'hover:bg-slate-850 hover:text-slate-100'
                      }`}
                    >
                      <CalendarCheck2 className="w-4 h-4" />
                      <span>Daftar Log Presensi</span>
                    </button>

                    <button
                      onClick={() => setActiveSection('g-laporan')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                        activeSection === 'g-laporan' 
                          ? 'bg-emerald-600 text-white font-semibold' 
                          : 'hover:bg-slate-850 hover:text-slate-100'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      <span>Laporan Harian</span>
                    </button>

                    <button
                      onClick={() => setActiveSection('g-rekap')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                        activeSection === 'g-rekap' 
                          ? 'bg-emerald-600 text-white font-semibold' 
                          : 'hover:bg-slate-850 hover:text-slate-100'
                      }`}
                    >
                      <CalendarDays className="w-4 h-4" />
                      <span>Rekap Bulanan</span>
                    </button>

                    {isSystemAdmin(appState.currentUser) && (
                      <button
                        onClick={() => setActiveSection('g-promotion')}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                          activeSection === 'g-promotion' 
                            ? 'bg-emerald-600 text-white font-semibold' 
                            : 'hover:bg-slate-850 hover:text-slate-100'
                        }`}
                      >
                        <BookOpen className="w-4 h-4" />
                        <span>Kenaikan Kelas</span>
                      </button>
                    )}

                    <p className="text-[10px] font-bold text-slate-550 uppercase tracking-widest p-2 pt-4">Dokumentasi & Bantuan</p>

                    <button
                      onClick={() => setActiveSection('g-panduan')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                        activeSection === 'g-panduan' 
                          ? 'bg-emerald-600 text-white font-semibold' 
                          : 'hover:bg-slate-850 hover:text-slate-100'
                      }`}
                      id="btn-sidebar-panduan-desktop"
                    >
                      <HelpCircle className="w-4 h-4 text-emerald-400" />
                      <span>Panduan & Slides PPT</span>
                    </button>

                    {isServerAdmin(appState.currentUser) && (
                      <button
                        onClick={() => setActiveSection('g-server')}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left border border-amber-500/20 bg-amber-950/10 transition-colors cursor-pointer ${
                          activeSection === 'g-server' 
                            ? 'bg-amber-600 text-white font-bold' 
                            : 'hover:bg-slate-850 text-amber-300'
                        }`}
                      >
                        <Sliders className="w-4 h-4 text-amber-400 rotate-90 animate-pulse" />
                        <span>Admin Server Center</span>
                      </button>
                    )}
                  </div>
                )}
              </nav>

            </div>

            {/* LOG OUT SWITCH FOOTER */}
            <div className="p-3 border-t border-slate-800/80 bg-slate-950">
              <button
                onClick={executeLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-colors text-slate-400 hover:text-white hover:bg-rose-955/40 text-xs font-bold cursor-pointer"
                id="btn-sidebar-logout"
              >
                <LogOut className="w-4 h-4 text-rose-500" />
                <span>Keluar / Log Out</span>
              </button>
            </div>
          </aside>

          {/* MAIN CONTAINER WORKSPACE */}
          <main className="flex-1 p-6 overflow-y-auto print:p-0 print:overflow-visible">
            
            {/* Siswa Section Routes wrapper */}
            {appState.currentUser.role === 'siswa' && (
              <SiswaSection 
                currentUser={appState.currentUser} 
                triggerToast={triggerToast} 
                absensi={appState.absensi} 
                onPhotoUpload={savePhotoForUser} 
                activeTab={activeSiswaTab}
                setActiveTab={setActiveSiswaTab}
              />
            )}

            {/* Guru/Admin Routing */}
            {appState.currentUser.role === 'guru' && (
              <div>
                
                {/* 1. GURU DASHBOARD & LIVE QR SCANNER */}
                {activeSection === 'g-dash' && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sistem Realtime QR Absensi</h2>
                        <p className="text-slate-500 text-sm mt-0.5">Kelola deteksi kehadiran masuk harian siswa secara otomatis atau manual.</p>
                      </div>
                      <div className="text-xs bg-emerald-50 text-emerald-800 font-bold px-3 py-1.5 rounded-xl border border-emerald-100 font-mono">
                        Hari Ini: {new Date().toISOString().split('T')[0]}
                      </div>
                    </div>

                    {/* BULLET STATS COUNTERS PANEL */}
                    <div className={`grid ${isSystemAdmin(appState.currentUser) ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2'} gap-4`} id="stats-counter-banner">
                      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Murid Terdaftar</span>
                          <span className="text-2xl font-black text-slate-850 mt-1 block">{totalRegisteredSiswa}</span>
                        </div>
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                          <Users className="w-5 h-5" />
                        </div>
                      </div>

                      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Log Hadir Hari Ini</span>
                          <span className="text-2xl font-black text-emerald-650 mt-1 block">{totalHadirToday}</span>
                        </div>
                        <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                          <Check className="w-5 h-5" />
                        </div>
                      </div>

                      {isSystemAdmin(appState.currentUser) && (
                        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Guru</span>
                            <span className="text-2xl font-black text-slate-850 mt-1 block">{totalGuru}</span>
                          </div>
                          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                            <GraduationCap className="w-5 h-5" />
                          </div>
                        </div>
                      )}

                      {isSystemAdmin(appState.currentUser) && (
                        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block uppercase">Kelas Aktif</span>
                            <span className="text-2xl font-black text-slate-850 mt-1 block">{totalClasses}</span>
                          </div>
                          <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                            <School className="w-5 h-5" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 3D BAR CHART DIAGRAM BATANG FOR SERVER ADMIN & SCHOOL ADMIN */}
                    {isSystemAdmin(appState.currentUser) && (
                      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div>
                            <h3 className="text-sm font-black uppercase text-slate-850 tracking-wider flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-emerald-500" />
                              <span>Visualisasi Statistik Realtime (3D Isometric Chart)</span>
                            </h3>
                            <p className="text-slate-400 text-[11px]">Diagram batang 3D interaktif yang menyajikan ringkasan metrik data operasional sekolah binaan terdaftar saat ini.</p>
                          </div>
                          
                          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 px-3 py-1 rounded-xl text-[10px] font-mono font-black border border-emerald-100">
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>DATABASE CLOUD SYNCED</span>
                          </div>
                        </div>

                        {/* RENDER THE 3D CHART */}
                        <div className="py-6 flex justify-center items-center bg-slate-50/50 rounded-2xl border border-slate-150 overflow-hidden min-h-[360px]">
                          <div className="w-full max-w-xl mx-auto px-4">
                            {(() => {
                              const chartDataPoints = [
                                {
                                  key: 'murid',
                                  label: 'Murid Terdaftar',
                                  value: totalRegisteredSiswa,
                                  colorHex: '#6366f1',
                                  gradLeft: 'url(#gradIndigoLeft)',
                                  gradRight: 'url(#gradIndigoRight)',
                                  gradTop: 'url(#gradIndigoTop)',
                                  prefix: 'Siswa'
                                },
                                {
                                  key: 'hadir',
                                  label: 'Hadir Hari Ini',
                                  value: totalHadirToday,
                                  colorHex: '#10b981',
                                  gradLeft: 'url(#gradEmeraldLeft)',
                                  gradRight: 'url(#gradEmeraldRight)',
                                  gradTop: 'url(#gradEmeraldTop)',
                                  prefix: 'Logs'
                                },
                                {
                                  key: 'guru',
                                  label: 'Total Guru',
                                  value: totalGuru,
                                  colorHex: '#f59e0b',
                                  gradLeft: 'url(#gradAmberLeft)',
                                  gradRight: 'url(#gradAmberRight)',
                                  gradTop: 'url(#gradAmberTop)',
                                  prefix: 'Guru'
                                },
                                {
                                  key: 'kelas',
                                  label: 'Kelas Aktif',
                                  value: totalClasses,
                                  colorHex: '#f43f5e',
                                  gradLeft: 'url(#gradRoseLeft)',
                                  gradRight: 'url(#gradRoseRight)',
                                  gradTop: 'url(#gradRoseTop)',
                                  prefix: 'Rombel'
                                }
                              ];

                              const maxVal = Math.max(...chartDataPoints.map(d => d.value), 4);
                              // Calculate steps dynamic
                              const stepVal = Math.ceil(maxVal / 4);

                              return (
                                <svg 
                                  viewBox="0 0 540 320" 
                                  width="100%" 
                                  height="100%" 
                                  className="overflow-visible font-sans"
                                >
                                  <defs>
                                    {/* Indigo Gradients */}
                                    <linearGradient id="gradIndigoLeft" x1="0%" y1="0%" x2="0%" y2="100%">
                                      <stop offset="0%" stopColor="#6366f1" />
                                      <stop offset="100%" stopColor="#4f46e5" />
                                    </linearGradient>
                                    <linearGradient id="gradIndigoRight" x1="0%" y1="0%" x2="0%" y2="100%">
                                      <stop offset="0%" stopColor="#4f46e5" />
                                      <stop offset="100%" stopColor="#3730a3" />
                                    </linearGradient>
                                    <linearGradient id="gradIndigoTop" x1="0%" y1="0%" x2="100%" y2="100%">
                                      <stop offset="0%" stopColor="#a5b4fc" />
                                      <stop offset="100%" stopColor="#818cf8" />
                                    </linearGradient>

                                    {/* Emerald Gradients */}
                                    <linearGradient id="gradEmeraldLeft" x1="0%" y1="0%" x2="0%" y2="100%">
                                      <stop offset="0%" stopColor="#10b981" />
                                      <stop offset="100%" stopColor="#059669" />
                                    </linearGradient>
                                    <linearGradient id="gradEmeraldRight" x1="0%" y1="0%" x2="0%" y2="100%">
                                      <stop offset="0%" stopColor="#059669" />
                                      <stop offset="100%" stopColor="#047857" />
                                    </linearGradient>
                                    <linearGradient id="gradEmeraldTop" x1="0%" y1="0%" x2="100%" y2="100%">
                                      <stop offset="0%" stopColor="#6ee7b7" />
                                      <stop offset="100%" stopColor="#34d399" />
                                    </linearGradient>

                                    {/* Amber Gradients */}
                                    <linearGradient id="gradAmberLeft" x1="0%" y1="0%" x2="0%" y2="100%">
                                      <stop offset="0%" stopColor="#f59e0b" />
                                      <stop offset="100%" stopColor="#d97706" />
                                    </linearGradient>
                                    <linearGradient id="gradAmberRight" x1="0%" y1="0%" x2="0%" y2="100%">
                                      <stop offset="0%" stopColor="#d97706" />
                                      <stop offset="100%" stopColor="#b45309" />
                                    </linearGradient>
                                    <linearGradient id="gradAmberTop" x1="0%" y1="0%" x2="100%" y2="100%">
                                      <stop offset="0%" stopColor="#fde047" />
                                      <stop offset="100%" stopColor="#facc15" />
                                    </linearGradient>

                                    {/* Rose Gradients */}
                                    <linearGradient id="gradRoseLeft" x1="0%" y1="0%" x2="0%" y2="100%">
                                      <stop offset="0%" stopColor="#f43f5e" />
                                      <stop offset="100%" stopColor="#e11d48" />
                                    </linearGradient>
                                    <linearGradient id="gradRoseRight" x1="0%" y1="0%" x2="0%" y2="100%">
                                      <stop offset="0%" stopColor="#e11d48" />
                                      <stop offset="100%" stopColor="#be123c" />
                                    </linearGradient>
                                    <linearGradient id="gradRoseTop" x1="0%" y1="0%" x2="100%" y2="100%">
                                      <stop offset="0%" stopColor="#fda4af" />
                                      <stop offset="100%" stopColor="#fb7185" />
                                    </linearGradient>
                                  </defs>

                                  {/* BACKDROP ISO GRID LINES */}
                                  <g opacity="0.4" className="stroke-slate-200">
                                    <line x1="45" y1="240" x2="500" y2="240" strokeWidth="1.5" />
                                    <line x1="45" y1="195" x2="500" y2="195" strokeWidth="1" strokeDasharray="3,3" />
                                    <line x1="45" y1="150" x2="500" y2="150" strokeWidth="1" strokeDasharray="3,3" />
                                    <line x1="45" y1="105" x2="500" y2="105" strokeWidth="1" strokeDasharray="3,3" />
                                    <line x1="45" y1="60" x2="500" y2="60" strokeWidth="1" strokeDasharray="3,3" />
                                  </g>

                                  {/* Y AXIS MARKS */}
                                  <g opacity="0.5" className="fill-slate-400 font-mono text-[10px] font-bold">
                                    <text x="35" y="244" textAnchor="end">0</text>
                                    <text x="35" y="199" textAnchor="end">{stepVal}</text>
                                    <text x="35" y="154" textAnchor="end">{stepVal * 2}</text>
                                    <text x="35" y="109" textAnchor="end">{stepVal * 3}</text>
                                    <text x="35" y="64" textAnchor="end">{maxVal}</text>
                                  </g>

                                  {/* RENDER THE 3D ISOMETRIC COLUMNS */}
                                  {chartDataPoints.map((item, idx) => {
                                    const X = 85 + idx * 125;
                                    const Y = 240;
                                    const W = 36; // Width of column
                                    const D = 18; // Depth of isometric top cap
                                    
                                    // Scale column height between 15px and 170px
                                    const H = Math.max(15, (item.value / maxVal) * 170);

                                    return (
                                      <g 
                                        key={item.key} 
                                        className="cursor-pointer transition-all duration-300 hover:opacity-90"
                                      >
                                        {/* Subtle Floor Shadow */}
                                        <polygon 
                                          points={`${X},${Y} ${X - W/2 - 4},${Y - D/2} ${X},${Y - D} ${X + W/2 + 4},${Y - D/2}`}
                                          fill="rgba(15, 23, 42, 0.08)"
                                        />

                                        {/* FRONT LEFT FACE */}
                                        <polygon 
                                          points={`${X},${Y} ${X - W/2},${Y - D/2} ${X - W/2},${Y - D/2 - H} ${X},${Y - H}`}
                                          fill={item.gradLeft}
                                        />

                                        {/* FRONT RIGHT FACE */}
                                        <polygon 
                                          points={`${X},${Y} ${X + W/2},${Y - D/2} ${X + W/2},${Y - D/2 - H} ${X},${Y - H}`}
                                          fill={item.gradRight}
                                        />

                                        {/* TOP ISO DIAMOND CAP */}
                                        <polygon 
                                          points={`${X},${Y - H} ${X - W/2},${Y - D/2 - H} ${X},${Y - D - H} ${X + W/2},${Y - D/2 - H}`}
                                          fill={item.gradTop}
                                        />

                                        {/* VALUE FLOATING BADGE SPEECH BUBBLE */}
                                        <g className="transition-all duration-300 drop-shadow-sm">
                                          {/* BG pill */}
                                          <rect 
                                            x={X - 25} 
                                            y={Y - H - D - 32} 
                                            width="50" 
                                            height="22" 
                                            rx="8" 
                                            fill={item.colorHex}
                                          />
                                          {/* Text inside */}
                                          <text 
                                            x={X} 
                                            y={Y - H - D - 17} 
                                            textAnchor="middle" 
                                            className="font-black text-[12px] fill-white font-mono"
                                          >
                                            {item.value}
                                          </text>
                                          {/* Tiny triangle pointing down */}
                                          <polygon 
                                            points={`${X - 4},${Y - H - D - 10} ${X + 4},${Y - H - D - 10} ${X},${Y - H - D - 6}`}
                                            fill={item.colorHex}
                                          />
                                        </g>

                                        {/* CAPTION LABEL AT THE BOTTOM */}
                                        <text 
                                          x={X} 
                                          y={Y + 28} 
                                          textAnchor="middle" 
                                          className="font-extrabold text-[11px] fill-slate-700 uppercase tracking-wide"
                                        >
                                          {item.label}
                                        </text>
                                        <text 
                                          x={X} 
                                          y={Y + 41} 
                                          textAnchor="middle" 
                                          className="font-bold text-[9px] fill-slate-400 tracking-wider uppercase font-mono"
                                        >
                                          {item.value} {item.prefix}
                                        </text>
                                      </g>
                                    );
                                  })}
                                </svg>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SESI MATA PELAJARAN AKTIF */}
                    {!isSystemAdmin(appState.currentUser) && (
                      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-3xl p-6 text-white shadow-xl space-y-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div className="space-y-1">
                            <span className="text-[10px] bg-white/20 text-white font-extrabold px-2.5 py-1 rounded-md uppercase tracking-wider">
                              Sesi Guru Mata Pelajaran (Mapel)
                            </span>
                            <h3 className="font-extrabold text-xl">Sesi Pelajaran, Tingkat & Jurusan</h3>
                            <p className="text-emerald-100 text-xs">
                              Atur mata pelajaran, target tingkat kelas, dan jurusan untuk membatasi pemindaian QR saat sesi pelajaran Anda sedang berlangsung.
                            </p>
                          </div>
                          <div className="bg-white/10 p-3 rounded-2xl border border-white/15 text-center shrink-0 min-w-44">
                            <span className="text-[10px] font-bold text-emerald-250 block uppercase tracking-wider">Sesi Mengajar</span>
                            <span className="text-sm font-extrabold mt-1 block">
                              {activeMataPelajaran === 'Lainnya' ? (customMataPelajaran || 'Kustom') : activeMataPelajaran}
                            </span>
                            {(activeSessionTingkat || activeSessionJurusan || activeSessionJamKe) && (
                              <span className="text-[10px] bg-black/20 text-emerald-100 font-extrabold px-2.5 py-1 rounded-md mt-1.5 inline-block border border-white/5 font-mono">
                                {activeSessionTingkat || 'Semua'} • {activeSessionJurusan || 'Semua'} • Jam {activeSessionJamKe}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-white/10">
                          {/* SELECT MAPEL */}
                          <div>
                            <label className="block text-[11px] font-bold text-emerald-200 uppercase mb-1.5">Mata Pelajaran</label>
                            <select
                              value={activeMataPelajaran}
                              onChange={(e) => setActiveMataPelajaran(e.target.value)}
                              className="w-full bg-slate-900/40 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white font-semibold focus:outline-none focus:ring-2 focus:ring-white/50 transition-all cursor-pointer"
                            >
                              {allowedGuruMapels.map(m => (
                                <option key={m} value={m} className="bg-slate-900 text-white font-medium">{m}</option>
                              ))}
                              {!isGuruNonAdmin && (
                                <option value="Lainnya" className="bg-slate-900 text-white font-medium">Lainnya (Ketik Manual...)</option>
                              )}
                            </select>
                            
                            {!isGuruNonAdmin && activeMataPelajaran === 'Lainnya' && (
                              <motion.input
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                type="text"
                                value={customMataPelajaran}
                                onChange={(e) => setCustomMataPelajaran(e.target.value)}
                                placeholder="Ketik nama mata pelajaran di sini..."
                                className="mt-2 w-full bg-slate-900/40 border border-white/25 rounded-xl px-3.5 py-2 text-xs text-white placeholder-emerald-200/65 font-medium focus:outline-none focus:ring-2 focus:ring-white/50 transition-all font-semibold"
                              />
                            )}
                          </div>

                          {/* SELECT TINGKAT KELAS (X, XI, XII) */}
                          <div>
                            <label className="block text-[11px] font-bold text-emerald-200 uppercase mb-1.5">Tingkat Kelas</label>
                            <select
                              value={activeSessionTingkat}
                              onChange={(e) => {
                                setActiveSessionTingkat(e.target.value);
                                triggerToast(`Target tingkat kelas diubah ke: ${e.target.value || 'Semua Kelas'}`);
                              }}
                              className="w-full bg-slate-900/40 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white font-semibold focus:outline-none focus:ring-2 focus:ring-white/50 transition-all cursor-pointer"
                            >
                              <option value="" className="bg-slate-900 text-white font-semibold">
                                {isGuruNonAdmin ? "Semua Kelas Binaan Anda" : "Semua Kelas (X, XI, XII)"}
                              </option>
                              {allowedGuruTingkat.map(t => (
                                <option key={t} value={t} className="bg-slate-900 text-white font-semibold">Kelas {t}</option>
                              ))}
                            </select>
                          </div>

                          {/* SELECT JURUSAN (ATPH, MPLB, TSM) */}
                          <div>
                            <label className="block text-[11px] font-bold text-emerald-200 uppercase mb-1.5">Jurusan</label>
                            <select
                              value={activeSessionJurusan}
                              onChange={(e) => {
                                  setActiveSessionJurusan(e.target.value);
                                  triggerToast(`Target jurusan diubah ke: ${e.target.value || 'Semua Jurusan'}`);
                              }}
                              className="w-full bg-slate-900/40 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white font-semibold focus:outline-none focus:ring-2 focus:ring-white/50 transition-all cursor-pointer"
                            >
                              <option value="" className="bg-slate-900 text-white font-semibold">
                                {isGuruNonAdmin ? "Semua Jurusan Binaan Anda" : "Semua Jurusan"}
                              </option>
                              {allowedGuruJurusan.map(j => (
                                <option key={j} value={j} className="bg-slate-900 text-white font-semibold">{j}</option>
                              ))}
                            </select>
                          </div>

                          {/* SELECT JAM KE (1, 2, 3, 4) */}
                          <div>
                            <label className="block text-[11px] font-bold text-emerald-200 uppercase mb-1.5">Jam Ke</label>
                            <select
                              value={activeSessionJamKe}
                              onChange={(e) => {
                                  setActiveSessionJamKe(e.target.value);
                                  triggerToast(`Target Jam Ke diubah ke: Jam ${e.target.value}`);
                              }}
                              className="w-full bg-slate-900/40 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white font-semibold focus:outline-none focus:ring-2 focus:ring-white/50 transition-all cursor-pointer font-mono"
                            >
                              <option value="1" className="bg-slate-900 text-white font-semibold">Jam Ke-1</option>
                              <option value="2" className="bg-slate-900 text-white font-semibold">Jam Ke-2</option>
                              <option value="3" className="bg-slate-900 text-white font-semibold">Jam Ke-3</option>
                              <option value="4" className="bg-slate-900 text-white font-semibold">Jam Ke-4</option>
                            </select>
                          </div>
                        </div>

                        {/* DESKRIPSI PENDALAMAN */}
                        <div className="flex items-center bg-white/5 rounded-2xl p-3.5 border border-white/5 text-xs text-emerald-150 leading-relaxed">
                          <Sparkles className="w-5 h-5 text-emerald-300 mr-3 shrink-0" />
                          <div>
                            Siswa yang men-scan kartu QR akan tercatat hadir di pelajaran <span className="font-extrabold text-white">{activeMataPelajaran === 'Lainnya' ? (customMataPelajaran || 'Kustom') : activeMataPelajaran}</span> (Jam Ke-<span className="font-extrabold text-white">{activeSessionJamKe}</span>){activeSessionTingkat && <> tingkat <span className="font-extrabold text-white">Kelas {activeSessionTingkat}</span></>}{activeSessionJurusan && <> jurusan <span className="font-extrabold text-white">{activeSessionJurusan}</span></>}. Sistem memblokir scanner jika murid bukan dari kelas/jurusan target!
                          </div>
                        </div>
                      </div>
                    )}


                    {/* SCANNER REAL-TIME COMPONENT */}
                    {(() => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      const todayHolidayObj = getHoliday(todayStr);
                      if (todayHolidayObj) {
                        return (
                          <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 text-center max-w-xl mx-auto space-y-4 shadow-sm my-6">
                            <div className="w-16 h-16 bg-rose-100/80 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner animate-pulse">
                              <CalendarDays className="w-8 h-8 animate-bounce" />
                            </div>
                            <div className="space-y-2">
                              <h3 className="text-lg font-black text-rose-950 uppercase tracking-tight">Sistem QR Presensi Dinonaktifkan</h3>
                              <p className="text-rose-850 text-xs font-semibold">
                                Hari ini ({todayStr}) adalah Hari Libur / Tanggal Merah (Sistem Libur).
                              </p>
                              <div className="inline-block bg-rose-600 text-white font-extrabold text-xs px-4  py-2 rounded-2xl uppercase tracking-wider shadow-sm mt-1">
                                Keterangan: {todayHolidayObj.keterangan}
                              </div>
                            </div>
                            <p className="text-[11px] text-rose-655/80 max-w-md mx-auto leading-relaxed">
                              Pemindaian kartu QR dan pencatatan presensi dinonaktifkan sementara selama hari libur untuk mencegah manipulasi data kehadiran di luar hari operasional sekolah. Mohon kembali di hari kerja berikutnya.
                            </p>
                          </div>
                        );
                      }

                      // Check school hour limits dynamically
                      if (!isWithinSchoolHours()) {
                        const { jamMasuk, jamPulang } = getActiveSchoolHoursConfig();
                        const nowLocal = new Date();
                        return (
                          <div className="bg-amber-50 border border-amber-250/50 rounded-3xl p-8 text-center max-w-xl mx-auto space-y-4 shadow-sm my-6">
                            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                              <Clock className="w-8 h-8 animate-pulse text-amber-600" />
                            </div>
                            <div className="space-y-2">
                              <h3 className="text-lg font-black text-amber-955 uppercase tracking-tight">Sistem QR Presensi Ditutup</h3>
                              <p className="text-amber-850 text-xs font-semibold">
                                Jam Operasional Presensi: {jamMasuk} s.d. {jamPulang} WITA
                              </p>
                              <div className="inline-block bg-amber-600 text-white font-extrabold text-xs px-4 py-2 rounded-2xl uppercase tracking-wider shadow-sm mt-1 font-mono">
                                Waktu Sekarang: {nowLocal.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA
                              </div>
                            </div>
                            <p className="text-[11px] text-amber-700 max-w-md mx-auto leading-relaxed">
                              Sistem pemindaian kartu QR dinonaktifkan di luar jam belajar mengajar ({jamMasuk} s.d. {jamPulang}) guna mencegah rekayasa/manipulasi jam kehadiran di luar jadwal operasional resmi sekolah.
                            </p>
                          </div>
                        );
                      }
                      
                      return !isSystemAdmin(appState.currentUser) ? (
                        <ScannerComponent 
                          onScanSuccess={handleQRDetected} 
                          siswaList={appState.siswa}
                          todayLogs={todayLogs}
                        />
                      ) : null;
                    })()}

                  </motion.div>
                )}

                {/* 2. DATA MURID CRUD PAGE */}
                {activeSection === 'g-murid' && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-5"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Manajemen Data Murid (Siswa)</h2>
                        <p className="text-slate-500 text-xs mt-0.5">Tambahkan, modifikasi, dan nonaktifkan data profil murid terdaftar.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {isSystemAdmin(appState.currentUser) && (
                          <>
                            <button
                              onClick={() => openMuridModal('ADD')}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow flex items-center gap-1.5 cursor-pointer"
                              id="btn-tambah-siswa"
                            >
                              <Plus className="w-4 h-4" />
                              <span>Tambah Siswa</span>
                            </button>
                            
                            <label 
                              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                              id="lbl-upload-siswa"
                            >
                              <Upload className="w-4 h-4 text-emerald-600" />
                              <span>Unggah Excel</span>
                              <input 
                                type="file" 
                                accept=".xlsx, .xls" 
                                onChange={handleUploadSiswa} 
                                className="hidden" 
                              />
                            </label>

                            <button
                              onClick={downloadSiswaTemplate}
                              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs px-3.5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                              id="btn-template-siswa"
                              title="Unduh Templat Excel"
                            >
                              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                              <span>Templat</span>
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => exportTableToExcel('tbl-murid-print-export', 'Database_Siswa')}
                          className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                          id="btn-export-siswa"
                        >
                          <Download className="w-4 h-4" />
                          <span>Unduh Excel</span>
                        </button>
                      </div>
                    </div>

                    {isGuruNonAdmin && managedClasses.length > 0 && (
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 shadow-sm">
                        <div className="text-xs text-slate-500 leading-relaxed">
                          <span className="font-extrabold text-slate-800 block mb-1">ℹ️ Otorisasi Data Murid Sesuai Kelas Binaan & Mapel</span>
                          Saat ini Anda memiliki akses data murid terdaftar untuk kelas binaan / mata pelajaran yang diajar: <span className="font-bold text-indigo-600">{managedClasses.join(', ')}</span>.
                        </div>
                      </div>
                    )}

                    {/* Filter Table Toolbar */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
                      <div className="relative w-full md:w-80">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                          <Search className="w-4 h-4" />
                        </span>
                        <input
                          type="text"
                          value={searchSiswaQuery}
                          onChange={(e) => setSearchSiswaQuery(e.target.value)}
                          placeholder="Cari nama atau NISN siswa..."
                          className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-800 pl-9 pr-4 py-2 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-400"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        {/* Filter Tingkat Kelas */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 shrink-0 uppercase font-bold text-[10px]">Kelas:</span>
                          <select
                            value={filterSiswaTingkat}
                            onChange={(e) => {
                              setFilterSiswaTingkat(e.target.value);
                              setFilterSiswaKelas(''); // Reset specific class
                            }}
                            className="bg-white border border-slate-200 text-xs px-3 py-1.5 rounded-xl font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            id="sel-filter-tingkat"
                          >
                            <option value="">Semua Kelas</option>
                            {allowedGuruTingkat.map(t => (
                              <option key={t} value={t}>Kelas {t}</option>
                            ))}
                          </select>
                        </div>

                        {/* Filter Jurusan */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 shrink-0 uppercase font-bold text-[10px]">Jurusan:</span>
                          <select
                            value={filterSiswaJurusan}
                            onChange={(e) => {
                              setFilterSiswaJurusan(e.target.value);
                              setFilterSiswaKelas(''); // Reset specific class
                            }}
                            className="bg-white border border-slate-200 text-xs px-3 py-1.5 rounded-xl font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            id="sel-filter-jurusan"
                          >
                            <option value="">Semua Jurusan</option>
                            {allowedGuruJurusan.map(j => (
                              <option key={j} value={j}>{j}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Table View */}
                    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm text-slate-700" id="tbl-murid-print-export">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-800 font-bold bg-slate-100/50">
                              <th className="py-3 px-4 font-bold text-center w-16">No</th>
                              <th className="py-3 px-4 font-bold w-28">NISN</th>
                              <th className="py-3 px-4 font-bold text-slate-900">Nama Lengkap</th>
                              <th className="py-3 px-4 font-bold text-center w-32">Kelas</th>
                              <th className="py-3 px-4 font-bold text-center w-28">Password</th>
                              <th className="py-3 px-4 font-bold text-center w-28">Status</th>
                              {isSystemAdmin(appState.currentUser) && (
                                <th className="py-3 px-4 font-bold text-center w-36">Aksi</th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredStudents.length === 0 ? (
                              <tr>
                                <td colSpan={isSystemAdmin(appState.currentUser) ? 7 : 6} className="py-12 text-center text-slate-400 font-semibold">
                                  Tidak ada siswa yang cocok dengan kriteria pencarian Anda.
                                </td>
                              </tr>
                            ) : (
                              filteredStudents.map((siswa, idx) => (
                                <tr key={siswa.nis} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-3 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                                  <td className="py-3 px-4 font-mono font-medium text-slate-500">{siswa.nis}</td>
                                  <td className="py-3 px-4 font-bold text-slate-850">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center font-bold text-slate-500 scale-90 shrink-0">
                                        {siswa.foto ? (
                                          <img src={siswa.foto} alt="Siswa" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                        ) : (
                                          siswa.nama.charAt(0)
                                        )}
                                      </div>
                                      <span>{siswa.nama}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-center font-semibold text-slate-600 uppercase">{siswa.kelas}</td>
                                  <td className="py-3 px-4 text-center font-mono text-xs text-slate-400">{siswa.password || 'siswa123'}</td>
                                  <td className="py-3 px-4 text-center">
                                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold inline-block border ${
                                      siswa.status === 'Aktif'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                        : 'bg-rose-50 text-rose-700 border-rose-100'
                                    }`}>
                                      {siswa.status}
                                    </span>
                                  </td>
                                  {isSystemAdmin(appState.currentUser) && (
                                    <td className="py-3 px-4 text-center">
                                      <div className="flex gap-2 justify-center">
                                        <button
                                          onClick={() => openMuridModal('EDIT', siswa.nis)}
                                          className="text-indigo-600 hover:text-indigo-800 p-1 bg-indigo-50 rounded hover:bg-indigo-100 transition-colors"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => deleteStudent(siswa.nis, siswa.nama)}
                                          className="text-rose-600 hover:text-rose-800 p-1 bg-rose-50 rounded hover:bg-rose-100 transition-colors"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 2.5 ADMIN SERVER CONTROL CENTER */}
                {activeSection === 'g-server' && isServerAdmin(appState.currentUser) && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                          <Sliders className="w-5 h-5 text-amber-500 rotate-90" />
                          <span>Admin Server Control Center</span>
                        </h2>
                        <p className="text-slate-500 text-xs mt-0.5">Pusat kendali penuh aplikasi penjamin kestabilan saat aplikasi dibagikan ke publik.</p>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 text-amber-500 font-extrabold text-[10px] rounded-xl border border-amber-500/20 uppercase tracking-widest animate-pulse">
                        <span className="w-2 h-2 bg-amber-500 rounded-full inline-block"></span>
                        <span>Server Active / Live Control</span>
                      </div>
                    </div>

                    {/* METRICS & HEALTH MONITOR */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-slate-400">
                      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-emerald-400" />
                        <span>Metrik Kesehatan Database Real-Time</span>
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80">
                          <span className="text-[10px] text-slate-450 block uppercase font-mono">Status Sistem</span>
                          <span className="text-sm font-black text-emerald-400 mt-2 block">HEALTHY</span>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80">
                          <span className="text-[10px] text-slate-450 block uppercase font-mono">Total Siswa</span>
                          <span className="text-lg font-black text-white mt-1 block">{appState.siswa.length} orang</span>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80">
                          <span className="text-[10px] text-slate-450 block uppercase font-mono">Total Staf/Guru</span>
                          <span className="text-lg font-black text-white mt-1 block">{appState.guru.length} orang</span>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80">
                          <span className="text-[10px] text-slate-450 block uppercase font-mono">Log Absensi</span>
                          <span className="text-lg font-black text-white mt-1 block">{appState.absensi.length} rekod</span>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 col-span-2 md:col-span-1">
                          <span className="text-[10px] text-slate-450 block uppercase font-mono">Database Size</span>
                          <span className="text-sm font-black text-amber-400 mt-2 block">
                            {(JSON.stringify(appState).length / 1024).toFixed(2)} KB
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* MULTI-SCHOOL CONTROL CENTER FOR ADMIN SERVER */}
                    <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
                      <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                          <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                            <School className="w-4 h-4 text-emerald-500" />
                            <span>Pusat Registrasi & Kontrol Multi-Sekolah</span>
                          </h3>
                          <p className="text-slate-500 text-[11px] mt-0.5">Daftarkan sekolah baru, hapus sekolah, atau beralih kontrol antar database sekolah yang terdaftar.</p>
                        </div>
                        <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold border border-emerald-100">
                          {sekolahList.length} Sekolah Terdaftar
                        </div>
                      </div>

                      {/* Side by side: Add School Form (1/3) & School List Table (2/3) */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* 1. Add School Form */}
                        <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 space-y-4">
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <Plus className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Daftarkan Sekolah Baru</span>
                          </h4>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">ID Unik / Kode Sekolah</label>
                            <input
                              type="text"
                              value={newSekolahId}
                              onChange={(e) => setNewSekolahId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                              placeholder="Contoh: sman1jkt, smkn2bdg"
                              className="w-full text-xs bg-white border border-slate-200 text-slate-800 px-3 py-2 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400"
                            />
                            <p className="text-[9px] text-slate-400 mt-0.5">Digunakan sebagai namespace cloud database (huruf kecil & angka tanpa spasi)</p>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nama Sekolah</label>
                            <input
                              type="text"
                              value={newSekolahNama}
                              onChange={(e) => setNewSekolahNama(e.target.value)}
                              placeholder="Contoh: SMA Negeri 1 Jakarta"
                              className="w-full text-xs bg-white border border-slate-200 text-slate-800 px-3 py-2 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Alamat Sekolah</label>
                            <input
                              type="text"
                              value={newSekolahAlamat}
                              onChange={(e) => setNewSekolahAlamat(e.target.value)}
                              placeholder="Alamat sekolah lengkap"
                              className="w-full text-xs bg-white border border-slate-200 text-slate-800 px-3 py-2 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Jam Masuk</label>
                              <input
                                type="time"
                                value={newSekolahJamMasuk}
                                onChange={(e) => setNewSekolahJamMasuk(e.target.value)}
                                className="w-full text-xs bg-white border border-slate-200 text-slate-800 px-3 py-2 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Jam Pulang</label>
                              <input
                                type="time"
                                value={newSekolahJamPulang}
                                onChange={(e) => setNewSekolahJamPulang(e.target.value)}
                                className="w-full text-xs bg-white border border-slate-200 text-slate-800 px-3 py-2 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">No. Kontak Admin/Sekolah</label>
                            <input
                              type="text"
                              value={newSekolahKontak}
                              onChange={(e) => setNewSekolahKontak(e.target.value)}
                              placeholder="Contoh: 081234567890"
                              className="w-full text-xs bg-white border border-slate-200 text-slate-800 px-3 py-2 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400"
                            />
                          </div>
                          <button
                            onClick={async () => {
                              const cleanId = newSekolahId.trim();
                              const cleanNama = newSekolahNama.trim();
                              const cleanAlamat = newSekolahAlamat.trim();
                              const cleanKontak = newSekolahKontak.trim();

                              if (!cleanId || !cleanNama) {
                                triggerToast('ID Kode dan Nama Sekolah wajib diisi!', 'warning');
                                return;
                              }

                              if (sekolahList.some(s => s.id === cleanId)) {
                                triggerToast(`Sekolah dengan ID Kode [${cleanId}] sudah terdaftar!`, 'error');
                                return;
                              }

                              const schoolObj: Sekolah = {
                                id: cleanId,
                                nama: cleanNama,
                                alamat: cleanAlamat,
                                jamMasuk: newSekolahJamMasuk,
                                jamPulang: newSekolahJamPulang,
                                kontak: cleanKontak,
                                createdAt: new Date().toISOString()
                              };

                              try {
                                await dbSaveSekolah(schoolObj);
                                triggerToast(`Sekolah "${cleanNama}" berhasil didaftarkan secara murni!`, 'success');
                                triggerToast(`Jangan lupa untuk memilih/mengubah sekolah aktif untuk menginisialisasi setelan database pabriknya jika kosong.`, 'warning');
                                setNewSekolahId('');
                                setNewSekolahNama('');
                                setNewSekolahAlamat('');
                                setNewSekolahJamMasuk('07:15');
                                setNewSekolahJamPulang('14:00');
                                setNewSekolahKontak('');
                              } catch (err) {
                                triggerToast('Gagal mendaftarkan sekolah baru ke cloud.', 'error');
                              }
                            }}
                            className="w-full bg-emerald-650 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl transition-all shadow flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Daftarkan Sekarang</span>
                          </button>
                        </div>

                        {/* 2. School List Table */}
                        <div className="lg:col-span-2 space-y-3.5">
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                            <School className="w-3.5 h-3.5 text-slate-500" />
                            <span>Daftar Sekolah yang Terdaftar di Sistem</span>
                          </h4>
                          <div className="overflow-x-auto border border-slate-150 rounded-2xl bg-white max-h-[460px] overflow-y-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150 sticky top-0 z-10">
                                  <th className="py-2.5 px-4 text-[10px] uppercase font-bold text-slate-400">Kode & Nama Sekolah</th>
                                  <th className="py-2.5 px-4 text-[10px] uppercase font-bold text-slate-400">Alamat & Kontak</th>
                                  <th className="py-2.5 px-4 text-[10px] uppercase font-bold text-slate-400">Jam Operasional</th>
                                  <th className="py-2.5 px-4 text-[10px] uppercase font-bold text-slate-400 text-center">Status</th>
                                  <th className="py-2.5 px-4 text-[10px] uppercase font-bold text-slate-400 text-right">Aksi Kontrol</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-medium">
                                {sekolahList.length === 0 ? (
                                  <tr>
                                    <td colSpan={5} className="py-8 text-center text-slate-400 font-semibold italic">
                                      Belum ada sekolah terdaftar dalam sistem cloud.
                                    </td>
                                  </tr>
                                ) : (
                                  sekolahList.map((sch) => {
                                    const isActive = sch.id === activeSchoolId;
                                    const stats = schoolStats[sch.id] || { siswa: 0, guru: 0, kelas: 0, absensi: 0 };
                                    return (
                                      <tr key={sch.id} className={`hover:bg-slate-50/50 transition-all ${isActive ? 'bg-emerald-500/5' : ''}`}>
                                        <td className="py-3 px-4">
                                          <div className="flex items-center gap-2 mb-1">
                                            <div className="bg-white px-2 py-0.5 rounded border border-slate-200 font-mono text-[9px] font-bold text-slate-600">
                                              {sch.id}
                                            </div>
                                            <span className="font-bold text-slate-800">{sch.nama}</span>
                                          </div>
                                          {/* Mini Stats Grid */}
                                          <div className="flex items-center gap-2 text-[9px] text-slate-400 font-medium mt-1">
                                            <span>👥 Siswa: <strong className="text-slate-650">{stats.siswa}</strong></span>
                                            <span>|</span>
                                            <span>👨‍🏫 Guru & Staff: <strong className="text-slate-655">{stats.guru}</strong></span>
                                            <span>|</span>
                                            <span>🏫 Kelas: <strong className="text-slate-650">{stats.kelas}</strong></span>
                                            <span>|</span>
                                            <span>📝 Log: <strong className="text-rose-600">{stats.absensi}</strong></span>
                                          </div>
                                        </td>
                                        <td className="py-3 px-4 text-slate-500">
                                          <div className="truncate max-w-[150px] text-slate-700 font-semibold">{sch.alamat || <span className="text-slate-350 italic text-[10px]">Tidak ada alamat</span>}</div>
                                          {sch.kontak && <div className="text-[10px] text-slate-400 font-mono mt-0.5">📞 {sch.kontak}</div>}
                                        </td>
                                        <td className="py-3 px-4">
                                          <div className="font-mono text-slate-650 font-bold bg-slate-50 px-2 py-1 rounded inline-block text-[10px] border border-slate-100">
                                            ⏰ {sch.jamMasuk || '06:00'} - {sch.jamPulang || '14:00'}
                                          </div>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                          {isActive ? (
                                            <span className="inline-block text-[9px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                              Aktif
                                            </span>
                                          ) : (
                                            <span className="inline-block text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                              Inaktif
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                          <div className="flex items-center justify-end gap-1.5">
                                            {/* Edit details */}
                                            <button
                                              onClick={() => setEditingSekolah(sch)}
                                              title="Edit Detail & Parameter Sekolah"
                                              className="text-[10px] font-bold bg-white text-slate-650 hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                                            >
                                              <Edit3 className="w-3.5 h-3.5" />
                                            </button>

                                            {/* Preview/Beralih */}
                                            <button
                                              onClick={() => {
                                                setActiveSchoolId(sch.id);
                                                localStorage.setItem('active-school-id', sch.id);
                                                triggerToast(`Berhasil beralih kontrol ke sekolah: ${sch.nama}`, 'success');
                                              }}
                                              className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border-2 transition-all cursor-pointer ${
                                                isActive 
                                                  ? 'bg-emerald-650 hover:bg-emerald-700 text-white border-emerald-650' 
                                                  : 'bg-white hover:bg-slate-50 text-slate-650 border-slate-200'
                                              }`}
                                            >
                                              {isActive ? 'Aktif' : 'Preview'}
                                            </button>

                                            {/* Reset Pabrik */}
                                            <button
                                              onClick={() => {
                                                requestConfirm(
                                                  'Reset Sekolah ke Setelan Pabrik',
                                                  `Apakah Anda sangat yakin ingin mengembalikan seluruh data sekolah "${sch.nama}" (ID: ${sch.id}) ke Setelan Pabrik? Tindakan ini akan menghapus semua siswa, guru, kelas, dan riwayat presensi yang terdaftar di sekolah tersebut saat ini, kemudian menimpa/mengisinya kembali dengan data template bawaan pabrik secara murni.`,
                                                  async () => {
                                                    try {
                                                      triggerToast(`Sedang melakukan setel ulang pabrik untuk "${sch.nama}"...`, 'warning');
                                                      await dbResetToFactorySeed(
                                                        sch.id,
                                                        INITIAL_SISWA,
                                                        INITIAL_GURU,
                                                        INITIAL_KELAS,
                                                        getInitialAbsensi()
                                                      );
                                                      triggerToast(`Sekolah "${sch.nama}" berhasil dikembalikan ke Setelan Pabrik!`, 'success');
                                                    } catch (err) {
                                                      triggerToast(`Gagal mereset data sekolah ke setelan pabrik.`, 'error');
                                                    }
                                                  }
                                                );
                                              }}
                                              title="Kembalikan Sekolah ini ke Setelan Pabrik"
                                              className="text-[10px] font-bold bg-white text-amber-600 hover:bg-amber-50 border-2 border-amber-100 hover:border-amber-200 px-2 flex items-center gap-1 py-1.5 rounded-lg transition-all cursor-pointer font-sans"
                                            >
                                              <RefreshCw className="w-3 h-3 animate-spin hover:animate-none" style={{ animationDuration: '4s' }} />
                                              <span>Reset Pabrik</span>
                                            </button>

                                            {/* Reset Kosong */}
                                            <button
                                              onClick={() => {
                                                requestConfirm(
                                                  'Reset Kosongkan Seluruh Data Sekolah',
                                                  `Apakah Anda sangat yakin ingin MERESET KOSONG seluruh data sekolah "${sch.nama}" (ID: ${sch.id})? Tindakan ini akan menghapus semua siswa, guru, kelas, dan riwayat presensi yang terdaftar di sekolah tersebut saat ini, menjadikannya benar-benar kosong (0 data).`,
                                                  async () => {
                                                    try {
                                                      triggerToast(`Sedang melakukan pembersihan data untuk "${sch.nama}"...`, 'warning');
                                                      await dbResetToFactorySeed(
                                                        sch.id,
                                                        [],
                                                        [],
                                                        [],
                                                        [],
                                                        true
                                                      );
                                                      triggerToast(`Seluruh data sekolah "${sch.nama}" berhasil dihapus bersih!`, 'success');
                                                    } catch (err) {
                                                      triggerToast(`Gagal mengosongkan data sekolah.`, 'error');
                                                    }
                                                  }
                                                );
                                              }}
                                              title="Kosongkan seluruh data sekolah ini"
                                              className="text-[10px] font-bold bg-white text-rose-500 hover:bg-rose-55 border-2 border-rose-100 hover:border-rose-200 px-2 flex items-center gap-1 py-1.5 rounded-lg transition-all cursor-pointer font-sans"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                              <span>Reset Kosong</span>
                                            </button>
                                            
                                            {/* Hapus */}
                                            <button
                                              onClick={() => {
                                                requestConfirm(
                                                  'Hapus Sekolah Terdaftar',
                                                  `Apakah Anda sangat yakin ingin menghapus sekolah "${sch.nama}" (ID: ${sch.id}) secara permanen? Data murid, guru, kelas, dan riwayat presensi yang berkaitan dengannya di dalam cloud tidak akan terhapus, namun akses ke sekolah ini dari portal utama akan dihilangkan selamanya.`,
                                                  async () => {
                                                    try {
                                                      await dbDeleteSekolah(sch.id);
                                                      triggerToast(`Sekolah "${sch.nama}" sukses dihapus!`, 'success');
                                                      if (isActive) {
                                                        setActiveSchoolId(null);
                                                        localStorage.removeItem('active-school-id');
                                                      }
                                                    } catch (err) {
                                                      triggerToast(`Gagal menghapus sekolah dari database cloud.`, 'error');
                                                    }
                                                  }
                                                );
                                              }}
                                              className="text-[10px] font-bold bg-white text-rose-600 hover:bg-rose-50 border-2 border-rose-100 hover:border-rose-200 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* SYSTEM HOLIDAYS CONFIGURATION PANEL */}
                    <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
                      <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                          <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                            <CalendarDays className="w-5 h-5 text-rose-500" />
                            <span>Pusat Pengaturan Hari Libur & Tanggal Merah</span>
                          </h3>
                          <p className="text-slate-500 text-[11px] mt-0.5">Atur hari libur nasional atau tanggal merah agar pada tanggal tersebut sistem pemindaian QR absensi dinonaktifkan secara otomatis.</p>
                        </div>
                        <div className="flex items-center gap-1.5 bg-rose-50 text-rose-700 px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold border border-rose-100">
                          {holidays.length} Hari Libur Terjadwal
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* FORM: TAMBAH HARI LIBUR */}
                        <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-150 space-y-4">
                          <span className="font-black text-xs text-slate-700 block uppercase tracking-wider">Tambah Hari Libur</span>
                          
                          <div className="space-y-3">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Pilih Tanggal</label>
                              <input 
                                type="date"
                                value={newHolidayDate}
                                onChange={(e) => setNewHolidayDate(e.target.value)}
                                className="w-full text-xs bg-white border border-slate-200 text-slate-850 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Keterangan / Alasan Libur</label>
                              <input 
                                type="text"
                                value={newHolidayKeterangan}
                                onChange={(e) => setNewHolidayKeterangan(e.target.value)}
                                placeholder="Contoh: Hari Raya Idul Fitri"
                                className="w-full text-xs bg-white border border-slate-200 text-slate-850 rounded-xl px-3 py-2.5 font-semibold focus:outline-none focus:ring-1 focus:ring-rose-500"
                              />
                            </div>
                          </div>

                          <button
                            onClick={handleAddHoliday}
                            className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black text-xs py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Daftarkan Hari Libur</span>
                          </button>
                        </div>

                        {/* LIST: DAFTAR HARI LIBUR TERJADWAL */}
                        <div className="md:col-span-2 space-y-3">
                          <span className="font-black text-xs text-slate-700 block uppercase tracking-wider">Daftar Tanggal Merah Terdaftar</span>
                          
                          <div className="border border-slate-150 rounded-2xl bg-white overflow-hidden max-h-[220px] overflow-y-auto">
                            {holidays.length === 0 ? (
                              <div className="p-12 text-center text-slate-400 text-xs font-semibold">
                                Belum ada hari libur atau tanggal merah yang didaftarkan. Sistem QR akan selalu aktif.
                              </div>
                            ) : (
                              <table className="w-full text-left text-xs text-slate-600">
                                <thead className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100 text-[10px] uppercase tracking-wider font-mono">
                                  <tr>
                                    <th className="py-2.5 px-4 font-black">No</th>
                                    <th className="py-2.5 px-4 font-black">Tanggal</th>
                                    <th className="py-2.5 px-4 font-black">Keterangan</th>
                                    <th className="py-2.5 px-4 font-black text-right">Opsi</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {holidays.map((hol, index) => (
                                    <tr key={hol.date} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="py-3 px-4 font-mono font-bold text-slate-400">{index + 1}</td>
                                      <td className="py-3 px-4 font-mono font-bold text-rose-600">{hol.date}</td>
                                      <td className="py-3 px-4 font-bold text-slate-800">{hol.keterangan}</td>
                                      <td className="py-3 px-4 text-right">
                                        <button
                                          onClick={() => handleDeleteHoliday(hol.date)}
                                          className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                          title="Hapus Hari Libur"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* DUAL DIVISION ROW */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      
                      {/* DIVISION 1: DANGEROUS SYSTEM CONTROLS (2 COLS) */}
                      <div className="lg:col-span-2 space-y-6">
                        
                        {/* EMERGENCY CONTROLS SECTION */}
                        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-5">
                          <div className="border-b border-slate-100 pb-3">
                            <h3 className="font-extrabold text-slate-900 text-sm">Alat Pemeliharaan Server</h3>
                            <p className="text-slate-500 text-[11px] mt-0.5">Gunakan tindakan di bawah untuk menyegarkan database jika aplikasi mengalami eror karena manipulasi pengguna publik.</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* RESET TO FACTORY SEED */}
                            <div className="border border-red-100 rounded-2xl p-4 bg-red-50/20 flex flex-col justify-between">
                              <div>
                                <span className="font-extrabold text-xs text-red-700 block uppercase tracking-wider">Reset Ke Setelan Pabrik</span>
                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                  Menghapus seluruh modifikasi dan mengembalikan data default murni (murid default, kelas default, guru default) serta mengosongkan log.
                                </p>
                              </div>
                              <button
                                onClick={resetToFactoryDefault}
                                className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
                                <span>Reset Pabrik Sekarang</span>
                              </button>
                            </div>

                            {/* WIPE ATTENDANCE LOGS ONLY */}
                            <div className="border border-orange-100 rounded-2xl p-4 bg-orange-50/25 flex flex-col justify-between">
                              <div>
                                <span className="font-extrabold text-xs text-orange-700 block uppercase tracking-wider">Bersihkan Semua Log Presensi</span>
                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                  Mengosongkan seluruh log kehadiran tertimbun tanpa menghapus database murid atau merubah akun guru / kelas.
                                </p>
                              </div>
                              <button
                                onClick={wipeAttendanceLogs}
                                className="mt-4 w-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Wipe Semua Log Presensi</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* EXPORT IMPORT SECTION */}
                        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
                          <div>
                            <h3 className="font-extrabold text-slate-900 text-sm">Ekspor & Impor Cadangan Database (Backup & Restore)</h3>
                            <p className="text-slate-500 text-[11px] mt-0.5">Amankan data Anda dengan mengunduh fail cadangan dalam bentuk JSON murni, lalu unggah kembali kapan saja.</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* EXPORT DATABASE TO FILE */}
                            <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50 flex flex-col justify-between">
                              <div>
                                <span className="font-extrabold text-xs text-slate-700 block uppercase">Unduh Cadangan Database</span>
                                <p className="text-[11px] text-slate-400 mt-1">
                                  Menyimpan kondisi aplikasi seluruhnya (termasuk foto siswa, guru, kelas, dan log absen) dalam satu fail backup terenkripsi.
                                </p>
                              </div>
                              <button
                                onClick={exportDatabaseJson}
                                className="mt-4 w-full bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Unduh Fail JSON Backup</span>
                              </button>
                            </div>

                            {/* RESTORE DATABASE WITH FILE */}
                            <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50 flex flex-col justify-between">
                              <div>
                                <span className="font-extrabold text-xs text-slate-700 block uppercase">Unggah Cadangan Database</span>
                                <p className="text-[11px] text-slate-400 mt-1">
                                  Mengganti kondisi database aplikasi saat ini dengan data cadangan dari fail JSON pilihan Anda.
                                </p>
                              </div>
                              <label
                                className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer text-center"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                <span>Pilih Fail JSON Backup</span>
                                <input
                                  type="file"
                                  accept=".json"
                                  onChange={handleRestoreDatabaseJson}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* DIVISION 2: MASTER CREDENTIAL OVERRIDE PANEL (1 COL) */}
                      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                        <div className="space-y-4">
                          <div className="border-b border-slate-100 pb-3">
                            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                              <span>Master Password Resetter</span>
                            </h3>
                            <p className="text-slate-500 text-[11px] mt-0.5">Lupa sandi guru atau murid? Ganti sandi siapa saja dari sini secara paksa tanpa login ke akun mereka.</p>
                          </div>

                          {/* Role selector tab */}
                          <div className="grid grid-cols-2 p-1.5 bg-slate-100 rounded-xl">
                            <button
                              onClick={() => { setResetUserRole('guru'); setResetUserNis(''); }}
                              className={`py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                                resetUserRole === 'guru' ? 'bg-white text-slate-850 shadow-sm' : 'text-slate-500'
                              }`}
                            >
                              Sandi Guru (Staf)
                            </button>
                            <button
                              onClick={() => { setResetUserRole('siswa'); setResetUserNip(''); }}
                              className={`py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                                resetUserRole === 'siswa' ? 'bg-white text-slate-850 shadow-sm' : 'text-slate-500'
                              }`}
                            >
                              Sandi Murid (Siswa)
                            </button>
                          </div>

                          {/* Specific target dropdown */}
                          <div className="space-y-3.5 py-2">
                            {resetUserRole === 'guru' ? (
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pilih Akun Guru (Staf)</label>
                                <select
                                  value={resetUserNip}
                                  onChange={(e) => setResetUserNip(e.target.value)}
                                  className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2.5 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                                >
                                  <option value="">-- Pilih Guru / NIP --</option>
                                  {appState.guru
                                    .filter(g => isServerAdmin(appState.currentUser) || !isServerAdmin({ username: g.nip }))
                                    .map(g => (
                                      <option key={g.nip} value={g.nip}>
                                        {g.nama} ({g.nip})
                                      </option>
                                    ))}
                                </select>
                              </div>
                            ) : (
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pilih Akun Siswa (Murid)</label>
                                <select
                                  value={resetUserNis}
                                  onChange={(e) => setResetUserNis(e.target.value)}
                                  className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2.5 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                                >
                                  <option value="">-- Pilih Siswa / NISN --</option>
                                  {appState.siswa.map(s => (
                                    <option key={s.nis} value={s.nis}>
                                      {s.nama} ({s.kelas} - {s.nis})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ketikkan Password Baru</label>
                              <input
                                type="text"
                                value={resetUserNewPass}
                                onChange={(e) => setResetUserNewPass(e.target.value)}
                                placeholder="Contoh: ganti123"
                                className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2.5 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={handleMasterResetPassword}
                          className="mt-5 w-full bg-slate-850 hover:bg-black text-white font-bold text-xs py-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1 px-4 cursor-pointer"
                        >
                          <span>Terapkan Ubah Sandi Master</span>
                        </button>
                      </div>

                    </div>
                  </motion.div>
                )}

                {/* 3. DATA GURU CRUD PAGE */}
                {activeSection === 'g-guru' && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-5"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Data Pendidik & Staf (Guru)</h2>
                        <p className="text-slate-500 text-xs mt-0.5">Kelola identitas guru wali kelas penyusun administrasi sekolah.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => openGuruModal('ADD')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow flex items-center gap-1.5 cursor-pointer"
                          id="btn-tambah-guru"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Tambah Guru</span>
                        </button>

                        <label 
                          className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                          id="lbl-upload-guru"
                        >
                          <Upload className="w-4 h-4 text-emerald-600" />
                          <span>Unggah Excel</span>
                          <input 
                            type="file" 
                            accept=".xlsx, .xls" 
                            onChange={handleUploadGuru} 
                            className="hidden" 
                          />
                        </label>

                        <button
                          onClick={downloadGuruTemplate}
                          className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs px-3.5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                          id="btn-template-guru"
                          title="Unduh Templat Excel Guru"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                          <span>Templat</span>
                        </button>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm text-slate-700">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-800 font-bold bg-slate-100/50">
                              <th className="py-3 px-4 font-bold text-center w-16">No</th>
                              <th className="py-3 px-4 font-bold w-28">NIP / ID</th>
                              <th className="py-3 px-4 font-bold text-slate-900">Nama Lengkap</th>
                              <th className="py-3 px-4 font-bold">Jabatan Pendidik</th>
                              <th className="py-3 px-4 font-bold text-center w-28">Password</th>
                              <th className="py-3 px-4 font-bold text-center w-36">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {appState.guru
                              .filter(g => isServerAdmin(appState.currentUser) || !isServerAdmin({ username: g.nip }))
                              .map((guru, idx) => (
                              <tr key={guru.nip} className="hover:bg-slate-50/50 transition-colors">
                                <td className="py-3 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                                <td className="py-3 px-4 font-mono font-medium text-slate-400">{guru.nip}</td>
                                <td className="py-3 px-4 font-bold text-slate-850">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center font-bold text-slate-500 scale-90 shrink-0">
                                      {guru.foto ? (
                                        <img src={guru.foto} alt="Guru" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                      ) : (
                                        guru.nama.charAt(0)
                                      )}
                                    </div>
                                    <span>{guru.nama}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 font-medium text-slate-500">{guru.jabatan}</td>
                                <td className="py-3 px-4 text-center font-mono text-xs text-slate-400">{guru.password || 'guru123'}</td>
                                <td className="py-3 px-4 text-center">
                                  <div className="flex gap-2 justify-center items-center">
                                    {!isSystemAdmin({ username: guru.nip }) && (
                                      <button
                                        onClick={() => {
                                          setSelectedInspectGuru(guru);
                                          setShowGuruControlModal(true);
                                        }}
                                        className="text-emerald-700 hover:text-white hover:bg-emerald-600 border border-emerald-100 p-1 bg-emerald-50 rounded-xl transition-all flex items-center gap-1 px-2 font-bold text-[10px] cursor-pointer"
                                        title="Buka Panel Kontrol Guru"
                                      >
                                        <Sliders className="w-3 h-3" />
                                        <span>Kontrol Data</span>
                                      </button>
                                    )}
                                    <button
                                      onClick={() => openGuruModal('EDIT', guru.nip)}
                                      className="text-indigo-600 hover:text-indigo-800 p-1 bg-indigo-50 rounded hover:bg-indigo-100 transition-colors"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    {!isSystemAdmin({ username: guru.nip }) ? (
                                      <button
                                        onClick={() => deleteGuru(guru.nip, guru.nama)}
                                        className="text-rose-600 hover:text-rose-800 p-1 bg-rose-50 rounded hover:bg-rose-100 transition-colors"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    ) : (
                                      <span className="text-[9px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-xl border border-amber-200 uppercase tracking-wide">Server Admin</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 4. MANAJEMEN KELAS */}
                {activeSection === 'g-kelas' && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-5"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Manajemen Kelas, Guru Mapel &amp; Mapel</h2>
                        <p className="text-slate-500 text-xs mt-0.5">Petakan kelas belajar, jurusan, guru pengampu, serta mata pelajaran yang diajarkan.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => openKelasModal('ADD')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow flex items-center gap-1.5 cursor-pointer"
                          id="btn-tambah-kelas"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Buat Kelas Baru</span>
                        </button>

                        <label 
                          className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                          id="lbl-upload-kelas"
                        >
                          <Upload className="w-4 h-4 text-emerald-600" />
                          <span>Unggah Excel</span>
                          <input 
                            type="file" 
                            accept=".xlsx, .xls" 
                            onChange={handleUploadKelas} 
                            className="hidden" 
                          />
                        </label>

                        <button
                          onClick={downloadKelasTemplate}
                          className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs px-3.5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                          id="btn-template-kelas"
                          title="Unduh Templat Excel Kelas"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                          <span>Templat</span>
                        </button>
                      </div>
                    </div>

                    {/* Filter Kelas & Jurusan */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-bold uppercase text-[10px]">Tingkat Kelas:</span>
                        <select
                          value={filterKelasTingkat}
                          onChange={(e) => setFilterKelasTingkat(e.target.value)}
                          className="bg-white border border-slate-200 text-xs px-3 py-1.5 rounded-xl font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          id="sel-filter-kelas-tingkat"
                        >
                          <option value="">Semua Tingkat</option>
                          {allowedGuruTingkat.map(t => (
                            <option key={t} value={t}>Kelas {t}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-505 font-bold uppercase text-[10px]">Jurusan:</span>
                        <select
                          value={filterKelasJurusan}
                          onChange={(e) => setFilterKelasJurusan(e.target.value)}
                          className="bg-white border border-slate-200 text-xs px-3 py-1.5 rounded-xl font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          id="sel-filter-kelas-jurusan"
                        >
                          <option value="">Semua Jurusan</option>
                          {/* Dynamically extract unique jurusans in appState.kelas */}
                          {Array.from(new Set(
                            appState.kelas.map(k => k.jurusan || k.namaKelas.split('-').slice(1).join('-') || '').filter(Boolean)
                          )).sort().map(jur => (
                            <option key={jur} value={jur}>{jur}</option>
                          ))}
                        </select>
                      </div>

                      {(filterKelasTingkat || filterKelasJurusan) && (
                        <button
                          onClick={() => {
                            setFilterKelasTingkat('');
                            setFilterKelasJurusan('');
                          }}
                          className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
                        >
                          Reset Filter
                        </button>
                      )}
                    </div>

                    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm text-slate-700">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-800 font-bold bg-slate-100/50">
                              <th className="py-3 px-4 font-bold text-center w-20">No</th>
                              <th className="py-3 px-4 font-bold">Kelas</th>
                              <th className="py-3 px-4 font-bold">Jurusan</th>
                              <th className="py-3 px-4 font-bold">Guru Mapel</th>
                              <th className="py-3 px-4 font-bold">Mapel</th>
                              <th className="py-3 px-4 font-bold text-center w-40">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredKelasList.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="py-12 text-center text-slate-400">
                                  {appState.kelas.length === 0 ? "Belum ada kelas dibentuk. Silakan tambah kelas." : "Tidak ada data kelas yang cocok dengan filter."}
                                </td>
                              </tr>
                            ) : (
                              filteredKelasList.map((kelas, idx) => {
                                const level = kelas.kelas || kelas.namaKelas.split('-')[0] || '';
                                const jurusan = kelas.jurusan || kelas.namaKelas.split('-').slice(1).join('-') || '';
                                const guruMapel = kelas.guruMapel || kelas.waliKelas || '';
                                const mapel = kelas.mapel || '-';
                                return (
                                  <tr key={kelas.namaKelas} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="py-3 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                                    <td className="py-3 px-4 font-bold text-slate-800 uppercase tracking-wide">{level}</td>
                                    <td className="py-3 px-4 font-bold text-slate-800 uppercase tracking-wide">{jurusan}</td>
                                    <td className="py-3 px-4 font-semibold text-slate-550">{guruMapel}</td>
                                    <td className="py-3 px-4 font-medium text-slate-600">{mapel}</td>
                                    <td className="py-3 px-4 text-center">
                                      <div className="flex gap-2 justify-center">
                                        <button
                                          onClick={() => openKelasModal('EDIT', kelas.namaKelas)}
                                          className="text-indigo-600 hover:text-indigo-800 p-1 bg-indigo-50 rounded hover:bg-indigo-100 transition-colors"
                                          title="Ubah Kelas"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => deleteKelas(kelas.namaKelas)}
                                          className="text-rose-600 hover:text-rose-800 p-1 bg-rose-50 rounded hover:bg-rose-100 transition-colors"
                                          title="Hapus Kelas"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 5. KELOLA ABSEN (MANUAL CORRECTIONS LIST) */}
                {activeSection === 'g-kelola' && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-5"
                  >
                    <div className="flex justify-between items-center gap-4">
                      <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Kelola Log Kehadiran Siswa</h2>
                        <p className="text-slate-500 text-xs mt-0.5">Penghapusan, revisi data log masuk, atau penulisan absen manual mandiri.</p>
                      </div>
                      <button
                        onClick={() => {
                          setFieldManualAbsenFilterTingkat('');
                          setFieldManualAbsenFilterJurusan('');
                          setFieldManualAbsenNis(restrictedSiswaList[0]?.nis || '');
                          const nowObj = new Date();
                          setFieldManualAbsenDate(nowObj.toISOString().split('T')[0]);
                          setFieldManualAbsenStatus('Hadir (Manual)');
                          setShowAbsenManualModal(true);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow flex items-center gap-1.5 cursor-pointer"
                        id="btn-tambah-manual-log"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Input Presensi Manual</span>
                      </button>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                      <div className="max-h-[550px] overflow-y-auto">
                        <table className="w-full border-collapse text-left text-sm text-slate-700">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-800 font-bold bg-slate-100/50 sticky top-0 bg-white z-10 shadow-sm">
                              <th className="py-3 px-4 font-bold text-center w-16">No</th>
                              <th className="py-3 px-4 font-bold w-40">Waktu Input</th>
                              <th className="py-3 px-4 font-bold w-24">NISN</th>
                              <th className="py-3 px-4 font-bold">Nama Murid</th>
                              <th className="py-3 px-4 font-bold text-center w-24">Kelas</th>
                              <th className="py-3 px-4 font-bold text-slate-800 w-40">Mata Pelajaran</th>
                              <th className="py-3 px-4 font-bold text-slate-800 text-center w-20">Jam Ke</th>
                              <th className="py-3 px-4 font-bold text-slate-800 w-36">Guru Pengampu</th>
                              <th className="py-3 px-4 font-bold text-center w-32">Status</th>
                              <th className="py-3 px-4 font-bold text-center w-24">Opsi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {restrictedAbsensiList.length === 0 ? (
                              <tr>
                                <td colSpan={10} className="py-12 text-center text-slate-400">
                                  Belum ada rekaman log presensi.
                                </td>
                              </tr>
                            ) : (
                              restrictedAbsensiList.map((log, idx) => (
                                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-3 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                                  <td className="py-3 px-4 font-mono text-xs text-slate-500">
                                    {new Date(log.timestamp).toLocaleString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                  <td className="py-3 px-4 font-mono font-medium text-slate-450">{log.nis}</td>
                                  <td className="py-3 px-4 font-bold text-slate-800">{log.nama}</td>
                                  <td className="py-3 px-4 text-center uppercase font-semibold text-slate-650">{log.kelas}</td>
                                  <td className="py-3 px-4">
                                    <span className="font-semibold text-teal-850 text-xs bg-teal-50 px-2 py-1 rounded-md border border-teal-100/60 block truncate max-w-[150px]" title={log.mataPelajaran || 'Umum'}>
                                      {log.mataPelajaran || 'Umum'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-center font-mono font-bold text-slate-600 text-xs bg-slate-50/50">
                                    {log.jamKe || '1'}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="font-semibold text-slate-700 text-xs truncate block max-w-[130px]" title={log.guruNama || 'Admin'}>
                                      {log.guruNama || 'Admin'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold inline-block border ${
                                      log.status.startsWith('Hadir')
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                        : log.status === 'Sakit'
                                        ? 'bg-blue-50 text-blue-700 border-blue-100'
                                        : log.status === 'Izin'
                                        ? 'bg-amber-50 text-amber-700 border-amber-100'
                                        : log.status === 'Bolos'
                                        ? 'bg-purple-50 text-purple-700 border-purple-100'
                                        : 'bg-rose-50 text-rose-700 border-rose-100'
                                    }`}>
                                      {log.status}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <button
                                      onClick={() => deleteAbsenLog(log.id)}
                                      className="text-rose-600 hover:text-rose-800 p-1 bg-rose-50 rounded hover:bg-rose-100 transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 6. DAFTAR HADIR LOGS */}
                {activeSection === 'g-hadir' && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="flex justify-between items-center gap-4">
                      <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Daftar Log Presensi Realtime</h2>
                        <p className="text-slate-500 text-xs mt-0.5">Seluruh rekaman presensi log kronologis yang disusun secara otomatis.</p>
                      </div>
                      <button
                        onClick={() => exportTableToExcel('tbl-log-presensi-export-raw', 'Raw_Logs_Kehadiran')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                        id="btn-export-hadir"
                      >
                        <Download className="w-4 h-4" />
                        <span>Ekspor Excel</span>
                      </button>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                      <div className="relative w-full md:w-auto flex-1 font-sans">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                          <Search className="w-4 h-4" />
                        </span>
                        <input
                          type="text"
                          value={searchLogQuery}
                          onChange={(e) => setSearchLogQuery(e.target.value)}
                          placeholder="Cari log berdasarkan nama, NISN, atau tanggal..."
                          className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-800 pl-9 pr-4 py-2 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-400 font-semibold"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto shrink-0">
                        {/* Filter Tingkat Kelas */}
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-150">
                          <span className="text-slate-400 uppercase font-black text-[9px] tracking-wider">Kelas:</span>
                          <select
                            value={filterLogTingkat}
                            onChange={(e) => setFilterLogTingkat(e.target.value)}
                            className="bg-transparent text-xs py-0.5 rounded font-bold text-slate-700 focus:outline-none cursor-pointer"
                            id="sel-filter-log-tingkat"
                          >
                            <option value="">Semua</option>
                            {allowedGuruTingkat.map(t => (
                              <option key={t} value={t}>Kelas {t}</option>
                            ))}
                          </select>
                        </div>

                        {/* Filter Jurusan */}
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-150">
                          <span className="text-slate-400 uppercase font-black text-[9px] tracking-wider">Jurusan:</span>
                          <select
                            value={filterLogJurusan}
                            onChange={(e) => setFilterLogJurusan(e.target.value)}
                            className="bg-transparent text-xs py-0.5 rounded font-bold text-slate-700 focus:outline-none cursor-pointer"
                            id="sel-filter-log-jurusan"
                          >
                            <option value="">Semua</option>
                            {allowedGuruJurusan.map(j => (
                              <option key={j} value={j}>{j}</option>
                            ))}
                          </select>
                        </div>

                        {/* New Filter Mata Pelajaran */}
                        <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-150 text-emerald-800">
                          <span className="text-emerald-500 uppercase font-black text-[9px] tracking-wider">Mapel:</span>
                          <select
                            value={filterLogMapel}
                            onChange={(e) => setFilterLogMapel(e.target.value)}
                            className="bg-transparent text-xs py-0.5 rounded font-bold text-emerald-950 focus:outline-none cursor-pointer"
                            id="sel-filter-log-mapel"
                          >
                            <option value="" className="text-slate-800 font-medium">Semua Mapel</option>
                            {Array.from(new Set(restrictedAbsensiList.map(l => l.mataPelajaran).filter(Boolean))).map(m => (
                              <option key={m} value={m} className="text-slate-800 font-medium">{m}</option>
                            ))}
                          </select>
                        </div>

                        {/* New Filter Guru Pengampu */}
                        <div className="flex items-center gap-1.5 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-150 text-indigo-800">
                          <span className="text-indigo-500 uppercase font-black text-[9px] tracking-wider">Guru:</span>
                          <select
                            value={filterLogGuru}
                            onChange={(e) => setFilterLogGuru(e.target.value)}
                            className="bg-transparent text-xs py-0.5 rounded font-bold text-indigo-950 focus:outline-none cursor-pointer"
                            id="sel-filter-log-guru"
                          >
                            <option value="" className="text-slate-800 font-medium">Semua Guru</option>
                            {Array.from(new Set(restrictedAbsensiList.map(l => l.guruNama).filter(Boolean))).map(g => (
                              <option key={g} value={g} className="text-slate-800 font-medium">{g}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                      <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full border-collapse text-left text-sm text-slate-700" id="tbl-log-presensi-export-raw">
                           <thead>
                                                    <tr className="border-b border-slate-200 text-slate-800 font-bold bg-slate-100/50">
                              <th className="py-3 px-4 font-bold text-center w-16">No</th>
                              <th className="py-3 px-4 font-bold">Waktu Deteksi</th>
                              <th className="py-3 px-4 font-bold">Tanggal</th>
                              <th className="py-3 px-4 font-bold">NISN</th>
                              <th className="py-3 px-4 font-bold text-slate-900">Nama Siswa</th>
                              <th className="py-3 px-4 font-bold text-center w-24">Kelas</th>
                              <th className="py-3 px-4 font-bold text-slate-800">Mata Pelajaran</th>
                              <th className="py-3 px-4 font-bold text-slate-800 text-center w-20">Jam Ke</th>
                              <th className="py-3 px-4 font-bold text-slate-800">Guru Pengampu</th>
                              <th className="py-3 px-4 font-bold text-center w-36">Status Presensi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium text-slate-650">
                            {restrictedAbsensiList
                              .filter(log => {
                                const term = searchLogQuery.toLowerCase();
                                const matchesSearch = log.nama.toLowerCase().includes(term) || log.nis.includes(term) || log.tanggal.includes(term) || log.status.toLowerCase().includes(term);

                                let matchesTingkat = true;
                                if (filterLogTingkat) {
                                  const cleanKelas = log.kelas.trim().toUpperCase();
                                  const targetTingkat = filterLogTingkat.toUpperCase();
                                  matchesTingkat = cleanKelas === targetTingkat ||
                                                   cleanKelas.startsWith(targetTingkat + '-') ||
                                                   cleanKelas.startsWith(targetTingkat + ' ');
                                }

                                const matchesJurusan = filterLogJurusan 
                                  ? log.kelas.toUpperCase().includes(filterLogJurusan.toUpperCase()) 
                                  : true;

                                const matchesMapel = filterLogMapel
                                  ? log.mataPelajaran === filterLogMapel
                                  : true;

                                const matchesGuru = filterLogGuru
                                  ? log.guruNama === filterLogGuru
                                  : true;

                                return matchesSearch && matchesTingkat && matchesJurusan && matchesMapel && matchesGuru;
                              })
                              .map((log, idx) => (
                                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-3 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                                  <td className="py-3 px-4 font-mono text-xs">
                                    {new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                  </td>
                                  <td className="py-3 px-4 font-mono text-xs">{log.tanggal}</td>
                                  <td className="py-3 px-4 font-mono">{log.nis}</td>
                                  <td className="py-3 px-3 font-bold text-slate-800">{log.nama}</td>
                                  <td className="py-3 px-4 text-center uppercase text-slate-500 font-bold">{log.kelas}</td>
                                  <td className="py-3 px-4">
                                    <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100/60 block truncate max-w-[150px]" title={log.mataPelajaran || 'Umum'}>
                                      {log.mataPelajaran || 'Umum'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-center font-mono font-bold text-slate-600 text-xs bg-slate-50/50">
                                    {log.jamKe || '1'}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="font-semibold text-slate-700 text-xs block truncate max-w-[125px]" title={log.guruNama || 'Admin'}>
                                      {log.guruNama || 'Admin'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold inline-block border ${
                                      log.status.startsWith('Hadir')
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                        : log.status === 'Sakit'
                                        ? 'bg-blue-50 text-blue-700 border-blue-100'
                                        : log.status === 'Izin'
                                        ? 'bg-amber-50 text-amber-700 border-amber-100'
                                        : log.status === 'Bolos'
                                        ? 'bg-purple-50 text-purple-700 border-purple-100'
                                        : 'bg-rose-50 text-rose-700 border-rose-100'
                                    }`}>
                                      {log.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 7. LAPORAN HARIAN (FILTER SECTION MODUL) */}
                {activeSection === 'g-laporan' && (
                  <LaporanHarian 
                    siswaList={restrictedSiswaList}
                    absensiList={restrictedAbsensiList}
                    kelasList={restrictedKelasList}
                    holidays={holidays}
                  />
                )}

                {/* 8. REKAP BULANAN */}
                {activeSection === 'g-rekap' && (
                  <RekapBulanan 
                    siswaList={restrictedSiswaList}
                    absensiList={restrictedAbsensiList}
                    kelasList={restrictedKelasList}
                    holidays={holidays}
                  />
                )}

                {/* 9. KENAIKAN KELAS MASS PROMOTION */}
                {activeSection === 'g-promotion' && isSystemAdmin(appState.currentUser) && (
                  <KenaikanKelas 
                    kelasList={restrictedKelasList}
                    siswaList={restrictedSiswaList}
                    onMigrate={handleMassMigration}
                  />
                )}

                {/* 10. PANDUAN PENGGUNA & SLIDES PPT (DOKUMENTASI INTERAKTIF) */}
                {activeSection === 'g-panduan' && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm">
                      <PanduanCenter 
                        currentSchoolScope={
                          sekolahList.find(s => s.id === activeSchoolId) || null
                        }
                        triggerToast={triggerToast}
                      />
                    </div>
                  </motion.div>
                )}

              </div>
            )}

          </main>

        </div>
      )}

      {/* ======================================================== */}
      {/* DIALOG MODAL: CRUD SISWA */}
      {showMuridModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print" id="modal-siswa-wrapper">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4"
          >
            <h3 className="font-bold text-slate-800 text-lg">
              {muridModalMode === 'ADD' ? 'Tambah Murid Terdaftar' : 'Modifikasi Profil Siswa'}
            </h3>

            <div className="space-y-3.5 text-sm">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Nomor Induk Siswa (NISN)</label>
                <input
                  type="text"
                  value={fieldMuridNis}
                  onChange={(e) => setFieldMuridNis(e.target.value)}
                  disabled={muridModalMode === 'EDIT'}
                  placeholder="Contoh: 12351"
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 text-slate-800 px-3 py-2 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Nama Lengkap Murid</label>
                <input
                  type="text"
                  value={fieldMuridNama}
                  onChange={(e) => setFieldMuridNama(e.target.value)}
                  placeholder="Ahmad Budiman"
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Pilih Kelas / Rombel Terdaftar</label>
                  <select
                    value={appState.kelas.some(k => k.namaKelas === fieldMuridKelas) ? fieldMuridKelas : 'CUSTOM'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== 'CUSTOM') {
                        setFieldMuridKelas(val);
                      }
                    }}
                    className="w-full text-xs font-semibold bg-white border border-slate-200 text-slate-800 px-3 py-2 rounded-xl cursor-pointer shadow-xs"
                  >
                    <option value="CUSTOM">-- Input Manual / Bebas Sesuai Database --</option>
                    {appState.kelas.map(k => (
                      <option key={k.namaKelas} value={k.namaKelas}>
                        {k.namaKelas} (Wali: {getWaliKelasForClass(k, appState.guru) || 'Belum Diatur'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nama / Kode Rombel Kelas</label>
                  <input
                    type="text"
                    value={fieldMuridKelas}
                    onChange={(e) => setFieldMuridKelas(e.target.value.toUpperCase())}
                    placeholder="Contoh: XII-RPL-1 atau X-ATPH"
                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2 rounded-xl"
                  />
                  <p className="text-[9px] text-slate-400 mt-0.5 leading-normal">
                    *Harus sama persis dengan kode kelas di database kelas sekolah agar akun Guru dapat menyaring data murid sesuai bidang ajar & wali kelas.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Sandi Akun Siswa</label>
                <input
                  type="text"
                  value={fieldMuridPass}
                  onChange={(e) => setFieldMuridPass(e.target.value)}
                  placeholder="Sandi login siswa"
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Status Aktivitas</label>
                <select
                  value={fieldMuridStatus}
                  onChange={(e) => setFieldMuridStatus(e.target.value as any)}
                  className="w-full text-xs font-semibold bg-white border border-slate-200 text-slate-800 px-3 py-1.5 rounded-xl cursor-pointer"
                >
                  <option value="Aktif">Aktif</option>
                  <option value="Nonaktif">Nonaktif</option>
                </select>
              </div>
            </div>

            {errorForm && (
              <div className="text-rose-600 text-xs font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                {errorForm}
              </div>
            )}

            <div className="flex gap-2.5 justify-end pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowMuridModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-550 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={submitStudentForm}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
              >
                Simpan Data
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* DIALOG MODAL: CRUD GURU */}
      {showGuruModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print" id="modal-guru-wrapper">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4"
          >
            <h3 className="font-bold text-slate-800 text-lg">
              {guruModalMode === 'ADD' ? 'Tambah Guru / Staf Pendidik' : 'Modifikasi Profil Guru'}
            </h3>

            <div className="space-y-3.5 text-sm">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">NIP / ID Guru</label>
                <input
                  type="text"
                  value={fieldGuruNip}
                  onChange={(e) => setFieldGuruNip(e.target.value)}
                  disabled={guruModalMode === 'EDIT'}
                  placeholder="Contoh: 19820202"
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 text-slate-800 px-3 py-2 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Nama Lengkap (Beserta Gelar)</label>
                <input
                  type="text"
                  value={fieldGuruNama}
                  onChange={(e) => setFieldGuruNama(e.target.value)}
                  placeholder="Diana Lestari, S.Si."
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Jabatan / Keterangan Tugas</label>
                <input
                  type="text"
                  value={fieldGuruJabatan}
                  onChange={(e) => setFieldGuruJabatan(e.target.value)}
                  placeholder="Contoh: Wali Kelas X-RPL-2 / Guru Fisika"
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Kata Sandi Akun</label>
                <input
                  type="text"
                  value={fieldGuruPass}
                  onChange={(e) => setFieldGuruPass(e.target.value)}
                  placeholder="Password akun guru"
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2 rounded-xl font-mono"
                />
              </div>
            </div>

            {errorForm && (
              <div className="text-rose-600 text-xs font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                {errorForm}
              </div>
            )}

            <div className="flex gap-2.5 justify-end pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowGuruModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-550 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={submitGuruForm}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
              >
                Simpan
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* DIALOG MODAL: CRUD KELAS */}
      {showKelasModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print" id="modal-kelas-wrapper">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4"
          >
            <h3 className="font-bold text-slate-800 text-lg">
              {kelasModalMode === 'ADD' ? 'Tambah Kelas & Mapel Baru' : 'Ubah Detail Kelas & Mapel'}
            </h3>

            <div className="space-y-3.5 text-sm">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Kelas</label>
                  <input
                    type="text"
                    value={fieldKelasLevel}
                    onChange={(e) => setFieldKelasLevel(e.target.value)}
                    disabled={kelasModalMode === 'EDIT'}
                    placeholder="Contoh: XII"
                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 text-slate-800 px-3 py-2 rounded-xl text-center font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Jurusan</label>
                  <input
                    type="text"
                    value={fieldKelasJurusan}
                    onChange={(e) => setFieldKelasJurusan(e.target.value)}
                    disabled={kelasModalMode === 'EDIT'}
                    placeholder="Contoh: RPL-1"
                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 text-slate-800 px-3 py-2 rounded-xl text-center font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Guru Mapel</label>
                <select
                  value={fieldKelasGuruMapel}
                  onChange={(e) => setFieldKelasGuruMapel(e.target.value)}
                  className="w-full text-xs font-semibold bg-white border border-slate-200 text-slate-800 px-3 py-1.5 rounded-xl cursor-pointer"
                >
                  <option value="">-- Pilih Guru Mapel --</option>
                  {appState.guru
                    .filter(g => isServerAdmin(appState.currentUser) || !isServerAdmin({ username: g.nip }))
                    .map(g => (
                      <option key={g.nip} value={g.nama}>{g.nama}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Mata Pelajaran (Mapel)</label>
                <input
                  type="text"
                  value={fieldKelasMapel}
                  onChange={(e) => setFieldKelasMapel(e.target.value)}
                  placeholder="Contoh: Pemrograman Web / Matematika"
                  className="w-full text-xs font-semibold bg-white border border-slate-200 text-slate-800 px-3 py-2 rounded-xl"
                />
              </div>
            </div>

            {errorForm && (
              <div className="text-rose-600 text-xs font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                {errorForm}
              </div>
            )}

            <div className="flex gap-2.5 justify-end pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowKelasModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-550 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={submitKelasForm}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
              >
                Simpan Kelas
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* DIALOG MODAL: ABSEN MANUAL FORM */}
      {showAbsenManualModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print" id="modal-absen-manual-wrapper">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-100 shadow-2xl space-y-4"
          >
            <h3 className="font-bold text-slate-800 text-lg">Perekaman Absensi Manual</h3>

            <div className="space-y-3 text-sm">
              {/* Filter Tingkat Kelas & Jurusan */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Filter Kelas</label>
                  <select
                    value={fieldManualAbsenFilterTingkat}
                    onChange={(e) => handleManualFilterTingkatChange(e.target.value, fieldManualAbsenFilterJurusan)}
                    className="w-full text-xs font-semibold bg-white border border-slate-200 text-slate-800 px-2.5 py-1.5 rounded-xl cursor-pointer"
                  >
                    <option value="">Semua</option>
                    {allowedGuruTingkat.map(t => (
                      <option key={t} value={t}>Kelas {t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Jurusan</label>
                  <select
                    value={fieldManualAbsenFilterJurusan}
                    onChange={(e) => handleManualFilterJurusanChange(e.target.value, fieldManualAbsenFilterTingkat)}
                    className="w-full text-xs font-semibold bg-white border border-slate-200 text-slate-800 px-2.5 py-1.5 rounded-xl cursor-pointer"
                  >
                    <option value="">Semua</option>
                    {allowedGuruJurusan.map(j => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Pilih Murid</label>
                <select
                  value={fieldManualAbsenNis}
                  onChange={(e) => setFieldManualAbsenNis(e.target.value)}
                  className="w-full text-xs font-semibold bg-white border border-slate-200 text-slate-800 px-3 py-1.5 rounded-xl cursor-pointer"
                >
                  {restrictedSiswaList
                    .filter(s => {
                      let matchesTingkat = true;
                      if (fieldManualAbsenFilterTingkat) {
                        const cleanKelas = s.kelas.trim().toUpperCase();
                        const targetTingkat = fieldManualAbsenFilterTingkat.toUpperCase();
                        matchesTingkat = cleanKelas === targetTingkat ||
                                         cleanKelas.startsWith(targetTingkat + '-') ||
                                         cleanKelas.startsWith(targetTingkat + ' ');
                      }

                      const matchesJurusan = fieldManualAbsenFilterJurusan
                        ? s.kelas.toUpperCase().includes(fieldManualAbsenFilterJurusan.toUpperCase())
                        : true;

                      return matchesTingkat && matchesJurusan;
                    })
                    .map(s => (
                      <option key={s.nis} value={s.nis}>{s.nama} ({s.kelas})</option>
                    ))}
                  {restrictedSiswaList.filter(s => {
                    let matchesTingkat = true;
                    if (fieldManualAbsenFilterTingkat) {
                      const cleanKelas = s.kelas.trim().toUpperCase();
                      const targetTingkat = fieldManualAbsenFilterTingkat.toUpperCase();
                      matchesTingkat = cleanKelas === targetTingkat ||
                                       cleanKelas.startsWith(targetTingkat + '-') ||
                                       cleanKelas.startsWith(targetTingkat + ' ');
                    }

                    const matchesJurusan = fieldManualAbsenFilterJurusan
                      ? s.kelas.toUpperCase().includes(fieldManualAbsenFilterJurusan.toUpperCase())
                      : true;

                    return matchesTingkat && matchesJurusan;
                  }).length === 0 && (
                    <option value="">-- Tidak ada murid yang cocok --</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Tanggal Absensi</label>
                <input
                  type="date"
                  value={fieldManualAbsenDate}
                  onChange={(e) => setFieldManualAbsenDate(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2 rounded-xl text-center"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 font-bold">Status Kehadiran</label>
                <select
                  value={fieldManualAbsenStatus}
                  onChange={(e) => setFieldManualAbsenStatus(e.target.value as any)}
                  className="w-full text-xs font-semibold bg-white border border-slate-200 text-slate-800 px-3 py-1.5 rounded-xl cursor-pointer"
                >
                  <option value="Hadir (Manual)">Hadir (Manual)</option>
                  <option value="Sakit">Sakit (S)</option>
                  <option value="Izin">Izin (I)</option>
                  <option value="Bolos">Bolos (B)</option>
                  <option value="Alfa">Alfa (A)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 font-bold">Jam Ke</label>
                <select
                  value={fieldManualAbsenJamKe}
                  onChange={(e) => setFieldManualAbsenJamKe(e.target.value)}
                  className="w-full text-xs font-semibold bg-white border border-slate-200 text-slate-800 px-3 py-1.5 rounded-xl cursor-pointer font-mono"
                >
                  <option value="1">Jam Ke-1</option>
                  <option value="2">Jam Ke-2</option>
                  <option value="3">Jam Ke-3</option>
                  <option value="4">Jam Ke-4</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2.5 justify-end pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowAbsenManualModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-550 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={submitManualAbsen}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
              >
                Simpan Log
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* DIALOG MODAL: INSPEKSI / KONTROL GURU */}
      {showGuruControlModal && selectedInspectGuru && (() => {
        const kelasDiampu = appState.kelas.filter(k => 
          isTeacherWaliOfClass(selectedInspectGuru, k) ||
          cleanCompareTeacher(k.guruMapel || '', selectedInspectGuru.nama || '')
        );
        const kelasDiampuNames = kelasDiampu.map(k => k.namaKelas);
        const kelasDiajarNames = selectedInspectGuru.kelasDiajar || [];
        const allManagedClasses = Array.from(new Set([...kelasDiampuNames, ...kelasDiajarNames]));

        const baseManagedAll = allManagedClasses.map(c => getBaseClassGroup(c, appState.kelas));
        const normalizedManagedAll = baseManagedAll.map(c => normalizeClassName(c));

        const siswaDiampu = appState.siswa.filter(s => {
          const sc = normalizeClassName(s.kelas);
          return normalizedManagedAll.some(mc => sc === mc || sc.includes(mc) || mc.includes(sc));
        });
        const logsDiampu = appState.absensi.filter(l => {
          const lc = normalizeClassName(l.kelas);
          return normalizedManagedAll.some(mc => lc === mc || lc.includes(mc) || mc.includes(lc));
        });
        const logsHariIni = logsDiampu.filter(l => l.tanggal === new Date().toISOString().split('T')[0]);

        const toggleClassAssignment = (namaKelas: string) => {
          const baseClass = namaKelas.split(' - ')[0];
          const isCurrentlyAssigned = isTeacherWaliOfClass(selectedInspectGuru, { namaKelas });
          
          let updatedJabatan = '';
          if (isCurrentlyAssigned) {
            updatedJabatan = 'Guru Mapel';
          } else {
            updatedJabatan = `Wali Kelas ${baseClass}`;
          }

          const updatedTeacherObj: Guru = {
            ...selectedInspectGuru,
            jabatan: updatedJabatan
          };
          
          dbSaveGuru(activeSchoolId || '', updatedTeacherObj);
          setSelectedInspectGuru(updatedTeacherObj);

          let updatedGuruList = appState.guru.map(g => {
            if (g.nip === selectedInspectGuru.nip) {
              return updatedTeacherObj;
            }
            if (!isCurrentlyAssigned && isTeacherWaliOfClass(g, { namaKelas })) {
              const updatedOther: Guru = {
                ...g,
                jabatan: 'Guru Mapel'
              };
              dbSaveGuru(activeSchoolId || '', updatedOther);
              return updatedOther;
            }
            return g;
          });

          setAppState(prev => ({
            ...prev,
            guru: updatedGuruList
          }));

          triggerToast(`Berhasil mengatur jabatan ${selectedInspectGuru.nama} sebagai ${updatedJabatan}.`);
        };

        const toggleClassTeaching = (namaKelas: string) => {
          const currentTeaching = selectedInspectGuru.kelasDiajar || [];
          const isCurrentlyTeaching = currentTeaching.includes(namaKelas);
          const updatedTeaching = isCurrentlyTeaching
            ? currentTeaching.filter(name => name !== namaKelas)
            : [...currentTeaching, namaKelas];

          const updatedTeacherObj: Guru = {
            ...selectedInspectGuru,
            kelasDiajar: updatedTeaching
          };

          dbSaveGuru(activeSchoolId || '', updatedTeacherObj);
          setSelectedInspectGuru(updatedTeacherObj);

          setAppState(prev => ({
            ...prev,
            guru: prev.guru.map(g => g.nip === selectedInspectGuru.nip ? updatedTeacherObj : g)
          }));
          triggerToast(`Berhasil mengubah penugasan kelas yang diajar: ${namaKelas}.`);
        };

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print" id="modal-guru-control-wrapper">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl p-5 max-w-3xl w-full border border-slate-100 shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[9px] bg-emerald-50 text-emerald-750 font-extrabold px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                    Control Panel Administrasi Guru
                  </span>
                  <h3 className="font-extrabold text-slate-900 text-lg mt-1 flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-emerald-600" />
                    <span>{selectedInspectGuru.nama}</span>
                  </h3>
                  <p className="text-slate-500 text-[11px] font-medium mt-0.5">
                    NIP: <span className="font-mono">{selectedInspectGuru.nip}</span> &bull; Jabatan: {selectedInspectGuru.jabatan || 'Wali Kelas'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowGuruControlModal(false);
                    setSelectedInspectGuru(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 rounded-lg transition-colors font-bold text-xs"
                >
                  Tutup Panel
                </button>
              </div>

              {/* STATS COUNT */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-slate-50 border border-slate-150 rounded-xl p-2.5">
                  <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Kelas Binaan</span>
                  <span className="text-lg font-black text-slate-800 mt-0.5 block">{kelasDiampu.length} Kelas</span>
                  <span className="text-[9px] text-slate-450 block truncate">
                    {kelasDiampuNames.join(', ') || 'Belum ada kelas'}
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-150 rounded-xl p-2.5">
                  <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Siswa Terkelola</span>
                  <span className="text-lg font-black text-slate-800 mt-0.5 block">{siswaDiampu.length} Siswa</span>
                  <span className="text-[9px] text-slate-450 block">Dalam kelas binaan guru</span>
                </div>

                <div className="bg-slate-50 border border-slate-150 rounded-xl p-2.5">
                  <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Log Hadir Hari Ini</span>
                  <span className="text-lg font-black text-emerald-600 mt-0.5 block">{logsHariIni.length} Presensi</span>
                  <span className="text-[9px] text-slate-450 block">Dari total kelas binaan</span>
                </div>
              </div>

              {/* MAIN BODY CONFIG GRID */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-left">
                
                {/* LEFT PANEL: CONFIG ASSIGNMENTS (4 cols) */}
                <div className="md:col-span-4 bg-slate-50/50 border border-slate-100/85 rounded-xl p-3 space-y-3 max-h-[350px] overflow-y-auto" id="config-guru-akses-kelas-panel">
                  {/* SECTION 1: WALI KELAS */}
                  <div className="space-y-1.5">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wide flex items-center gap-1 text-emerald-700">
                        <School className="w-3 h-3" />
                        <span>Otoritas Wali Kelas</span>
                      </h4>
                      <p className="text-[9px] text-slate-450 leading-tight">
                        Pilih kelas di mana guru ini menjabat sebagai Wali Kelas utama.
                      </p>
                    </div>

                    <div className="border border-slate-200/60 bg-white rounded-lg divide-y divide-slate-100 max-h-[100px] overflow-y-auto">
                      {appState.kelas.length === 0 ? (
                        <p className="text-center py-3 text-[10px] text-slate-400 font-medium">Belum ada data kelas.</p>
                      ) : (
                        appState.kelas.map(k => {
                          const isAssignedToThis = isTeacherWaliOfClass(selectedInspectGuru, k);
                          const currentWali = getWaliKelasForClass(k, appState.guru);
                          const isAssignedToOther = currentWali && currentWali !== selectedInspectGuru.nama;

                          return (
                            <div 
                              key={k.namaKelas} 
                              className={`flex items-center justify-between p-2 transition-colors cursor-pointer select-none text-[10px] hover:bg-slate-50`}
                              onClick={() => {
                                if (isAssignedToOther) {
                                  requestConfirm(
                                    'Pindahkan Wali Kelas?',
                                    `Kelas ${k.namaKelas} saat ini diampu oleh ${currentWali}. Pindahkan penugasan ke ${selectedInspectGuru.nama}?`,
                                    () => toggleClassAssignment(k.namaKelas)
                                  );
                                } else {
                                  toggleClassAssignment(k.namaKelas);
                                }
                              }}
                            >
                              <div className="space-y-0.5 max-w-[125px] truncate">
                                <span className="font-extrabold text-slate-800">{k.namaKelas}</span>
                                <p className="text-[8px] text-slate-400 truncate">
                                  {isAssignedToThis ? 'Wali (Aktif)' : isAssignedToOther ? `Diampu: ${currentWali}` : 'Belum diampu'}
                                </p>
                              </div>
                              <input 
                                type="checkbox"
                                checked={isAssignedToThis}
                                onChange={() => {}} // event handled by div block click
                                className="w-3 h-3 text-emerald-600 border-slate-200 focus:ring-emerald-500 rounded cursor-pointer animate-none"
                              />
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* SECTION 2: KELAS YANG DIAJAR / GURU MAPEL */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                    <div>
                      <h4 className="font-extrabold text-indigo-700 text-[11px] uppercase tracking-wide flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>Kelas yang Diajar (Mapel)</span>
                      </h4>
                      <p className="text-[9px] text-slate-450 leading-tight">
                        Masukkan & petakan daftar kelas tambahan yang diajar guru ini agar memudahkan penyaringan murid.
                      </p>
                    </div>

                    <div className="border border-slate-200/60 bg-white rounded-lg divide-y divide-slate-100 max-h-[110px] overflow-y-auto font-medium">
                      {appState.kelas.length === 0 ? (
                        <p className="text-center py-3 text-[10px] text-slate-400 font-medium">Belum ada data kelas.</p>
                      ) : (
                        appState.kelas.map(k => {
                          const isTeachingThis = (selectedInspectGuru.kelasDiajar || []).includes(k.namaKelas);

                          return (
                            <div 
                              key={`teach-${k.namaKelas}`} 
                              className={`flex items-center justify-between p-2 transition-colors cursor-pointer select-none text-[10px] hover:bg-slate-50`}
                              onClick={() => toggleClassTeaching(k.namaKelas)}
                            >
                              <div className="space-y-0.5">
                                <span className="font-extrabold text-slate-800">{k.namaKelas}</span>
                                <p className="text-[8px] text-indigo-500">
                                  {isTeachingThis ? 'Mengajar (Aktif)' : 'Bukan Pengampu'}
                                </p>
                              </div>
                              <input 
                                type="checkbox"
                                checked={isTeachingThis}
                                onChange={() => {}} // handled by click
                                className="w-3 h-3 text-indigo-600 border-slate-200 focus:ring-indigo-500 rounded cursor-pointer animate-none"
                              />
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* RIGHT PANEL: INSPECT DATA SUB-TABS (8 cols) */}
                <div className="md:col-span-8 space-y-3.5">
                  
                  {/* siswa list */}
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wide flex items-center gap-1 mb-1">
                      <Users className="w-3 h-3 text-slate-500" />
                      <span>Daftar Siswa Binaan ({siswaDiampu.length} murid)</span>
                    </h4>
                    <div className="border border-slate-100 rounded-lg max-h-[110px] overflow-y-auto bg-white">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold sticky top-0 z-10">
                            <th className="p-1 pl-2 font-bold w-10 text-center">No</th>
                            <th className="p-1 font-bold w-20">NISN</th>
                            <th className="p-1 font-bold">Nama Siswa</th>
                            <th className="p-1 font-bold text-center w-20">Kelas</th>
                            <th className="p-1 pr-2 font-bold text-center w-16">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {siswaDiampu.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-4 text-center text-slate-400 font-medium">
                                Guru ini belum memiliki kelas binaan atau siswa terdaftar di kelasnya.
                              </td>
                            </tr>
                          ) : (
                            siswaDiampu.map((s, idx) => (
                              <tr key={s.nis} className="hover:bg-slate-50/50">
                                <td className="p-1 px-2 text-center text-slate-450 font-mono">{idx + 1}</td>
                                <td className="p-1 font-mono text-slate-400">{s.nis}</td>
                                <td className="p-1 font-bold text-slate-700 truncate max-w-[140px]">{s.nama}</td>
                                <td className="p-1 text-center text-slate-600 font-bold uppercase">{s.kelas}</td>
                                <td className="p-1 pr-2 text-center">
                                  <span className={`px-1 rounded text-[8px] font-bold inline-block border ${
                                    s.status === 'Aktif'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                      : 'bg-rose-50 text-rose-700 border-rose-100'
                                  }`}>
                                    {s.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* recent logs list */}
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                      <ClipboardCheck className="w-3 h-3 text-slate-500" />
                      <span>Log Kehadiran Masuk Siswa Hari Ini & Terbaru ({logsDiampu.length} log)</span>
                    </h4>
                    <div className="border border-slate-100 rounded-lg max-h-[110px] overflow-y-auto bg-white">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold sticky top-0 z-10">
                            <th className="p-1.5 pl-2 font-bold w-10 text-center">No</th>
                            <th className="p-1 font-bold w-24">Waktu Deteksi</th>
                            <th className="p-1 font-bold">Nama Siswa</th>
                            <th className="p-1 font-bold text-center w-20">Kelas</th>
                            <th className="p-1 pr-2 font-bold text-center w-24">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {logsDiampu.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-4 text-center text-slate-400 font-medium">
                                Belum ada log presensi tercatat untuk kelas binaan guru ini.
                              </td>
                            </tr>
                          ) : (
                            logsDiampu.slice(0, 30).map((log, idx) => (
                              <tr key={log.id} className="hover:bg-slate-50/50">
                                <td className="p-1 px-2 text-center text-slate-450 font-mono">{idx + 1}</td>
                                <td className="p-1 font-mono text-slate-400">
                                  {new Date(log.timestamp).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})} {new Date(log.timestamp).toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'})}
                                </td>
                                <td className="p-1 font-bold text-slate-755 truncate max-w-[130px]">{log.nama}</td>
                                <td className="p-1 text-center text-slate-500 font-bold uppercase">{log.kelas}</td>
                                <td className="p-1 pr-2 text-center">
                                  <span className={`px-1 rounded text-[8px] font-bold inline-block border ${
                                    log.status.startsWith('Hadir')
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                      : log.status === 'Sakit'
                                      ? 'bg-blue-50 text-blue-700 border-blue-100'
                                      : log.status === 'Izin'
                                      ? 'bg-amber-50 text-amber-700 border-amber-100'
                                      : log.status === 'Bolos'
                                      ? 'bg-purple-50 text-purple-700 border-purple-100'
                                      : 'bg-rose-50 text-rose-700 border-rose-100'
                                  }`}>
                                    {log.status === 'Hadir (QR)' ? 'QR HADIR' : log.status === 'Hadir (Manual)' ? 'HADIR' : log.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>

              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    setShowGuruControlModal(false);
                    setSelectedInspectGuru(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl transition-colors shadow"
                >
                  Tutup Panel Kontrol
                </button>
              </div>

            </motion.div>
          </div>
        );
      })()}

      {/* DIALOG MODAL: CUSTOM CONFIRMATION BOX */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print" id="modal-confirm-wrapper">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-100 shadow-2xl space-y-4 text-center"
          >
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border border-rose-100">
              <AlertTriangle className="w-6 h-6" />
            </div>
            
            <div className="space-y-1.5">
              <h3 className="font-bold text-slate-800 text-base">{confirmModal.title}</h3>
              <p className="text-slate-500 text-xs leading-relaxed">{confirmModal.message}</p>
            </div>

            <div className="flex gap-2.5 justify-center pt-2">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-bold text-slate-550 bg-slate-100 hover:bg-slate-200 rounded-xl flex-1 cursor-pointer"
                id="btn-confirm-cancel"
              >
                Batal
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl flex-1 cursor-pointer shadow-md shadow-rose-100"
                id="btn-confirm-approve"
              >
                Ya, Lanjutkan
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* UPDATE/EDIT SEKOLAH PARAMETERS OVERLAY DIALOG */}
      <AnimatePresence>
        {editingSekolah && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans"
            id="editing-sekolah-overlay"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 rounded-xl">
                    <School className="w-5 h-5 text-emerald-650" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-sm">Update Parameter Sekolah</h3>
                    <p className="text-[10px] text-slate-400 font-mono">Kode ID: {editingSekolah.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingSekolah(null)}
                  className="p-1 hover:bg-slate-100 rounded-full transition-all text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs font-semibold">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nama Sekolah</label>
                  <input
                    type="text"
                    value={editingSekolah.nama}
                    onChange={(e) => setEditingSekolah({ ...editingSekolah, nama: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Alamat Lengkap</label>
                  <input
                    type="text"
                    value={editingSekolah.alamat || ''}
                    onChange={(e) => setEditingSekolah({ ...editingSekolah, alamat: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Jam Masuk</label>
                    <input
                      type="time"
                      value={editingSekolah.jamMasuk || '07:15'}
                      onChange={(e) => setEditingSekolah({ ...editingSekolah, jamMasuk: e.target.value })}
                      className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Jam Pulang</label>
                    <input
                      type="time"
                      value={editingSekolah.jamPulang || '14:00'}
                      onChange={(e) => setEditingSekolah({ ...editingSekolah, jamPulang: e.target.value })}
                      className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">No. Kontak Pengaduan/Admin</label>
                  <input
                    type="text"
                    value={editingSekolah.kontak || ''}
                    onChange={(e) => setEditingSekolah({ ...editingSekolah, kontak: e.target.value })}
                    placeholder="Contoh: 081234567890"
                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setEditingSekolah(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer text-center"
                >
                  Batal
                </button>
                <button
                  onClick={async () => {
                    if (!editingSekolah.nama.trim()) {
                      triggerToast('Nama sekolah wajib diisi!', 'warning');
                      return;
                    }
                    try {
                      await dbSaveSekolah(editingSekolah);
                      triggerToast(`Sekolah "${editingSekolah.nama}" berhasil diperbarui!`, 'success');
                      setEditingSekolah(null);
                    } catch (e) {
                      triggerToast('Gagal memperbarui data sekolah.', 'error');
                    }
                  }}
                  className="flex-1 bg-emerald-650 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 shadow"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
