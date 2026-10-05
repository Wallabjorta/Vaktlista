// Firebase configuration and services
// Install: npm install firebase

import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, getDoc, getDocs, setDoc, addDoc, deleteDoc, updateDoc, query, where, onSnapshot, writeBatch } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

// ============ FIREBASE CONFIGURATION ============
// Config is environment-driven so a separate test/staging environment can point
// at its own Firebase project. Provide VITE_FIREBASE_CONFIG as a JSON string with
// the web app config from the staging Firebase console. Falls back to the live
// config (vaktlista-d0efd) when unset, so production behaviour is unchanged.
const firebaseConfig = import.meta.env.VITE_FIREBASE_CONFIG
  ? JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG)
  : {
      apiKey: "AIzaSyCW0p942dGWKCVvQCwb2_y3PpAQSXN1ArU",
      authDomain: "vaktlista-d0efd.firebaseapp.com",
      projectId: "vaktlista-d0efd",
      storageBucket: "vaktlista-d0efd.firebasestorage.app",
      messagingSenderId: "627526854242",
      appId: "1:627526854242:web:b7d5d4e7c66a1a708e933b",
      measurementId: "G-S5EEYJ05GP"
    };

// ============ INITIALIZE FIREBASE ============
const app = initializeApp(firebaseConfig);
// Offline-persistence: läsningar betjänas från lokal cache när data inte
// ändrats, vilket kraftigt minskar antalet Firestore-reads för återkommande
// användare (viktigt för att hålla sig under gratisplanens dagliga kvot).
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
const auth = getAuth(app);

// Cloud Functions URL for iCal endpoints. Derived from the active project ID so
// staging points at its own functions automatically. Overridable via VITE_API_URL.
const functionsUrl =
  import.meta.env.VITE_API_URL ||
  `https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net`;


const employeesCollection = collection(db, "employees");
const shiftsCollection = collection(db, "shifts");
const departmentsCollection = collection(db, "departments");
const usersCollection = collection(db, "users");
const notificationsCollection = collection(db, "notifications");
const leaveRequestsCollection = collection(db, "leaveRequests");
const swapRequestsCollection = collection(db, "swapRequests");
const auditLogsCollection = collection(db, "auditLogs");
const groupEventsCollection = collection(db, "groupEvents");
const revenueCollection = collection(db, "revenues");

// ===== STAFFING CONFIG =====

const STAFFING_CONFIG_DOC = "staffingConfig";

/**
 * Hämta bemanningskonfiguration (trösklar)
 * @returns {Promise<Object>} { minimumStaff, thresholds: [{ minRevenue, staff, label }] }
 */
export const getStaffingConfig = async () => {
  try {
    const snap = await getDoc(doc(db, "staffingConfig", STAFFING_CONFIG_DOC));
    if (!snap.exists()) {
      return {
        minimumStaff: 2,
        thresholds: [
          { minRevenue: 0, staff: 2, label: 'Lav' },
          { minRevenue: 25000, staff: 4, label: 'Middels' },
          { minRevenue: 40000, staff: 6, label: 'Høy' }
        ]
      };
    }
    return snap.data();
  } catch (error) {
    console.error("Error getting staffing config:", error);
    return null;
  }
};

/**
 * Spara bemanningskonfiguration
 * @param {Object} config
 */
export const saveStaffingConfig = async (config) => {
  try {
    await setDoc(doc(db, "staffingConfig", STAFFING_CONFIG_DOC), config);
    return true;
  } catch (error) {
    console.error("Error saving staffing config:", error);
    throw error;
  }
};

/**
 * Prenumerera på bemanningskonfiguration i realtid
 */
