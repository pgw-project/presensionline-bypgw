import { useState } from 'react';
import { motion } from 'motion/react';
import { CalendarDays, Download, HelpCircle, AlertTriangle, Info, Calendar } from 'lucide-react';
import { Siswa, AbsenLog, Kelas, SystemHoliday } from '../types';
import * as XLSX from 'xlsx';

interface RekapBulananProps {
  siswaList: Siswa[];
  absensiList: AbsenLog[];
  kelasList: Kelas[];
  holidays: SystemHoliday[];
}

export default function RekapBulanan({ siswaList, absensiList, kelasList, holidays = [] }: RekapBulananProps) {
  const [selectedBulan, setSelectedBulan] = useState<string>('Juni 2026');
  const [selectedKelas, setSelectedKelas] = useState<string>('');
  const [filterTingkat, setFilterTingkat] = useState<string>('');
  const [filterJurusan, setFilterJurusan] = useState<string>('');
  const [filterMapel, setFilterMapel] = useState<string>('');

  const isMonthInFuture = (monthStr: string) => {
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const parts = monthStr.split(' ');
    if (parts.length === 2) {
      const mName = parts[0];
      const year = parseInt(parts[1], 10);
      const monthIndex = monthNames.findIndex(n => n.toLowerCase() === mName.toLowerCase());
      if (monthIndex !== -1 && !isNaN(year)) {
        const d = new Date();
        const currentYear = d.getFullYear(); // e.g. 2026
        const currentMonth = d.getMonth(); // 0-indexed
        
        if (year > currentYear) return true;
        if (year === currentYear && monthIndex > currentMonth) return true;
      }
    }
    return false;
  };

  const isFutureMonthSelected = isMonthInFuture(selectedBulan);

  // Extract unique subjects that have entries in the logs
  const availableMapels = Array.from(new Set(absensiList.map(l => l.mataPelajaran).filter(Boolean))) as string[];

  // Extract unique months from attendance logs (excluding future months)
  const getAvailableMonths = () => {
    const months = new Set<string>();
    // Default current month if nothing in logs
    months.add('Juni 2026');
    absensiList.forEach(log => {
      if (log.bulan) {
        months.add(log.bulan);
      }
    });
    // Filter out future months so they cannot be selected
    return Array.from(months).filter(m => !isMonthInFuture(m));
  };

  const availableMonths = getAvailableMonths();

  // Helper date status checks
  const isSundayDateStr = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const dateObj = new Date(y, m, d);
      return dateObj.getDay() === 0;
    }
    return false;
  };

  const isHolidayDateStr = (dateStr: string) => {
    if (isSundayDateStr(dateStr)) return true;
    return holidays.some(h => h.date === dateStr);
  };

  const getSundaysAndHolidaysInMonth = () => {
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const parts = selectedBulan.split(' ');
    if (parts.length === 2) {
      const mName = parts[0];
      const year = parseInt(parts[1], 10);
      const monthIndex = monthNames.findIndex(n => n.toLowerCase() === mName.toLowerCase());
      if (monthIndex !== -1 && !isNaN(year)) {
        const items: { date: string; dayIndex: number; label: string; tipe: 'minggu' | 'custom' }[] = [];
        const numDays = new Date(year, monthIndex + 1, 0).getDate();
        for (let d = 1; d <= numDays; d++) {
          const dayStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const dateObj = new Date(year, monthIndex, d);
          
          if (dateObj.getDay() === 0) {
            items.push({ date: dayStr, dayIndex: d, label: 'Hari Minggu (Hari Libur Rutin)', tipe: 'minggu' });
          } else {
            const custom = holidays.find(h => h.date === dayStr);
            if (custom) {
              items.push({ date: dayStr, dayIndex: d, label: `Libur: ${custom.keterangan || 'Libur Nasional'}`, tipe: 'custom' });
            }
          }
        }
        return items;
      }
    }
    return [];
  };

  const scheduledHolidays = getSundaysAndHolidaysInMonth();

  // Find all active students in that class
  const classStudents = siswaList.filter(s => {
    const matchesStatus = s.status === 'Aktif';
    const matchesKelas = selectedKelas ? s.kelas === selectedKelas : true;

    let matchesTingkat = true;
    if (filterTingkat) {
      const cleanKelas = s.kelas.trim().toUpperCase();
      if (filterTingkat === 'XII') {
        matchesTingkat = cleanKelas.startsWith('XII');
      } else if (filterTingkat === 'XI') {
        matchesTingkat = cleanKelas.startsWith('XI') && !cleanKelas.startsWith('XII');
      } else if (filterTingkat === 'X') {
        matchesTingkat = cleanKelas.startsWith('X') && !cleanKelas.startsWith('XI') && !cleanKelas.startsWith('XII');
      }
    }

    const matchesJurusan = filterJurusan 
      ? s.kelas.toUpperCase().includes(filterJurusan.toUpperCase()) 
      : true;

    return matchesStatus && matchesKelas && matchesTingkat && matchesJurusan;
  });

  // Calculate unique active school sessions in this month for the filter selection (must exclude holidays/Sundays)
  const uniqueSchoolRawSessions = Array.from(new Set(
    absensiList
      .filter(log => {
        const matchBulan = log.bulan === selectedBulan;
        const matchKelas = selectedKelas ? log.kelas === selectedKelas : true;

        let matchTingkat = true;
        if (filterTingkat) {
          const cleanK = log.kelas.trim().toUpperCase();
          if (filterTingkat === 'XII') {
            matchTingkat = cleanK.startsWith('XII');
          } else if (filterTingkat === 'XI') {
            matchTingkat = cleanK.startsWith('XI') && !cleanK.startsWith('XII');
          } else if (filterTingkat === 'X') {
            matchTingkat = cleanK.startsWith('X') && !cleanK.startsWith('XI') && !cleanK.startsWith('XII');
          }
        }

        const matchJurusan = filterJurusan ? log.kelas.trim().toUpperCase().includes(filterJurusan.toUpperCase()) : true;
        const matchMapel = filterMapel ? log.mataPelajaran === filterMapel : true;

        return matchBulan && matchKelas && matchTingkat && matchJurusan && matchMapel;
      })
      .map(log => `${log.tanggal}_${log.mataPelajaran || 'Umum'}_${log.jamKe || '1'}`)
  ));
  
  // Exclude Sundays and Holidays from listed active school sessions
  const uniqueSchoolSessions = uniqueSchoolRawSessions.filter(sessionKey => {
    const tanggal = sessionKey.split('_')[0];
    return !isHolidayDateStr(tanggal);
  });
  const totalMeetingsCount = uniqueSchoolSessions.length || 3;

  // Compute stats for each student
  const rekapData = classStudents.map((siswa, idx) => {
    const studentLogs = absensiList.filter(log => 
      log.nis === siswa.nis && 
      log.bulan === selectedBulan &&
      (filterMapel ? log.mataPelajaran === filterMapel : true)
    );
    
    // Group student logs by session key so different hours same day are treated as different meetings
    const logsBySession: { [sessionKey: string]: AbsenLog[] } = {};
    studentLogs.forEach(log => {
      const sessionKey = `${log.tanggal}_${log.mataPelajaran || 'Umum'}_${log.jamKe || '1'}`;
      if (!logsBySession[sessionKey]) {
        logsBySession[sessionKey] = [];
      }
      logsBySession[sessionKey].push(log);
    });

    // Find all unique active school sessions that occurred for THIS student's class in this month
    const studentClassSessions = Array.from(new Set(
      absensiList
        .filter(log => {
          const matchBulan = log.bulan === selectedBulan;
          const matchKelas = log.kelas === siswa.kelas; // strictly matches student's own class
          const matchMapel = filterMapel ? log.mataPelajaran === filterMapel : true;
          return matchBulan && matchKelas && matchMapel;
        })
        .map(log => `${log.tanggal}_${log.mataPelajaran || 'Umum'}_${log.jamKe || '1'}`)
    )).filter(sessionKey => {
      const tanggal = sessionKey.split('_')[0];
      return !isHolidayDateStr(tanggal);
    });

    const totalStudentClassMeetings = studentClassSessions.length || 3;

    let sakit = 0;
    let izin = 0;
    let alfa = 0;
    let hadir = 0;

    Object.entries(logsBySession).forEach(([sessionKey, logs]) => {
      const tanggal = sessionKey.split('_')[0];
      const isHoliday = isHolidayDateStr(tanggal);
      if (!isHoliday) {
        // Resolve status for this specific meeting/session
        const hasHadir = logs.some(l => l.status.startsWith('Hadir'));
        const hasSakit = logs.some(l => l.status === 'Sakit');
        const hasIzin = logs.some(l => l.status === 'Izin');
        const hasAlfa = logs.some(l => l.status === 'Alfa');

        if (hasHadir) hadir++;
        else if (hasSakit) sakit++;
        else if (hasIzin) izin++;
        else if (hasAlfa) alfa++;
      } else {
        // Holiday attendance prioritizes Hadir
        const hasHadir = logs.some(l => l.status.startsWith('Hadir'));
        if (hasHadir) hadir++;
      }
    });

    // If a student doesn't have an entry on school sessions, they count as Alfa (excluding holidays/Sundays)
    const activeRecordedSessions = Object.keys(logsBySession);
    studentClassSessions.forEach(sessionKey => {
      if (!activeRecordedSessions.includes(sessionKey)) {
        alfa++; // auto count unrecorded school sessions as Alfa (unexcused absence)
      }
    });

    const studentTotalSessions = hadir + sakit + izin + alfa;

    return {
      no: idx + 1,
      nis: siswa.nis,
      nama: siswa.nama,
      kelas: siswa.kelas,
      sakit,
      izin,
      alfa,
      hadir,
      totalPertemuan: Math.max(studentTotalSessions, totalStudentClassMeetings)
    };
  });

  const downloadExcel = () => {
    if (isFutureMonthSelected) {
      alert("Maaf, Anda tidak dapat mengunduh data rekap bulanan untuk bulan di masa mendatang!");
      return;
    }

    // Generate clean header and rows for sheet
    const sheetData = rekapData.map(item => ({
      'No': item.no,
      'NISN': item.nis,
      'Nama Lengkap': item.nama,
      'Kelas': item.kelas,
      'Sakit (S)': item.sakit,
      'Izin (I)': item.izin,
      'Alpa (A)': item.alfa,
      'Hadir (H)': item.hadir,
      'Total Pertemuan': item.totalPertemuan
    }));

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Bulanan");

    // Add extra reference sheet for holidays & Sundays list for teacher transparency
    if (scheduledHolidays.length > 0) {
      const holidaySheetData = scheduledHolidays.map(h => ({
        'Tanggal': h.date,
        'Tanggal Ke-': h.dayIndex,
        'Keterangan Hari Libur': h.label
      }));
      const wsHolidays = XLSX.utils.json_to_sheet(holidaySheetData);
      XLSX.utils.book_append_sheet(wb, wsHolidays, "Info Hari Libur");
    }
    
    // Set column widths elegantly
    const wscols = [
      { wch: 6 },
      { wch: 12 },
      { wch: 28 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 16 }
    ];
    ws['!cols'] = wscols;

    const fileSuffix = filterMapel ? `_${filterMapel.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
    const fileName = `REKAP_ABSENSI_${selectedBulan.replace(' ', '_')}_${selectedKelas || 'SEMUA_KELAS'}${fileSuffix}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="w-full">
      {/* FILTER PANEL */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mb-6 flex flex-col md:flex-row gap-4 justify-between items-center no-print" id="rekap-bulanan-filters">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-xl border border-emerald-100">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Rekap Bulanan Siswa</h3>
            <p className="text-slate-500 text-xs">Perekaman rekap bulanan otomatis dalam bentuk lembar kerja Excel.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bulan & Tahun</label>
            <select
              value={selectedBulan}
              onChange={(e) => setSelectedBulan(e.target.value)}
              className="bg-white border border-slate-200 text-slate-800 px-3 py-2 text-sm rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer pointer-events-auto font-semibold"
              id="rekap-bulan-picker"
            >
              {availableMonths.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tingkat Kelas</label>
            <select
              value={filterTingkat}
              onChange={(e) => {
                setFilterTingkat(e.target.value);
                setSelectedKelas(''); // Reset specific class
              }}
              className="bg-white border border-slate-200 text-slate-800 px-3 py-2 text-sm rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer font-semibold"
              id="rekap-tingkat-picker"
            >
              <option value="">Semua Kelas</option>
              <option value="X">Kelas X</option>
              <option value="XI">Kelas XI</option>
              <option value="XII">Kelas XII</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Jurusan</label>
            <select
              value={filterJurusan}
              onChange={(e) => {
                setFilterJurusan(e.target.value);
                setSelectedKelas(''); // Reset specific class
              }}
              className="bg-white border border-slate-200 text-slate-800 px-3 py-2 text-sm rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer font-semibold"
              id="rekap-jurusan-picker"
            >
              <option value="">Semua Jurusan</option>
              <option value="ATPH">ATPH</option>
              <option value="MPLB">MPLB</option>
              <option value="TSM">TSM</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-emerald-600 uppercase mb-1">Mata Pelajaran</label>
            <select
              value={filterMapel}
              onChange={(e) => setFilterMapel(e.target.value)}
              className="bg-emerald-50/50 border border-emerald-200 text-slate-800 px-3 py-2 text-sm rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
              id="rekap-mapel-picker"
            >
              <option value="">Semua Pelajaran (Umum)</option>
              {availableMapels.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="pt-4 md:pt-5 font-sans">
            <button
              onClick={downloadExcel}
              disabled={isFutureMonthSelected}
              className={`font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 h-[38px] ${
                isFutureMonthSelected 
                  ? 'bg-slate-200 text-slate-450 border border-slate-300 cursor-not-allowed' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
              }`}
              id="btn-download-excel-rekap"
            >
              <Download className="w-4 h-4" />
              <span>{isFutureMonthSelected ? 'Unduh Dikunci' : 'Ekspor Excel'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ERROR BANNER FOR FUTURE MONTH SELECTION */}
      {isFutureMonthSelected && (
        <div className="bg-rose-50 border border-rose-150 rounded-2xl p-5 mb-6 flex items-start gap-3.5 shadow-sm text-rose-950 no-print">
          <div className="bg-rose-100/80 text-rose-600 p-2 rounded-xl mt-0.5">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="font-bold text-sm">Akses Rekap Bulanan Terkunci</h4>
            <p className="text-xs text-rose-900 mt-1">
              Bulan yang Anda pilih ({selectedBulan}) berada di masa mendatang. Anda tidak diperkenankan untuk meremajakan, melihat, ataupun melakukan ekspor lembar rekapitulasi data absensi bulanan sebelum bulan tersebut terjadi.
            </p>
          </div>
        </div>
      )}

      {/* HOLIDAYS CALENDAR TIPS ON MONTH RECAP */}
      {!isFutureMonthSelected && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="flex items-start gap-2.5">
            <div className="bg-amber-100 text-amber-700 p-2 rounded-xl mt-0.5 shadow-inner">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h5 className="font-bold text-xs text-slate-800">Kalender Libur & Hari Minggu ({selectedBulan})</h5>
              <p className="text-[11px] text-slate-500 mt-0.5">Semua hari Minggu dan tanggal merah dikecualikan dari kalkulasi denda Alpa.</p>
            </div>
          </div>
          
          <div className="md:col-span-2">
            {scheduledHolidays.length === 0 ? (
              <span className="text-[11px] font-medium text-slate-400 block text-center py-2">
                Tidak ada hari libur terdeteksi untuk bulan ini di kalender.
              </span>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-[50px] overflow-y-auto pr-2 pb-1">
                {scheduledHolidays.map((hol, idx) => (
                  <span 
                    key={idx} 
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border ${
                      hol.tipe === 'minggu' 
                        ? 'bg-rose-50 text-rose-700 border-rose-100' 
                        : 'bg-amber-50 text-amber-700 border-amber-100'
                    }`}
                    title={hol.label}
                  >
                    Tgl {hol.dayIndex} ({hol.tipe === 'minggu' ? 'Minggu' : 'Libur'})
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 overflow-hidden"
        id="rekap-table-card"
      >
        <div className="flex justify-between items-center mb-6">
          <div>
            <h4 className="font-bold text-slate-800 text-lg">Lembar Rekapitulasi Presensi - {selectedBulan}</h4>
            <p className="text-slate-400 text-xs">Menyajikan rekam jejak bulanan kumulatif per-identitas murid (Hari Minggu & Libur dikecualikan).</p>
          </div>
          <div className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>S: Sakit, I: Izin, A: Alfa, H: Hadir</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-700">
            <thead>
              <tr className="border-b border-slate-200 text-slate-800 font-bold bg-slate-100/50">
                <th className="py-3 px-4 text-center w-12">No</th>
                <th className="py-3 px-4 w-28">NISN</th>
                <th className="py-3 px-4">Nama Lengkap</th>
                <th className="py-3 px-4 text-center w-24">Kelas</th>
                <th className="py-3 px-4 text-center w-16 text-blue-700 bg-blue-50/50">S</th>
                <th className="py-3 px-4 text-center w-16 text-amber-700 bg-amber-50/50">I</th>
                <th className="py-3 px-4 text-center w-16 text-rose-700 bg-rose-50/50">A</th>
                <th className="py-3 px-4 text-center w-16 text-emerald-700 bg-emerald-50/50">H</th>
                <th className="py-3 px-4 text-center w-36">Total Pertemuan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
              {isFutureMonthSelected ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-rose-500 font-bold">
                    [Akses Terkunci] Tidak dapat menampilkan data bulanan untuk tanggal/bulan di masa mendatang.
                  </td>
                </tr>
              ) : rekapData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Tidak ada data murid yang sesuai dengan filter kelas.
                  </td>
                </tr>
              ) : (
                rekapData.map((item) => (
                  <tr key={item.nis} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 text-center font-mono text-slate-400">{item.no}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{item.nis}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{item.nama}</td>
                    <td className="py-3 px-4 text-center uppercase">{item.kelas}</td>
                    <td className="py-3 px-4 text-center bg-blue-50/20 text-blue-600 font-bold">{item.sakit}</td>
                    <td className="py-3 px-4 text-center bg-amber-50/20 text-amber-600 font-bold">{item.izin}</td>
                    <td className="py-3 px-4 text-center bg-rose-50/20 text-rose-600 font-bold">{item.alfa}</td>
                    <td className="py-3 px-4 text-center bg-emerald-50/20 text-emerald-600 font-bold">{item.hadir}</td>
                    <td className="py-3 px-4 text-center text-slate-700 font-bold">{item.totalPertemuan} Pertemuan</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
