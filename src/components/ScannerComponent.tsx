import { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { motion } from 'motion/react';
import { Camera, AlertTriangle, Play, Square, RefreshCw, UserCheck, Volume2, Zap, ZapOff, Info, Check, Maximize2, Minimize2 } from 'lucide-react';
import { Siswa } from '../types';

// Gracefully patch HTMLVideoElement.prototype.play globally to suppress play() promise interruption exceptions 
// caused by browser security when camera tracks are unmounted or changed mid-request.
if (typeof window !== 'undefined' && typeof HTMLVideoElement !== 'undefined') {
  const originalPlay = HTMLVideoElement.prototype.play;
  if (originalPlay && (originalPlay as any).__isPatched !== true) {
    const patchedPlay = function (this: HTMLVideoElement, ...args: any[]) {
      const promise = originalPlay.apply(this, args);
      if (promise && typeof promise.catch === 'function') {
        return promise.catch((err) => {
          const errMsg = err?.message || "";
          if (
            err?.name === "AbortError" || 
            errMsg.includes("interrupted") || 
            errMsg.includes("play() request") ||
            errMsg.includes("removed from the document")
          ) {
            console.warn("INFO: Suppressed play() interruption warning:", err);
          } else {
            return Promise.reject(err);
          }
        });
      }
      return promise;
    };
    (patchedPlay as any).__isPatched = true;
    (HTMLVideoElement.prototype as any).play = patchedPlay;
  }
}

interface ScannerComponentProps {
  onScanSuccess: (nis: string) => void;
  siswaList: Siswa[];
  todayLogs: any[];
}

export default function ScannerComponent({ onScanSuccess, siswaList, todayLogs }: ScannerComponentProps) {
  const [scannerActive, setScannerActive] = useState<boolean>(true);
  const [localCooldown, setLocalCooldown] = useState<boolean>(false);
  const cooldownRef = useRef<boolean>(false);
  const [cameraError, setCameraError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const onScanSuccessRef = useRef(onScanSuccess);

  // Update ref when prop changes
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  const isMountedRef = useRef<boolean>(true);
  const operationQueueRef = useRef<Promise<any>>(Promise.resolve());

  // Set mounted status for the absolute lifetime of this component
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const enqueueScannerOperation = (operation: () => Promise<void>) => {
    operationQueueRef.current = operationQueueRef.current
      .then(operation)
      .catch((error) => console.warn("Scanner operation failed in queue:", error));
  };

  const safeStopScanner = async () => {
    if (qrScannerRef.current) {
      if (qrScannerRef.current.isScanning) {
        try {
          await qrScannerRef.current.stop();
        } catch (err) {
          console.warn("Error stopping scanner in safeStopScanner:", err);
        }
      }
      qrScannerRef.current = null;
    }
    
    // Clear the container HTML fully to make sure there's zero leftover elements
    const container = document.getElementById("reader");
    if (container) {
      container.innerHTML = "";
    }
    
    setHasTorch(false);
    setTorchOn(false);
  };

  const safeStartScanner = async (deviceId: string) => {
    // Ensure any outstanding active scanning is first stopped cleanly
    await safeStopScanner();

    if (!isMountedRef.current) return;

    // Force empty container
    const container = document.getElementById("reader");
    if (container) {
      container.innerHTML = "";
    }

    try {
      const elementId = "reader";
      const mainScannerObj = new Html5Qrcode(elementId);
      qrScannerRef.current = mainScannerObj;

      const config = {
        fps: 30, // Extremely fast, smooth, near real-time scans (30 frames/sec)
        qrbox: (width: number, height: number) => {
          const smallest = Math.min(width, height);
          const size = Math.max(160, Math.floor(smallest * 0.75));
          return { width: size, height: size };
        },
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true // Employs instant hardware-accelerated QR scanning if supported
        }
      };

      const handleSuccessCallback = (decodedText: string) => {
        if (cooldownRef.current) return;

        cooldownRef.current = true;
        setLocalCooldown(true);

        playBeep();
        onScanSuccessRef.current(decodedText.trim());

        // Highly accurate responsive detection with a stable 3-second cooldown between student scans
        setTimeout(() => {
          cooldownRef.current = false;
          if (isMountedRef.current) {
            setLocalCooldown(false);
          }
        }, 3000);
      };

      const selectionConfig = deviceId 
        ? deviceId
        : { facingMode: "environment" };

      await mainScannerObj.start(
        selectionConfig,
        config,
        handleSuccessCallback,
        () => {} // Silent fail on standard unmatched frames to keep log empty
      );

      // If component unmounted while starting, do cleanup immediately
      if (!isMountedRef.current) {
        try {
          await mainScannerObj.stop();
        } catch (cleanupErr) {
          console.warn("Silent clean-up stop on unmounted state error:", cleanupErr);
        }
        return;
      }

      setCameraError(false);
      setErrorMessage('');

      // Safely check for flashlight capabilities on the running camera track
      try {
        const capabilities = mainScannerObj.getRunningTrackCapabilities();
        if (capabilities && 'torch' in capabilities) {
          setHasTorch(true);
          setTorchOn(false);
        } else {
          setHasTorch(false);
        }
      } catch {
        setHasTorch(false);
      }

    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.warn("Kamera start sequence failed: ", err);
      setCameraError(true);
      setErrorMessage(err.message || 'Kamera tidak ditemukan atau izin akses ditolak browser.');
    }
  };

  // Play synthetic scanner success tone (A5-Pitch Pure Sine Wave with rapid exponential decay)
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(950, audioCtx.currentTime); // pure alert frequency
      gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2); // sharp click/beep

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.2);
    } catch (error) {
      console.warn("Could not play feedback beep:", error);
    }
  };

  // Enumerate cameras on component load
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((cams) => {
        setDevices(cams);
        
        // Select back camera as preferred default if found
        const backCam = cams.find(c => 
          c.label.toLowerCase().includes('back') || 
          c.label.toLowerCase().includes('environment') || 
          c.label.toLowerCase().includes('rear') ||
          c.label.toLowerCase().includes('belakang')
        );
        if (backCam) {
          setSelectedDeviceId(backCam.id);
        } else if (cams.length > 0) {
          setSelectedDeviceId(cams[0].id);
        }
      })
      .catch((err) => {
        console.warn("Mendapatkan list kamera gagal via Html5Qrcode.getCameras, mencoba fallback:", err);
        
        // Fallback to standard enumerateDevices if getCameras has issues
        navigator.mediaDevices.enumerateDevices()
          .then((allDevices) => {
            const cams = allDevices.filter(d => d.kind === 'videoinput');
            setDevices(cams.map(c => ({ id: c.deviceId, label: c.label })));
            
            if (cams.length > 0) {
              const backCam = cams.find(c => 
                c.label.toLowerCase().includes('back') || 
                c.label.toLowerCase().includes('environment') || 
                c.label.toLowerCase().includes('rear') ||
                c.label.toLowerCase().includes('belakang')
              );
              setSelectedDeviceId(backCam ? backCam.deviceId : cams[0].deviceId);
            }
          })
          .catch((fallbackErr) => {
            console.warn("Mendapatkan list kamera gagal total:", fallbackErr);
          });
      });
  }, []);

  useEffect(() => {
    if (scannerActive) {
      enqueueScannerOperation(async () => {
        await safeStartScanner(selectedDeviceId);
      });
    } else {
      enqueueScannerOperation(async () => {
        await safeStopScanner();
      });
    }

    return () => {
      enqueueScannerOperation(async () => {
        await safeStopScanner();
      });
    };
  }, [scannerActive, selectedDeviceId]);

  // Safe exit from fullscreen with clean layout transition
  const exitFullscreen = () => {
    setIsFullscreen(false);
  };

  // Safe enter/toggle fullscreen with clean layout transition
  const handleFullscreenToggle = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Exit virtual fullscreen mode on Escape key press with clean camera transition
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        exitFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  const toggleTorch = async () => {
    if (qrScannerRef.current && qrScannerRef.current.isScanning && hasTorch) {
      try {
        const nextState = !torchOn;
        await qrScannerRef.current.applyVideoConstraints({
          advanced: [{ torch: nextState } as any]
        });
        setTorchOn(nextState);
      } catch (err) {
        console.warn("Flashlight control failed:", err);
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full" id="scanner-main-wrapper">
      
      {/* CAMERA DISCOVERY ELEMENT */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
            <h4 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Camera className="w-5 h-5 text-emerald-600 animate-pulse" />
              <span>Instan QR Scanner Presensi V2</span>
            </h4>
            
            <div className="flex gap-2 self-end sm:self-auto">
              {/* Sound Feedback Toggle */}
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-lg border transition-colors ${
                  soundEnabled 
                    ? 'bg-slate-50 text-emerald-600 border-slate-200 hover:bg-slate-100' 
                    : 'bg-slate-100 text-slate-400 border-slate-150 hover:bg-slate-150'
                }`}
                title={soundEnabled ? 'Suara Berhasil Aktif' : 'Suara Dimatikan'}
              >
                <Volume2 className="w-4 h-4" />
              </button>

              {/* Torch Toggle */}
              {hasTorch && scannerActive && (
                <button
                  onClick={toggleTorch}
                  className={`p-2 rounded-lg border transition-colors ${
                    torchOn 
                      ? 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-150' 
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                  }`}
                  title="Aktifkan Senter Kamera"
                >
                  {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                </button>
              )}

              {/* Fullscreen Toggle */}
              {scannerActive && (
                <button
                  onClick={handleFullscreenToggle}
                  className="text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200 active:scale-95"
                  title="Aktifkan Mode Layar Penuh"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Layar Penuh</span>
                </button>
              )}

              {/* Toggle On/Off State */}
              <button
                onClick={() => setScannerActive(!scannerActive)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
                  scannerActive 
                    ? 'bg-amber-50 text-amber-800 border border-amber-100 hover:bg-amber-100' 
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
                id="btn-toggle-scanner-state"
              >
                {scannerActive ? (
                  <>
                    <Square className="w-3.5 h-3.5" />
                    <span>Matikan</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Nyalakan</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* CAMERA DEVICELIST SELECTOR */}
          {devices.length > 1 && scannerActive && (
            <div className="mb-4 bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-bold shrink-0">Sumber Kamera:</span>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="w-full text-xs text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 hover:border-slate-300 transition-colors"
              >
                {devices.map((device, index) => (
                  <option key={device.id || device.deviceId} value={device.id || device.deviceId}>
                    {device.label || `Kamera ${index + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <p className="text-xs text-slate-500 mb-4 flex items-start gap-1.5">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>Versi Pemindai Tercanggih: Mendukung multi-kemudi sensor kamera, filter otomatis anti-duplikat scan, suara umpan balik beeper instan, serta pemecahan cahaya otomatis.</span>
          </p>
        </div>

        {/* READER STAGE CONTAINER WITH OVERLAY */}
        <div className={isFullscreen 
          ? "fixed inset-0 z-[9999] bg-slate-950/98 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 animate-fade-in"
          : "relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden flex flex-col items-center justify-center border-2 border-slate-800 shadow-inner"
        }>
          {/* Header ONLY in Fullscreen Mode - Unconditional DOM index to prevent unmounting camera sibling */}
          <div className={isFullscreen ? "text-center mb-5 max-w-sm sm:max-w-md animate-fade-in shrink-0 block" : "hidden"}>
            <h3 className="text-lg sm:text-2xl font-black text-white tracking-wider uppercase flex items-center justify-center gap-2">
              <Camera className="w-6 h-6 text-emerald-400 animate-pulse" />
              <span>Pemindai QR Siswa (Layar Penuh)</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Arahkan kartu QR siswa ke kamera untuk pemindaian instan
            </p>
          </div>

          {/* Camera Viewport Wrapper - Persistent Key & stable slot 2 */}
          <div 
            key="camera-viewport-wrapper"
            className={isFullscreen 
              ? "relative w-full max-w-2xl aspect-[4/3] sm:aspect-video bg-slate-900 border-4 border-emerald-500/40 rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(16,185,129,0.2)] flex flex-col items-center justify-center"
              : "w-full h-full relative flex flex-col items-center justify-center"
            }
          >
            {/* Keep reader permanently in DOM to prevent browser play() interruption exceptions when unmounting immediately */}
            <div 
              id="reader" 
              key="reader-element" 
              className={`w-full h-full object-cover [&_video]:object-cover [&_video]:w-full [&_video]:h-full border border-slate-800 rounded-lg ${scannerActive ? 'block' : 'hidden'}`}
            ></div>

            {!scannerActive && (
              <div className="text-center p-6 text-slate-400">
                <VideoOffPlaceholder message="Kamera dinonaktifkan sementara." />
              </div>
            )}

            {/* Cooldown Overlay */}
            {scannerActive && localCooldown && (
              <div className="absolute inset-0 bg-emerald-950/85 backdrop-blur-xs flex flex-col items-center justify-center text-center p-4 z-10 animate-fade-in">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mb-3 animate-bounce">
                  <Check className="w-6 h-6 text-emerald-400" />
                </div>
                <h5 className="font-bold text-emerald-300 text-sm">Presensi Terkirim</h5>
                <p className="text-[11px] text-emerald-400/85 mt-1 max-w-xs leading-normal">
                  Menyimpan data kehadiran. Mempersiapkan sensor untuk pemindaian berikutnya...
                </p>
              </div>
            )}

            {/* Fancy Laser Animated Target Guide Overlay */}
            {scannerActive && !cameraError && !localCooldown && (
              <div className="absolute inset-x-0 inset-y-0 pointer-events-none flex items-center justify-center">
                {/* Overlay Corners */}
                <div className={isFullscreen
                  ? "w-[240px] h-[240px] sm:w-[320px] sm:h-[320px] border-2 border-dashed border-emerald-400/30 rounded-2xl relative"
                  : "w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] border-2 border-dashed border-emerald-400/20 rounded-lg relative"
                }>
                  {/* Visual corners */}
                  <span className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-emerald-500 rounded-tl"></span>
                  <span className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-emerald-500 rounded-tr"></span>
                  <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-emerald-500 rounded-bl"></span>
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-emerald-500 rounded-br"></span>
                  
                  {/* Laser Scanning Loop line */}
                  <motion.div 
                    initial={{ top: '5%' }}
                    animate={{ top: '95%' }}
                    transition={{ 
                      duration: 2.0, 
                      repeat: Infinity, 
                      repeatType: "reverse", 
                      ease: "easeInOut" 
                    }}
                    className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                  />
                </div>
              </div>
            )}

            {cameraError && scannerActive && (
              <div className="absolute inset-0 bg-slate-900/95 p-6 flex flex-col items-center justify-center text-center">
                <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
                <h5 className="font-bold text-slate-100 text-sm">Masalah Akses Kamera</h5>
                <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                  {errorMessage || "Tidak dapat mengakses kamera. Pastikan izin kamera telah disetujui di browser."}
                </p>
                <button
                  onClick={() => {
                    setScannerActive(false);
                    setTimeout(() => setScannerActive(true), 200);
                  }}
                  className="mt-4 bg-emerald-600 text-white text-xs px-4 py-2 font-semibold rounded-lg hover:bg-emerald-700 flex items-center gap-1.5 transition-colors"
                  id="btn-re-init-camera"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Hubungkan Ulang</span>
                </button>
              </div>
            )}
          </div>

          {/* Footer and exit buttons ONLY in Fullscreen Mode - Unconditional DOM index, conditional visual visibility */}
          <div className={isFullscreen ? "mt-5 flex flex-col items-center gap-3 w-full max-w-2xl shrink-0 animate-fade-in block" : "hidden"}>
            <button
              onClick={exitFullscreen}
              className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs px-5 py-3 rounded-xl flex items-center gap-2 shadow-2xl transition-all tracking-wider uppercase"
            >
              <Minimize2 className="w-4 h-4" />
              <span>Keluar Layar Penuh (ESC)</span>
            </button>
          </div>
        </div>

        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            <span>Sensor Pemindai aktif berkelanjutan.</span>
          </div>
          {scannerActive && <span className="font-mono text-[10px] text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded">Ultra-Fast (30 Fps)</span>}
        </div>
      </div>

      {/* REAL-TIME LOG COMPONENT */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex flex-col justify-between" id="attendance-log-today-live">
        <div>
          <div className="flex items-center justify-between mb-4 border-b border-slate-150 pb-3">
            <h4 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-600" />
              <span>Log Presensi Masuk Hari Ini</span>
            </h4>
            <span className="bg-emerald-50 text-emerald-800 text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-md border border-emerald-100">
              Realtime Feed
            </span>
          </div>

          <p className="text-xs text-slate-500 mb-4">
            Daftar murid yang telah berhasil melakukan presensi hari ini menggunakan pemindai QR atau input absensi terkoordinasi.
          </p>

          <div className="max-h-[300px] overflow-y-auto text-xs divide-y divide-slate-100 border border-slate-100 rounded-xl bg-slate-50/30">
            {todayLogs.length === 0 ? (
              <div className="py-20 text-center text-slate-400 font-medium">
                Belum ada presensi yang terdeteksi hari ini.
              </div>
            ) : (
              todayLogs.map((log) => (
                <div key={log.id} className="p-3 flex justify-between items-center hover:bg-slate-50 transition-colors animate-fade-in">
                  <div>
                    <span className="font-bold text-slate-800 text-sm block">{log.nama}</span>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500 font-medium">
                      <span className="bg-slate-150 text-slate-700 px-1.5 py-0.5 rounded uppercase font-bold">{log.kelas}</span>
                      <span>•</span>
                      <span className="font-mono">{log.nis}</span>
                      {log.mataPelajaran && (
                        <>
                          <span>•</span>
                          <span className="text-teal-700 font-semibold bg-teal-50 px-1 py-0.5 rounded border border-teal-100/60">{log.mataPelajaran}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-100">
                      {log.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-4 text-[11px] text-slate-400 bg-slate-50/50 p-2.5 rounded-xl text-center border border-dashed border-slate-150">
          Siswa juga dapat melihat kartu riwayat mereka sendiri secara berkala.
        </div>
      </div>
    </div>
  );
}

function VideoOffPlaceholder({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center mb-2">
        <Square className="w-4 h-4 text-slate-500" />
      </div>
      <p className="text-xs font-semibold text-slate-500">{message}</p>
    </div>
  );
}

