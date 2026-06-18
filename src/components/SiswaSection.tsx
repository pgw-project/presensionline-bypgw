import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { GraduationCap, Printer, User, Award, ShieldAlert, CheckCircle, Download, Activity, Calendar, Clock, Upload, FileText, ClipboardList } from 'lucide-react';
import { CurrentUser, AbsenLog } from '../types';
import { jsPDF } from 'jspdf';

interface SiswaSectionProps {
  currentUser: CurrentUser;
  triggerToast?: (message: string, type?: 'success' | 'warning' | 'error') => void;
  absensi?: AbsenLog[];
  onPhotoUpload?: (base64Data: string) => void;
  activeTab?: 'dash' | 'card' | 'laporan' | 'rekap';
  setActiveTab?: (tab: 'dash' | 'card' | 'laporan' | 'rekap') => void;
}

export default function SiswaSection({ 
  currentUser, 
  triggerToast, 
  absensi = [], 
  onPhotoUpload,
  activeTab: controlledActiveTab,
  setActiveTab: controlledSetActiveTab
}: SiswaSectionProps) {
  const [localActiveTab, setLocalActiveTab] = useState<'dash' | 'card' | 'laporan' | 'rekap'>('dash');
  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : localActiveTab;
  const setActiveTab = controlledSetActiveTab !== undefined ? controlledSetActiveTab : setLocalActiveTab;

  // Subject filter states for daily & monthly reports
  const [filterMapelLaporan, setFilterMapelLaporan] = useState<string>('all');
  const [filterMapelRekap, setFilterMapelRekap] = useState<string>('all');

  // Real-time updates for auto-refresh dashboard crossing 6 AM morning
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000); // Check and refresh every 10 seconds
    return () => clearInterval(timer);
  }, []);

  // Date and month states for reports
  const getTodayString = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getCurrentMonthString = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthString());

  const compressProfileImage = (base64Str: string, maxWidth = 250, maxHeight = 250, quality = 0.65): Promise<string> => {
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

  const handleLocalPhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      if (triggerToast) triggerToast('Gagal: Ukuran foto maksimal adalah 2MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      const compressedData = await compressProfileImage(base64Data);
      if (onPhotoUpload) {
        onPhotoUpload(compressedData);
      }
    };
    reader.onerror = () => {
      if (triggerToast) triggerToast('Gagal membaca file gambar.', 'error');
    };
    reader.readAsDataURL(file);
  };

  const printCard = () => {
    try {
      window.print();
    } catch (err) {
      console.error('Print failed:', err);
      if (triggerToast) {
        triggerToast(
          'Browser memblokir cetak langsung dari dalam frame uji coba. Harap klik tombol "Buka di Tab Baru" di kanan atas browser Anda, atau gunakan fitur "Simpan Gambar PNG"!',
          'warning'
        );
      } else {
        alert(
          'Browser memblokir cetak langsung dari dalam frame uji coba. Silakan klik tombol "Buka di Tab Baru" di kanan atas layar, atau gunakan fitur "Simpan Gambar"!'
        );
      }
    }
  };

  const downloadCardAsImage = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 550;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas 2D context not supported');
      }

      // Draw background with nice styling
      const grd = ctx.createLinearGradient(0, 0, 0, 550);
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(1, '#f8fafc'); // slate-50
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 400, 550);

      // Card border
      ctx.strokeStyle = '#e2e8f0'; // slate-200
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, 394, 544);

      // Card Header
      ctx.fillStyle = '#0f172a'; // slate-900
      ctx.fillRect(16, 16, 368, 80);

      // Header Brand text
      ctx.fillStyle = '#10b981'; // emerald-500
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('KARTU DIGITAL ABSENSI', 35, 52);

      ctx.fillStyle = '#94a3b8'; // slate-400
      ctx.font = 'bold 9px monospace';
      ctx.fillText('By PGW', 35, 74);

      // Header "SC" circle badge
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(335, 56, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SC', 335, 56);

      // Draw Student Name
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(currentUser.nama.toUpperCase(), 200, 145);

      // Draw Student NISN
      ctx.fillStyle = '#64748b'; // slate-500
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`NISN: ${currentUser.username}`, 200, 172);

      // Draw QR Code from the SVG element
      const svgElement = document.getElementById('student-qr-code');
      if (!svgElement) {
        throw new Error('QRCode SVG element not found in DOM');
      }

      const svgString = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const blobURL = window.URL.createObjectURL(svgBlob);
      
      const img = new Image();
      img.onload = () => {
        // Draw image onto canvas
        ctx.drawImage(img, 110, 205, 180, 180);

        const finalizeAndDownload = () => {
          // Draw Class Badge (pill shape)
          ctx.fillStyle = '#ecfdf5'; // emerald-50
          ctx.beginPath();
          // Rounded rect for badge
          const badgeX = 110;
          const badgeY = 410;
          const badgeW = 180;
          const badgeH = 32;
          const r = 16; // radius
          ctx.moveTo(badgeX + r, badgeY);
          ctx.arcTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + badgeH, r);
          ctx.arcTo(badgeX + badgeW, badgeY + badgeH, badgeX, badgeY + badgeH, r);
          ctx.arcTo(badgeX, badgeY + badgeH, badgeX, badgeY, r);
          ctx.arcTo(badgeX, badgeY, badgeX + badgeW, badgeY, r);
          ctx.closePath();
          ctx.fill();
          
          ctx.strokeStyle = '#a7f3d0'; // emerald-200
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Class text inside badge
          ctx.fillStyle = '#047857'; // emerald-700
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(currentUser.extra || 'KELAS NIL', 200, 430);

          // Footer instructions
          ctx.fillStyle = '#94a3b8'; // slate-450
          ctx.font = '9px monospace';
          ctx.fillText('Simpan kartu ini di handphone untuk scan harian.', 200, 485);
          ctx.fillText('Dilarang menyebarluaskan QR Code ini.', 200, 502);

          // Trigger safe file download
          const imageURL = canvas.toDataURL('image/png');
          const downloadLink = document.createElement('a');
          downloadLink.href = imageURL;
          downloadLink.download = `Kartu_QR_Absen_${currentUser.nama.replace(/\s+/g, '_')}_${currentUser.username}.png`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);

          // Revoke blob memory
          window.URL.revokeObjectURL(blobURL);

          if (triggerToast) {
            triggerToast('Kartu QR berhasil diunduh sebagai gambar PNG!', 'success');
          }
        };

        if (currentUser.foto) {
          const profileImg = new Image();
          profileImg.onload = () => {
            ctx.save();
            ctx.beginPath();
            ctx.arc(335, 56, 18, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(profileImg, 335 - 18, 56 - 18, 36, 36);
            ctx.restore();

            // Re-draw clean emerald border
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(335, 56, 18, 0, Math.PI * 2);
            ctx.stroke();

            finalizeAndDownload();
          };
          profileImg.onerror = () => {
            finalizeAndDownload();
          };
          profileImg.src = currentUser.foto;
        } else {
          finalizeAndDownload();
        }
      };
      img.onerror = () => {
        throw new Error('Gagal memuat gambar QR Code SVG.');
      };
      img.src = blobURL;
    } catch (err) {
      console.error('Image download failed:', err);
      if (triggerToast) {
        triggerToast('Gagal memproses pengunduhan kartu gambar. Harap gunakan screen capture atau cetak manual.', 'error');
      } else {
        alert('Gagal mengunduh kartu gambar. Silakan gunakan tangkapan layar HP Anda.');
      }
    }
  };

  // Filter helper functions
  const getYYYYMMDD = (timestamp: any) => {
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return '';
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch (e) {
      return '';
    }
  };

  const getYYYYMM = (timestamp: any) => {
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return '';
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${yyyy}-${mm}`;
    } catch (e) {
      return '';
    }
  };

  const isDashboardLogVisible = (logTimestamp: any, now: Date) => {
    try {
      const logStr = getYYYYMMDD(logTimestamp);
      if (!logStr) return false;

      // Get today's local date string
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;

      // Check if it matches today
      if (logStr === todayStr) {
        return true;
      }

      // Check if it matches yesterday
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const y_yyyy = yesterday.getFullYear();
      const y_mm = String(yesterday.getMonth() + 1).padStart(2, '0');
      const y_dd = String(yesterday.getDate()).padStart(2, '0');
      const yesterdayStr = `${y_yyyy}-${y_mm}-${y_dd}`;

      if (logStr === yesterdayStr) {
        // Yesterday's logs are only visible if current local time is before 06:00 AM
        return now.getHours() < 6;
      }

      return false;
    } catch (e) {
      return false;
    }
  };

  const studentLogs = (absensi || []).filter(
    (log) => log.nis.trim().toLowerCase() === currentUser.username.trim().toLowerCase()
  );

  // PDF generator for Laporan Harian
  const handleDownloadLaporanHarianPDF = (targetDate: string, filteredLogs: AbsenLog[]) => {
    try {
      if (triggerToast) {
        triggerToast("Menyusun Laporan Harian PDF...", "warning");
      }

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const emeraldColor = [4, 120, 87]; 
      const darkSlate = [15, 23, 42]; 
      const textGrey = [71, 85, 105]; 
      const margin = 20;
      const contentWidth = 170;
      const pageHeight = doc.internal.pageSize.getHeight();
      let y = 25;

      // Decorative Header Top Block
      doc.setFillColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
      doc.rect(margin, y, contentWidth, 3, "F");
      y += 10;

      // Report Header Badge
      doc.setFillColor(237, 253, 245);
      doc.rect(margin, y, 55, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
      doc.text("LAPORAN PRESENSI HARIAN DIGITAL", margin + 3, y + 4.8);
      y += 12;

      // Document Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
      doc.text("LAPORAN HARIAN KEHADIRAN SISWA", margin, y);
      y += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(textGrey[0], textGrey[1], textGrey[2]);
      doc.text(`Waktu Cetak: ${new Date().toLocaleString('id-ID')} WITA`, margin, y);
      y += 10;

      // Student Profile Frame
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, contentWidth, 26, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
      doc.text(`PROFIL SISWA`, margin + 5, y + 6);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(`Nama Lengkap : ${currentUser.nama.toUpperCase()}`, margin + 5, y + 12);
      doc.text(`NISN Siswa    : ${currentUser.username}`, margin + 5, y + 17);
      doc.text(`Kelas / Rombel : ${currentUser.extra || 'UMUM'}`, margin + 5, y + 22);

      // Selected Report Date Frame (Right Side Highlight)
      let formattedDateText = targetDate;
      try {
        const d = new Date(targetDate);
        if (!isNaN(d.getTime())) {
          formattedDateText = d.toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          });
        }
      } catch(e){}

      doc.setFont("helvetica", "bold");
      doc.text(`Tanggal Laporan:`, margin + 105, y + 12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
      doc.text(formattedDateText, margin + 105, y + 17);
      y += 35;

      // Section Table Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
      doc.text("RINCIAN SESI MATA PELAJARAN YANG DIIKUTI", margin, y);
      y += 6;

      // Headers of lessons table
      const tableHeaders = ["Mata Pelajaran", "Jam Presensi", "Guru Pengajar", "Status Kehadiran"];
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 8, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(tableHeaders[0], margin + 4, y + 5.5);
      doc.text(tableHeaders[1], margin + 55, y + 5.5);
      doc.text(tableHeaders[2], margin + 90, y + 5.5);
      doc.text(tableHeaders[3], margin + 140, y + 5.5);
      y += 8;

      if (filteredLogs.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        doc.text("Tidak ada data presensi siswa yang terekam pada tanggal ini.", margin + 4, y + 8);
        y += 15;
      } else {
        filteredLogs.forEach((log) => {
          let logTimeFormatted = '--:--';
          try {
            const d = new Date(log.timestamp);
            logTimeFormatted = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WITA';
          } catch(e){}

          // Draw Row background line
          doc.setDrawColor(241, 245, 249);
          doc.line(margin, y + 7, margin + contentWidth, y + 7);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(15, 23, 42);
          doc.text(log.mataPelajaran || "Umum / Mulok", margin + 4, y + 4.5);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(71, 85, 105);
          doc.text(logTimeFormatted, margin + 55, y + 4.5);

          const teacherText = log.guruNip ? `${log.guruNama || 'Guru'} (${log.guruNip})` : (log.guruNama || 'Sistem Mandiri');
          doc.text(teacherText.substring(0, 24), margin + 90, y + 4.5);

          // Render Badge text
          doc.setFont("helvetica", "bold");
          const displayStatus = log.status === 'Hadir (QR)' ? 'HADIR (QR)' : log.status === 'Hadir (Manual)' ? 'HADIR' : log.status.toUpperCase();
          if (log.status.startsWith('Hadir')) {
            doc.setTextColor(4, 120, 87); // Emerald color
          } else if (log.status === 'Sakit') {
            doc.setTextColor(37, 99, 235); // Blue
          } else if (log.status === 'Izin') {
            doc.setTextColor(217, 119, 6); // Amber
          } else {
            doc.setTextColor(225, 29, 72); // Rose
          }
          doc.text(displayStatus, margin + 140, y + 4.5);

          y += 8;
        });
      }
      y += 15;

      // Note/Disclaimer Block
      doc.setFillColor(254, 252, 232);
      doc.setDrawColor(254, 240, 138);
      doc.rect(margin, y, contentWidth, 15, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(161, 98, 7);
      doc.text("Pernyataan Keabsahan", margin + 4, y + 5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(113, 63, 18);
      doc.text("Dokumen laporan ini diterbitkan oleh sistem cloud digital sekolah dan tervalidasi secara otomatis harian.", margin + 4, y + 10);

      // Sign-off / Signature
      y += 20;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text("Mengetahui,", margin + 110, y);
      doc.text("Orang Tua / Wali Siswa", margin + 110, y + 5);
      
      doc.line(margin + 110, y + 23, margin + 155, y + 23);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("Tanda Tangan & Nama Jelas", margin + 110, y + 27);

      // Footer
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`Dicetak Digital oleh ${currentUser.nama} (NISN: ${currentUser.username})`, margin, pageHeight - 12);

      // Save PDF File
      doc.save(`Laporan_Harian_${currentUser.username}_${targetDate}.pdf`);

      if (triggerToast) {
        triggerToast("Laporan Harian PDF Berhasil Diunduh!", "success");
      }
    } catch(e) {
      console.error("Laporan PDF error:", e);
      if (triggerToast) {
        triggerToast("Gagal menyusun data PDF Laporan Harian.", "error");
      }
    }
  };

  // PDF generator for Rekap Bulanan
  const handleDownloadRekapBulananPDF = (targetMonth: string, filteredLogs: AbsenLog[], monthlyStats: { hadir: number, sakit: number, izin: number, alfa: number }) => {
    try {
      if (triggerToast) {
        triggerToast("Menyusun Rekap Bulanan PDF...", "warning");
      }

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const emeraldColor = [4, 120, 87]; 
      const darkSlate = [15, 23, 42]; 
      const textGrey = [71, 85, 105]; 
      const margin = 20;
      const contentWidth = 170;
      const pageHeight = doc.internal.pageSize.getHeight();
      let y = 25;

      // Decorative Header Top Block
      doc.setFillColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
      doc.rect(margin, y, contentWidth, 3, "F");
      y += 10;

      // Report Header Badge
      doc.setFillColor(237, 253, 245);
      doc.rect(margin, y, 55, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
      doc.text("REKAPITULASI BULANAN DIGITAL", margin + 3, y + 4.8);
      y += 12;

      // Document Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
      doc.text("REKAP PRESTASI ABSENSI BULANAN", margin, y);
      y += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(textGrey[0], textGrey[1], textGrey[2]);
      doc.text(`Periode: ${targetMonth} (Bulan/Tahun)  |  Halaman Utama Catatan Siswa`, margin, y);
      y += 10;

      // Student Profile Frame
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, contentWidth, 26, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
      doc.text(`PROFIL SISWA`, margin + 5, y + 6);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(`Nama Lengkap : ${currentUser.nama.toUpperCase()}`, margin + 5, y + 12);
      doc.text(`NISN Siswa    : ${currentUser.username}`, margin + 5, y + 17);
      doc.text(`Kelas / Rombel : ${currentUser.extra || 'UMUM'}`, margin + 5, y + 22);

      // Selected Report Month Frame (Right Side Highlight)
      let formattedMonthText = targetMonth;
      try {
        const parts = targetMonth.split('-');
        if (parts.length === 2) {
          const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
          formattedMonthText = d.toLocaleDateString('id-ID', {
            month: 'long',
            year: 'numeric'
          });
        }
      } catch(e){}

      doc.setFont("helvetica", "bold");
      doc.text(`Periode Rekap:`, margin + 105, y + 12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
      doc.text(formattedMonthText, margin + 105, y + 17);
      y += 35;

      // STATS BOXES VISUAL IN PDF
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
      doc.text("RINGKASAN KEHADIRAN PADA PERIODE INI", margin, y);
      y += 5;

      // STATISTIC TILES
      const boxW = 38;
      const boxH = 14;
      const boxSpacing = 5;

      // Tile 1: Hadir
      doc.setFillColor(236, 253, 245); // emerald-50
      doc.rect(margin, y, boxW, boxH, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(4, 120, 87);
      doc.text("HADIR", margin + 3, y + 4.5);
      doc.setFontSize(12);
      doc.text(`${monthlyStats.hadir} Sesi`, margin + 3, y + 10.5);

      // Tile 2: Sakit
      doc.setFillColor(239, 246, 255); // blue-50
      doc.rect(margin + boxW + boxSpacing, y, boxW, boxH, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(37, 99, 235);
      doc.text("SAKIT", margin + boxW + boxSpacing + 3, y + 4.5);
      doc.setFontSize(12);
      doc.text(`${monthlyStats.sakit} Sesi`, margin + boxW + boxSpacing + 3, y + 10.5);

      // Tile 3: Izin
      doc.setFillColor(254, 243, 199); // amber-50
      doc.rect(margin + (boxW + boxSpacing) * 2, y, boxW, boxH, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(217, 119, 6);
      doc.text("IZIN", margin + (boxW + boxSpacing) * 2 + 3, y + 4.5);
      doc.setFontSize(12);
      doc.text(`${monthlyStats.izin} Sesi`, margin + (boxW + boxSpacing) * 2 + 3, y + 10.5);

      // Tile 4: Alfa
      doc.setFillColor(255, 241, 242); // rose-50
      doc.rect(margin + (boxW + boxSpacing) * 3, y, boxW, boxH, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(225, 29, 72);
      doc.text("ALPA", margin + (boxW + boxSpacing) * 3 + 3, y + 4.5);
      doc.setFontSize(12);
      doc.text(`${monthlyStats.alfa} Sesi`, margin + (boxW + boxSpacing) * 3 + 3, y + 10.5);

      y += 22;

      // Section Table Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
      doc.text("DAFTAR RINCI RAW LOG PRESENSI BULANAN", margin, y);
      y += 6;

      // Headers of lessons table
      const tableHeaders = ["Tanggal", "Mata Pelajaran", "Jam", "Guru Pengajar", "Status"];
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 8, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(tableHeaders[0], margin + 4, y + 5.5);
      doc.text(tableHeaders[1], margin + 35, y + 5.5);
      doc.text(tableHeaders[2], margin + 78, y + 5.5);
      doc.text(tableHeaders[3], margin + 110, y + 5.5);
      doc.text(tableHeaders[4], margin + 148, y + 5.5);
      y += 8;

      if (filteredLogs.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        doc.text("Tidak ada data rekap presensi pada periode bulan ini.", margin + 4, y + 8);
        y += 15;
      } else {
        const pageLimitLogs = filteredLogs.slice(0, 15);
        pageLimitLogs.forEach((log) => {
          let logDateStr = log.tanggal;
          let logTimeFormatted = '--:--';
          try {
            const d = new Date(log.timestamp);
            logDateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            logTimeFormatted = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WITA';
          } catch(e){}

          // Draw Row background line
          doc.setDrawColor(241, 245, 249);
          doc.line(margin, y + 7, margin + contentWidth, y + 7);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(15, 23, 42);
          doc.text(logDateStr, margin + 4, y + 4.5);

          doc.setFont("helvetica", "normal");
          doc.setTextColor(71, 85, 105);
          doc.text(log.mataPelajaran || "Umum", margin + 35, y + 4.5);
          doc.text(logTimeFormatted, margin + 78, y + 4.5);

          const teacherText = log.guruNama || 'Guru';
          doc.text(teacherText.substring(0, 18), margin + 110, y + 4.5);

          // Render Status Group indicator text
          doc.setFont("helvetica", "bold");
          const displayStatus = log.status === 'Hadir (QR)' ? 'HADIR (QR)' : log.status === 'Hadir (Manual)' ? 'HADIR' : log.status.toUpperCase();
          if (log.status.startsWith('Hadir')) {
            doc.setTextColor(4, 120, 87); // Emerald color
          } else if (log.status === 'Sakit') {
            doc.setTextColor(37, 99, 235); // Blue
          } else if (log.status === 'Izin') {
            doc.setTextColor(217, 119, 6); // Amber
          } else {
            doc.setTextColor(225, 29, 72); // Rose
          }
          doc.text(displayStatus, margin + 148, y + 4.5);

          y += 8;
        });

        if (filteredLogs.length > 15) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(`...dan ${filteredLogs.length - 15} sesi presensi lainnya (Di-unrekap dalam lembar ini)`, margin + 4, y + 5);
          y += 8;
        }
      }
      y += 12;

      // Sign-off / Signature
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text("Wali Kelas Bimbingan,", margin + 110, y);
      
      doc.line(margin + 110, y + 20, margin + 155, y + 20);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("Tanda Tangan & Nama Terang", margin + 110, y + 24);

      // Footer
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`Unduhan Berkas Digital Rekapitulasi Presensi  |  Sistem Cloud QR`, margin, pageHeight - 12);

      // Save PDF File
      doc.save(`Rekap_Bulanan_${currentUser.username}_${targetMonth}.pdf`);

      if (triggerToast) {
        triggerToast("Rekap Bulanan PDF Berhasil Diunduh!", "success");
      }
    } catch(e) {
      console.error("Rekap PDF error:", e);
      if (triggerToast) {
        triggerToast("Gagal menyusun data PDF Rekap Bulanan.", "error");
      }
    }
  };

  return (
    <div className="w-full">
      {/* Upper Navigation Tabs */}
      {!controlledActiveTab && (
        <div className="flex flex-wrap border-b border-slate-200 mb-6 no-print gap-1">
          <button
            onClick={() => setActiveTab('dash')}
            className={`px-5 py-3 font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'dash'
                ? 'border-b-2 border-emerald-600 text-emerald-700 font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            id="btn-tab-sis-dash"
          >
            Dashboard Siswa
          </button>
          <button
            onClick={() => setActiveTab('laporan')}
            className={`px-5 py-3 font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'laporan'
                ? 'border-b-2 border-emerald-600 text-emerald-700 font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            id="btn-tab-sis-laporan"
          >
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>Laporan Harian</span>
          </button>
          <button
            onClick={() => setActiveTab('rekap')}
            className={`px-5 py-3 font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'rekap'
                ? 'border-b-2 border-emerald-600 text-emerald-700 font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            id="btn-tab-sis-rekap"
          >
            <ClipboardList className="w-4 h-4 text-emerald-600" />
            <span>Rekap Bulanan</span>
          </button>
          <button
            onClick={() => setActiveTab('card')}
            className={`px-5 py-3 font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'card'
                ? 'border-b-2 border-emerald-600 text-emerald-700 font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            id="btn-tab-sis-card"
          >
            Kartu Absensi QR
          </button>
        </div>
      )}

      {activeTab === 'dash' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm no-print"
          id="section-sis-dash"
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Selamat Datang, {currentUser.nama}!</h2>
              <p className="text-slate-500 mt-1">Gunakan platform ini untuk mengelola absensi kelas dan melihat kartu QR digital Anda.</p>
            </div>
            <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-200 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold text-sm">Akun Siswa Aktif</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-slate-100 bg-slate-50/50 p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 tracking-widest uppercase">Profil Siswa</span>
                <div className="flex items-center gap-4 mt-4">
                  <div className="relative w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-2xl overflow-hidden shadow-inner border border-emerald-500/30 shrink-0 group">
                    {currentUser.foto ? (
                      <img src={currentUser.foto} alt="Foto Profil" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    ) : (
                      currentUser.nama.charAt(0)
                    )}
                    <label className="absolute inset-0 bg-black/60 transition-opacity duration-200 flex flex-col items-center justify-center cursor-pointer text-white opacity-0 group-hover:opacity-100">
                      <Upload className="w-4 h-4" />
                      <span className="text-[8px] font-extrabold uppercase tracking-wider mt-0.5">Unggah</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleLocalPhotoUpload} 
                      />
                    </label>
                  </div>
                  <div className="flex flex-col">
                    <h3 className="font-bold text-slate-800 text-base leading-tight">{currentUser.nama}</h3>
                    <p className="text-xs text-slate-550 font-mono mt-0.5">NISN: {currentUser.username}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-slate-400 text-xs block">KELAS</span>
                  <span className="font-semibold text-slate-800">{currentUser.extra || 'Bila Belum Dipetakan'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">HAK AKSES</span>
                  <span className="font-semibold text-slate-850 px-2 py-0.5 rounded bg-slate-200 text-xs inline-block">Siswa (Murid)</span>
                </div>
              </div>
            </div>

            <div className="border border-emerald-100 bg-emerald-50/20 p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 text-emerald-800 font-bold text-lg">
                  <Award className="w-6 h-6 text-emerald-600" />
                  <span>Petunjuk Absensi</span>
                </div>
                <p className="text-slate-650 text-sm mt-3 leading-relaxed">
                  Untuk melakukan absensi harian, silakan buka menu <span className="font-semibold text-emerald-700 cursor-pointer" onClick={() => setActiveTab('card')}>Kartu Absensi QR</span> dan tunjukkan kode QR Anda kepada Guru pengampu di depan kelas.
                </p>
                <div className="mt-4 flex items-start gap-2.5 text-xs text-slate-550 leading-relaxed bg-white/70 p-3 rounded-lg border border-slate-100">
                  <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>Pastikan layar HP Anda dalam kondisi terang (brigthness maksimal) agar scanner dapat mendeteksi barcode Anda dengan cepat.</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIWAYAT PRESENSI MANDIRI SISWA */}
          {(() => {
            const myLogs = (absensi || []).filter(
              (log) => log.nis.trim().toLowerCase() === currentUser.username.trim().toLowerCase() && isDashboardLogVisible(log.timestamp, currentTime)
            );
            const sortedLogs = [...myLogs].sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );

            const countHadir = sortedLogs.filter((l) => l.status.startsWith('Hadir')).length;
            const countSakit = sortedLogs.filter((l) => l.status === 'Sakit').length;
            const countIzin = sortedLogs.filter((l) => l.status === 'Izin').length;
            const countAlfa = sortedLogs.filter((l) => l.status === 'Alfa').length;

            return (
              <div className="mt-8 border-t border-slate-150 pt-8" id="siswa-presensi-rekap">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-emerald-600" />
                      <span>Riwayat Kehadiran & Presensi Saya</span>
                    </h3>
                    <p className="text-slate-500 text-xs mt-0.5">
                      Menampilkan presensi hari ini. Riwayat hari kemarin otomatis hilang dari ringkasan dashboard setelah pukul 06:00 WITA (tersimpan lengkap di menu Laporan Harian & Rekap Bulanan).
                    </p>
                  </div>
                  
                  <div className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 shrink-0">
                    Total Dashboard: {sortedLogs.length} Sesi
                  </div>
                </div>

                {/* Indikator stats kecil */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-700 block uppercase tracking-wider">Hadir</span>
                      <span className="text-xl font-black text-slate-900 mt-0.5 block">{countHadir} Sesi</span>
                    </div>
                    <div className="w-8 h-8 bg-emerald-100 text-emerald-800 rounded-lg flex items-center justify-center font-bold text-xs">
                      H
                    </div>
                  </div>

                  <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-blue-700 block uppercase tracking-wider">Sakit</span>
                      <span className="text-xl font-black text-slate-900 mt-0.5 block">{countSakit} Sesi</span>
                    </div>
                    <div className="w-8 h-8 bg-blue-100 text-blue-800 rounded-lg flex items-center justify-center font-bold text-xs">
                      S
                    </div>
                  </div>

                  <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-amber-700 block uppercase tracking-wider">Izin</span>
                      <span className="text-xl font-black text-slate-900 mt-0.5 block">{countIzin} Sesi</span>
                    </div>
                    <div className="w-8 h-8 bg-amber-100 text-amber-800 rounded-lg flex items-center justify-center font-bold text-xs">
                      I
                    </div>
                  </div>

                  <div className="bg-rose-50/50 border border-rose-100 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-rose-700 block uppercase tracking-wider">Alfa</span>
                      <span className="text-xl font-black text-slate-900 mt-0.5 block">{countAlfa} Sesi</span>
                    </div>
                    <div className="w-8 h-8 bg-rose-100 text-rose-800 rounded-lg flex items-center justify-center font-bold text-xs">
                      A
                    </div>
                  </div>
                </div>

                {/* Tabel Riwayat */}
                <div className="border border-slate-150 rounded-2xl overflow-hidden bg-white shadow-xs">
                  {sortedLogs.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 font-semibold flex flex-col items-center justify-center">
                      <Calendar className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="text-sm">Belum ada riwayat kehadiran yang terekam.</p>
                      <p className="text-xs text-slate-400 font-normal mt-0.5">Silakan lakukan pemindaian kartu QR dengan guru di kelas.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs md:text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                            <th className="py-3.5 px-4">Mata Pelajaran</th>
                            <th className="py-3.5 px-4 text-center">Jam Ke</th>
                            <th className="py-3.5 px-4 text-center">Tanggal & Waktu</th>
                            <th className="py-3.5 px-4 text-center">Guru Pengajar</th>
                            <th className="py-3.5 px-4 text-center">Status Kehadiran</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {sortedLogs.map((log) => {
                            let formattedDate = log.tanggal;
                            let formattedTime = '';
                            try {
                              const d = new Date(log.timestamp);
                              formattedDate = d.toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              });
                              formattedTime = d.toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              });
                            } catch (e) {}

                            return (
                              <tr key={log.id} className="hover:bg-slate-50/55 transition-all">
                                <td className="py-3.5 px-4">
                                  <div className="font-extrabold text-slate-800 text-sm">{log.mataPelajaran || 'Umum'}</div>
                                  <div className="text-[10px] text-slate-400 mt-0.5 font-semibold uppercase">{log.kelas}</div>
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <span className="inline-flex items-center justify-center w-7 h-7 bg-slate-100 rounded-full font-bold text-slate-700 text-xs shadow-inner">
                                    {log.jamKe || '1'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <div className="font-semibold text-slate-800">{formattedDate}</div>
                                  <div className="text-[10px] text-slate-450 mt-0.5 font-mono">{formattedTime || '--:--'} WITA</div>
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <div className="text-slate-600 font-semibold">{log.guruNama || 'Sistem Mandiri'}</div>
                                  {log.guruNip && <div className="text-[9px] text-slate-400 font-mono mt-0.5">{log.guruNip}</div>}
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <span
                                    className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase border tracking-wide ${
                                      log.status.startsWith('Hadir')
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                        : log.status === 'Sakit'
                                        ? 'bg-blue-50 border-blue-200 text-blue-800'
                                        : log.status === 'Izin'
                                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                                        : 'bg-rose-50 border-rose-200 text-rose-800'
                                    }`}
                                  >
                                    {log.status === 'Hadir (QR)' ? 'HADIR (QR)' : log.status === 'Hadir (Manual)' ? 'HADIR' : log.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </motion.div>
      )}

      {activeTab === 'laporan' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm no-print"
          id="section-sis-laporan"
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600" />
                <span>Dokumen Laporan Harian Siswa</span>
              </h2>
              <p className="text-slate-500 text-xs mt-0.5">Filter berdasarkan tanggal dan unduh surat laporan kehadiran harian dengan format PDF resmi.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto shrink-0 font-sans">
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 w-full md:w-auto">
                <span className="text-xs text-slate-500 font-semibold shrink-0">Tanggal:</span>
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent border-none text-xs text-slate-800 font-bold focus:outline-none w-full cursor-pointer focus:ring-0"
                />
              </div>

              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 w-full md:w-auto">
                <span className="text-xs text-slate-500 font-semibold shrink-0">Mapel:</span>
                <select 
                  value={filterMapelLaporan}
                  onChange={(e) => setFilterMapelLaporan(e.target.value)}
                  className="bg-transparent border-none text-xs text-slate-800 font-bold focus:outline-none w-full cursor-pointer focus:ring-0"
                >
                  <option value="all">Semua Mapel</option>
                  {Array.from(new Set(studentLogs.map(log => log.mataPelajaran).filter(Boolean))).map((sub) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>

              {(() => {
                const dailyLogs = studentLogs.filter(log => {
                  const matchDate = getYYYYMMDD(log.timestamp) === selectedDate;
                  const matchMapel = filterMapelLaporan === 'all' || log.mataPelajaran === filterMapelLaporan;
                  return matchDate && matchMapel;
                });
                return (
                  <button
                    onClick={() => handleDownloadLaporanHarianPDF(selectedDate, dailyLogs)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow w-full md:w-auto cursor-pointer"
                    id="btn-download-laporan-pdf"
                  >
                    <Download className="w-4 h-4" />
                    <span>Unduh PDF Harian</span>
                  </button>
                );
              })()}
            </div>
          </div>

          {/* TABLE PREVIEW */}
          {(() => {
            const dailyLogs = studentLogs.filter(log => {
              const matchDate = getYYYYMMDD(log.timestamp) === selectedDate;
              const matchMapel = filterMapelLaporan === 'all' || log.mataPelajaran === filterMapelLaporan;
              return matchDate && matchMapel;
            });
            return (
              <div>
                <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hasil Pencarian Presensi</span>
                  <span className="text-xs font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                    {dailyLogs.length} Sesi Terdaftar
                  </span>
                </div>

                <div className="border border-slate-150 rounded-2xl overflow-hidden bg-white shadow-xs">
                  {dailyLogs.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 font-semibold flex flex-col items-center justify-center">
                      <Calendar className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="text-sm">Tidak ada catatan presensi pada tanggal {selectedDate}.</p>
                      <p className="text-xs text-slate-400 font-normal mt-0.5">Silakan pilih tanggal lain atau tanyakan kepada wali kelas Anda.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs md:text-sm animate-fade-in">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                            <th className="py-3.5 px-4">Mata Pelajaran</th>
                            <th className="py-3.5 px-4 text-center">Jam Ke</th>
                            <th className="py-3.5 px-4 text-center">Waktu Presensi</th>
                            <th className="py-3.5 px-4 text-center">Guru Pengajar</th>
                            <th className="py-3.5 px-4 text-center">Status Kehadiran</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 font-sans">
                          {dailyLogs.map((log) => {
                            let formattedTime = '';
                            try {
                              const d = new Date(log.timestamp);
                              formattedTime = d.toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              });
                            } catch (e) {}

                            return (
                              <tr key={log.id} className="hover:bg-slate-50/55 transition-all">
                                <td className="py-3.5 px-4">
                                  <div className="font-extrabold text-slate-800 text-sm">{log.mataPelajaran || 'Umum'}</div>
                                  <div className="text-[10px] text-slate-400 mt-0.5 font-semibold uppercase">{log.kelas}</div>
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <span className="inline-flex items-center justify-center w-7 h-7 bg-slate-100 rounded-full font-bold text-slate-700 text-xs shadow-inner">
                                    {log.jamKe || '1'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <div className="text-xs text-slate-850 font-mono font-bold">{formattedTime || '--:--'} WITA</div>
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <div className="text-slate-600 font-semibold">{log.guruNama || 'Sistem Mandiri'}</div>
                                  {log.guruNip && <div className="text-[10px] text-slate-400 font-mono mt-0.5">{log.guruNip}</div>}
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <span
                                    className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase border tracking-wide ${
                                      log.status.startsWith('Hadir')
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                        : log.status === 'Sakit'
                                        ? 'bg-blue-50 border-blue-200 text-blue-800'
                                        : log.status === 'Izin'
                                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                                        : 'bg-rose-50 border-rose-200 text-rose-800'
                                    }`}
                                  >
                                    {log.status === 'Hadir (QR)' ? 'HADIR (QR)' : log.status === 'Hadir (Manual)' ? 'HADIR' : log.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </motion.div>
      )}

      {activeTab === 'rekap' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm no-print"
          id="section-sis-rekap"
        >
          {(() => {
            const monthlyLogs = studentLogs.filter(log => {
              const matchMonth = getYYYYMM(log.timestamp) === selectedMonth;
              const matchMapel = filterMapelRekap === 'all' || log.mataPelajaran === filterMapelRekap;
              return matchMonth && matchMapel;
            });
            const monthlyStats = {
              hadir: monthlyLogs.filter(log => log.status.startsWith('Hadir')).length,
              sakit: monthlyLogs.filter(log => log.status === 'Sakit').length,
              izin: monthlyLogs.filter(log => log.status === 'Izin').length,
              alfa: monthlyLogs.filter(log => log.status === 'Alfa').length,
            };

            return (
              <div>
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-emerald-600" />
                      <span>Dokumen Rekapitulasi Absensi Bulanan</span>
                    </h2>
                    <p className="text-slate-500 text-xs mt-0.5">Filter berdasarkan bulan dan unduh surat rekapitusasi kehadiran resmi dengan format PDF.</p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto shrink-0 font-sans">
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 w-full md:w-auto">
                      <span className="text-xs text-slate-500 font-semibold shrink-0">Bulan:</span>
                      <input 
                        type="month" 
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-transparent border-none text-xs text-slate-800 font-bold focus:outline-none w-full cursor-pointer focus:ring-0"
                      />
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 w-full md:w-auto">
                      <span className="text-xs text-slate-500 font-semibold shrink-0">Mapel:</span>
                      <select 
                        value={filterMapelRekap}
                        onChange={(e) => setFilterMapelRekap(e.target.value)}
                        className="bg-transparent border-none text-xs text-slate-800 font-bold focus:outline-none w-full cursor-pointer focus:ring-0"
                      >
                        <option value="all">Semua Mapel</option>
                        {Array.from(new Set(studentLogs.map(log => log.mataPelajaran).filter(Boolean))).map((sub) => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={() => handleDownloadRekapBulananPDF(selectedMonth, monthlyLogs, monthlyStats)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow w-full md:w-auto cursor-pointer"
                      id="btn-download-rekap-pdf"
                    >
                      <Download className="w-4 h-4" />
                      <span>Unduh PDF Bulanan</span>
                    </button>
                  </div>
                </div>

                {/* STATS TILES */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 font-sans">
                  <div className="bg-emerald-50/55 border border-emerald-100 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-700 block uppercase tracking-wider">Hadir</span>
                      <span className="text-lg font-black text-slate-900 mt-0.5 block">{monthlyStats.hadir} Sesi</span>
                    </div>
                    <div className="w-7 h-7 bg-emerald-100 text-emerald-800 rounded-lg flex items-center justify-center font-bold text-xs">H</div>
                  </div>

                  <div className="bg-blue-50/55 border border-blue-100 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-blue-700 block uppercase tracking-wider">Sakit</span>
                      <span className="text-lg font-black text-slate-900 mt-0.5 block">{monthlyStats.sakit} Sesi</span>
                    </div>
                    <div className="w-7 h-7 bg-blue-100 text-blue-800 rounded-lg flex items-center justify-center font-bold text-xs">S</div>
                  </div>

                  <div className="bg-amber-50/55 border border-amber-100 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-amber-700 block uppercase tracking-wider">Izin</span>
                      <span className="text-lg font-black text-slate-900 mt-0.5 block">{monthlyStats.izin} Sesi</span>
                    </div>
                    <div className="w-7 h-7 bg-amber-100 text-amber-800 rounded-lg flex items-center justify-center font-bold text-xs">I</div>
                  </div>

                  <div className="bg-rose-50/55 border border-rose-100 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-rose-700 block uppercase tracking-wider">Alfa</span>
                      <span className="text-lg font-black text-slate-900 mt-0.5 block">{monthlyStats.alfa} Sesi</span>
                    </div>
                    <div className="w-7 h-7 bg-rose-100 text-rose-800 rounded-lg flex items-center justify-center font-bold text-xs">A</div>
                  </div>
                </div>

                <div className="border border-slate-150 rounded-2xl overflow-hidden bg-white shadow-xs">
                  {monthlyLogs.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 font-semibold flex flex-col items-center justify-center">
                      <Calendar className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="text-sm">Belum ada riwayat kehadiran yang terekam di bulan ini ({selectedMonth}).</p>
                      <p className="text-xs text-slate-400 font-normal mt-0.5">Silakan pilih bulan lain atau kumpulkan logs kehadiran Anda.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs md:text-sm animate-fade-in">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                            <th className="py-3.5 px-4">Tanggal & Waktu</th>
                            <th className="py-3.5 px-4">Mata Pelajaran</th>
                            <th className="py-3.5 px-4 text-center">Jam Ke</th>
                            <th className="py-3.5 px-4 text-center">Guru Pengajar</th>
                            <th className="py-3.5 px-4 text-center">Status Kehadiran</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 font-sans">
                          {monthlyLogs.map((log) => {
                            let formattedDate = log.tanggal;
                            let formattedTime = '';
                            try {
                              const d = new Date(log.timestamp);
                              formattedDate = d.toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              });
                              formattedTime = d.toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              });
                            } catch (e) {}

                            return (
                              <tr key={log.id} className="hover:bg-slate-50/55 transition-all">
                                <td className="py-3.5 px-4">
                                  <div className="font-semibold text-slate-800">{formattedDate}</div>
                                  <div className="text-[10px] text-slate-450 mt-0.5 font-mono">{formattedTime || '--:--'} WITA</div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="font-extrabold text-slate-800 text-sm">{log.mataPelajaran || 'Umum'}</div>
                                  <div className="text-[10px] text-slate-400 mt-0.5 font-semibold uppercase">{log.kelas}</div>
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <span className="inline-flex items-center justify-center w-7 h-7 bg-slate-100 rounded-full font-bold text-slate-700 text-xs shadow-inner">
                                    {log.jamKe || '1'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <div className="text-slate-600 font-semibold">{log.guruNama || 'Sistem Mandiri'}</div>
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <span
                                    className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase border tracking-wide ${
                                      log.status.startsWith('Hadir')
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                        : log.status === 'Sakit'
                                        ? 'bg-blue-50 border-blue-200 text-blue-800'
                                        : log.status === 'Izin'
                                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                                        : 'bg-rose-50 border-rose-200 text-rose-800'
                                    }`}
                                  >
                                    {log.status === 'Hadir (QR)' ? 'HADIR (QR)' : log.status === 'Hadir (Manual)' ? 'HADIR' : log.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </motion.div>
      )}

      {activeTab === 'card' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center"
          id="section-sis-card"
        >
          <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 no-print">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Kartu QR Absensi Digital</h2>
              <p className="text-slate-500 text-xs mt-0.5">Cetak langsung kartu fisik atau simpan gambar ke galeri gawai pintar Anda.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={downloadCardAsImage}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors flex items-center gap-1.5 shadow"
                id="btn-unduh-kartu"
              >
                <Download className="w-4 h-4" />
                <span>Simpan Gambar (PNG)</span>
              </button>
              <button
                onClick={printCard}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                id="btn-cetak-kartu"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Kartu Saya</span>
              </button>
            </div>
          </div>

          {/* PRINT CARD WRAPPER */}
          <div className="id-card-digital w-full max-w-sm bg-white rounded-3xl border-2 border-slate-200 p-6 shadow-lg flex flex-col items-center relative overflow-hidden text-center transition-all bg-radial from-white to-slate-50/50 print:border-slate-800 print:shadow-none print:my-10 print:mx-auto">
            
            {/* Header style */}
            <div className="w-full bg-slate-900 text-white rounded-2xl p-4 mb-6 flex items-center justify-between text-left print:bg-black">
              <div>
                <h5 className="font-bold text-sm tracking-wide m-0 uppercase text-emerald-400 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4" />
                  KARTU DIGITAL
                </h5>
                <p className="text-[10px] text-slate-300 font-mono m-0 mt-0.5">By PGW</p>
              </div>
              <div className="w-10 h-10 rounded-full border border-emerald-500/50 flex items-center justify-center font-bold text-xs bg-slate-800 overflow-hidden shrink-0">
                {currentUser.foto ? (
                  <img src={currentUser.foto} alt="Foto Profil" referrerPolicy="no-referrer" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <span>SC</span>
                )}
              </div>
            </div>

            <h3 className="font-bold text-slate-900 text-xl tracking-tight uppercase print:text-black">
              {currentUser.nama}
            </h3>
            <p className="text-slate-500 text-xs font-mono mt-1 print:text-slate-700">
              NISN: {currentUser.username}
            </p>

            <div className="bg-white p-4 my-6 rounded-2xl border border-slate-100 shadow-sm inline-block print:border-slate-800">
              <QRCodeSVG
                id="student-qr-code"
                value={currentUser.username}
                size={160}
                level="H"
                includeMargin={false}
              />
            </div>

            <div className="bg-emerald-50 text-emerald-800 px-5 py-1.5 rounded-full font-bold text-xs tracking-wider border border-emerald-100 print:border-slate-800 print:text-black uppercase">
              {currentUser.extra || 'KELAS NIL'}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 w-full text-[10px] text-slate-450 leading-relaxed font-mono print:border-slate-800">
              Simpan kartu ini di handphone untuk scan harian.
              <br />
              Dilarang menyebarluaskan QR Code ini.
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
