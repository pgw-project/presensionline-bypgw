import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, Save, Search, Filter, Calendar, Clock, BookOpen,
  Check, RefreshCw, Sparkles, UserCheck, UserX, Info, QrCode, Zap
} from 'lucide-react';
import { Siswa, Kelas, AbsenLog, CurrentUser, AppState, Guru } from '../types';
import { dbSaveAbsen } from '../lib/firebaseSync';

interface PresensiMassalProps {
  appState: AppState;
  currentUser: CurrentUser | null;
  currentGuruObj?: Guru;
  isGuruNonAdmin: boolean;
  restrictedKelasList: Kelas[];
  restrictedSiswaList: Siswa[];
  allowedGuruMapels: string[];
  allowedGuruTingkat: string[];
  allowedGuruJurusan: string[];
  activeMataPelajaran: string;
  customMataPelajaran: string;
  activeSessionJamKe: string;
  activeSessionTingkat: string;
  activeSessionJurusan: string;
  activeSchoolId: string;
  isWithinSchoolHours: () => boolean;
  getActiveSchoolHoursConfig: () => { jamMasuk: string; jamPulang: string };
  getHoliday: (dateStr: string) => { date: string; keterangan: string } | undefined;
  checkGuruAttendancePermission: (
    guru: CurrentUser | null,
    guruDetail: Guru | undefined,
    student: Siswa,
    subjectName: string,
    kelasList: Kelas[]
  ) => { isAuthorized: boolean; reason?: string };
  triggerToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onSaveMassal: (newLogs: AbsenLog[]) => void;
}

export type StatusType = 'Hadir (QR)' | 'Hadir (Manual)' | 'Sakit' | 'Izin' | 'Bolos' | 'Alfa';

