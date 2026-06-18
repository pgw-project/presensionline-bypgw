import { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, ArrowRight, AlertTriangle, CheckCircle } from 'lucide-react';
import { Kelas, Siswa } from '../types';

interface KenaikanKelasProps {
  kelasList: Kelas[];
  siswaList: Siswa[];
  onMigrate: (sourceKelas: string, destKelas: string) => void;
}

export default function KenaikanKelas({ kelasList, siswaList, onMigrate }: KenaikanKelasProps) {
  const [sourceKelas, setSourceKelas] = useState<string>('');
  const [destKelas, setDestKelas] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  const countStudents = siswaList.filter(s => s.kelas === sourceKelas && s.status === 'Aktif').length;

  const handleMigrate = () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!sourceKelas || !destKelas) {
      setErrorMsg('Pilih kelas asal dan kelas tujuan terlebih dahulu!');
      return;
    }

    if (sourceKelas === destKelas) {
      setErrorMsg('Kelas asal dan kelas tujuan tidak boleh sama!');
      return;
    }

    if (countStudents === 0) {
      setErrorMsg(`Tidak ada murid aktif di kelas ${sourceKelas} yang bisa dimigrasi.`);
      return;
    }

    setShowConfirm(true);
  };

  const executeMigration = () => {
    onMigrate(sourceKelas, destKelas);
    setSuccessMsg(`Migrasi Massal Selesai! Berhasil menaikkan ${countStudents} siswa dari ${sourceKelas} ke ${destKelas}.`);
    setSourceKelas('');
    setDestKelas('');
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
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Kelas Asal (Tingkat Lama)</label>
              <select
                value={sourceKelas}
                onChange={(e) => setSourceKelas(e.target.value)}
                className="w-full text-sm bg-white border border-slate-200 text-slate-800 px-3.5 py-2.5 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
                id="kk-select-source"
              >
                <option value="">-- Pilih Kelas Asal --</option>
                {kelasList.map(k => (
                  <option key={k.namaKelas} value={k.namaKelas}>{k.namaKelas}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Kelas Tujuan (Tingkat Baru)</label>
              <select
                value={destKelas}
                onChange={(e) => setDestKelas(e.target.value)}
                className="w-full text-sm bg-white border border-slate-200 text-slate-800 px-3.5 py-2.5 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
                id="kk-select-dest"
              >
                <option value="">-- Pilih Kelas Tujuan --</option>
                {kelasList.map(k => (
                  <option key={k.namaKelas} value={k.namaKelas}>{k.namaKelas}</option>
                ))}
              </select>
            </div>
          </div>

          {sourceKelas && (
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-center text-xs text-slate-600">
              Siswa aktif yang terdeteksi di kelas <span className="font-bold text-emerald-700">{sourceKelas}</span>: <span className="font-bold text-slate-800 text-sm">{countStudents}</span> orang.
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
            disabled={!sourceKelas || !destKelas}
            className={`w-full py-3 px-4 font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm ${
              (!sourceKelas || !destKelas)
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
                Apakah Anda yakin ingin memindahkan seluruh siswa aktif ({countStudents} orang) dari kelas <span className="font-bold text-emerald-600">{sourceKelas}</span> ke kelas <span className="font-bold text-emerald-600">{destKelas}</span>? Tindakan ini bernilai administratif massal harian.
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
