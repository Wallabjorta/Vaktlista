// Custom hook for managing Firebase data in React components
// Usage: const { employees, shifts, loading, error, addEmployee, addShift, ... } = useFirebaseData();

import { useState, useEffect, useCallback } from 'react';
import {
  getEmployees,
  getShifts,
  addEmployee,
  updateEmployee,
  deleteEmployee,
  addShift,
  updateShift,
  deleteShift,
  subscribeToEmployees,
  subscribeToShifts,
  migrateFromLocalStorage
} from '../firebase';

const DEPARTMENTS = [
  { id: "dept-1", name: "Vest", color: "#3B82F6" },
  { id: "dept-2", name: "Øst", color: "#10B981" },
  { id: "dept-3", name: "Skiskole", color: "#F59E0B" },
  { id: "dept-4", name: "Butikk", color: "#EF4444" },
  { id: "dept-5", name: "Skolegrupper", color: "#8B5CF6" }
];

export default function useFirebaseData() {
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [migrated, setMigrated] = useState(false);

  // Load initial data from Firebase
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Check if we should migrate from localStorage
      const hasLocalData = localStorage.getItem('employees') || localStorage.getItem('shifts');
      const hasFirebaseData = false; // We'll check this
      
      // For now, always try to load from Firebase first
      const [emps, shfts] = await Promise.all([
        getEmployees(),
        getShifts()
      ]);
      
      setEmployees(emps);
      setShifts(shfts);
      
      // If no Firebase data but localStorage has data, offer migration
      if ((!emps || emps.length === 0) && hasLocalData && !migrated) {
        console.log('Firebase data is empty but localStorage has data. Consider migrating.');
      }
      
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message);
      
      // Fallback to localStorage if Firebase fails
      const localEmployees = localStorage.getItem('employees');
      const localShifts = localStorage.getItem('shifts');
      
      if (localEmployees) {
        setEmployees(JSON.parse(localEmployees));
      }
      if (localShifts) {
        setShifts(JSON.parse(localShifts));
      }
      
    } finally {
      setLoading(false);
    }
  }, [migrated]);

  // Set up realtime subscriptions
  useEffect(() => {
    // Subscribe to realtime updates
    const unsubscribeEmployees = subscribeToEmployees((emps) => {
      setEmployees(emps);
      localStorage.setItem('employees', JSON.stringify(emps));
    });
    
    const unsubscribeShifts = subscribeToShifts((shfts) => {
      setShifts(shfts);
      localStorage.setItem('shifts', JSON.stringify(shfts));
    });
    
    // Initial load
    loadData();
    
    // Cleanup subscriptions
    return () => {
      unsubscribeEmployees();
      unsubscribeShifts();
    };
  }, [loadData]);

  // Migrate data from localStorage to Firebase
  const migrateData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await migrateFromLocalStorage();
      setMigrated(true);
      await loadData();
      
      // Clear localStorage after successful migration
      localStorage.removeItem('employees');
      localStorage.removeItem('shifts');
      
      return result;
    } catch (err) {
      setError(err.message);
      console.error('Migration failed:', err);
      return { employees: 0, shifts: 0, errors: [err.message] };
    } finally {
      setLoading(false);
    }
  }, [loadData]);

  // Employee CRUD operations
  const addEmployeeFunc = useCallback(async (employee) => {
    try {
      const newEmployee = await addEmployee(employee);
      return newEmployee;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const updateEmployeeFunc = useCallback(async (id, updates) => {
    try {
      await updateEmployee(id, updates);
      return true;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const deleteEmployeeFunc = useCallback(async (id) => {
    try {
      await deleteEmployee(id);
      return true;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Shift CRUD operations
  const addShiftFunc = useCallback(async (shift) => {
    try {
      const newShift = await addShift(shift);
      return newShift;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const updateShiftFunc = useCallback(async (id, updates) => {
    try {
      await updateShift(id, updates);
      return true;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const deleteShiftFunc = useCallback(async (id) => {
    try {
      await deleteShift(id);
      return true;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Save to localStorage as fallback
  const saveToLocalStorage = useCallback(() => {
    localStorage.setItem('employees', JSON.stringify(employees));
    localStorage.setItem('shifts', JSON.stringify(shifts));
  }, [employees, shifts]);

  return {
    employees,
    shifts,
    loading,
    error,
    migrated,
    departments: DEPARTMENTS,
    
    // Data loading
    loadData,
    migrateData,
    saveToLocalStorage,
    
    // Employee operations
    addEmployee: addEmployeeFunc,
    updateEmployee: updateEmployeeFunc,
    deleteEmployee: deleteEmployeeFunc,
    
    // Shift operations
    addShift: addShiftFunc,
    updateShift: updateShiftFunc,
    deleteShift: deleteShiftFunc,
  };
}
