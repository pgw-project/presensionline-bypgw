import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  onSnapshot, 
  writeBatch,
  getDocFromServer,
  getCountFromServer
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Siswa, Guru, Kelas, AbsenLog, Sekolah, AppState } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

// Robust error handler matching the system skill requirements
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test on start
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    // Silently handle offline/unavailable states
  }
}

// ----------------------------------------
// GLOBAL SEKOLAH CRUD HELPERS
// ----------------------------------------

export async function dbSaveSekolah(sekolah: Sekolah) {
  const path = `sekolah/${sekolah.id}`;
  try {
    await setDoc(doc(db, 'sekolah', sekolah.id), sekolah);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function dbDeleteSekolah(id: string) {
  const path = `sekolah/${id}`;
  try {
    await deleteDoc(doc(db, 'sekolah', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ----------------------------------------
// MULTI-TENANT FIRESTORE CRUD HELPERS
// ----------------------------------------

export async function dbSaveSiswa(schoolId: string, siswa: Siswa) {
  const path = `schools/${schoolId}/siswa/${siswa.nis}`;
  try {
    await setDoc(doc(db, 'schools', schoolId, 'siswa', siswa.nis), siswa);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function dbDeleteSiswa(schoolId: string, nis: string) {
  const path = `schools/${schoolId}/siswa/${nis}`;
  try {
    // Delete from student details
    await deleteDoc(doc(db, 'schools', schoolId, 'siswa', nis));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function dbSaveGuru(schoolId: string, guru: Guru) {
  const path = `schools/${schoolId}/guru/${guru.nip}`;
  try {
    await setDoc(doc(db, 'schools', schoolId, 'guru', guru.nip), guru);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function dbDeleteGuru(schoolId: string, nip: string) {
  const path = `schools/${schoolId}/guru/${nip}`;
  try {
    await deleteDoc(doc(db, 'schools', schoolId, 'guru', nip));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function dbSaveKelas(schoolId: string, kelas: Kelas) {
  const path = `schools/${schoolId}/kelas/${kelas.namaKelas}`;
  try {
    await setDoc(doc(db, 'schools', schoolId, 'kelas', kelas.namaKelas), kelas);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function dbDeleteKelas(schoolId: string, namaKelas: string) {
  const path = `schools/${schoolId}/kelas/${namaKelas}`;
  try {
    await deleteDoc(doc(db, 'schools', schoolId, 'kelas', namaKelas));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function dbSaveAbsen(schoolId: string, absen: AbsenLog) {
  const path = `schools/${schoolId}/absensi/${absen.id}`;
  try {
    await setDoc(doc(db, 'schools', schoolId, 'absensi', absen.id), absen);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function dbDeleteAbsen(schoolId: string, id: string) {
  const path = `schools/${schoolId}/absensi/${id}`;
  try {
    await deleteDoc(doc(db, 'schools', schoolId, 'absensi', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Seeding DB if collections are completely uninitialized for this school
export async function seedInitialDataIfEmpty(
  schoolId: string,
  initialSiswa: Siswa[],
  initialGuru: Guru[],
  initialKelas: Kelas[],
  initialAbsensi: AbsenLog[]
) {
  if (!schoolId) return;
  try {
    const sekolahDoc = await getDoc(doc(db, 'sekolah', schoolId));
    if (sekolahDoc.exists() && sekolahDoc.data().allowEmpty === true) {
      // The administrator explicitly requested this school to remain empty/clean (0 documents count)
      return;
    }

    const siswaSnap = await getDocs(collection(db, 'schools', schoolId, 'siswa'));
    const guruSnap = await getDocs(collection(db, 'schools', schoolId, 'guru'));
    const kelasSnap = await getDocs(collection(db, 'schools', schoolId, 'kelas'));

    const batch = writeBatch(db);
    let dirty = false;

    if (siswaSnap.empty) {
      initialSiswa.forEach(s => {
        batch.set(doc(db, 'schools', schoolId, 'siswa', s.nis), s);
      });
      dirty = true;
    }

    if (guruSnap.empty) {
      initialGuru.forEach(g => {
        batch.set(doc(db, 'schools', schoolId, 'guru', g.nip), g);
      });
      dirty = true;
    }

    if (kelasSnap.empty) {
      initialKelas.forEach(k => {
        batch.set(doc(db, 'schools', schoolId, 'kelas', k.namaKelas), k);
      });
      dirty = true;
    }

    // Since Absensi might be empty naturally, we only seed if we had to seed standard entities
    const absensiSnap = await getDocs(collection(db, 'schools', schoolId, 'absensi'));
    if (absensiSnap.empty && dirty) {
      initialAbsensi.forEach(a => {
        batch.set(doc(db, 'schools', schoolId, 'absensi', a.id), a);
      });
    }

    if (dirty) {
      await batch.commit();
      console.log(`Successfully seeded school "${schoolId}" with initial presets.`);
    }
  } catch (error) {
    const isOffline = error instanceof Error && (
      error.message.toLowerCase().includes('offline') ||
      error.message.toLowerCase().includes('could not reach') ||
      error.message.toLowerCase().includes('network') ||
      error.message.toLowerCase().includes('connection')
    );

    if (isOffline) {
      console.warn(`Skipping automatic background school database seed check for "${schoolId}" because Firebase client is currently offline.`);
      return;
    }

    handleFirestoreError(error, OperationType.WRITE, `seed_operation_${schoolId}`);
  }
}

// Maintenance operations: clear tables for school
export async function dbClearAllAbsensi(schoolId: string) {
  try {
    const snap = await getDocs(collection(db, 'schools', schoolId, 'absensi'));
    const batch = writeBatch(db);
    snap.docs.forEach(d => {
      batch.delete(d.ref);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `schools/${schoolId}/absensi`);
  }
}

// Reset entire school database to factory seeding or clear completely
export async function dbResetToFactorySeed(
  schoolId: string,
  factorySiswa: Siswa[],
  factoryGuru: Guru[],
  factoryKelas: Kelas[],
  factoryAbsensi: AbsenLog[],
  allowEmpty: boolean = false
) {
  try {
    // Delete existing documents
    const siswaSnap = await getDocs(collection(db, 'schools', schoolId, 'siswa'));
    const guruSnap = await getDocs(collection(db, 'schools', schoolId, 'guru'));
    const kelasSnap = await getDocs(collection(db, 'schools', schoolId, 'kelas'));
    const absensiSnap = await getDocs(collection(db, 'schools', schoolId, 'absensi'));

    let batch = writeBatch(db);
    siswaSnap.docs.forEach(d => batch.delete(d.ref));
    guruSnap.docs.forEach(d => batch.delete(d.ref));
    kelasSnap.docs.forEach(d => batch.delete(d.ref));
    absensiSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();

    // Update the 'sekolah' doc with the allowEmpty flag
    const schoolRef = doc(db, 'sekolah', schoolId);
    const schoolDoc = await getDoc(schoolRef);
    if (schoolDoc.exists()) {
      await setDoc(schoolRef, { ...schoolDoc.data(), allowEmpty }, { merge: true });
    }

    if (!allowEmpty) {
      // Insert factory data
      batch = writeBatch(db);
      factorySiswa.forEach(s => batch.set(doc(db, 'schools', schoolId, 'siswa', s.nis), s));
      factoryGuru.forEach(g => batch.set(doc(db, 'schools', schoolId, 'guru', g.nip), g));
      factoryKelas.forEach(k => batch.set(doc(db, 'schools', schoolId, 'kelas', k.namaKelas), k));
      factoryAbsensi.forEach(a => batch.set(doc(db, 'schools', schoolId, 'absensi', a.id), a));
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `reset_database_${schoolId}`);
  }
}

// Fetch total document statistics for a specific school (e.g., student counts, etc.)
export async function dbGetSchoolStatistics(schoolId: string) {
  try {
    const siswaCount = await getCountFromServer(collection(db, 'schools', schoolId, 'siswa'));
    const guruCount = await getCountFromServer(collection(db, 'schools', schoolId, 'guru'));
    const kelasCount = await getCountFromServer(collection(db, 'schools', schoolId, 'kelas'));
    const absensiCount = await getCountFromServer(collection(db, 'schools', schoolId, 'absensi'));

    return {
      siswa: siswaCount.data().count,
      guru: guruCount.data().count,
      kelas: kelasCount.data().count,
      absensi: absensiCount.data().count,
    };
  } catch (error) {
    console.error(`Gagal mengambil statistik untuk sekolah ${schoolId}:`, error);
    return { siswa: 0, guru: 0, kelas: 0, absensi: 0 };
  }
}
