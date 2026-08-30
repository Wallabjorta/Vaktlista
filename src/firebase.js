// Firebase configuration and services
// Install: npm install firebase

import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, query, where, onSnapshot } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

// ============ FIREBASE CONFIGURATION ============
// Your Firebase configuration for vaktlista-d0efd
const firebaseConfig = {
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
const db = getFirestore(app);
const auth = getAuth(app);

// ============ COLLECTION REFERENCES ============
const employeesCollection = collection(db, "employees");
const shiftsCollection = collection(db, "shifts");
const departmentsCollection = collection(db, "departments");
const usersCollection = collection(db, "users");
const notificationsCollection = collection(db, "notifications");

// ============ FIREBASE SERVICE FUNCTIONS ============

// ===== EMPLOYEES =====

/**
 * Get all employees
 * @returns {Promise<Array>} Array of employee objects
 */
export const getEmployees = async () => {
  try {
    const snapshot = await getDocs(employeesCollection);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    const docRef = doc(employeesCollection);
    await setDoc(docRef, employee);
    return { id: docRef.id, ...employee };
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
    const docRef = doc(db, "employees", id);
    await deleteDoc(docRef);
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
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    const docRef = doc(departmentsCollection);
    await setDoc(docRef, department);
    return { id: docRef.id, ...department };
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
    await updateDoc(docRef, updates);
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
    const docRef = doc(shiftsCollection);
    await setDoc(docRef, shift);
    return { id: docRef.id, ...shift };
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
    const docRef = doc(db, "shifts", id);
    await deleteDoc(docRef);
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
    const employees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    const shifts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    const departments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
          await addEmployee(emp);
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
          await addShift(shift);
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

// ============ EXPORT ============
export { db, auth, firebaseConfig };
