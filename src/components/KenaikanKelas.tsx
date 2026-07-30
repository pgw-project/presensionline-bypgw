import { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, ArrowRight, AlertTriangle, CheckCircle } from 'lucide-react';
import { Kelas, Siswa } from '../types';

export const parseTingkat = (className: string): string => {
  if (!className) return '';
  const clean = className.trim();

  // Check if it has "Kelas <Something>"
  const kelasMatch = clean.match(/^kelas\s+([^\s\-]+)/i);
  if (kelasMatch) {
    return `Kelas ${kelasMatch[1].toUpperCase()}`;
  }

  // Check Roman Numerals at the beginning (e.g. XII-RPL-1 -> XII, X -> X)
  const romanMatch = clean.match(/^(XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)\b/i);
  if (romanMatch) {
    return romanMatch[1].toUpperCase();
  }

  // Check Arabic Numerals at the beginning (e.g. 10 RPL 1 -> 10, 1 -> 1)
  const numMatch = clean.match(/^(\d+)\b/);
  if (numMatch) {
    return numMatch[1];
  }

  // Fallback to the first word/segment split by spaces or hyphens
  const firstWord = clean.split(/[\s\-]+/)[0];
  return firstWord ? firstWord.toUpperCase() : clean.toUpperCase();
};

export const replaceTingkat = (className: string, sourceTingkat: string, destTingkat: string): string => {
  if (!className) return '';
  const clean = className.trim();
  const sTingkat = sourceTingkat.trim();
  const dTingkat = destTingkat.trim();

  // If the class name starts with the exact sourceTingkat (case-insensitive)
  if (clean.toUpperCase().startsWith(sTingkat.toUpperCase())) {
    return dTingkat + clean.slice(sTingkat.length);
  }

  const sTingkatOnly = sTingkat.replace(/^kelas\s+/i, '').trim().toUpperCase();
  const dTingkatOnly = dTingkat.replace(/^kelas\s+/i, '').trim().toUpperCase();

  const kelasPrefixMatch = clean.match(/^kelas\s+/i);
  if (kelasPrefixMatch) {
    const prefix = kelasPrefixMatch[0]; // e.g. "Kelas "
    const remaining = clean.slice(prefix.length).trim();
    if (remaining.toUpperCase().startsWith(sTingkatOnly)) {
      return `${prefix}${dTingkatOnly}${remaining.slice(sTingkatOnly.length)}`;
    }
  }

  // Otherwise, do a case-insensitive replacement of the first occurrence
  const regex = new RegExp(sTingkat, 'i');
  return clean.replace(regex, destTingkat);
};

export const isClassMatch = (studentClass: string, selectedClass: string): boolean => {
  if (!studentClass || !selectedClass) return false;

  const sClean = studentClass.trim().toUpperCase();
  const selClean = selectedClass.trim().toUpperCase();

  if (sClean === selClean) return true;

  const normalize = (val: string) => val.replace(/[^A-Z0-9]/g, '');
  const sNorm = normalize(sClean);
  const selNorm = normalize(selClean);

  if (sNorm === selNorm) return true;

  // Protect Roman Numerals (e.g. X, XI, XII shouldn't mismatch)
  const getRomanNumerals = (str: string): string[] => {
    return (str.toUpperCase().match(/\b(X|XI|XII|IX|V|IV|I|II|III|VIII|VII|VI)\b/g) || []);
  };
  const romS = getRomanNumerals(studentClass);
  const romSel = getRomanNumerals(selectedClass);
  if (romS.length > 0 && romSel.length > 0) {
    const matchRom = romS.some(r => romSel.includes(r)) || romSel.some(r => romS.includes(r));
    if (!matchRom) return false;
  }

  // Protect regular numbers (e.g. "Kelas 1" shouldn't match "Kelas 10")
  const numS = studentClass.match(/\d+/g);
  const numSel = selectedClass.match(/\d+/g);
  if (numS && numSel) {
    const matchNum = numS.some(n => numSel.includes(n)) || numSel.some(n => numS.includes(n));
    if (!matchNum) return false;
  }

  // Split and compare parts
  const getBaseParts = (name: string): string[] => {
    return name.toUpperCase()
      .split(/[\s\-\/(),]+/)
      .map(p => p.trim())
      .filter(p => p.length > 0 && p !== 'MAPEL' && p !== 'KELAS' && p !== 'JURUSAN');
  };

  const sParts = getBaseParts(studentClass);
  const selParts = getBaseParts(selectedClass);

  if (sParts.length > 0 && selParts.length > 0) {
    const allStudentPartsInSelected = sParts.every(sp => selParts.includes(sp));
    const allSelectedPartsInStudent = selParts.every(selp => sParts.includes(selp));
    if (allStudentPartsInSelected || allSelectedPartsInStudent) {
      return true;
    }
  }

  // Safe fallback comparison
  if (sNorm.includes(selNorm) || selNorm.includes(sNorm)) {
    return true;
  }

  return false;
};

interface KenaikanKelasProps {
  kelasList: Kelas[];
  siswaList: Siswa[];
  onMigrate: (sourceTingkat: string, destTingkat: string) => void;
}

