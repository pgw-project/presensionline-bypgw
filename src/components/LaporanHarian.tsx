import { useState } from 'react';
import { motion } from 'motion/react';
import { FileText, Download, Check, CircleDot, XCircle, Users, Calendar, AlertTriangle, CalendarRange, Info } from 'lucide-react';
import { Siswa, AbsenLog, Kelas, SystemHoliday } from '../types';
import * as XLSX from 'xlsx';

interface LaporanHarianProps {
  siswaList: Siswa[];
  absensiList: AbsenLog[];
  kelasList: Kelas[];
  holidays: SystemHoliday[];
}

const getIndonesianDayAndDate = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    return dateObj.toLocaleDateString('id-ID', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  } catch (e) {
    return dateStr;
  }
};

export default function LaporanHarian({ siswaList, absensiList, kelasList, holidays = [] }: LaporanHarianProps) {
  const [reportMode, setReportMode] = useState<'harian' | 'rentang'>('harian');
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Default range to past 7 days up to today
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [filterKelas, setFilterKelas] = useState<string>('');
  const [filterTingkat, setFilterTingkat] = useState<string>('');
  const [filterJurusan, setFilterJurusan] = useState<string>('');
  const [filterMapel, setFilterMapel] = useState<string>('');

  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalDateString();

  // Validate active constraints
  const isFutureDate = reportMode === 'harian'
    ? filterDate > todayStr
    : (startDate > todayStr || endDate > todayStr);

  const isInvalidRange = reportMode === 'rentang' && startDate > endDate;

  // Check if holiday (either Sunday or custom database holiday)
  const getHolidayReason = (dateStr: string) => {
    // 1. Check Sunday
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const dateObj = new Date(year, month, day);
      if (dateObj.getDay() === 0) {
        return 'Hari Minggu (Hari Libur Rutin)';
      }
    }
    // 2. Check custom holidays
    const customH = holidays.find(h => h.date === dateStr);
    if (customH) {
      return customH.keterangan || 'Hari Libur Nasional';
    }
    return null;
  };

  const holidayReason = reportMode === 'harian' ? getHolidayReason(filterDate) : null;

  const isSunday = () => {
    if (reportMode === 'harian') {
      const parts = filterDate.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const dateObj = new Date(year, month, day);
        return dateObj.getDay() === 0;
      }
      return false;
    } else {
      // If single day range and it is Sunday, block it.
      if (startDate === endDate) {
        const parts = startDate.split('-');
        if (parts.length === 3) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          const dateObj = new Date(year, month, day);
          return dateObj.getDay() === 0;
        }
      }
      return false;
    }
  };

  const disableExport = isFutureDate || isSunday() || isInvalidRange;

  // Extract unique subjects that have entries in the logs and class management
  const availableMapels = Array.from(new Set<string>([
    ...absensiList.map(l => l.mataPelajaran).filter(Boolean),
    ...kelasList.map(k => k.mapel).filter(Boolean)
  ])).map(m => m.trim()).filter(Boolean).sort();

  // Extract unique grade levels dynamically from database input
  const availableTingkats = Array.from(new Set<string>([
    ...kelasList.map(k => k.kelas).filter(Boolean),
    ...kelasList.map(k => {
      const name = k.namaKelas.trim().toUpperCase();
      const parts = name.split(/[\s\-]+/);
      return parts[0] || '';
    }).filter(Boolean),
    ...siswaList.map(s => {
      const name = s.kelas.trim().toUpperCase();
      const parts = name.split(/[\s\-]+/);
      return parts[0] || '';
    }).filter(Boolean)
  ])).filter(Boolean).sort((a, b) => {
    const standard = ['X', 'XI', 'XII', '10', '11', '12', '1', '2', '3'];
    const idxA = standard.indexOf(a);
    const idxB = standard.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  // Extract unique majors/jurusans dynamically from database input
  const availableJurusans = Array.from(new Set<string>([
    ...kelasList.map(k => k.jurusan).filter(Boolean),
    ...kelasList.map(k => {
      if (k.jurusan) return k.jurusan;
      const parts = k.namaKelas.split(/[\s\-_]+/);
      const majorPart = parts.find(p => {
        const u = p.toUpperCase().trim();
        return u && u !== 'X' && u !== 'XI' && u !== 'XII' && !/^\d+$/.test(u);
      });
      return majorPart || '';
    }).filter(Boolean),
    ...siswaList.map(s => {
      const parts = s.kelas.split(/[\s\-_]+/);
      const majorPart = parts.find(p => {
        const u = p.toUpperCase().trim();
        return u && u !== 'X' && u !== 'XI' && u !== 'XII' && !/^\d+$/.test(u);
      });
      return majorPart || '';
    }).filter(Boolean),
  ])).map(j => j.toUpperCase().trim()).filter(Boolean).sort();

  // Extract unique specific class names (Rombel) dynamically
  const availableClasses = Array.from(new Set<string>([
    ...kelasList.map(k => k.namaKelas).filter(Boolean),
    ...siswaList.map(s => s.kelas).filter(Boolean)
  ])).filter(Boolean).sort();

  // Helper safe date elements generator
  const getDatesInRange = (startStr: string, endStr: string) => {
    const dates: string[] = [];
    if (!startStr || !endStr) return dates;
    try {
      const startParts = startStr.split('-').map(Number);
      const endParts = endStr.split('-').map(Number);
      
      const s = new Date(startParts[0], startParts[1] - 1, startParts[2]);
      const e = new Date(endParts[0], endParts[1] - 1, endParts[2]);
      
      const temp = new Date(s);
      let count = 0;
      // safety limit to prevent resource exhaustion (max 62 days)
      while (temp <= e && count < 62) {
        const year = temp.getFullYear();
        const month = String(temp.getMonth() + 1).padStart(2, '0');
        const day = String(temp.getDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${day}`);
        temp.setDate(temp.getDate() + 1);
        count++;
      }
    } catch (err) {
      console.error(err);
    }
    return dates;
  };

  // Find all active students in the filtered class
  const classStudents = siswaList.filter(s => {
    const matchesStatus = s.status === 'Aktif';
    const matchesKelas = filterKelas ? s.kelas.trim().toUpperCase() === filterKelas.trim().toUpperCase() : true;

    let matchesTingkat = true;
    if (filterTingkat) {
      const cleanKelas = s.kelas.trim().toUpperCase();
      const targetTingkat = filterTingkat.toUpperCase();
      matchesTingkat = cleanKelas === targetTingkat ||
                       cleanKelas.startsWith(targetTingkat + '-') ||
                       cleanKelas.startsWith(targetTingkat + ' ');
    }

    const matchesJurusan = filterJurusan 
      ? s.kelas.toUpperCase().includes(filterJurusan.toUpperCase()) 
      : true;

    return matchesStatus && matchesKelas && matchesTingkat && matchesJurusan;
  });

  // Calculate targeted range of dates
  const selectedDates = reportMode === 'harian' ? [filterDate] : getDatesInRange(startDate, endDate);

  // Unified data pipeline construction
  const processedLogs: any[] = [];
  let recordCounter = 1;

  selectedDates.forEach(currentDate => {
    const currentHolidayReason = getHolidayReason(currentDate);

    classStudents.forEach(siswa => {
      // Find all matching logs for this student on this date & matching subject
      const studentDayLogs = absensiList.filter(log => 
        log.nis === siswa.nis && 
        log.tanggal === currentDate &&
        (filterMapel ? log.mataPelajaran === filterMapel : true)
      );

      if (studentDayLogs.length === 0) {
        let displayStatus = 'Belum Scan';
        if (currentHolidayReason) {
          displayStatus = 'Hari Libur';
        }
        processedLogs.push({
          no: recordCounter++,
          tanggal: currentDate,
          hariDanTanggal: getIndonesianDayAndDate(currentDate),
          nis: siswa.nis,
          nama: siswa.nama,
          kelas: siswa.kelas,
          status: displayStatus,
          jamAbsen: '-',
          mapelLog: currentHolidayReason ? 'Libur' : (filterMapel || 'Umum'),
          jamKeLog: currentHolidayReason ? 'Libur' : '-',
          guruLog: currentHolidayReason ? 'Libur' : '-'
        });
      } else {
        // Sort logs by jamKe numerical/alphabetical value
        const sortedLogs = [...studentDayLogs].sort((a, b) => {
          const ja = parseInt(a.jamKe || '0', 10);
          const jb = parseInt(b.jamKe || '0', 10);
          return ja - jb;
        });

        sortedLogs.forEach(attendance => {
          let jamAbsen = '-';
          if (attendance.timestamp) {
            try {
              const timeObj = new Date(attendance.timestamp);
              const hours = String(timeObj.getHours()).padStart(2, '0');
              const minutes = String(timeObj.getMinutes()).padStart(2, '0');
              const seconds = String(timeObj.getSeconds()).padStart(2, '0');
              jamAbsen = `${hours}:${minutes}:${seconds} WITA`;
            } catch (e) {
              jamAbsen = '-';
            }
          }
          const mapelLog = attendance.mataPelajaran || 'Umum';
          const guruLog = attendance.guruNama || 'Admin';

          processedLogs.push({
            no: recordCounter++,
            tanggal: currentDate,
            hariDanTanggal: getIndonesianDayAndDate(currentDate),
            nis: siswa.nis,
            nama: siswa.nama,
            kelas: siswa.kelas,
            status: attendance.status,
            jamAbsen,
            mapelLog,
            jamKeLog: attendance.jamKe || '1',
            guruLog
          });
        });
      }
    });
  });

  // Calculate statistics totals
  const totalRecords = processedLogs.length;
  const countHadir = processedLogs.filter(p => p.status.startsWith('Hadir')).length;
  const countSakit = processedLogs.filter(p => p.status === 'Sakit').length;
  const countIzin = processedLogs.filter(p => p.status === 'Izin').length;
  const countAlfa = processedLogs.filter(p => p.status === 'Belum Scan' || p.status === 'Alfa').length;
  const countLibur = processedLogs.filter(p => p.status === 'Hari Libur').length;
  
  // Attendance calculations (excluding holidays from total denominator if we want active attendance rate)
  const totalActiveSlots = processedLogs.filter(p => p.status !== 'Hari Libur').length;
  const attendanceRate = totalActiveSlots > 0 ? Math.round((countHadir / totalActiveSlots) * 100) : 0;

  const downloadExcel = () => {
    if (isFutureDate) {
      alert("Maaf, Anda tidak dapat mengunduh data laporan harian untuk tanggal di masa mendatang!");
      return;
    }
    if (isSunday()) {
      alert("Format dilarang: Tidak diijinkan mengunduh atau mencetak laporan harian di hari Minggu!");
      return;
    }
    if (isInvalidRange) {
      alert("Kesalahan rentang: Tanggal Mulai tidak boleh melewati Tanggal Selesai!");
      return;
    }

    // Generate sheet data mapped elegantly
    const sheetData = processedLogs.map(item => ({
      'No': item.no,
      'Tanggal': item.tanggal,
      'Hari & Tanggal': item.hariDanTanggal,
      'NISN': item.nis,
      'Nama Siswa': item.nama,
      'Mata Pelajaran': item.mapelLog,
      'Jam Ke': item.jamKeLog,
      'Guru Pengampu': item.guruLog,
      'Waktu Absen': item.jamAbsen,
      'Status Kehadiran': item.status
    }));

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    
    const sheetName = reportMode === 'harian' ? "Laporan Harian" : "Laporan Rentang Hari";
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    
    // Set column widths elegantly
    const wscols = [
      { wch: 6 },
      { wch: 15 },
      { wch: 25 },
      { wch: 15 },
      { wch: 30 },
      { wch: 22 },
      { wch: 12 },
      { wch: 25 },
      { wch: 18 },
      { wch: 20 }
    ];
    ws['!cols'] = wscols;

    const fileSuffix = [
      filterTingkat ? `Kelas_${filterTingkat}` : '',
      filterJurusan ? `${filterJurusan}` : '',
      filterMapel ? `${filterMapel}` : ''
    ].filter(Boolean).join('_');

    const fileName = reportMode === 'harian'
      ? `Laporan_Harian_Absen_${filterDate}${fileSuffix ? `_${fileSuffix}` : ''}.xlsx`
      : `Laporan_Rentang_Absen_${startDate}_sd_${endDate}${fileSuffix ? `_${fileSuffix}` : ''}.xlsx`;

    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="w-full">
      
      {/* MODE SELECTOR PANEL */}
      <div className="bg-slate-100 p-1 rounded-xl max-w-sm mb-4 flex gap-1 no-print">
        <button
          onClick={() => setReportMode('harian')}
          className={`flex-1 text-center py-1.5 rounded-lg text-xs font-bold transition-all ${
            reportMode === 'harian'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          id="toggle-mode-harian"
        >
          Satu Hari
        </button>
        <button
          onClick={() => setReportMode('rentang')}
          className={`flex-1 text-center py-1.5 rounded-lg text-xs font-bold transition-all ${
            reportMode === 'rentang'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          id="toggle-mode-rentang"
        >
          Rentang Tanggal (Waktu Kustom)
        </button>
      </div>

      {/* FILTER HEADER ROW - HIDDEN DURING PRINTING */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mb-6 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center no-print" id="laporan-harian-filters">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-xl border border-emerald-100">
            {reportMode === 'harian' ? <FileText className="w-5 h-5" /> : <CalendarRange className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-lg">
              {reportMode === 'harian' ? 'Filter Laporan Harian' : 'Filter Laporan Rentang Hari'}
            </h3>
            <p className="text-slate-500 text-xs">
              {reportMode === 'harian' 
                ? 'Pilih tanggal, kelas, dan mata pelajaran murid untuk melihat laporan harian.' 
                : 'Pilih periode tanggal mulai, tanggal berakhir, kelas, dan mapel.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3.5 w-full xl:w-auto">
          
          {/* DYNAMIC DATE CONTROLS */}
          {reportMode === 'harian' ? (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tanggal Absensi</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="bg-white border border-slate-200 text-slate-800 px-3 py-1.5 text-sm rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
                id="lap-harian-date-picker"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mulai Dari</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-800 px-3 py-1.5 text-sm rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
                  id="lap-rentang-start"
                  max={todayStr}
                />
              </div>
              <div className="text-slate-400 font-bold self-end pb-2">s.d</div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sampai Dengan</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-800 px-3 py-1.5 text-sm rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
                  id="lap-rentang-end"
                  max={todayStr}
                />
              </div>
            </div>
          )}

           <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-sans">Tingkat Kelas</label>
            <select
              value={filterTingkat}
              onChange={(e) => {
                setFilterTingkat(e.target.value);
                setFilterKelas(''); // Reset specific class
              }}
              className="bg-white border border-slate-200 text-slate-800 px-3 py-1.5 text-sm rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
              id="lap-harian-tingkat-selector"
            >
              <option value="">Semua Tingkat</option>
              {availableTingkats.map(t => (
                <option key={t} value={t}>Kelas {t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-sans">Jurusan</label>
            <select
              value={filterJurusan}
              onChange={(e) => {
                setFilterJurusan(e.target.value);
                setFilterKelas(''); // Reset specific class
              }}
              className="bg-white border border-slate-200 text-slate-800 px-3 py-1.5 text-sm rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
              id="lap-harian-jurusan-selector"
            >
              <option value="">Semua Jurusan</option>
              {availableJurusans.map(j => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-emerald-600 uppercase mb-1 font-sans">Mata Pelajaran (Mapel)</label>
            <select
              value={filterMapel}
              onChange={(e) => setFilterMapel(e.target.value)}
              className="bg-emerald-50/50 border border-emerald-200 text-slate-800 px-3 py-1.5 text-sm rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
              id="lap-harian-mapel-selector"
            >
              <option value="">Semua Pelajaran (Umum)</option>
              {availableMapels.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="pt-5">
            <button
              onClick={downloadExcel}
              disabled={disableExport}
              className={`font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow flex items-center gap-1.5 h-[38px] ${
                disableExport 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
              }`}
              id="btn-download-lap-harian"
              title={isFutureDate ? "Waktu masa depan diblokir" : isSunday() ? "Hari Minggu dilarang unduh/cetak" : "Unduh lembar Excel"}
            >
              <Download className="w-4 h-4" />
              <span>
                {isSunday() 
                  ? 'Unduh Dikunci (Minggu)' 
                  : isFutureDate 
                  ? 'Belum Tersedia' 
                  : isInvalidRange 
                  ? 'Rentang Salah' 
                  : 'Unduh Excel'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* WARNING NOTIFICATION BANNER FOR FUTURE DATES */}
      {isFutureDate && (
        <div className="bg-rose-50 border border-rose-150 rounded-2xl p-5 mb-6 flex items-start gap-3.5 shadow-sm text-rose-950 no-print">
          <div className="bg-rose-100/80 text-rose-600 p-2 rounded-xl mt-0.5 animate-pulse">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm">Akses Laporan Masa Depan Dibatasi</h4>
            <p className="text-xs text-rose-900 mt-1">
              Tanggal/periode yang dipilih berada di masa mendatang. Anda tidak diijinkan untuk memproses, melihat rekapitulasi, maupun mengunduh laporan harian sebelum tanggal bersangkutan terlewati.
            </p>
          </div>
        </div>
      )}

      {/* WARNING BANNER FOR INVALID DATE RANGE ORDER */}
      {isInvalidRange && (
        <div className="bg-amber-50 border border-amber-150 rounded-2xl p-5 mb-6 flex items-start gap-3.5 shadow-sm text-amber-950 no-print">
          <div className="bg-amber-100 text-amber-600 p-2 rounded-xl mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm">Urutan Tanggal Tidak Valid</h4>
            <p className="text-xs text-amber-900 mt-1">
              Tanggal Mulai ({startDate}) tidak boleh melewati Tanggal Selesai ({endDate}). Harap tentukan rentang waktu historis yang valid untuk mengunduh laporan.
            </p>
          </div>
        </div>
      )}

      {/* WARNING NOTIFICATION BANNER FOR SUNDAY OR HOLIDAYS IN DAILY MODE */}
      {reportMode === 'harian' && !isFutureDate && holidayReason && (
        <div className="bg-amber-50 border border-amber-150 rounded-2xl p-5 mb-6 flex items-start gap-3.5 shadow-sm text-amber-950 no-print">
          <div className="bg-amber-100 text-amber-700 p-2 rounded-xl mt-0.5">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm">Sistem Hari Libur {isSunday() ? 'Rutin (Hari Minggu)' : ''}</h4>
            <p className="text-xs text-amber-900 mt-1 leading-relaxed">
              Hari ini teridentifikasi sebagai <strong>{holidayReason}</strong>. {isSunday() ? 'Sesuai kebijakan sekolah, kegiatan presensi serta pencetakan/pengunduhan berkas laporan presensi tidak diizinkan pada hari Minggu.' : 'Proses pembelajaran diliburkan, status absensi murid diatur sebagai hari libur secara otomatis.'}
            </p>
          </div>
        </div>
      )}

      {/* RENDER REPORT SHEETS */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 print:border-none print:shadow-none print:p-0"
        id="print-sheet-wrapper"
      >
        <div className="text-center mb-8 border-b border-dashed border-slate-200 pb-6 print:border-slate-800">
          <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">
            {reportMode === 'harian' ? 'Laporan Kehadiran Harian Siswa' : 'Laporan Kehadiran Rentang Tanggal Siswa'}
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {reportMode === 'harian' ? (
              <>
                Hari & Tanggal: <span className="font-extrabold text-emerald-700 font-sans">{getIndonesianDayAndDate(filterDate)}</span>
              </>
            ) : (
              <>
                Periode: <span className="font-extrabold text-emerald-700 font-sans">{getIndonesianDayAndDate(startDate)}</span> s.d. <span className="font-extrabold text-emerald-700 font-sans">{getIndonesianDayAndDate(endDate)}</span>
              </>
            )}
            <span className="mx-3">•</span>
            Kelas: <span className="font-semibold text-slate-800 uppercase">
              {[
                filterTingkat ? `Kelas ${filterTingkat}` : '',
                filterJurusan ? `Jurusan ${filterJurusan}` : ''
              ].filter(Boolean).join(' ') || 'Semua Kelas'}
            </span>
          </p>
        </div>

        {/* METRICS ROW FOR PRINT PREVIEW & VISIBILITY */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6" id="lap-harian-summary-row">
          <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl text-center">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">
              {reportMode === 'harian' ? 'Total Murid' : 'Total Data Baris'}
            </span>
            <span className="text-xl font-extrabold text-slate-800 mt-0.5 block">{totalRecords}</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-3.5 rounded-xl text-center">
            <span className="text-[10px] font-bold text-emerald-600 block uppercase">Hadir</span>
            <span className="text-xl font-extrabold text-emerald-950 mt-0.5 block">{countHadir}</span>
          </div>
          <div className="bg-blue-50 border border-blue-100 text-blue-800 p-3.5 rounded-xl text-center">
            <span className="text-[10px] font-bold text-blue-600 block uppercase">Sakit</span>
            <span className="text-xl font-extrabold text-blue-950 mt-0.5 block">{countSakit}</span>
          </div>
          <div className="bg-amber-50 border border-amber-100 text-amber-800 p-3.5 rounded-xl text-center">
            <span className="text-[10px] font-bold text-amber-600 block uppercase">Izin</span>
            <span className="text-xl font-extrabold text-amber-950 mt-0.5 block">{countIzin}</span>
          </div>

          {reportMode === 'harian' && holidayReason ? (
            <div className="bg-amber-50 border border-amber-100 text-amber-800 p-3.5 rounded-xl text-center col-span-2 md:col-span-1">
              <span className="text-[10px] font-bold text-amber-600 block uppercase">Libur</span>
              <span className="text-xl font-extrabold text-amber-950 mt-0.5 block">{countLibur}</span>
            </div>
          ) : (
            <div className="bg-rose-50 border border-rose-100 text-rose-800 p-3.5 rounded-xl text-center col-span-2 md:col-span-1">
              <span className="text-[10px] font-bold text-rose-600 block uppercase">Belum Scan</span>
              <span className="text-xl font-extrabold text-rose-950 mt-0.5 block">{countAlfa}</span>
            </div>
          )}
        </div>

        <div className="flex md:flex-row flex-col justify-between items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 font-medium text-xs text-slate-650" id="lap-attendance-rate-banner">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            {reportMode === 'harian' && holidayReason ? (
              <span>Hari ini diliburkan: <span className="font-bold text-amber-700">{holidayReason}</span></span>
            ) : (
              <span>Persentase Kehadiran Siswa pada Hari Sekolah Aktif: <span className="font-bold text-emerald-700">{attendanceRate}%</span></span>
            )}
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            Dicetak: {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* LOGS TABLE ELEMENT */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-700">
            <thead>
              <tr className="border-b border-slate-200 text-slate-800 font-bold bg-slate-100/50 print:bg-slate-200">
                <th className="py-3 px-4 font-semibold text-center w-16">No</th>
                {reportMode === 'rentang' && (
                  <th className="py-3 px-4 font-semibold w-40">Hari & Tanggal</th>
                )}
                <th className="py-3 px-4 font-semibold w-28">NISN</th>
                <th className="py-3 px-4 font-semibold text-slate-900">Nama Siswa</th>
                <th className="py-3 px-4 font-semibold text-slate-850">Mata Pelajaran</th>
                <th className="py-3 px-4 font-semibold text-slate-850 text-center w-20">Jam Ke</th>
                <th className="py-3 px-4 font-semibold text-slate-850 font-sans">Guru Pengampu</th>
                <th className="py-3 px-4 font-semibold text-center w-32">Waktu Absen</th>
                <th className="py-3 px-4 font-semibold text-center w-36">Status Kehadiran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processedLogs.length === 0 ? (
                <tr>
                  <td colSpan={reportMode === 'rentang' ? 9 : 8} className="py-12 text-center text-slate-400 font-medium">
                    Tidak ada log murid yang cocok dengan kriteria filter yang dipilih.
                  </td>
                </tr>
              ) : (
                processedLogs.map((item) => (
                  <tr key={`${item.tanggal}-${item.nis}-${item.no}`} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 text-center font-mono text-slate-400">{item.no}</td>
                    {reportMode === 'rentang' && (
                      <td className="py-3 px-4 font-semibold text-xs text-slate-700">{item.hariDanTanggal}</td>
                    )}
                    <td className="py-3 px-4 font-mono font-medium text-slate-500">{item.nis}</td>
                    <td className="py-3 px-4 font-bold text-slate-850">{item.nama}</td>
                    <td className="py-3 px-4">
                      {item.mapelLog === 'Libur' ? (
                        <span className="font-semibold text-amber-700 text-xs bg-amber-50 px-2 py-1 rounded-md border border-amber-100/60 block truncate max-w-[150px]">
                          {item.mapelLog}
                        </span>
                      ) : (
                        <span className="font-semibold text-teal-850 text-xs bg-teal-50 px-2 py-1 rounded-md border border-teal-100/60 block truncate max-w-[150px]">
                          {item.mapelLog}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-600 text-xs bg-slate-50/50">
                      {item.jamKeLog}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span className="font-semibold text-slate-600 text-xs block truncate max-w-[130px]">
                        {item.guruLog}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-xs text-slate-650 animate-fade">
                      {item.jamAbsen === '-' ? (
                        <span className="text-slate-400 font-sans">-</span>
                      ) : (
                        <span className="font-semibold text-emerald-700">{item.jamAbsen}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold leading-none ${
                        item.status.startsWith('Hadir') 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                          : item.status === 'Sakit'
                          ? 'bg-blue-50 text-blue-700 border border-blue-100'
                          : item.status === 'Izin'
                          ? 'bg-amber-50 text-amber-700 border border-amber-100'
                          : item.status === 'Hari Libur'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse'
                          : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PRINT SIGNATURE FOOTER - SHOWN DURING PRINT */}
        <div className="hidden print:flex justify-between items-center mt-16 text-xs text-slate-800 font-medium px-4">
          <div>
            <p>Mengetahui,</p>
            <p className="mt-16 font-bold underline">Kepala Sekolah SMK Contoh</p>
          </div>
          <div className="text-right">
            <p className="font-mono">
              Tanggal Cetak: {reportMode === 'harian' ? getIndonesianDayAndDate(filterDate) : `${getIndonesianDayAndDate(startDate)} s.d. ${getIndonesianDayAndDate(endDate)}`}
            </p>
            <p className="mt-16 font-bold underline">Guru Wali Kelas</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
