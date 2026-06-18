import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  FileText, 
  Download, 
  Printer, 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  Minimize2, 
  HelpCircle, 
  Users, 
  QrCode, 
  GraduationCap, 
  Sliders, 
  CheckCircle2, 
  PhoneCall, 
  Calendar, 
  Clock, 
  X,
  Play
} from 'lucide-react';
import pptxgen from 'pptxgenjs';
import { jsPDF } from 'jspdf';

interface PanduanCenterProps {
  currentSchoolScope?: {
    nama: string;
    id: string;
    alamat?: string;
    jamMasuk?: string;
    jamPulang?: string;
    kontak?: string;
  } | null;
  triggerToast?: (message: string, type: 'success' | 'warning' | 'error') => void;
}

export default function PanduanCenter({ currentSchoolScope, triggerToast }: PanduanCenterProps) {
  const [activeTab, setActiveTab] = useState<'slides' | 'handbook'>('slides');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const schNama = currentSchoolScope?.nama || 'Sistem Sekolah';
  const schId = currentSchoolScope?.id || 'GLOBAL';
  const schJamMasuk = currentSchoolScope?.jamMasuk || '07:15';
  const schJamPulang = currentSchoolScope?.jamPulang || '14:00';
  const schKontak = currentSchoolScope?.kontak || '0812-3456-7890';

  // 1. Definition of Slides for the PPT Viewer
  const slidesData = [
    {
      title: "PANDUAN OPERASIONAL & TUTORIAL SISTEM",
      subtitle: `Sistem Real-Time Absensi Siswa Berbasis QR Code - ${schNama}`,
      desc: "Panduan praktis pengoperasian, sinkronisasi cloud, pemindaian digital, rekapitulasi nilai presensi, hingga regulasi sekolah harian.",
      accent: "Cover Pembuka",
      icon: <GraduationCap className="w-12 h-12 text-emerald-400 animate-bounce" />,
      bullets: [
        "Sistem cloud multi-instansi terpusat khusus sekolah binaan.",
        "Pemindaian kilat multi-platform menggunakan kartu fisik maupun gawai gila.",
        "Transparansi data presensi 100% untuk orang tua murid.",
        "Generasi otomatis rekapitulasi data kehadiran berformat spreadsheet."
      ]
    },
    {
      title: "ALUR UTAMA PENGGUNAAN SISTEM",
      subtitle: "Sinergi 3 Aktor Utama: Wali Kelas, Siswa, & Scanner",
      desc: "Bagaimana roda operasional absensi berjalan sehari-hari secara otomatis?",
      accent: "Alur Proses",
      icon: <Sliders className="w-12 h-12 text-indigo-400" />,
      bullets: [
        "1. PENDAFTARAN GURU: Wali Kelas / Staf Guru masuk dengan NIP atau Username terdaftar.",
        "2. DATABASE KELAS: Guru memasukkan / melengkapi database kelas dan data murid bimbingan.",
        "3. KARTU DIGITAL: Siswa login memakai NISN, mengunduh, lalu mencetak Kartu QR Fisik mereka.",
        "4. SCAN PRESENSI: Guru membuka Scanner di sekolah, memindai kartu QR siswa saat jam masuk.",
        "5. LOG CLOUD: Hasil scan tersimpan detik-demi-detik secara real-time dan direkap bulanan."
      ]
    },
    {
      title: "PANDUAN WALI KELAS & STAFF OPERASIONAL",
      subtitle: "Fungsi Kontrol, Registrasi & Ekspor Administrasi",
      desc: "Langkah-langkah detail tugas Wali Kelas harian & bulanan:",
      accent: "Wali Kelas",
      icon: <Users className="w-12 h-12 text-emerald-400" />,
      bullets: [
        `REGISTRASI SISWA: Mendaftarkan siswa baru sesuai kelas agar NISN terdaftar di database [${schId}].`,
        "ABSENSI MANUAL: Mencatat manual bagi siswa yang beralasan Sakit, Izin, atau Alpa (Tanpa Keterangan).",
        "FILTER WALIAN: Guru dapat memfilter riwayat log presensi khusus kelasnya saja demi efisiensi.",
        "PROMOSI KELAS: Menu 'Kenaikan Kelas' memindahkan siswa/kelas secara massal saat tahun ajaran baru.",
        "EKSPOR EXCEL: Klik tombol 'Unduh Excel' di Laporan Harian/Rekap Bulanan untuk arsip dinas."
      ]
    },
    {
      title: "PANDUAN AKSES PORTAL MANDIRI SISWA",
      subtitle: "Kemudahan Mandiri untuk Murid, Praktis & Keamanan Terjaga",
      desc: "Langkah mudah siswa untuk melihat profil dan mencetak kartu absensi:",
      accent: "Portal Siswa",
      icon: <QrCode className="w-12 h-12 text-blue-400" />,
      bullets: [
        "LOGIN NISN: Masuk dengan Username (NISN) & Pasword resmi yang telah diubah oleh Anda/Wali Kelas.",
        "FOTO PROFIL: Unggah foto terbaik Anda dengan format JPEG/PNG (maksimal ukuran 2MB).",
        "CETAK KARTU: Tekan menu 'Cetak Kartu', pilih 'Simpan Gambar PNG' atau langsung print fisik.",
        "RIWAYAT PRESENSI: Pantau status kehadiran harian Anda langsung dari tabel riwayat real-time.",
        "VERIFIKASI: Kartu QR hanya bisa dipindai oleh Scanner Wali Kelas/Sekolah Anda yang terdaftar resmi."
      ]
    },
    {
      title: "PANDUAN MONITORING BAGI ORANG TUA WALI",
      subtitle: "Transparansi Pendidikan untuk Memupuk Karakter Jujur Siswa",
      desc: "Langkah mudah memantau kehadiran harian sang buah hati dari mana saja:",
      accent: "Orang Tua Wali",
      icon: <CheckCircle2 className="w-12 h-12 text-amber-400" />,
      bullets: [
        "REAL-TIME LOG: Tidak perlu install aplikasi tambahan, cukup buka portal siswa menggunakan gawai.",
        "OTENTIKASI VERIFIKASI: Status log 'Hadir (QR)' mendeteksi detak kehadiran fisik anak di kelas.",
        "GRAFIK METRIK PERFORMA: Lihat grafik persentase kehadiran bulanan anak Anda di dashboard utama siswa.",
        "HUBUNGI SEKOLAH: No. Kontak dan alamat sekolah terpampang jelas untuk keperluan pengaduan belajar."
      ]
    },
    {
      title: "TEKNIS & REGULASI ANTI-MANIPULASI DATA",
      subtitle: `Sistem Jam Operasional & Pencegahan Kecurangan Presensi`,
      desc: `Aplikasi dikonfigurasi dengan aturan dinamis demi penegakan kedisplinan:`,
      accent: "Tips & Regulasi",
      icon: <Clock className="w-12 h-12 text-rose-400" />,
      bullets: [
        `JAM MASUK & PULANG: Absen masuk & pulang hanya bisa dipindai pada rentang jam belajar: ${schJamMasuk} s.d. ${schJamPulang} WITA.`,
        "MANIPULASI WAKTU DITOLAK: Jam pendaftaran log diambil akurat dari server waktu, anti-rekayasa.",
        "HARI OPERASIONAL: Log presensi dikunci (ditolak) selama hari libur nasional atau akhir pekan.",
        `KONTAK LAYANAN SEKOLAH: Pusat konsultasi teknis & pengaduan operasional bisa menghubungi: ${schKontak}.`,
        "RESET PABRIK: Admin dapat mereset data ke seed pabrik kapan pun jika mendeteksi anomali."
      ]
    }
  ];

  // 2. Handle Keyboard Navigation for Slideshow
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== 'slides') return;
      if (e.key === 'ArrowRight') {
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        prevSlide();
      } else if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide, activeTab, isFullscreen]);

  const nextSlide = () => {
    setCurrentSlide(prev => (prev === slidesData.length - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentSlide(prev => (prev === 0 ? slidesData.length - 1 : prev - 1));
  };

  // 3. Generasi File PPTX PowerPoint secara Fisik (Real Integration via pptxgenjs)
  const handleDownloadPPTX = () => {
    try {
      if (triggerToast) {
        triggerToast("Menyiapkan berkas slide PowerPoint PPTX...", "warning");
      }

      const pptx = new pptxgen();
      pptx.layout = 'LAYOUT_16x9';

      // General theme constants
      const primaryColor = '047857'; // emerald-700
      const slateDark = '0F172A'; // slate-900
      const white = 'FFFFFF';
      const gray = '64748B';

      slidesData.forEach((slide, idx) => {
        const pptSlide = pptx.addSlide();

        if (idx === 0) {
          // Cover Slide design (dark minimalist)
          pptSlide.background = { fill: slateDark };
          
          pptSlide.addText(slide.title, {
            x: 0.8,
            y: 1.5,
            w: 11.5,
            h: 0.8,
            fontSize: 28,
            bold: true,
            color: '10B981', // green-accent
            fontFace: 'Arial'
          });

          pptSlide.addText(slide.subtitle, {
            x: 0.8,
            y: 2.3,
            w: 11.5,
            h: 0.6,
            fontSize: 16,
            color: 'F1F5F9',
            fontFace: 'Arial',
            italic: true
          });

          pptSlide.addText(slide.desc, {
            x: 0.8,
            y: 3.1,
            w: 11.0,
            h: 0.8,
            fontSize: 12,
            color: '94A3B8',
            fontFace: 'Arial'
          });

          pptSlide.addText("POIN UTAMA MATERI PRESENTASI:", {
            x: 0.8,
            y: 4.0,
            w: 11.0,
            h: 0.3,
            fontSize: 11,
            bold: true,
            color: '34D399',
            fontFace: 'Arial'
          });

          // Bullet lists in Cover
          let bulletY = 4.3;
          slide.bullets.forEach(b => {
            pptSlide.addText(`✔ ${b}`, {
              x: 0.9,
              y: bulletY,
              w: 11.0,
              h: 0.3,
              fontSize: 10,
              color: 'E2E8F0',
              fontFace: 'Arial'
            });
            bulletY += 0.35;
          });

          pptSlide.addText(`Aplikasi Sedia Pakai • Kode Sekolah: ${schId} • No. Kontak: ${schKontak}`, {
            x: 0.8,
            y: 6.2,
            w: 11.5,
            h: 0.4,
            fontSize: 10,
            color: '475569',
            fontFace: 'Arial'
          });

        } else {
          // Content Slides Design
          pptSlide.background = { fill: 'F8FAFC' };

          // Category Badge
          pptSlide.addText(slide.accent.toUpperCase(), {
            x: 0.5,
            y: 0.6,
            w: 4.0,
            h: 0.3,
            fontSize: 10,
            bold: true,
            color: primaryColor,
            fontFace: 'Arial'
          });

          // Slide title
          pptSlide.addText(slide.title, {
            x: 0.5,
            y: 0.9,
            w: 12.3,
            h: 0.5,
            fontSize: 20,
            bold: true,
            color: '1E293B',
            fontFace: 'Arial'
          });

          // Slide subtitle
          pptSlide.addText(slide.subtitle, {
            x: 0.5,
            y: 1.4,
            w: 12.3,
            h: 0.3,
            fontSize: 11,
            color: gray,
            italic: true,
            fontFace: 'Arial'
          });

          // Slide desc paragraph
          pptSlide.addText(slide.desc, {
            x: 0.5,
            y: 1.8,
            w: 12.0,
            h: 0.4,
            fontSize: 11,
            color: '334155',
            fontFace: 'Arial'
          });

          // Core Bullets Listing
          let bulletY = 2.4;
          slide.bullets.forEach((b, bIdx) => {
            pptSlide.addText(`[${bIdx + 1}]  ${b}`, {
              x: 0.6,
              y: bulletY,
              w: 11.8,
              h: 0.6,
              fontSize: 12,
              color: '0F172A',
              fontFace: 'Arial',
              lineSpacing: 18
            });
            bulletY += 0.65;
          });

          // Slide footer page trace
          pptSlide.addText(`Panduan Pengguna • Halaman ${idx + 1} dari ${slidesData.length} • Berbasis Web Cloud Run`, {
            x: 0.5,
            y: 6.3,
            w: 12.0,
            h: 0.3,
            fontSize: 9,
            color: '94A3B8',
            fontFace: 'Arial'
          });
        }
      });

      // Save output
      pptx.writeFile({ fileName: `Panduan_Presentasi_Absensi_${schId}.pptx` })
        .then(() => {
          if (triggerToast) {
            triggerToast("Sukses Mengunduh! Fail presentasi PPTX berhasil disimpan di komputer/HP Anda.", "success");
          }
        })
        .catch(err => {
          console.error("PPTX write error:", err);
          if (triggerToast) {
            triggerToast("Gagal menulis fail PPTX ke gawai Anda.", "error");
          }
        });
    } catch (e) {
      console.error(e);
      if (triggerToast) {
        triggerToast("Gagal memproses ekspor presentasi PPTX.", "error");
      }
    }
  };

  // 4. Programmatic, Beautiful Client-Side PDF Generation utilizing jsPDF
  const handlePrintPDF = () => {
    try {
      if (triggerToast) {
        triggerToast("Menyusun dokumen PDF resmi sistem absensi...", "warning");
      }

      // Initialize Portrait A4 jsPDF
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      // Style guidelines & theme palettes (Emerald & Slate)
      const primaryColor = [4, 120, 87]; // Emerald
      const slateDark = [15, 23, 42]; // Slate 900
      const textGray = [71, 85, 105]; // Slate 600
      const contentWidth = 170; // A4 width is 210, 20mm margin on each side = 170mm
      const margin = 20;
      const pageHeight = doc.internal.pageSize.getHeight();
      let y = 25;

      // --- HALAMAN 1 ---
      // 1. Decorative Header Line
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(margin, y, contentWidth, 3, "F");
      y += 10;

      // 2. Publication Badge
      doc.setFillColor(237, 253, 245);
      doc.rect(margin, y, 68, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("EDISI BUKU PANDUAN UTAMA RESMI", margin + 3, y + 4.8);
      y += 12;

      // 3. Document Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
      doc.text("BUKU PANDUAN OPERASIONAL", margin, y);
      y += 8;
      doc.setFontSize(13);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("Sistem Presensi Real-Time Berbasis QR Code Cloud", margin, y);
      y += 11;

      // 4. School Metadata Profile Block
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, contentWidth, 23, "FD");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
      doc.text(`PROFIL INSTANSI SEKOMLAH: ${schNama.toUpperCase()}`, margin + 5, y + 6);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.text(`ID Sekolah: ${schId}  |  Jam Belajar Masuk - Pulang: ${schJamMasuk} - ${schJamPulang} WITA`, margin + 5, y + 12);
      doc.text(`Pusat Layanan Bantuan / Kontak Sekolah: ${schKontak}`, margin + 5, y + 17);
      y += 33;

      // 5. Section 1 Content
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
      doc.text("BAGIAN I: MANAJEMEN GURU WALI KELAS & KELOLA DATABASE", margin, y);
      y += 5;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      
      const sec1Text = [
        "Guru Wali Kelas bertanggung jawab menyusun database kelas asuhan serta mendaftarkan seluruh siswa bimbingan agar NISN mereka tervalidasi di cloud.",
        "• Masuk menggunakan akun Wali Kelas / Staf Guru yang telah didaftarkan sebelumnya oleh Administrator.",
        "• Pilih menu 'Manajemen Kelas' di sidebar sebelah kiri, lalu tekan tombol 'Daftarkan Kelas Baru'. Isi nama kelas Anda secara presisi (contoh: 'VII-A', 'X-FKK-2').",
        "• Buka menu 'Data Murid', daftarkan satu per satu murid Anda dengan mengisi Nama Lengkap, NISN unik, pilihan Kelas, serta kata sandi standar awal (contoh: '123456').",
        "• Guru Wali Kelas memegang hak kendali penuh untuk menyunting informasi murid maupun mereset kata sandi siswa jika siswa mengalami lupa sandi."
      ];

      sec1Text.forEach(line => {
        const textLines = doc.splitTextToSize(line, contentWidth);
        textLines.forEach((l: string) => {
          doc.text(l, margin, y);
          y += 5;
        });
      });
      y += 7;

      // 6. Section 2 Content
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
      doc.text("BAGIAN II: ALUR PENJADWALAN & CETAK KARTU DIGITAL SISWA", margin, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);

      const sec2Text = [
        "Masing-masing siswa memiliki kartu identitas digital unik yang dilengkapi dengan enkripsi kode QR otentik perorangan. Cetak kartu Anda dengan langkah berikut:",
        "• Siswa melakukan login mandiri ke portal menggunakan kredensial berupa NISN sebagai username dan sandi yang diperoleh dari Wali Kelas.",
        "• Masuk ke menu halaman utama siswa, lalu pilih tombol 'Cetak Kartu'.",
        "• Di layar pratinjau kartu, tekan tombol 'Simpan Gambar PNG' untuk menyimpannya ke memori telepon genggam Anda sebagai kartu digital portabel.",
        "• Tekan 'Cetak Kartu Saya' untuk langsung mencetaknya fisik dengan kertas tebal, foto, atau ID Card plastik agar awet dan terlindung dari goresan fisik."
      ];

      sec2Text.forEach(line => {
        const textLines = doc.splitTextToSize(line, contentWidth);
        textLines.forEach((l: string) => {
          doc.text(l, margin, y);
          y += 5;
        });
      });

      // Footer Page 1
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Buku Panduan Presensi Digital ${schNama}  |  Halaman 1 dari 2`, margin, pageHeight - 12);

      // --- ADD NEW PAGE ---
      doc.addPage();
      y = 25;

      // Decorative Top Band Page 2
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(margin, y, contentWidth, 3, "F");
      y += 10;

      // 7. Section 3 Content
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
      doc.text("BAGIAN III: TATA CARA PELAKSANAAN PRESENSI HARIAN", margin, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);

      const sec3Text = [
        "Untuk efisiensi operasional harian, sistem memisahkan pencatatan logs ke dalam dua metode adaptif:",
        "• METODE ABSENSI QR (Live Scanning): Guru mengaktifkan kamera dengan menekan tombol 'Aktifkan Kamera Live QR'. Siswa cukup mendekatkan kartu QR mereka dengan jarak 15-30cm di depan bidikan kamera. Ketika buzzer notifikasi berbunyi sukses, kehadiran instan langsung tercatat otomatis.",
        "• METODE ABSENSI MANUAL (Disepakati Wali Kelas): Apabila siswa terkendala sakit atau izin resmi, Guru menuju panel 'Kelola Log Absen' -> ketuk tombol 'Presensi Manual'. Pilih identitas siswa, ubah status presensi menjadi Sakit, Izin, atau Alpa, lalu tekan simpan."
      ];

      sec3Text.forEach(line => {
        const textLines = doc.splitTextToSize(line, contentWidth);
        textLines.forEach((l: string) => {
          doc.text(l, margin, y);
          y += 5;
        });
      });
      y += 7;

      // 8. Section 4 Content
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
      doc.text("BAGIAN IV: PELAPORAN TRANSPARAN & UNDUH BERKAS EXCEL", margin, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);

      const sec4Text = [
        "Sistem menyimpan detail waktu absensi secara otomatis untuk kebutuhan audit administrasi sekolah:",
        "• Statistik Dashboard: Memantau visualisasi grafik sebaran kehadiran masuk di hari ini secara langsung.",
        "• Laporan Absensi Harian: Berisi data runtut jam kedatangan siswa, nama pengajar, serta pendaftaran mapel.",
        "• Rekap Kontrol Bulanan: Menampilkan persentase performa total (jumlah kehadiran, alpa, izin, sakit) bagi setiap siswa dalam 30 hari penuh.",
        "• Untuk mengarsipkan data demi laporan dinas, tekan tombol 'Unduh Excel' di setiap panel rekap untuk mengunduh fail berekstensi .xlsx secara langsung."
      ];

      sec4Text.forEach(line => {
        const textLines = doc.splitTextToSize(line, contentWidth);
        textLines.forEach((l: string) => {
          doc.text(l, margin, y);
          y += 5;
        });
      });
      y += 7;

      // 9. Section 5 Content
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
      doc.text("BAGIAN V: REGULASI PROTEKSI & KONTAK LAYANAN BANTUAN", margin, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);

      const sec5Text = [
        "Aplikasi dilengkapi pengetatan digital guna menutup penuh celah manipulasi:",
        `• Pembatasan Jam Absen: Scanner ditutup otomatis di luar jadwal masuk & pulang sekolah resmi (${schJamMasuk} s.d. ${schJamPulang} WITA).`,
        "• Lock Hari Libur Nasional: Tanggal merah, hari libur bersama, dan akhir pekan otomatis mengunci modul pemindaian.",
        `• Call Center Bantuan Sekolah: Jika terjadi masalah pembacaan lensa kamera QR, siswa atau orang tua dapat berkonsultasi ke hotline sekolah di: ${schKontak} atau berkunjung langsung ke alamat sekolah yang terdaftar.`
      ];

      sec5Text.forEach(line => {
        const textLines = doc.splitTextToSize(line, contentWidth);
        textLines.forEach((l: string) => {
          doc.text(l, margin, y);
          y += 5;
        });
      });

      // Footer Page 2
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Buku Panduan Presensi Digital ${schNama}  |  Halaman 2 dari 2  |  Unduh PDF: ${new Date().toLocaleDateString('id-ID')}`, margin, pageHeight - 12);

      // Save Constructed PDF Automatically
      doc.save(`Buku_Panduan_Absensi_${schId}.pdf`);

      if (triggerToast) {
        triggerToast("Sukses Mengunduh! Fail Buku Panduan PDF berhasil disimpan di peramban/HP Anda.", "success");
      }
    } catch (e) {
      console.error("Critical PDF generation error:", e);
      if (triggerToast) {
        triggerToast("Gagal melakukan unduhan langsung PDF. Mencoba cadangan cetak...", "error");
      }
      window.print();
    }
  };

  return (
    <div className="space-y-6 print:bg-white print:text-black" id="panduan-center-main-wrapper">
      
      {/* Upper Title Header Section (Excluded on Print) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-emerald-650" />
            <span>Pusat Tutorial & Panduan Operasional</span>
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Media interaktif penunjuk penggunaan aplikasi untuk guru wali kelas, siswa, hingga orang tua tanpa hambatan.
          </p>
        </div>

        {/* Tab Toggle Controls (Dual Mode Selection) */}
        <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1 border border-slate-200">
          <button
            onClick={() => setActiveTab('slides')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'slides' 
                ? 'bg-emerald-600 text-white shadow-md' 
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Slide PPT Interaktif</span>
          </button>
          <button
            onClick={() => setActiveTab('handbook')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'handbook' 
                ? 'bg-emerald-600 text-white shadow-md' 
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Buku Panduan (Siap PDF)</span>
          </button>
        </div>
      </div>

      {/* RENDER MODE 1: INTERACTIVE POWERPOINT-STYLE SLIDER VIEW */}
      {activeTab === 'slides' && (
        <div className="space-y-4 no-print">
          
          {/* Main Presenter Layout */}
          <div className={`grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch ${isFullscreen ? 'fixed inset-0 bg-slate-900 z-50 p-6' : ''}`}>
            
            {/* Left Thumbnail Drawer (only visible in normal mode for speed jumps) */}
            <div className={`lg:col-span-1 space-y-2 border border-slate-200 p-3 rounded-2xl bg-white max-h-[460px] overflow-y-auto no-print ${isFullscreen ? 'hidden' : 'block'}`}>
              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Daftar Slide Presentasi</h5>
              <div className="space-y-1.5">
                {slidesData.map((slide, sIdx) => (
                  <button
                    key={sIdx}
                    onClick={() => setCurrentSlide(sIdx)}
                    className={`w-full text-left p-2.5 rounded-xl transition-all border text-xs cursor-pointer ${
                      currentSlide === sIdx 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold' 
                        : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-mono text-[9px] text-slate-400 font-bold uppercase mb-0.5">SLIDE {sIdx + 1}</div>
                    <div className="truncate font-semibold">{slide.title}</div>
                  </button>
                ))}
              </div>

              {/* PPT Download Floating Trigger */}
              <div className="pt-3 border-t border-slate-100 mt-4 space-y-2">
                <button
                  onClick={handleDownloadPPTX}
                  className="w-full flex items-center justify-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-[11px] py-2.5 px-3 rounded-xl cursor-pointer transition-all shadow-md shadow-orange-100"
                >
                  <Download className="w-4 h-4 animate-bounce" style={{ animationDuration: '3s' }} />
                  <span>Unduh Fail PPTX Utama</span>
                </button>
                <p className="text-[9px] text-slate-400 text-center leading-relaxed font-semibold">
                  Mendownload fail presentasi murni Microsoft PowerPoint (.pptx) untuk diedit atau dipresentasikan offline.
                </p>
              </div>
            </div>

            {/* Right Screen Content Slideshow stage */}
            <div className={`lg:col-span-3 flex flex-col justify-between rounded-3xl border transition-all ${
              isFullscreen 
                ? 'bg-slate-950 border-slate-800 min-h-screen text-white p-8' 
                : 'bg-slate-900 border-slate-800 text-white p-6 md:p-8 min-h-[420px]'
            }`}>
              
              {/* Slide Upper Control Bar */}
              <div className="flex justify-between items-center border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-500/10 text-emerald-400 font-black text-[9px] px-2.5 py-1 rounded-full uppercase border border-emerald-500/20 tracking-wider">
                    {slidesData[currentSlide].accent}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-slate-400">
                    Slide {currentSlide + 1} dari {slidesData.length}
                  </span>
                </div>
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh Viewer"}
                  className="p-1 px-3 rounded-lg text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 font-extrabold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {isFullscreen ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5" />
                      <span>Normal</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Full Screen</span>
                    </>
                  )}
                </button>
              </div>

              {/* Active Slide Body Area */}
              <div className="my-6 md:my-8 space-y-5 flex-1 flex flex-col justify-center">
                <div className="flex items-start gap-4">
                  <div className="bg-slate-800 p-3.5 rounded-2xl border border-slate-700/60 grow-0 shrink-0">
                    {slidesData[currentSlide].icon}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg md:text-2xl font-black text-white tracking-tight leading-snug">
                      {slidesData[currentSlide].title}
                    </h3>
                    <p className="text-emerald-400 font-bold text-xs md:text-sm">
                      ● {slidesData[currentSlide].subtitle}
                    </p>
                  </div>
                </div>

                <p className="text-slate-350 text-xs md:text-sm italic font-semibold leading-relaxed border-l-2 border-slate-700 pl-3">
                  {slidesData[currentSlide].desc}
                </p>

                {/* Bullets mapping */}
                <div className="mt-4 space-y-2.5">
                  {slidesData[currentSlide].bullets.map((bullet, bIdx) => (
                    <motion.div 
                      key={bIdx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: bIdx * 0.08 }}
                      className="flex items-start gap-2 text-xs md:text-sm"
                    >
                      <span className="text-emerald-500 font-bold font-mono shrink-0">[{bIdx + 1}]</span>
                      <span className="text-slate-100 font-semibold leading-relaxed">{bullet}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Lower Navigation Controller */}
              <div className="border-t border-slate-800 pb-1 pt-4 flex flex-col sm:flex-row gap-3 justify-between items-center">
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[9px] font-bold">←</kbd>
                  <span className="text-[10px] text-slate-450 font-semibold">Gunakan tombol keyboard panah untuk navigasi slide</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[9px] font-bold">→</kbd>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={prevSlide}
                    className="p-2 sm:px-3 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Kembali</span>
                  </button>

                  {/* Progress bar info */}
                  <div className="w-20 md:w-32 bg-slate-800 h-2 rounded-full overflow-hidden shrink-0 mx-2">
                    <div 
                      className="bg-emerald-500 h-full transition-all duration-300" 
                      style={{ width: `${((currentSlide + 1) / slidesData.length) * 100}%` }}
                    />
                  </div>

                  <button
                    onClick={nextSlide}
                    className="p-2 sm:px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>Berikutnya</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Quick download triggers for HP/Tablet layout compatibility wrapper */}
          <div className="lg:hidden p-4 rounded-2xl bg-white border border-slate-200 flex flex-col gap-3 justify-center items-center mt-3">
            <button
              onClick={handleDownloadPPTX}
              className="w-full flex items-center justify-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs py-3 px-4 rounded-xl cursor-pointer transition-all shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>Unduh File Microsoft PowerPoint (.PPTX)</span>
            </button>
          </div>

        </div>
      )}

      {/* RENDER MODE 2: HANDBOOK / PRINTABLE BOOK PREVIEW (PDF-READY) */}
      {activeTab === 'handbook' && (
        <div id="print-handbook-root" className="bg-white border md:border-slate-200/80 rounded-3xl p-6 md:p-10 text-slate-800 space-y-8 font-sans max-w-4xl mx-auto shadow-sm">
          
          {/* Printable Handbook Header Frame */}
          <div className="border-b-4 border-emerald-650 pb-6 flex justify-between items-start gap-4">
            <div className="space-y-1">
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-black px-2.5 py-1 rounded-full uppercase border border-emerald-250/20 tracking-wider">
                Edisi Panduan Resmi Aplikasi
              </span>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-none mt-2">
                Buku Panduan Presensi Multi-Sekolah
              </h1>
              <p className="text-slate-500 font-mono text-[11px] font-bold">
                Instansi Digital Aktif: <span className="text-emerald-700 font-black">{schNama} [{schId}]</span>
              </p>
            </div>
            
            {/* Quick click PDF save button (Hidden on real print session) */}
            <div className="no-print">
              <button
                onClick={handlePrintPDF}
                className="bg-emerald-650 hover:bg-emerald-700 text-white font-black text-xs py-3 px-5 rounded-2xl flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-100"
              >
                <Printer className="w-4 h-4 animate-pulse" />
                <span>Cetak / Ekspor ke Fail PDF</span>
              </button>
            </div>
          </div>

          {/* Table of Contents and Stats Intro */}
          <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-4 print:bg-white print:border-slate-300">
            <div className="col-span-2 space-y-2">
              <h4 className="text-xs font-black text-slate-450 uppercase tracking-widest font-mono">Daftar Isi Panduan Pengguna:</h4>
              <ul className="text-xs space-y-1.5 font-bold text-slate-700">
                <li>📄 Bagian 1: Manajemen wali kelas & Registrasi Kelas-Murid</li>
                <li>📄 Bagian 2: Alur Pembuatan & Cetak Kartu Digital Siswa</li>
                <li>📄 Bagian 3: Pelaksanaan Presensi Harian (QR & Manual)</li>
                <li>📄 Bagian 4: Pelaporan Presensi realtime & Laporan Bulanan</li>
                <li>📄 Bagian 5: Regulasi, Jam Belajar, Pengamanan Data & Kontak</li>
              </ul>
            </div>
            <div className="bg-emerald-50 border border-emerald-150 p-4 rounded-xl flex flex-col justify-center text-center space-y-1 print:hidden">
              <h5 className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">Waktu Operasional Aktif</h5>
              <div className="text-xl font-black text-emerald-950 font-mono">{schJamMasuk} - {schJamPulang}</div>
              <p className="text-[9px] text-emerald-800 leading-normal font-semibold">
                Sistem tertutup otomatis di luar jam operasional di atas untuk mencegah manipulasi.
              </p>
            </div>
          </div>

          {/* Section 1 */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-900 border-b border-slate-150 pb-2 flex items-center gap-1.5 uppercase font-sans">
              <span className="w-5 h-5 bg-emerald-600 text-white font-mono text-[10px] font-bold rounded-lg flex items-center justify-center">1</span>
              <span>Registrasi & Administrasi Guru Wali Kelas</span>
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Guru Wali Kelas bertanggung jawab menyusun database kelas asuhan mereka sebelum murid dapat menggunakan sistem. Jika data murid atau kelas kosong, silakan lakukan langkah-langkah berikut:
            </p>
            <div className="bg-slate-50 border border-slate-150 rounded-2xl overflow-hidden print:bg-white print:border-slate-300">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-150/50 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3 w-1/4">Tahapan Aktivitas</th>
                    <th className="p-3">Panduan Langkah Pelaksanaan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  <tr>
                    <td className="p-3 font-bold text-slate-900">1. Setup Kelas Utama</td>
                    <td className="p-3 text-slate-600 leading-normal">
                      Buka menu <strong className="text-slate-800">Manajemen Kelas</strong>, klik tombol daftarkan kelas baru. Isi nama kode kelas secara presisi (contoh: 'VII-A', 'X-FKK-2'). Nama kelas ini akan bertindak sebagai pengidentifikasi relasi murid.
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-900">2. Input Database Murid</td>
                    <td className="p-3 text-slate-600 leading-normal">
                      Klik menu <strong className="text-slate-800">Data Murid</strong>, masukkan nama, NISN, pilih kelas terdaftar, dan buatkan password awal (misal: '123456'). Anda juga dapat mengubah atau menghapus murid dari daftar ini sewaktu-waktu.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2 */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-900 border-b border-slate-150 pb-2 flex items-center gap-1.5 uppercase font-sans">
              <span className="w-5 h-5 bg-emerald-600 text-white font-mono text-[10px] font-bold rounded-lg flex items-center justify-center">2</span>
              <span>Alur Pembuatan & Cetak Kartu Digital Murid</span>
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed font-semibold">
              Kartu absensi digital memuat kode QR otentik yang terdaftar di sistem. Guru, Wali Kelas, atau Siswa sendiri dapat mencetaknya langsung:
            </p>
            <div className="border border-slate-150 rounded-2xl p-4 space-y-2 text-xs leading-relaxed font-semibold">
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-650 shrink-0">✔</span>
                <span>Siswa login menggunakan akun NISN dan Kata Sandi yang dibuat bapak/ibu Guru Wali Kelas.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-650 shrink-0">✔</span>
                <span>Buka menu <strong className="text-slate-800">Cetak Kartu</strong>. Pastikan identitas nama, kode NISN, dan kelas yang tertera sudah terpasang benar.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-650 shrink-0">✔</span>
                <span>Tekan <strong className="text-slate-800">Simpan Gambar PNG</strong> untuk ditaruh di memori HP, atau tekan <strong className="text-slate-800">Cetak Kartu Saya</strong> untuk langsung mentransfer dokumen ke printer kertas/id card fisik.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-650 shrink-0">✔</span>
                <span>Tempelkan kartu atau bawa gawai ponsel pintar Anda untuk discan setibanya Anda di depan gerbang / pintu kelas sekolah.</span>
              </div>
            </div>
          </div>

          {/* Section 3 */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-900 border-b border-slate-150 pb-2 flex items-center gap-1.5 uppercase font-sans">
              <span className="w-5 h-5 bg-emerald-600 text-white font-mono text-[10px] font-bold rounded-lg flex items-center justify-center">3</span>
              <span>Tata Cara Pelaksanaan Presensi Harian</span>
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Sistem absensi membagi pemindaian harian menjadi dua metode fungsional:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 print:bg-white print:border-slate-300">
                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-2 py-0.5 rounded border border-indigo-150 uppercase tracking-widest block w-fit mb-2">Metode 1: Pemindaian QR</span>
                <p className="text-[11px] text-slate-650 leading-relaxed font-semibold">
                  Guru membuka dashboard dan menekan tombol <strong className="text-slate-800">Aktifkan Kamera Live QR</strong>. Murid mendekatkan kartu QR mereka ke kamera sejauh 15-30cm. Deteksi suara dan notifikasi sukses akan langsung berbunyi instan, mendaftarkan status 'Hadir (QR)'.
                </p>
              </div>
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 print:bg-white print:border-slate-300">
                <span className="text-[10px] bg-amber-50 text-amber-700 font-extrabold px-2 py-0.5 rounded border border-amber-150 uppercase tracking-widest block w-fit mb-2">Metode 2: Input Manual Guru</span>
                <p className="text-[11px] text-slate-650 leading-relaxed font-semibold">
                  Apabila murid mengalami keadaan sakit atau izin resmi, Guru menuju panel <strong className="text-slate-800">Kelola Log Absen</strong>, tekan <strong className="text-slate-800">Pencatatan Presensi Manual</strong>. Pilih siswa, pilih status 'Sakit' / 'Izin' / 'Alpa', lalu simpan.
                </p>
              </div>
            </div>
          </div>

          {/* Section 4 */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-900 border-b border-slate-150 pb-2 flex items-center gap-1.5 uppercase font-sans">
              <span className="w-5 h-5 bg-emerald-600 text-white font-mono text-[10px] font-bold rounded-lg flex items-center justify-center">4</span>
              <span>Pelaporan Terbuka & Rekapitulasi Excel</span>
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Laporan Presensi dikelompokkan otomatis di bawah cloud agar transparan dan mempermudah arsip administrasi:
            </p>
            <div className="space-y-2 border-l-4 border-emerald-500 pl-4 text-xs font-semibold text-slate-650 leading-relaxed">
              <p>
                📈 **Pratinjau Grafik Harian**: Memantau grafik batang 3D persentase rasio kehadiran, mendeteksi jumlah kehadiran masuk vs siswa absen seketika di hari operasional saat ini.
              </p>
              <p>
                📅 **Laporan Harian**: Guru mendaftarkan Mata Pelajaran yang diajarkan, lalu menyalin atau memfilter logs masuk harian dan mengunduh fail berekstensi Excel XLSX.
              </p>
              <p>
                📅 **Rekap Bulanan**: Menyajikan rincian persentase kehadiran masing-masing siswa (Hadir, Sakit, Izin, Absen) dalam satu bulan kalender penuh demi pelaporan rapor dinas.
              </p>
            </div>
          </div>

          {/* Section 5 */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-900 border-b border-slate-150 pb-2 flex items-center gap-1.5 uppercase font-sans">
              <span className="w-5 h-5 bg-emerald-600 text-white font-mono text-[10px] font-bold rounded-lg flex items-center justify-center">5</span>
              <span>Sistem Proteksi Waktu & Kontak Pengaduan</span>
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Sistem presensi dilengkapi dengan firewall digital murni untuk mencegah pemalsuan presensi:
            </p>
            <div className="bg-rose-50/50 border border-rose-150 rounded-2xl p-4 text-xs leading-relaxed text-slate-750 font-semibold space-y-1.5 print:bg-white print:border-slate-300">
              <p>● **Lock Jam Operasional**: Scanner dan manual tertutup dinonaktifkan di luar jadwal resmi ({schJamMasuk} s.d {schJamPulang} WITA) untuk menutup peluang kehadiran di luar jam belajar resmi.</p>
              <p>● **Lock Hari Libur**: Jika Tanggal menunjukkan Tanggal Merah (Sistem Hari Libur) atau akhir pekan, pemindaian presensi harian otomatis terkunci sepenuhnya.</p>
              {schKontak && <p>● **Layanan Bantuan**: Bila terjadi kendala pencocokan kartu QR, hubungi Admin/Telepon sekolah aktif: <strong className="text-rose-700 font-bold">{schKontak}</strong> atau alamat sekolah: <strong className="italic text-slate-800">{currentSchoolScope?.alamat || 'Alamat Terdaftar'}</strong>.</p>}
            </div>
          </div>

          {/* Footer of Printable Page */}
          <div className="pt-6 border-t border-slate-200 mt-10 flex justify-between items-center text-[10px] text-slate-400 font-mono font-bold">
            <span>Panduan Resmi Aplikasi Presensi Multi-Sekolah cloud</span>
            <span>Waktu Dokumen: {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>

        </div>
      )}

    </div>
  );
}