export default function PresensiMassal({
  appState,
  currentUser,
  currentGuruObj,
  isGuruNonAdmin,
  restrictedKelasList,
  restrictedSiswaList,
  allowedGuruMapels,
  allowedGuruTingkat,
  allowedGuruJurusan,
  activeMataPelajaran,
  customMataPelajaran,
  activeSessionJamKe,
  activeSessionTingkat,
  activeSessionJurusan,
  activeSchoolId,
  isWithinSchoolHours,
  getActiveSchoolHoursConfig,
  getHoliday,
  checkGuruAttendancePermission,
  triggerToast,
  onSaveMassal,
}: PresensiMassalProps) {
  // Filters
  const [filterTingkat, setFilterTingkat] = useState<string>('');
  const [filterJurusan, setFilterJurusan] = useState<string>('');
  const [selectedMapel, setSelectedMapel] = useState<string>('');
  const [selectedJamKe, setSelectedJamKe] = useState<string>(activeSessionJamKe || '1');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Available Mapel options strictly corresponding to subjects taught by the teacher
  const teacherMapelOptions = useMemo(() => {
    const setM = new Set<string>();

    const cleanStr = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const isTeacherMatch = (t1?: string, t2?: string) => {
      if (!t1 || !t2) return false;
      const c1 = cleanStr(t1);
      const c2 = cleanStr(t2);
      return c1 === c2 || c1.includes(c2) || c2.includes(c1);
    };

    // 1. Explicit mataPelajaran on currentGuruObj (e.g. "MULOK, Manajemen Logistik")
    if (currentGuruObj?.mataPelajaran) {
      currentGuruObj.mataPelajaran.split(/[,;/]/).forEach(m => {
        const clean = m.trim();
        if (clean) setM.add(clean);
      });
    }

    // 2. Check classes in appState.kelas assigned to currentGuruObj
    if (currentGuruObj) {
      const guruName = currentGuruObj.nama;
      const guruNip = currentGuruObj.nip;

      appState.kelas.forEach(k => {
        const isMatch = k.guruMapel && (isTeacherMatch(k.guruMapel, guruName) || k.guruMapel === guruNip);
        if (isMatch && k.mapel && k.mapel.trim()) {
          setM.add(k.mapel.trim());
        }
      });

      // Also check kelasDiajar list for embedded subjects or class names
      (currentGuruObj.kelasDiajar || []).forEach(kd => {
        if (kd.includes(' - ')) {
          const parts = kd.split(' - ');
          const lastPart = parts[parts.length - 1].trim();
          if (lastPart && !lastPart.match(/^(X|XI|XII)/i)) {
            setM.add(lastPart);
          }
        }
      });
    }

    // 3. For Non-Admin teachers, check allowedGuruMapels
    if (isGuruNonAdmin && allowedGuruMapels && allowedGuruMapels.length > 0) {
      allowedGuruMapels.forEach(m => {
        if (m && m.trim()) setM.add(m.trim());
      });
    }

    // If teacher-specific subjects were found, return ONLY those subjects
    if (setM.size > 0) {
      return Array.from(setM).sort((a, b) => a.localeCompare(b, 'id'));
    }

    // Fallback ONLY when no teacher profile or no specific mapel is assigned at all
    if (allowedGuruMapels && allowedGuruMapels.length > 0) {
      allowedGuruMapels.forEach(m => { if (m && m.trim()) setM.add(m.trim()); });
    } else if (appState.kelas && appState.kelas.length > 0) {
      appState.kelas.forEach(k => {
        if (k && k.mapel && k.mapel.trim()) setM.add(k.mapel.trim());
      });
    } else {
      ['Matematika', 'Bahasa Indonesia', 'Bahasa Inggris', 'IPA', 'IPS', 'Pendidikan Agama', 'PPKn', 'Informatika'].forEach(m => setM.add(m));
    }

    return Array.from(setM).sort((a, b) => a.localeCompare(b, 'id'));
  }, [allowedGuruMapels, currentGuruObj, isGuruNonAdmin, appState.kelas]);

  // Set default selectedMapel when options are available or when selectedMapel is invalid
  useEffect(() => {
    if (teacherMapelOptions.length > 0) {
      if (!selectedMapel || !teacherMapelOptions.includes(selectedMapel)) {
        setSelectedMapel(teacherMapelOptions[0]);
      }
    }
  }, [teacherMapelOptions, selectedMapel]);

  // Available Tingkat options
  const availableTingkats = useMemo(() => {
    if (allowedGuruTingkat && allowedGuruTingkat.length > 0) return allowedGuruTingkat;
    const setT = new Set<string>();
    restrictedKelasList.forEach(k => {
      const t = k.kelas || (k.namaKelas || '').split('-')[0];
      if (t) setT.add(t.toUpperCase());
    });
    return Array.from(setT).sort();
  }, [allowedGuruTingkat, restrictedKelasList]);

  // Available Jurusan options
  const availableJurusans = useMemo(() => {
    if (allowedGuruJurusan && allowedGuruJurusan.length > 0) return allowedGuruJurusan;
    const setJ = new Set<string>();
    restrictedKelasList.forEach(k => {
      if (k.jurusan) setJ.add(k.jurusan.toUpperCase());
    });
    return Array.from(setJ).sort();
  }, [allowedGuruJurusan, restrictedKelasList]);

  // Students matching selected Tingkat and Jurusan - STRICTLY ALPHABETICAL (A-Z)
  const classStudents = useMemo(() => {
    return restrictedSiswaList
      .filter(s => {
        if (!s || s.status !== 'Aktif') return false;
        const sKelas = (s.kelas || '').trim().toUpperCase();

        if (filterTingkat) {
          const t = filterTingkat.toUpperCase();
          const matchesT = sKelas === t || sKelas.startsWith(t + '-') || sKelas.startsWith(t + ' ');
          if (!matchesT) return false;
        }

        if (filterJurusan) {
          const fj = filterJurusan.toUpperCase();
          const sJ = (s.jurusan || '').toUpperCase();
          if (!sKelas.includes(fj) && !sJ.includes(fj)) return false;
        }

        return true;
      })
      .sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id'));
  }, [restrictedSiswaList, filterTingkat, filterJurusan]);

  // Search filter applied to classStudents
  const filteredStudents = useMemo(() => {
    if (!searchQuery) return classStudents;
    const q = searchQuery.toLowerCase().trim();
    return classStudents.filter(s => 
      s.nama.toLowerCase().includes(q) || s.nis.includes(q)
    );
  }, [classStudents, searchQuery]);

  // Attendance status map: NIS -> StatusType
  const [statusMap, setStatusMap] = useState<Record<string, StatusType>>({});
  const prevQrLogIdsRef = useRef<Set<string>>(new Set());

  // Sync status map whenever student list, date, selectedMapel, or jamKe changes
  useEffect(() => {
    if (classStudents.length === 0) {
      setStatusMap({});
      return;
    }

    const currentQrSet = new Set<string>();
    const initialMap: Record<string, StatusType> = {};

    classStudents.forEach(siswa => {
      const existingLog = appState.absensi.find(log => 
        log.nis === siswa.nis &&
        log.tanggal === selectedDate &&
        (log.jamKe || '1') === selectedJamKe &&
        (!selectedMapel || !log.mataPelajaran || (log.mataPelajaran || '').trim().toLowerCase() === selectedMapel.trim().toLowerCase())
      );

      if (existingLog) {
        let st: StatusType = 'Hadir (Manual)';
        if (existingLog.status === 'Hadir (QR)') {
          st = 'Hadir (QR)';
          currentQrSet.add(existingLog.id);
        } else if (existingLog.status.startsWith('Hadir')) {
          st = 'Hadir (Manual)';
        } else if (existingLog.status === 'Sakit') st = 'Sakit';
        else if (existingLog.status === 'Izin') st = 'Izin';
        else if (existingLog.status === 'Bolos') st = 'Bolos';
        else if (existingLog.status === 'Alfa') st = 'Alfa';
        initialMap[siswa.nis] = st;
      } else {
        initialMap[siswa.nis] = 'Alfa';
      }
    });

    // Notify teacher if a new QR scan was synced live while viewing
    if (prevQrLogIdsRef.current.size > 0) {
      currentQrSet.forEach(id => {
        if (!prevQrLogIdsRef.current.has(id)) {
          const log = appState.absensi.find(l => l.id === id);
          if (log) {
            triggerToast(`⚡ Live Barcode Sync: ${log.nama} (${log.kelas}) tersinkron via scan QR!`, 'success');
          }
        }
      });
    }
    prevQrLogIdsRef.current = currentQrSet;

    setStatusMap(initialMap);
  }, [classStudents, selectedDate, selectedJamKe, selectedMapel, appState.absensi]);

  // Mass action setter
  const handleSetAllStatus = (targetStatus: StatusType) => {
    if (classStudents.length === 0) return;
    const updatedMap = { ...statusMap };
    classStudents.forEach(s => {
      updatedMap[s.nis] = targetStatus;
    });
    setStatusMap(updatedMap);
    triggerToast(`Seluruh murid (${classStudents.length}) di-set ke status: ${targetStatus.split(' ')[0]}`, 'info');
  };

  const handleStudentStatusChange = (nis: string, status: StatusType) => {
    setStatusMap(prev => ({
      ...prev,
      [nis]: status
    }));
  };

  // Live Summary Counts
  const summaryCounts = useMemo(() => {
    let hadirQr = 0, hadirManual = 0, sakit = 0, izin = 0, bolos = 0, alfa = 0;
    classStudents.forEach(s => {
      const st = statusMap[s.nis];
      if (st === 'Hadir (QR)') hadirQr++;
      else if (st === 'Hadir (Manual)' || (st && st.startsWith('Hadir'))) hadirManual++;
      else if (st === 'Sakit') sakit++;
      else if (st === 'Izin') izin++;
      else if (st === 'Bolos') bolos++;
      else if (st === 'Alfa') alfa++;
      else alfa++;
    });
    return { 
      hadirQr, 
      hadirManual, 
      totalHadir: hadirQr + hadirManual, 
      sakit, 
      izin, 
      bolos, 
      alfa, 
      total: classStudents.length 
    };
  }, [classStudents, statusMap]);

  // Save Mass Attendance
  const handleSubmitMassal = async () => {
    if (!isWithinSchoolHours()) {
      const { jamMasuk, jamPulang } = getActiveSchoolHoursConfig();
      triggerToast(`Perekaman Ditolak! Pengisian presensi hanya aktif pukul ${jamMasuk} s.d ${jamPulang}.`, 'error');
      return;
    }

    if (classStudents.length === 0) {
      triggerToast('Tidak ada murid yang sesuai dengan filter kelas saat ini!', 'warning');
      return;
    }

    const holidayOnDate = getHoliday(selectedDate);
    if (holidayOnDate) {
      triggerToast(`Tanggal ${selectedDate} adalah hari libur: ${holidayOnDate.keterangan}`, 'error');
      return;
    }

    setIsSaving(true);
    try {
      const nowObj = new Date();
      const [year, month, day] = selectedDate.split('-').map(Number);
      const dObj = new Date(year, month - 1, day, nowObj.getHours(), nowObj.getMinutes(), nowObj.getSeconds(), 0);
      const monthStr = dObj.toLocaleString('id-ID', { month: 'long', year: 'numeric' });

      const currentMapelName = selectedMapel || (activeMataPelajaran === 'Lainnya' ? (customMataPelajaran || 'Umum') : (activeMataPelajaran || 'Umum'));

      const logsToSave: AbsenLog[] = [];

      for (const student of classStudents) {
        if (isGuruNonAdmin) {
          const permCheck = checkGuruAttendancePermission(currentUser, currentGuruObj, student, currentMapelName, appState.kelas);
          if (!permCheck.isAuthorized) {
            triggerToast(`Otoritas Terbatas untuk ${student.nama}: ${permCheck.reason}`, 'warning');
            continue;
          }
        }

        const targetStatus = statusMap[student.nis] || 'Alfa';

        const existingLog = appState.absensi.find(log => 
          log.nis === student.nis &&
          log.tanggal === selectedDate &&
          (log.jamKe || '1') === selectedJamKe &&
          (!log.mataPelajaran || (log.mataPelajaran || '').trim().toLowerCase() === currentMapelName.trim().toLowerCase())
        );

        const newLog: AbsenLog = {
          id: existingLog ? existingLog.id : `log_${Date.now()}_${student.nis}_${Math.random().toString(36).substr(2, 4)}`,
          timestamp: existingLog ? existingLog.timestamp : dObj.toISOString(),
          tanggal: selectedDate,
          bulan: monthStr,
          nis: student.nis,
          nama: student.nama,
          kelas: student.kelas,
          status: targetStatus,
          guruNip: currentUser?.username,
          guruNama: currentUser?.nama,
          mataPelajaran: currentMapelName,
          jamKe: selectedJamKe
        };

        await dbSaveAbsen(activeSchoolId || '', newLog);
        logsToSave.push(newLog);
      }

      if (logsToSave.length > 0) {
        onSaveMassal(logsToSave);
        triggerToast(`Presensi massal (${logsToSave.length} siswa) berhasil disimpan!`, 'success');
      } else {
        triggerToast('Tidak ada data presensi yang berhasil disimpan.', 'warning');
      }
    } catch (error) {
      console.error('Error saving mass attendance:', error);
      triggerToast('Gagal menyimpan presensi massal.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5" id="presensi-massal-wrapper">
      {/* HEADER & SELECTION CONTROLS PANEL */}
      <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                <Users className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Presensi Massal Per Kelas</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed pl-1">
              Pilih kelas, jurusan, jam keberapa, dan tanggal. Data scan barcode siswa otomatis tersinkronisasi secara real-time.
            </p>
          </div>

          <button
            onClick={handleSubmitMassal}
            disabled={isSaving || classStudents.length === 0}
            className={`px-5 py-2.5 rounded-2xl font-bold text-xs text-white transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
              isSaving || classStudents.length === 0
                ? 'bg-slate-300 cursor-not-allowed shadow-none'
                : 'bg-emerald-600 hover:bg-emerald-700 active:scale-98 shadow-emerald-600/20'
            }`}
            id="btn-simpan-presensi-massal"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Menyimpan Presensi...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Simpan Presensi Massal ({summaryCounts.total} Murid)</span>
              </>
            )}
          </button>
        </div>

        {/* REALTIME QR BARCODE SYNC BANNER */}
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50/60 border border-emerald-200/80 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Zap className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <span className="font-extrabold text-slate-900 block text-xs">Integrasi Presensi Barcode Real-Time</span>
              <span className="text-[11px] text-slate-500">
                Siswa yang sudah melakukan scan barcode QR akan otomatis bertanda <b className="text-emerald-700">⚡ Hadir (QR)</b> tanpa perlu absen ulang.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <span className="bg-emerald-600 text-white font-extrabold text-[11px] px-3 py-1 rounded-xl shadow-xs flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5" />
              <span>{summaryCounts.hadirQr} Siswa Tersinkron QR</span>
            </span>
          </div>
        </div>

        {/* CONTROLS FILTER GRID: Tingkat, Jurusan, Kelas, Jam Ke, Tanggal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          {/* 1. FILTER TINGKAT */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
              <Filter className="w-3 h-3 text-emerald-600" />
              <span>Tingkat</span>
            </label>
            <select
              value={filterTingkat}
              onChange={(e) => setFilterTingkat(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
            >
              <option value="">Semua Tingkat</option>
              {availableTingkats.map(t => (
                <option key={t} value={t}>Kelas {t}</option>
              ))}
            </select>
          </div>

          {/* 2. FILTER JURUSAN */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
              <Filter className="w-3 h-3 text-emerald-600" />
              <span>Jurusan</span>
            </label>
            <select
              value={filterJurusan}
              onChange={(e) => setFilterJurusan(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
            >
              <option value="">Semua Jurusan</option>
              {availableJurusans.map(j => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </div>

          {/* 3. SELECT MATA PELAJARAN (MAPEL) */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
              <BookOpen className="w-3 h-3 text-emerald-600" />
              <span>Mata Pelajaran</span>
            </label>
            <select
              value={selectedMapel}
              onChange={(e) => setSelectedMapel(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
            >
              {teacherMapelOptions.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* 4. SELECT JAM KE */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
              <Clock className="w-3 h-3 text-emerald-600" />
              <span>Jam Ke</span>
            </label>
            <select
              value={selectedJamKe}
              onChange={(e) => setSelectedJamKe(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer font-mono"
            >
              <option value="1">Jam Ke-1</option>
              <option value="2">Jam Ke-2</option>
              <option value="3">Jam Ke-3</option>
              <option value="4">Jam Ke-4</option>
              <option value="5">Jam Ke-5</option>
              <option value="6">Jam Ke-6</option>
              <option value="7">Jam Ke-7</option>
              <option value="8">Jam Ke-8</option>
            </select>
          </div>

          {/* 5. SELECT TANGGAL */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-emerald-600" />
              <span>Tanggal</span>
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-center cursor-pointer font-mono"
            />
          </div>
        </div>

        {/* SEARCH & QUICK MASS ACTIONS */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Pilih Cepat Massal:</span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleSetAllStatus('Hadir (Manual)')}
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <UserCheck className="w-3 h-3" />
                <span>Hadir Semua</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetAllStatus('Alfa')}
                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <UserX className="w-3 h-3" />
                <span>Absen (Alfa) Semua</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetAllStatus('Sakit')}
                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
              >
                Sakit Semua
              </button>
              <button
                type="button"
                onClick={() => handleSetAllStatus('Izin')}
                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
              >
                Izin Semua
              </button>
              <button
                type="button"
                onClick={() => handleSetAllStatus('Bolos')}
                className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
              >
                Bolos Semua
              </button>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama atau NISN murid..."
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold pl-8 pr-3 py-1.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* SUMMARY BADGES */}
      <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
        <div className="bg-white border border-slate-100 rounded-2xl p-3 shadow-xs text-center">
          <span className="block text-[10px] font-bold text-slate-400 uppercase">Total Murid</span>
          <span className="text-lg font-black text-slate-800">{summaryCounts.total}</span>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-200 rounded-2xl p-3 shadow-xs text-center">
          <span className="block text-[10px] font-extrabold text-emerald-800 uppercase flex items-center justify-center gap-1">
            <QrCode className="w-3 h-3 text-emerald-600" /> Hadir (QR)
          </span>
          <span className="text-lg font-black text-emerald-700">{summaryCounts.hadirQr}</span>
        </div>
        <div className="bg-emerald-50/80 border border-emerald-100 rounded-2xl p-3 shadow-xs text-center">
          <span className="block text-[10px] font-bold text-emerald-700 uppercase">Hadir (Manual)</span>
          <span className="text-lg font-black text-emerald-700">{summaryCounts.hadirManual}</span>
        </div>
        <div className="bg-rose-50/80 border border-rose-100 rounded-2xl p-3 shadow-xs text-center">
          <span className="block text-[10px] font-bold text-rose-700 uppercase">Absen (Alfa)</span>
          <span className="text-lg font-black text-rose-700">{summaryCounts.alfa}</span>
        </div>
        <div className="bg-blue-50/80 border border-blue-100 rounded-2xl p-3 shadow-xs text-center">
          <span className="block text-[10px] font-bold text-blue-700 uppercase">Sakit</span>
          <span className="text-lg font-black text-blue-700">{summaryCounts.sakit}</span>
        </div>
        <div className="bg-amber-50/80 border border-amber-100 rounded-2xl p-3 shadow-xs text-center">
          <span className="block text-[10px] font-bold text-amber-700 uppercase">Izin</span>
          <span className="text-lg font-black text-amber-700">{summaryCounts.izin}</span>
        </div>
        <div className="bg-purple-50/80 border border-purple-100 rounded-2xl p-3 shadow-xs text-center">
          <span className="block text-[10px] font-bold text-purple-700 uppercase">Bolos</span>
          <span className="text-lg font-black text-purple-700">{summaryCounts.bolos}</span>
        </div>
      </div>

      {/* STUDENT TABLE WITH DISTINCT STATUS COLUMNS */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
        <div className="max-h-[550px] overflow-y-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-700">
            <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
              <tr className="text-slate-800 font-bold text-xs">
                <th className="py-3.5 px-3 text-center w-10">No</th>
                <th className="py-3.5 px-3 w-24">NISN</th>
                <th className="py-3.5 px-3">Nama Murid (Abjad A-Z)</th>
                <th className="py-3.5 px-3 text-center w-24">Kelas</th>
                
                {/* HADIR COLUMN */}
                <th className="py-2.5 px-2 text-center w-28 bg-emerald-50/80 text-emerald-800 border-x border-slate-200/80">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-extrabold text-[11px]">Hadir</span>
                    <button
                      type="button"
                      onClick={() => handleSetAllStatus('Hadir (Manual)')}
                      className="text-[9px] bg-emerald-600 text-white px-2 py-0.5 rounded-md hover:bg-emerald-700 cursor-pointer font-bold shadow-xs"
                      title="Set Semua Siswa Hadir Manual"
                    >
                      Set Semua
                    </button>
                  </div>
                </th>

                {/* ABSEN / ALFA COLUMN */}
                <th className="py-2.5 px-2 text-center w-24 bg-rose-50/80 text-rose-800 border-r border-slate-200/80">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-extrabold text-[11px]">Absen</span>
                    <button
                      type="button"
                      onClick={() => handleSetAllStatus('Alfa')}
                      className="text-[9px] bg-rose-600 text-white px-2 py-0.5 rounded-md hover:bg-rose-700 cursor-pointer font-bold shadow-xs"
                      title="Set Semua Siswa Absen"
                    >
                      Set Semua
                    </button>
                  </div>
                </th>

                {/* SAKIT COLUMN */}
                <th className="py-2.5 px-2 text-center w-24 bg-blue-50/80 text-blue-800 border-r border-slate-200/80">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-extrabold text-[11px]">Sakit</span>
                    <button
                      type="button"
                      onClick={() => handleSetAllStatus('Sakit')}
                      className="text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded-md hover:bg-blue-700 cursor-pointer font-bold shadow-xs"
                      title="Set Semua Siswa Sakit"
                    >
                      Set Semua
                    </button>
                  </div>
                </th>

                {/* IZIN COLUMN */}
                <th className="py-2.5 px-2 text-center w-24 bg-amber-50/80 text-amber-800 border-r border-slate-200/80">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-extrabold text-[11px]">Izin</span>
                    <button
                      type="button"
                      onClick={() => handleSetAllStatus('Izin')}
                      className="text-[9px] bg-amber-600 text-white px-2 py-0.5 rounded-md hover:bg-amber-700 cursor-pointer font-bold shadow-xs"
                      title="Set Semua Siswa Izin"
                    >
                      Set Semua
                    </button>
                  </div>
                </th>

                {/* BOLOS COLUMN */}
                <th className="py-2.5 px-2 text-center w-24 bg-purple-50/80 text-purple-800 border-r border-slate-200/80">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-extrabold text-[11px]">Bolos</span>
                    <button
                      type="button"
                      onClick={() => handleSetAllStatus('Bolos')}
                      className="text-[9px] bg-purple-600 text-white px-2 py-0.5 rounded-md hover:bg-purple-700 cursor-pointer font-bold shadow-xs"
                      title="Set Semua Siswa Bolos"
                    >
                      Set Semua
                    </button>
                  </div>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                    {classStudents.length === 0 
                      ? 'Tidak ada data murid aktif terdaftar sesuai kriteria filter saat ini.'
                      : `Tidak ada murid yang cocok dengan kata kunci "${searchQuery}".`}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((siswa, idx) => {
                  const currentStatus = statusMap[siswa.nis] || 'Alfa';

                  const logForStudent = appState.absensi.find(log => 
                    log.nis === siswa.nis &&
                    log.tanggal === selectedDate &&
                    (log.jamKe || '1') === selectedJamKe &&
                    (!selectedMapel || !log.mataPelajaran || (log.mataPelajaran || '').trim().toLowerCase() === selectedMapel.trim().toLowerCase())
                  );

                  const scanTimeStr = logForStudent?.timestamp 
                    ? new Date(logForStudent.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) 
                    : null;

                  return (
                    <tr key={siswa.nis} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-500 text-xs">{siswa.nis}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-850">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center font-bold text-slate-500 shrink-0 text-xs">
                              {siswa.foto ? (
                                <img src={siswa.foto} alt="Foto" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                              ) : (
                                siswa.nama.charAt(0)
                              )}
                            </div>
                            <span className="text-slate-900 font-bold text-xs">{siswa.nama}</span>
                          </div>

                          {/* Distinct Barcode Scan Badge */}
                          {currentStatus === 'Hadir (QR)' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300/80 shadow-2xs">
                              <QrCode className="w-3 h-3 text-emerald-600 animate-pulse" />
                              <span>Scan Barcode {scanTimeStr ? `(${scanTimeStr})` : ''}</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-xs text-slate-600 uppercase">
                        {siswa.kelas}
                      </td>

                      {/* HADIR CHECK CELL */}
                      <td 
                        onClick={() => handleStudentStatusChange(siswa.nis, currentStatus === 'Hadir (QR)' ? 'Hadir (QR)' : 'Hadir (Manual)')}
                        className={`py-2 px-2 text-center border-x border-slate-100 cursor-pointer transition-all ${
                          currentStatus.startsWith('Hadir') ? 'bg-emerald-500/10' : 'hover:bg-emerald-50/40'
                        }`}
                      >
                        <button
                          type="button"
                          className={`w-full py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                            currentStatus === 'Hadir (QR)'
                              ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-600/40 font-bold'
                              : currentStatus === 'Hadir (Manual)'
                              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30 font-bold'
                              : 'bg-white text-slate-300 border border-slate-200 hover:border-emerald-400 hover:text-emerald-600'
                          }`}
                        >
                          {currentStatus === 'Hadir (QR)' ? (
                            <>
                              <QrCode className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span className="text-[11px]">Hadir (QR)</span>
                            </>
                          ) : currentStatus === 'Hadir (Manual)' ? (
                            <>
                              <Check className="w-4 h-4 stroke-[3]" />
                              <span className="text-[11px]">Hadir</span>
                            </>
                          ) : (
                            <>
                              <span className="w-2 h-2 rounded-full bg-slate-200" />
                              <span className="text-[11px]">Hadir</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* ABSEN / ALFA CHECK CELL */}
                      <td 
                        onClick={() => handleStudentStatusChange(siswa.nis, 'Alfa')}
                        className={`py-2 px-2 text-center border-r border-slate-100 cursor-pointer transition-all ${
                          currentStatus === 'Alfa' ? 'bg-rose-500/10' : 'hover:bg-rose-50/40'
                        }`}
                      >
                        <button
                          type="button"
                          className={`w-full py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                            currentStatus === 'Alfa'
                              ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-600/30 font-bold'
                              : 'bg-white text-slate-300 border border-slate-200 hover:border-rose-400 hover:text-rose-600'
                          }`}
                        >
                          {currentStatus === 'Alfa' ? <Check className="w-4 h-4 stroke-[3]" /> : <span className="w-2 h-2 rounded-full bg-slate-200" />}
                          <span className="text-[11px]">Absen</span>
                        </button>
                      </td>

                      {/* SAKIT CHECK CELL */}
                      <td 
                        onClick={() => handleStudentStatusChange(siswa.nis, 'Sakit')}
                        className={`py-2 px-2 text-center border-r border-slate-100 cursor-pointer transition-all ${
                          currentStatus === 'Sakit' ? 'bg-blue-500/10' : 'hover:bg-blue-50/40'
                        }`}
                      >
                        <button
                          type="button"
                          className={`w-full py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                            currentStatus === 'Sakit'
                              ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/30 font-bold'
                              : 'bg-white text-slate-300 border border-slate-200 hover:border-blue-400 hover:text-blue-600'
                          }`}
                        >
                          {currentStatus === 'Sakit' ? <Check className="w-4 h-4 stroke-[3]" /> : <span className="w-2 h-2 rounded-full bg-slate-200" />}
                          <span className="text-[11px]">Sakit</span>
                        </button>
                      </td>

                      {/* IZIN CHECK CELL */}
                      <td 
                        onClick={() => handleStudentStatusChange(siswa.nis, 'Izin')}
                        className={`py-2 px-2 text-center border-r border-slate-100 cursor-pointer transition-all ${
                          currentStatus === 'Izin' ? 'bg-amber-500/10' : 'hover:bg-amber-50/40'
                        }`}
                      >
                        <button
                          type="button"
                          className={`w-full py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                            currentStatus === 'Izin'
                              ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-500/30 font-bold'
                              : 'bg-white text-slate-300 border border-slate-200 hover:border-amber-400 hover:text-amber-600'
                          }`}
                        >
                          {currentStatus === 'Izin' ? <Check className="w-4 h-4 stroke-[3]" /> : <span className="w-2 h-2 rounded-full bg-slate-200" />}
                          <span className="text-[11px]">Izin</span>
                        </button>
                      </td>

                      {/* BOLOS CHECK CELL */}
                      <td 
                        onClick={() => handleStudentStatusChange(siswa.nis, 'Bolos')}
                        className={`py-2 px-2 text-center border-r border-slate-100 cursor-pointer transition-all ${
                          currentStatus === 'Bolos' ? 'bg-purple-500/10' : 'hover:bg-purple-50/40'
                        }`}
                      >
                        <button
                          type="button"
                          className={`w-full py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                            currentStatus === 'Bolos'
                              ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-600/30 font-bold'
                              : 'bg-white text-slate-300 border border-slate-200 hover:border-purple-400 hover:text-purple-600'
                          }`}
                        >
                          {currentStatus === 'Bolos' ? <Check className="w-4 h-4 stroke-[3]" /> : <span className="w-2 h-2 rounded-full bg-slate-200" />}
                          <span className="text-[11px]">Bolos</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* BOTTOM SAVE BAR */}
        {filteredStudents.length > 0 && (
          <div className="bg-slate-50 border-t border-slate-100 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <Info className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Menampilkan <b>{filteredStudents.length}</b> murid ({summaryCounts.hadirQr} diantaranya telah scan QR Code).
              </span>
            </div>
            <button
              onClick={handleSubmitMassal}
              disabled={isSaving || classStudents.length === 0}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs text-white transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                isSaving || classStudents.length === 0
                  ? 'bg-slate-300 cursor-not-allowed shadow-none'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-98 shadow-emerald-600/20'
              }`}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menyimpan Presensi...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Simpan Data Presensi ({summaryCounts.total} Siswa)</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
