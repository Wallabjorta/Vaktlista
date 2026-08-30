import { useState, useEffect, useCallback } from 'react';
import ShiftCalendar from './components/ShiftCalendar';
import LoginModal from './components/LoginModal';
import AddShiftModal from './components/AddShiftModal';
import EditEmployeeModal from './components/EditEmployeeModal';
import EmployeeDetailsModal from './components/EmployeeDetailsModal';
import AddEmployeeModal from './components/AddEmployeeModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import AdminStats from './components/AdminStats';
import DepartmentModal from './components/DepartmentModal';
import useNorwegianHolidays from './hooks/useNorwegianHolidays';
import useWorkLawValidation from './hooks/useWorkLawValidation';
import useFirebaseData from './hooks/useFirebaseData';

// Skoleferier for Norge
const VACATIONS = {
  "2026-06-20": "Sommerferie", "2026-06-21": "Sommerferie", "2026-06-22": "Sommerferie",
  "2026-06-23": "Sommerferie", "2026-06-24": "Sommerferie", "2026-06-25": "Sommerferie",
  "2026-06-26": "Sommerferie", "2026-06-27": "Sommerferie", "2026-06-28": "Sommerferie",
  "2026-06-29": "Sommerferie", "2026-06-30": "Sommerferie", "2026-07-01": "Sommerferie",
  "2026-07-02": "Sommerferie", "2026-07-03": "Sommerferie", "2026-07-04": "Sommerferie",
  "2026-07-05": "Sommerferie", "2026-07-06": "Sommerferie", "2026-07-07": "Sommerferie",
  "2026-07-08": "Sommerferie", "2026-07-09": "Sommerferie", "2026-07-10": "Sommerferie",
  "2026-07-11": "Sommerferie", "2026-07-12": "Sommerferie", "2026-07-13": "Sommerferie",
  "2026-07-14": "Sommerferie", "2026-07-15": "Sommerferie", "2026-07-16": "Sommerferie",
  "2026-07-17": "Sommerferie", "2026-07-18": "Sommerferie", "2026-07-19": "Sommerferie",
  "2026-07-20": "Sommerferie", "2026-07-21": "Sommerferie", "2026-07-22": "Sommerferie",
  "2026-07-23": "Sommerferie", "2026-07-24": "Sommerferie", "2026-07-25": "Sommerferie",
  "2026-07-26": "Sommerferie", "2026-07-27": "Sommerferie", "2026-07-28": "Sommerferie",
  "2026-07-29": "Sommerferie", "2026-07-30": "Sommerferie", "2026-07-31": "Sommerferie",
  "2026-08-01": "Sommerferie", "2026-08-02": "Sommerferie", "2026-08-03": "Sommerferie",
  "2026-08-04": "Sommerferie", "2026-08-05": "Sommerferie", "2026-08-06": "Sommerferie",
  "2026-08-07": "Sommerferie", "2026-08-08": "Sommerferie", "2026-08-09": "Sommerferie",
  "2026-08-10": "Sommerferie", "2026-08-11": "Sommerferie", "2026-08-12": "Sommerferie",
  "2026-08-13": "Sommerferie", "2026-08-14": "Sommerferie", "2026-08-15": "Sommerferie",
  "2026-09-28": "Høstferie", "2026-09-29": "Høstferie", "2026-09-30": "Høstferie",
  "2026-10-01": "Høstferie", "2026-10-02": "Høstferie",
  "2026-12-20": "Juleferie", "2026-12-21": "Juleferie", "2026-12-22": "Juleferie",
  "2026-12-23": "Juleferie", "2026-12-27": "Juleferie", "2026-12-28": "Juleferie",
  "2026-12-29": "Juleferie", "2026-12-30": "Juleferie", "2026-12-31": "Juleferie",
  "2027-01-02": "Juleferie", "2027-01-03": "Juleferie", "2027-01-04": "Juleferie",
  "2027-01-05": "Juleferie",
  "2027-02-15": "Vinterferie", "2027-02-16": "Vinterferie", "2027-02-17": "Vinterferie",
  "2027-02-18": "Vinterferie", "2027-02-19": "Vinterferie", "2027-02-20": "Vinterferie",
  "2027-02-21": "Vinterferie", "2027-02-22": "Vinterferie", "2027-02-23": "Vinterferie",
  "2027-02-24": "Vinterferie", "2027-02-25": "Vinterferie", "2027-02-26": "Vinterferie",
  "2027-02-27": "Vinterferie", "2027-02-28": "Vinterferie",
  "2027-04-12": "Påskeferie", "2027-04-13": "Påskeferie", "2027-04-14": "Påskeferie",
  "2027-04-15": "Påskeferie", "2027-04-16": "Påskeferie", "2027-04-17": "Påskeferie",
  "2027-04-18": "Påskeferie", "2027-04-19": "Påskeferie", "2027-04-20": "Påskeferie",
  "2027-04-21": "Påskeferie", "2027-04-22": "Påskeferie", "2027-04-23": "Påskeferie",
  "2027-06-19": "Sommerferie", "2027-06-20": "Sommerferie", "2027-06-21": "Sommerferie",
  "2027-06-22": "Sommerferie", "2027-06-23": "Sommerferie", "2027-06-24": "Sommerferie",
  "2027-06-25": "Sommerferie", "2027-06-26": "Sommerferie", "2027-06-27": "Sommerferie",
  "2027-06-28": "Sommerferie", "2027-06-29": "Sommerferie", "2027-06-30": "Sommerferie",
  "2027-07-01": "Sommerferie", "2027-07-02": "Sommerferie", "2027-07-03": "Sommerferie",
  "2027-07-04": "Sommerferie", "2027-07-05": "Sommerferie", "2027-07-06": "Sommerferie",
  "2027-07-07": "Sommerferie", "2027-07-08": "Sommerferie", "2027-07-09": "Sommerferie",
  "2027-07-10": "Sommerferie", "2027-07-11": "Sommerferie", "2027-07-12": "Sommerferie",
  "2027-07-13": "Sommerferie", "2027-07-14": "Sommerferie", "2027-07-15": "Sommerferie",
  "2027-07-16": "Sommerferie", "2027-07-17": "Sommerferie", "2027-07-18": "Sommerferie",
  "2027-07-19": "Sommerferie", "2027-07-20": "Sommerferie", "2027-07-21": "Sommerferie",
  "2027-07-22": "Sommerferie", "2027-07-23": "Sommerferie", "2027-07-24": "Sommerferie",
  "2027-07-25": "Sommerferie", "2027-07-26": "Sommerferie", "2027-07-27": "Sommerferie",
  "2027-07-28": "Sommerferie", "2027-07-29": "Sommerferie", "2027-07-30": "Sommerferie",
  "2027-07-31": "Sommerferie", "2027-08-01": "Sommerferie", "2027-08-02": "Sommerferie",
  "2027-08-03": "Sommerferie", "2027-08-04": "Sommerferie", "2027-08-05": "Sommerferie",
  "2027-08-06": "Sommerferie", "2027-08-07": "Sommerferie", "2027-08-08": "Sommerferie",
  "2027-08-09": "Sommerferie", "2027-08-10": "Sommerferie", "2027-08-11": "Sommerferie",
  "2027-08-12": "Sommerferie", "2027-08-13": "Sommerferie", "2027-08-14": "Sommerferie",
  "2027-08-15": "Sommerferie"
};