export default function KenaikanKelas({ kelasList, siswaList, onMigrate }: KenaikanKelasProps) {
  const [sourceTingkat, setSourceTingkat] = useState<string>('');
  const [destTingkat, setDestTingkat] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  // Ambil list tingkat kelas yang unik dari data kelas dan data murid
  const uniqueTingkatList = Array.from(
    new Set([
      ...kelasList.map(k => parseTingkat(k.namaKelas)),
      ...siswaList.map(s => parseTingkat(s.kelas))
    ])
  ).filter(Boolean).sort((a, b) => {
    const aClean = a.replace(/^kelas\s+/i, '').trim();
    const bClean = b.replace(/^kelas\s+/i, '').trim();
    const romanOrder = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    const idxA = romanOrder.indexOf(aClean.toUpperCase());
    const idxB = romanOrder.indexOf(bClean.toUpperCase());
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    
    const numA = parseInt(aClean, 10);
    const numB = parseInt(bClean, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  const countStudents = siswaList.filter(s => s.status === 'Aktif' && parseTingkat(s.kelas) === sourceTingkat).length;

  const handleMigrate = () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!sourceTingkat || !destTingkat) {
      setErrorMsg('Pilih tingkat asal dan tingkat baru terlebih dahulu!');
      return;
    }

    if (sourceTingkat === destTingkat) {
      setErrorMsg('Tingkat asal dan tingkat tujuan tidak boleh sama!');
      return;
    }

    if (countStudents === 0) {
      setErrorMsg(`Tidak ada murid aktif di tingkat ${sourceTingkat} yang bisa dinaikkan kelas.`);
      return;
    }

    setShowConfirm(true);
  };

  const executeMigration = () => {
    onMigrate(sourceTingkat, destTingkat);
    setSuccessMsg(`Kenaikan Kelas Selesai! Berhasil menaikkan ${countStudents} siswa dari tingkat ${sourceTingkat} ke tingkat ${destTingkat}.`);
    setSourceTingkat('');
    setDestTingkat('');
    setShowConfirm(false);
  };

  return (
    <div className="w-full max-w-2xl mx-auto" id="kenaikan-kelas-v2-wrapper">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
          <div className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Manajemen Kenaikan Kelas</h3>
            <p className="text-slate-400 text-xs">Pindahkan seluruh siswa di suatu kelas ke level kelas yang baru secara massal.</p>
          </div>
        </div>

        {/* Warning Alert Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 text-amber-850 text-xs leading-relaxed mb-6">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <span className="font-bold block text-amber-900 mb-0.5">Peringatan Tindakan Massal</span>
            Fitur ini bernilai destruktif administratif tinggi. Sistem akan mengubah status kelas seluruh siswa aktif dari tingkat asal ke tingkat yang baru secara langsung. Pastikan Anda telah melakukan rekapitulasi nilai sebelum migrasi dilakukan.
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Pilih Tingkat Kelas Asal</label>
              <select
                value={sourceTingkat}
                onChange={(e) => setSourceTingkat(e.target.value)}
                className="w-full text-sm bg-white border border-slate-200 text-slate-800 px-3.5 py-2.5 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
                id="kk-select-source"
              >
                <option value="">-- Pilih Tingkat Asal --</option>
                {uniqueTingkatList.map((tingkat) => (
                  <option key={`source-${tingkat}`} value={tingkat}>
                    {tingkat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Pilih Tingkat Kelas Baru</label>
              <select
                value={destTingkat}
                onChange={(e) => setDestTingkat(e.target.value)}
                className="w-full text-sm bg-white border border-slate-200 text-slate-800 px-3.5 py-2.5 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
                id="kk-select-dest"
              >
                <option value="">-- Pilih Tingkat Baru --</option>
                {uniqueTingkatList.map((tingkat) => (
                  <option key={`dest-${tingkat}`} value={tingkat}>
                    {tingkat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {sourceTingkat && (
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-center text-xs text-slate-600">
              Siswa aktif yang terdeteksi di tingkat <span className="font-bold text-emerald-700">{sourceTingkat}</span>: <span className="font-bold text-slate-800 text-sm">{countStudents}</span> orang.
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-850 rounded-xl text-xs font-medium flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <button
            onClick={handleMigrate}
            disabled={!sourceTingkat || !destTingkat}
            className={`w-full py-3 px-4 font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm ${
              (!sourceTingkat || !destTingkat)
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-emerald-100'
            }`}
            id="btn-migrate-execute"
          >
            <span>Eksekusi Kenaikan Kelas</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* DIALOG MODAL: LOCAL MASS MIGRATION CONFIRM OVERLAYS */}
      {showConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print" id="modal-migration-confirm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4 text-center"
          >
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto border border-amber-100">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="font-bold text-slate-800 text-base">Konfirmasi Kenaikan Kelas</h3>
              <p className="text-slate-500 text-xs leading-relaxed">
                Apakah Anda yakin ingin memindahkan seluruh siswa aktif ({countStudents} orang) dari tingkat <span className="font-bold text-emerald-600">{sourceTingkat}</span> ke tingkat <span className="font-bold text-emerald-600">{destTingkat}</span>? Tindakan ini bernilai administratif massal harian.
              </p>
            </div>

            <div className="flex gap-2.5 justify-center pt-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-xs font-bold text-slate-550 bg-slate-100 hover:bg-slate-200 rounded-xl flex-1 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={executeMigration}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex-1 cursor-pointer shadow-md shadow-emerald-100"
              >
                Ya, Rekontruksi
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}