export const subscribeToStaffingConfig = (callback) => {
  return onSnapshot(doc(db, "staffingConfig", STAFFING_CONFIG_DOC), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
};

// ===== REVENUE (omsättning per dag) =====

/**
 * Importera daglig omsättning (ersätter befintliga poster för samma datum)
 * @param {Array} entries - [{ date: 'YYYY-MM-DD', amount: number }]
 */
export const importRevenues = async (entries, location = null) => {
  const batch = writeBatch(db);
  for (const entry of entries) {
    const docId = location ? `${location}_${entry.date}` : entry.date;
    const ref = doc(db, "revenues", docId);
    const data = { date: entry.date, amount: entry.amount };
    if (location) data.location = location;
    batch.set(ref, data, { merge: true });
  }
  await batch.commit();
  return entries.length;
};

/**
 * Spara/uppdatera en enskild dags omsättning
 */
export const saveRevenue = async (date, amount, location = null) => {
  try {
    const docId = location ? `${location}_${date}` : date;
    const data = { date, amount: Number(amount) };
    if (location) data.location = location;
    await setDoc(doc(db, "revenues", docId), data, { merge: true });
    return true;
  } catch (error) {
    console.error("Error saving revenue:", error);
    throw error;
  }
};

/**
 * Ta bort en dags omsättning
 */
export const deleteRevenue = async (date, location = null) => {
  try {
    const docId = location ? `${location}_${date}` : date;
    await deleteDoc(doc(db, "revenues", docId));
  } catch (error) {
    console.error("Error deleting revenue:", error);
    throw error;
  }
};

/**
 * Prenumerera på all omsättningsdata i realtid
 */
/**
 * Rensa omsättningsdata. Utan location raderas ALL data;
 * med location raderas endast den platsens poster.
 * @param {string|null} location - 'st' | 'øst' | null (allt)
 * @returns {Promise<number>} Antal raderade poster
 */
export const clearRevenues = async (location = null) => {
  const snapshot = await getDocs(revenueCollection);
  const toDelete = snapshot.docs.filter(d => {
    const data = d.data();
    if (location) return data.location === location;
    return true;
  });
  const batch = writeBatch(db);
  for (const d of toDelete) {
    batch.delete(d.ref);
  }
  await batch.commit();
  return toDelete.length;
};

export const subscribeToRevenues = (callback) => {
  return onSnapshot(revenueCollection, (snapshot) => {
    const revenues = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(revenues);
  });
};

/**
 * Räkna fram rekommenderad bemanning utifrån konfiguration
 * @param {number} amount
 * @param {Object} config
 * @returns {Object} { staff, label, source }
 */
export const recommendStaffing = (amount, config) => {
  if (amount == null || isNaN(amount)) return { staff: null, label: '', source: null };
  if (!config) return { staff: null, label: '', source: null };

  let staff = config.minimumStaff || 0;
  let label = '';
  if (Array.isArray(config.thresholds) && config.thresholds.length > 0) {
    const sorted = [...config.thresholds].sort((a, b) => (a.minRevenue || 0) - (b.minRevenue || 0));
    for (const t of sorted) {
      if (amount >= (t.minRevenue || 0) && (t.staff || 0) >= staff) {
        staff = t.staff;
        label = t.label || '';
      }
    }
  }

  return { staff, label, source: 'threshold' };
};

// ===== GROUP EVENTS =====

/**
 * Subscribe to realtime updates for group events (hente/levere-datoer per gruppe)
 * @param {Function} callback - Callback function with array of group events
 * @returns {Function} Unsubscribe function
 */
export const subscribeToGroupEvents = (callback) => {
  return onSnapshot(groupEventsCollection, (snapshot) => {
    const events = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    callback(events);
  });
};

/**
 * Legg til et nytt grupperevent
 * @param {Object} event - { groupName, pickupDate, dropoffDate, contact, participants, notes, color }
 * @returns {Promise<Object>} Det lagrede eventet med id
 */
export const addGroupEvent = async (event) => {
  try {
    const docRef = await addDoc(groupEventsCollection, event);
    return { ...event, id: docRef.id };
  } catch (error) {
    console.error("Error adding group event:", error);
    throw error;
  }
};

/**
 * Oppdater et grupperevent
 * @param {string} id - Dokument-ID
 * @param {Object} updates - Felt som skal oppdateres
 * @returns {Promise<boolean>} Success status
 */
export const updateGroupEvent = async (id, updates) => {
  try {
    const docRef = doc(db, "groupEvents", id);
    await setDoc(docRef, updates, { merge: true });
    return true;
  } catch (error) {
    console.error("Error updating group event:", error);
    throw error;
  }
};

/**
 * Slett et grupperevent
 * @param {string} id - Dokument-ID
 */
export const deleteGroupEvent = async (id) => {
  try {
    await deleteDoc(doc(db, "groupEvents", id));
  } catch (error) {
    console.error("Error deleting group event:", error);
    throw error;
  }
};

// ============ FIREBASE SERVICE FUNCTIONS ============

// ===== AUDIT LOG =====
/**
 * Logg en adminhandling i auditLogs-samlingen. Best-effort: feil logges kun til konsollen.
 * @param {Object} admin - Innlogget admin (krever id og name)
 * @param {string} action - Handling: 'shift_add' | 'shift_update' | 'shift_delete' | 'employee_add' | 'employee_update' | 'employee_delete' | 'department_add' | 'department_update' | 'department_delete' | 'leave_status' | 'swap_status'
 * @param {Object} details - Fritekstdetaljer om handlingen
 */
const removeUndefined = (obj) => {
  const out = {};
  for (const [key, value] of Object.entries(obj || {})) {
    if (value !== undefined) out[key] = value;
  }
  return out;
};

export const logAdminAction = async (admin, action, details = {}) => {
  if (!admin || !admin.isAdmin) return;
  try {
    await addDoc(auditLogsCollection, removeUndefined({
      adminId: admin.id,
      adminName: admin.name,
      action,
      details: removeUndefined(details),
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    console.error("Error writing audit log:", error);
  }
};

/**
 * Hent alle adminhendelser (nyeste først)
 * @returns {Promise<Array>} Array av loggobjekter
 */
export const getAuditLogs = async () => {
  try {
    const snapshot = await getDocs(auditLogsCollection);
    return snapshot.docs
      .map(d => {
        const data = d.data();
        let ts = data.timestamp;
        if (ts && typeof ts.toDate === "function") {
          ts = ts.toDate().toISOString();
        }
        if (ts instanceof Date) {
          ts = ts.toISOString();
        }
        if (ts && !String(ts).includes("T")) {
          ts = new Date(ts).toISOString();
        }
        return { id: d.id, ...data, timestamp: ts };
      })
      .sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
  } catch (error) {
    console.error("Error getting audit logs:", error);
    return [];
  }
};

// ===== EMPLOYEES =====

/**
 * Get all employees
 * @returns {Promise<Array>} Array of employee objects
 */
export const getEmployees = async () => {
  try {
    const snapshot = await getDocs(employeesCollection);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
  } catch (error) {
    console.error("Error getting employees:", error);
    return [];
  }
};

/**
 * Get a single employee by ID
 * @param {string} id - Employee ID
 * @returns {Promise<Object|null>} Employee object or null
 */
export const getEmployeeById = async (id) => {
  try {
    const docRef = doc(db, "employees", id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  } catch (error) {
    console.error("Error getting employee:", error);
    return null;
  }
};

/**
 * Add a new employee
 * @param {Object} employee - Employee data
 * @returns {Promise<Object>} The created employee with ID
 */
export const addEmployee = async (employee) => {
  try {
    const docRef = await addDoc(employeesCollection, employee);
    return { ...employee, id: docRef.id };
  } catch (error) {
    console.error("Error adding employee:", error);
    throw error;
  }
};

/**
 * Update an employee (creates if doesn't exist)
 * @param {string} id - Employee ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<boolean>} Success status
 */
export const updateEmployee = async (id, updates) => {
  try {
    const docRef = doc(db, "employees", id);
    await setDoc(docRef, updates, { merge: true });
    return true;
  } catch (error) {
    console.error("Error updating employee:", error);
    throw error;
  }
};

/**
 * Delete an employee
 * @param {string} id - Employee ID
 * @returns {Promise<boolean>} Success status
 */
export const deleteEmployee = async (id) => {
  try {
    console.log("Deleting employee with ID:", id);
    const docRef = doc(db, "employees", id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      console.error("Employee document does not exist:", id);
      throw new Error(`Employee with ID ${id} does not exist in Firestore`);
    }
    await deleteDoc(docRef);
    console.log("Successfully deleted employee:", id);
    return true;
  } catch (error) {
    console.error("Error deleting employee:", error);
    throw error;
  }
};

// ===== SHIFTS =====

/**
 * Get all shifts
 * @returns {Promise<Array>} Array of shift objects
 */
export const getShifts = async () => {
  try {
    const snapshot = await getDocs(shiftsCollection);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
  } catch (error) {
    console.error("Error getting shifts:", error);
    return [];
  }
};

/**
 * Get shifts for a specific employee
 * @param {string} employeeId - Employee ID
 * @returns {Promise<Array>} Array of shift objects
 */
export const getShiftsByEmployee = async (employeeId) => {
  try {
    const q = query(shiftsCollection, where("employeeId", "==", employeeId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  } catch (error) {
    console.error("Error getting shifts by employee:", error);
    return [];
  }
};

/**
 * Get shifts for a specific department
 * @param {string} departmentId - Department ID
 * @returns {Promise<Array>} Array of shift objects
 */
export const getShiftsByDepartment = async (departmentId) => {
  try {
    const q = query(shiftsCollection, where("departmentId", "==", departmentId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  } catch (error) {
    console.error("Error getting shifts by department:", error);
    return [];
  }
};

// ===== DEPARTMENTS =====

/**
 * Get all departments
 * @returns {Promise<Array>} Array of department objects
 */
export const getDepartments = async () => {
  try {
    const snapshot = await getDocs(departmentsCollection);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  } catch (error) {
    console.error("Error getting departments:", error);
    return [];
  }
};

/**
 * Get a single department by ID
 * @param {string} id - Department ID
 * @returns {Promise<Object|null>} Department object or null
 */
export const getDepartmentById = async (id) => {
  try {
    const docRef = doc(db, "departments", id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  } catch (error) {
    console.error("Error getting department:", error);
    return null;
  }
};

/**
 * Add a new department
 * @param {Object} department - Department data (name, color)
 * @returns {Promise<Object>} The created department with ID
 */
export const addDepartment = async (department) => {
  try {
    const id = department.id || doc(departmentsCollection).id;
    await setDoc(doc(db, "departments", id), { ...department, id });
    return { id, ...department };
  } catch (error) {
    console.error("Error adding department:", error);
    throw error;
  }
};

/**
 * Update a department
 * @param {string} id - Department ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<boolean>} Success status
 */
export const updateDepartment = async (id, updates) => {
  try {
    const docRef = doc(db, "departments", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      await updateDoc(docRef, updates);
    } else {
      await setDoc(docRef, { ...updates, id }, { merge: true });
    }
    return true;
  } catch (error) {
    console.error("Error updating department:", error);
    throw error;
  }
};

/**
 * Delete a department
 * @param {string} id - Department ID
 * @returns {Promise<boolean>} Success status
 */
export const normalizeDepartments = async () => {
  try {
    const snapshot = await getDocs(departmentsCollection);
    const all = snapshot.docs.map(d => ({ docId: d.id, data: d.data() }));
    const docIds = new Set(all.map(x => x.docId));
    const keep = new Set();
    let changed = false;
    for (const { docId, data } of all) {
      const stableId = data.id || docId;
      const name = (data.name || '').trim();
      // Ta bort dokument utan namn (skräp från misslyckade försök)
      if (!name) {
        await deleteDoc(doc(db, "departments", docId));
        docIds.delete(docId);
        changed = true;
        continue;
      }
      // Flytta auto-ID-dokument till stabilt ID
      if (docId !== stableId) {
        if (!docIds.has(stableId) && !keep.has(stableId)) {
          await setDoc(doc(db, "departments", stableId), data, { merge: true });
          docIds.add(stableId);
          keep.add(stableId);
        }
        await deleteDoc(doc(db, "departments", docId));
        docIds.delete(docId);
        changed = true;
        continue;
      }
      keep.add(stableId);
    }
    // Ta bort dubbletter: samma stabila ID behålls bara en gång (först träffad behålls)
    const seenIds = new Set();
    for (const { docId, data } of all) {
      const stableId = data.id || docId;
      if (!keep.has(stableId)) continue;
      if (seenIds.has(stableId)) {
        await deleteDoc(doc(db, "departments", docId));
        docIds.delete(docId);
        changed = true;
      } else {
        seenIds.add(stableId);
      }
    }
    return changed;
  } catch (error) {
    console.error("Error normalizing departments:", error);
    return false;
  }
};

/**
 * Delete a department
 * @param {string} id - Department ID
 * @returns {Promise<boolean>} Success status
 */
export const deleteDepartment = async (id) => {
  try {
    // Check if any employees are using this department
    const employeesSnapshot = await getDocs(query(employeesCollection, where("deptIds", "array-contains", id)));
    if (!employeesSnapshot.empty) {
      throw new Error("Cannot delete department: employees are assigned to it");
    }
    
    // Check if any shifts are using this department
    const shiftsSnapshot = await getDocs(query(shiftsCollection, where("departmentId", "==", id)));
    if (!shiftsSnapshot.empty) {
      throw new Error("Cannot delete department: shifts are assigned to it");
    }
    
    const docRef = doc(db, "departments", id);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error("Error deleting department:", error);
    throw error;
  }
};

// ===== SHIFTS =====

/**
 * Add a new shift
 * @param {Object} shift - Shift data
 * @returns {Promise<Object>} The created shift with ID
 */
export const addShift = async (shift) => {
  try {
    const docRef = await addDoc(shiftsCollection, shift);
    return { ...shift, id: docRef.id };
  } catch (error) {
    console.error("Error adding shift:", error);
    throw error;
  }
};

/**
 * Update a shift
 * @param {string} id - Shift ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<boolean>} Success status
 */
export const updateShift = async (id, updates) => {
  try {
    const docRef = doc(db, "shifts", id);
    await updateDoc(docRef, updates);
    return true;
  } catch (error) {
    console.error("Error updating shift:", error);
    throw error;
  }
};

/**
 * Delete a shift
 * @param {string} id - Shift ID
 * @returns {Promise<boolean>} Success status
 */
export const deleteShift = async (id) => {
  try {
    console.log("Deleting shift with ID:", id);
    const docRef = doc(db, "shifts", id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      console.error("Shift document does not exist:", id);
      throw new Error(`Shift with ID ${id} does not exist in Firestore`);
    }
    await deleteDoc(docRef);
    console.log("Successfully deleted shift:", id);
    return true;
  } catch (error) {
    console.error("Error deleting shift:", error);
    throw error;
  }
};

// ===== USERS / AUTHENTICATION =====

/**
 * Sign in with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} User credential
 */
export const signIn = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential;
  } catch (error) {
    console.error("Error signing in:", error);
    throw error;
  }
};

/**
 * Sign out current user
 * @returns {Promise<void>}
 */
export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};

/**
 * Get current authenticated user
 * @returns {Promise<Object|null>} User object or null
 */
export const getCurrentUser = () => {
  return auth.currentUser;
};

/**
 * Subscribe to auth state changes
 * @param {Function} callback - Callback function with user or null
 * @returns {Function} Unsubscribe function
 */
export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// ===== REALTIME SUBSCRIPTIONS =====

/**
 * Subscribe to realtime updates for employees
 * @param {Function} callback - Callback function with array of employees
 * @returns {Function} Unsubscribe function
 */
export const subscribeToEmployees = (callback) => {
  return onSnapshot(employeesCollection, (snapshot) => {
    const employees = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    callback(employees);
  });
};

/**
 * Subscribe to realtime updates for shifts
 * @param {Function} callback - Callback function with array of shifts
 * @returns {Function} Unsubscribe function
 */
export const subscribeToShifts = (callback) => {
  return onSnapshot(shiftsCollection, (snapshot) => {
    const shifts = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    callback(shifts);
  });
};

/**
 * Subscribe to realtime updates for departments
 * @param {Function} callback - Callback function with array of departments
 * @returns {Function} Unsubscribe function
 */
export const subscribeToDepartments = (callback) => {
  return onSnapshot(departmentsCollection, (snapshot) => {
    const departments = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    callback(departments);
  });
};

// ===== DATA MIGRATION FROM LOCALSTORAGE =====

/**
 * Migrate data from localStorage to Firebase
 * @returns {Promise<Object>} Migration result
 */
export const migrateFromLocalStorage = async () => {
  const result = { employees: 0, shifts: 0, errors: [] };
  
  try {
    // Migrate employees
    const localEmployees = localStorage.getItem('employees');
    if (localEmployees) {
      const employees = JSON.parse(localEmployees);
      for (const emp of employees) {
        try {
          const { id, ...data } = emp;
          if (!id) continue;
          await setDoc(doc(db, "employees", String(id)), data, { merge: true });
          result.employees++;
        } catch (error) {
          result.errors.push(`Failed to migrate employee ${emp.id}: ${error.message}`);
        }
      }
    }
    
    // Migrate shifts
    const localShifts = localStorage.getItem('shifts');
    if (localShifts) {
      const shifts = JSON.parse(localShifts);
      for (const shift of shifts) {
        try {
          const { id, ...data } = shift;
          if (!id) continue;
          await setDoc(doc(db, "shifts", String(id)), data, { merge: true });
          result.shifts++;
        } catch (error) {
          result.errors.push(`Failed to migrate shift ${shift.id}: ${error.message}`);
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error("Migration error:", error);
    result.errors.push(`Migration failed: ${error.message}`);
    return result;
  }
};

// ============ LEAVE & SWAP REQUESTS ============

// ============ LEAVE REQUESTS ============

export const addLeaveRequest = async (request) => {
  try {
    const docRef = doc(leaveRequestsCollection);
    await setDoc(docRef, {
      ...request,
      createdAt: new Date().toISOString(),
      status: 'pending',
      updatedAt: new Date().toISOString()
    });
    return { id: docRef.id, ...request };
  } catch (error) {
    console.error("Error adding leave request:", error);
    throw error;
  }
};

export const getLeaveRequests = async () => {
  try {
    const snapshot = await getDocs(leaveRequestsCollection);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  } catch (error) {
    console.error("Error getting leave requests:", error);
    return [];
  }
};

export const getLeaveRequestsByEmployee = async (employeeId) => {
  try {
    const q = query(leaveRequestsCollection, where("employeeId", "==", employeeId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  } catch (error) {
    console.error("Error getting leave requests by employee:", error);
    return [];
  }
};

export const updateLeaveRequestStatus = async (id, status, adminId) => {
  try {
    const docRef = doc(db, "leaveRequests", id);
    await updateDoc(docRef, {
      status,
      updatedAt: new Date().toISOString(),
      handledBy: adminId,
      handledAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error("Error updating leave request:", error);
    throw error;
  }
};

export const deleteLeaveRequest = async (id) => {
  try {
    await deleteDoc(doc(db, "leaveRequests", id));
    return true;
  } catch (error) {
    console.error("Error deleting leave request:", error);
    throw error;
  }
};

// ============ SWAP REQUESTS ============

export const addSwapRequest = async (request) => {
  try {
    const docRef = doc(swapRequestsCollection);
    await setDoc(docRef, {
      ...request,
      createdAt: new Date().toISOString(),
      status: 'pending',
      updatedAt: new Date().toISOString()
    });
    return { id: docRef.id, ...request };
  } catch (error) {
    console.error("Error adding swap request:", error);
    throw error;
  }
};

export const getSwapRequests = async () => {
  try {
    const snapshot = await getDocs(swapRequestsCollection);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  } catch (error) {
    console.error("Error getting swap requests:", error);
    return [];
  }
};

export const getSwapRequestsByEmployee = async (employeeId) => {
  try {
    const q = query(swapRequestsCollection, where("employeeId", "==", employeeId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  } catch (error) {
    console.error("Error getting swap requests by employee:", error);
    return [];
  }
};

export const updateSwapRequestStatus = async (id, status, adminId) => {
  try {
    const docRef = doc(db, "swapRequests", id);
    await updateDoc(docRef, {
      status,
      updatedAt: new Date().toISOString(),
      handledBy: adminId,
      handledAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error("Error updating swap request:", error);
    throw error;
  }
};

export const approveSwapRequest = async (requestId, adminId) => {
  try {
    const requestDoc = doc(db, "swapRequests", requestId);
    const requestSnap = await getDoc(requestDoc);
    
    if (!requestSnap.exists()) {
      throw new Error("Swap request not found");
    }
    
    const request = requestSnap.data();
    
    if (request.status !== 'pending') {
      throw new Error("Swap request already processed");
    }
    
    const { employeeId, originalDate, targetEmployeeId, targetDate, targetEmployeeName, employeeName, departmentId } = request;
    
    const batch = writeBatch(db);
    
    const originalShiftQuery = query(
      shiftsCollection,
      where("employeeId", "==", employeeId),
      where("date", "==", originalDate)
    );
    const originalShiftSnapshot = await getDocs(originalShiftQuery);
    
    if (!originalShiftSnapshot.empty) {
      const originalShiftDoc = originalShiftSnapshot.docs[0];
      const originalShiftData = originalShiftDoc.data();
      
      batch.delete(originalShiftDoc.ref);
      
      const newShiftRef = doc(shiftsCollection);
      batch.set(newShiftRef, {
        ...originalShiftData,
        id: newShiftRef.id,
        employeeId: targetEmployeeId,
        employeeName: targetEmployeeName || "Ukjent",
        date: targetDate
      });
    }
    
    batch.update(requestDoc, {
      status: "approved",
      updatedAt: new Date().toISOString(),
      handledBy: adminId,
      handledAt: new Date().toISOString()
    });
    
    await batch.commit();
    return true;
  } catch (error) {
    console.error("Error approving swap request:", error);
    throw error;
  }
};

export const rejectSwapRequest = async (requestId, adminId) => {
  try {
    const requestDoc = doc(db, "swapRequests", requestId);
    await updateDoc(requestDoc, {
      status: "rejected",
      updatedAt: new Date().toISOString(),
      handledBy: adminId,
      handledAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error("Error rejecting swap request:", error);
    throw error;
  }
};

export const deleteSwapRequest = async (id) => {
  try {
    await deleteDoc(doc(db, "swapRequests", id));
    return true;
  } catch (error) {
    console.error("Error deleting swap request:", error);
    throw error;
  }
};

// ============ EXPORT ============
export { db, auth, firebaseConfig, functionsUrl };