function App() {
  // Firebase data hook - now includes departments
  const {
    employees,
    shifts,
    departments,
    loading,
    error,
    addEmployee: addEmployeeFirebase,
    updateEmployee: updateEmployeeFirebase,
    deleteEmployee: deleteEmployeeFirebase,
    addShift: addShiftFirebase,
    deleteShift: deleteShiftFirebase,
    addDepartment: addDepartmentFirebase,
    updateDepartment: updateDepartmentFirebase,
    deleteDepartment: deleteDepartmentFirebase,
    migrateData
  } = useFirebaseData();

  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentUser, setCurrentUser] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [showEditEmployeeModal, setShowEditEmployeeModal] = useState(false);
  const [showEmployeeDetailsModal, setShowEmployeeDetailsModal] = useState(false);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [newShift, setNewShift] = useState({
    employeeId: "",
    departmentId: "",
    date: new Date().toISOString().split('T')[0],
    startTime: "08:00",
    endTime: "16:00",
    comment: ""
  });

  // Hent norske helligdager dynamisk
  const { holidays } = useNorwegianHolidays([2024, 2025, 2026, 2027]);
  
  // Validering av norske arbeidslover
  const { validate } = useWorkLawValidation(shifts, holidays);

  // Load user from localStorage on initial render
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
    
    // Check if we need to migrate data from localStorage to Firebase
    const hasLocalData = localStorage.getItem('employees') || localStorage.getItem('shifts');
    if (hasLocalData && employees.length === 0 && shifts.length === 0 && !loading) {
      // Auto-migrate if Firebase is empty but localStorage has data
      migrateData().then(result => {
        console.log('Migration result:', result);
      });
    }
  }, [employees.length, shifts.length, loading, migrateData]);

  // Fallback: Load default employees if Firebase returns empty
  useEffect(() => {
    if (!loading && employees.length === 0) {
      const defaultEmployees = [
        { id: "1", name: "Ola Nordmann", deptIds: ["dept-1"], email: "ola@vaktlista.no", phone: "", isAdmin: false },
        { id: "2", name: "Kari Peterson", deptIds: ["dept-1", "dept-2"], email: "kari@vaktlista.no", phone: "", isAdmin: false },
        { id: "3", name: "Per Hansen", deptIds: ["dept-3"], email: "per@vaktlista.no", phone: "", isAdmin: false },
        { id: "4", name: "Admin Adminsson", deptIds: ["dept-1", "dept-2", "dept-3", "dept-4"], email: "admin@vaktlista.no", phone: "", isAdmin: true }
      ];
      
      // Add default employees to Firebase
      defaultEmployees.forEach(async (emp) => {
        try {
          await addEmployeeFirebase(emp);
        } catch (e) {
          console.log('Default employee already exists or error:', e.message);
        }
      });
    }
  }, [loading, employees.length, addEmployeeFirebase]);

  const handleLogin = useCallback((email, password) => {
    // Find user in employees list
    const user = employees.find(emp => emp.id === email || emp.email === email);
    if (!user) {
      alert('Ogiltig ansatt! Vennligst velg en ansatt fra listen.');
      return false;
    }
    
    // For demo purposes, use simple password check
    // In production, you should use Firebase Authentication
    if (user.isAdmin && password !== 'admin123') {
      alert('Feil passord for admin!');
      return false;
    }
    if (user.isAdmin && !password) {
      alert('Admin må oppgi passord!');
      return false;
    }
    
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    setShowLoginModal(false);
    return true;
  }, [employees]);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  }, []);

  const handleAddShift = useCallback(async () => {
    if (!newShift.employeeId) {
      alert('Velg en ansatt!');
      return;
    }
    if (!newShift.departmentId) {
      alert('Velg en avdeling!');
      return;
    }
    if (!newShift.date || !newShift.startTime || !newShift.endTime) {
      alert('Fyll ut alle felter!');
      return;
    }
    if (newShift.startTime >= newShift.endTime) {
      alert('Sluttid må være etter starttid!');
      return;
    }

    // Varning for norsk arbeidslov (men tillåt åndå)
    const validation = validate(newShift.employeeId, newShift.date);
    if (!validation.isValid) {
      alert(`⚠️ Advarsel: ${validation.errors.join(', ')}. Vakt lagt til likevel.`);
    }

    const shiftToSave = {
      ...newShift,
      id: Date.now().toString(),
      breaks: []
    };

    try {
      await addShiftFirebase(shiftToSave);
      setShowAddShiftModal(false);
      setNewShift({
        employeeId: "",
        departmentId: selectedDepartment || "",
        date: new Date().toISOString().split('T')[0],
        startTime: "08:00",
        endTime: "16:00",
        comment: ""
      });
    } catch (error) {
      console.error('Error saving shift:', error);
      alert('Feil ved lagring av vakt: ' + error.message);
    }
  }, [newShift, selectedDepartment, addShiftFirebase, validate]);

  const handleDeleteShift = useCallback(async (shiftId) => {
    if (!confirm('Slett vakt?')) return;
    try {
      await deleteShiftFirebase(shiftId);
    } catch (error) {
      console.error('Error deleting shift:', error);
      alert('Feil ved sletting av vakt: ' + error.message);
    }
  }, [deleteShiftFirebase]);

  const handleSaveEmployee = useCallback(async (updatedEmployee) => {
    try {
      await updateEmployeeFirebase(updatedEmployee.id, updatedEmployee);
      setShowEditEmployeeModal(false);
      alert('Ansatt oppdatert!');
    } catch (error) {
      console.error('Error updating employee:', error);
      alert('Feil ved oppdatering av ansatt: ' + error.message);
    }
  }, [updateEmployeeFirebase]);

  const handleAddEmployee = useCallback(async (newEmployee) => {
    try {
      await addEmployeeFirebase(newEmployee);
      setShowAddEmployeeModal(false);
      alert('Ny ansatt lagt til!');
    } catch (error) {
      console.error('Error adding employee:', error);
      alert('Feil ved oppretting av ansatt: ' + error.message);
    }
  }, [addEmployeeFirebase]);

  const handleDeleteEmployee = useCallback(async () => {
    if (!employeeToDelete) return;

    const hasShifts = shifts.some(shift => shift.employeeId === employeeToDelete.id);
    if (hasShifts) {
      alert('Kan ikke slette ansatt som har vakter! Slett vaktene først.');
      setShowDeleteConfirmModal(false);
      setEmployeeToDelete(null);
      return;
    }

    if (currentUser?.id === employeeToDelete.id) {
      alert('Kan ikke slette den innloggede brukeren! Logg ut først.');
      setShowDeleteConfirmModal(false);
      setEmployeeToDelete(null);
      return;
    }

    try {
      await deleteEmployeeFirebase(employeeToDelete.id);
      setShowDeleteConfirmModal(false);
      setEmployeeToDelete(null);
      alert('Ansatt slettet!');
    } catch (error) {
      console.error('Error deleting employee:', error);
      alert('Feil ved sletting av ansatt: ' + error.message);
    }
  }, [employeeToDelete, shifts, currentUser, deleteEmployeeFirebase]);

  const handleShowEmployeeDetails = useCallback((employee) => {
    setSelectedEmployee(employee);
    setShowEmployeeDetailsModal(true);
  }, []);

  const handleRequestDeleteEmployee = useCallback((employee) => {
    setEmployeeToDelete(employee);
    setShowDeleteConfirmModal(true);
  }, []);

  // Department handlers
  const handleSaveDepartment = useCallback(async (department) => {
    try {
      if (department.id) {
        // Update existing department
        await updateDepartmentFirebase(department.id, department);
        alert('Avdeling oppdatert!');
      } else {
        // Add new department
        await addDepartmentFirebase(department);
        alert('Ny avdeling lagt til!');
      }
      setShowDepartmentModal(false);
    } catch (error) {
      console.error('Error saving department:', error);
      alert('Feil ved lagring av avdeling: ' + error.message);
    }
  }, [addDepartmentFirebase, updateDepartmentFirebase]);

  const handleDeleteDepartment = useCallback(async (departmentId) => {
    try {
      await deleteDepartmentFirebase(departmentId);
      alert('Avdeling slettet!');
    } catch (error) {
      console.error('Error deleting department:', error);
      alert('Feil ved sletting av avdeling: ' + error.message);
    }
  }, [deleteDepartmentFirebase]);

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="mb-4 flex justify-between items-center">
        <div></div>
        <div className="flex gap-2 items-center">
          {currentUser ? (
            <>
              <span className="text-sm">
                Innlogget som: <strong>{currentUser.name}</strong>
                {currentUser.isAdmin && <span className="ml-1 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Admin</span>}
              </span>
              <button onClick={handleLogout} className="px-3 py-1 bg-red-100 text-red-700 rounded border border-red-200 hover:bg-red-200">
                Logg ut
              </button>
            </>
          ) : (
            <button onClick={() => setShowLoginModal(true)} className="px-3 py-1 bg-blue-600 text-white rounded border border-blue-600 hover:bg-blue-700">
              Logg inn
            </button>
          )}
        </div>
      </div>

      <header className="mb-6 p-4 bg-white border rounded-lg shadow-sm">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {selectedDepartment ? `Vaktlista - ${departments.find(d => d.id === selectedDepartment)?.name}` : 'Vaktlista - Alle avdelinger'}
            </h1>
            <p className="text-gray-600">Visning: 30 uker</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)))} className="px-3 py-1 bg-gray-200 rounded border hover:bg-gray-300">⬅ Forrige</button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 bg-blue-600 text-white rounded border border-blue-600 hover:bg-blue-700">I dag</button>
            <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)))} className="px-3 py-1 bg-gray-200 rounded border hover:bg-gray-300">Neste ➡</button>
          </div>
        </div>
      </header>

      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <button
          onClick={() => setSelectedDepartment(null)}
          className="px-4 py-2 rounded border"
          style={!selectedDepartment ? { backgroundColor: '#3B82F6', color: 'white', borderColor: '#3B82F6' } : { backgroundColor: '#f3f4f6' }}
        >
          Oversikt (Alle)
        </button>
        {departments.map(dept => (
          <button
            key={dept.id}
            onClick={() => setSelectedDepartment(dept.id)}
            className="px-4 py-2 rounded border"
            style={selectedDepartment === dept.id ? { backgroundColor: dept.color, color: 'white', borderColor: dept.color } : { backgroundColor: dept.color, color: 'white', borderColor: dept.color, opacity: 0.7 }}
          >
            {dept.name}
          </button>
        ))}
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="px-4 py-2 rounded border bg-gray-100 hover:bg-gray-200"
        >
          {showHistory ? 'Skjul historikk' : 'Vis historikk'}
        </button>
      </div>

      <div className="mb-6 p-4 bg-white border rounded-lg shadow-sm">
        <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
          <h2 className="text-lg font-semibold">
            {selectedDepartment ? `Ansatte (${departments.find(d => d.id === selectedDepartment)?.name})` : 'Ansatte (Alle)'}
          </h2>
          {currentUser && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setNewShift({
                    employeeId: "",
                    departmentId: selectedDepartment || "",
                    date: new Date().toISOString().split('T')[0],
                    startTime: "08:00",
                    endTime: "16:00"
                  });
                  setShowAddShiftModal(true);
                }}
                className="px-3 py-1 bg-green-600 text-white rounded border border-green-600 hover:bg-green-700"
              >
                + Legg til vakt
              </button>
              {currentUser.isAdmin && (
                <>
                  <button
                    onClick={() => setShowAddEmployeeModal(true)}
                    className="px-3 py-1 bg-blue-600 text-white rounded border border-blue-600 hover:bg-blue-700"
                  >
                    + Ny ansatt
                  </button>
                  <button
                    onClick={() => window.open('/api/export/ical', '_blank')}
                    className="px-3 py-1 bg-purple-600 text-white rounded border border-purple-600 hover:bg-purple-700"
                  >
                    📅 Eksporter til iCal
                  </button>
                  <button
                    onClick={() => setShowDepartmentModal(true)}
                    className="px-3 py-1 bg-orange-600 text-white rounded border border-orange-600 hover:bg-orange-700"
                  >
                    ⚙️ Avdelinger
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {employees.map(emp => (
            <div
              key={emp.id}
              className="flex items-center gap-2 bg-gray-50 px-3 py-1 rounded-full border cursor-pointer hover:bg-gray-100 group"
              onClick={() => currentUser?.isAdmin && handleShowEmployeeDetails(emp)}
              title={currentUser?.isAdmin ? "Klikk for å se detaljer" : ""}
            >
              <span>{emp.name}</span>
              {emp.isAdmin && <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">Admin</span>}
              {emp.deptIds?.map(deptId => (
                <span key={deptId} className="w-2 h-2 rounded-full ml-1" style={{ backgroundColor: departments.find(d => d.id === deptId)?.color }} title={departments.find(d => d.id === deptId)?.name}></span>
              ))}
              {currentUser?.isAdmin && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEmployee(emp);
                      setShowEditEmployeeModal(true);
                    }}
                    className="text-blue-500 hover:text-blue-700 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Rediger ansatt"
                  >
                    ✏️
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRequestDeleteEmployee(emp);
                    }}
                    className="text-red-500 hover:text-red-700 text-xs opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                    title="Slett ansatt"
                  >
                    ❌
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {currentUser && (
        <ShiftCalendar
          employees={employees.filter(employee => !selectedDepartment || employee.deptIds?.includes(selectedDepartment))}
          shifts={shifts}
          selectedDepartment={selectedDepartment}
          currentDate={currentDate}
          departments={departments}
          holidays={holidays}
          vacations={VACATIONS}
          currentUser={currentUser}
          showHistory={showHistory}
          onAddShift={(employeeId, date, deptId) => {
            // Varning for norsk arbeidslov (men tillåt åndå)
            const validation = validate(employeeId, date);
            if (!validation.isValid) {
              alert(`⚠️ Advarsel: ${validation.errors.join(', ')}. Du kan likevel legge til vakten.`);
            }
            setNewShift({
              employeeId: employeeId,
              departmentId: deptId || selectedDepartment || "",
              date: date,
              startTime: "08:00",
              endTime: "16:00"
            });
            setShowAddShiftModal(true);
          }}
          onDeleteShift={handleDeleteShift}
        />
      )}

      {currentUser?.isAdmin && (
        <div className="mt-6">
          <AdminStats
            employees={employees}
            shifts={shifts}
            holidays={holidays}
            departments={departments}
          />
        </div>
      )}

      {showLoginModal && (
        <LoginModal
          employees={employees}
          onLogin={handleLogin}
          onClose={() => setShowLoginModal(false)}
        />
      )}

      {showAddShiftModal && (
        <AddShiftModal
          employees={employees}
          departments={departments}
          newShift={newShift}
          onChange={(field, value) => setNewShift(prev => ({ ...prev, [field]: value }))}
          onSave={handleAddShift}
          onClose={() => setShowAddShiftModal(false)}
        />
      )}

      {showEmployeeDetailsModal && selectedEmployee && (
        <EmployeeDetailsModal
          employee={selectedEmployee}
          departments={departments}
          onClose={() => setShowEmployeeDetailsModal(false)}
          onEdit={(emp) => {
            setSelectedEmployee(emp);
            setShowEmployeeDetailsModal(false);
            setShowEditEmployeeModal(true);
          }}
        />
      )}

      {showEditEmployeeModal && selectedEmployee && (
        <EditEmployeeModal
          employee={selectedEmployee}
          departments={departments}
          onSave={handleSaveEmployee}
          onClose={() => setShowEditEmployeeModal(false)}
        />
      )}

      {showAddEmployeeModal && (
        <AddEmployeeModal
          departments={departments}
          onSave={handleAddEmployee}
          onClose={() => setShowAddEmployeeModal(false)}
        />
      )}

      {showDeleteConfirmModal && employeeToDelete && (
        <DeleteConfirmModal
          itemType="ansatt"
          itemName={employeeToDelete.name}
          onConfirm={handleDeleteEmployee}
          onClose={() => {
            setShowDeleteConfirmModal(false);
            setEmployeeToDelete(null);
          }}
        />
      )}

      {showDepartmentModal && (
        <DepartmentModal
          departments={departments}
          onSave={handleSaveDepartment}
          onDelete={handleDeleteDepartment}
          onClose={() => setShowDepartmentModal(false)}
        />
      )}


    </div>
  );
}

export default App;
