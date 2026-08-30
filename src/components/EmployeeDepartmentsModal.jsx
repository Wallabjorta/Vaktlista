import React, { useState, useEffect } from 'react';

/**
 * Modal for managing an employee's departments
 * Allows adding/removing departments from an employee
 */
function EmployeeDepartmentsModal({ employee, departments, onSave, onClose }) {
  const [selectedDeptIds, setSelectedDeptIds] = useState([]);

  // Initialize with employee's current departments
  useEffect(() => {
    if (employee) {
      setSelectedDeptIds(employee.deptIds || []);
    }
  }, [employee]);

  const handleDeptToggle = (deptId) => {
    setSelectedDeptIds(prev => {
      const newDeptIds = [...prev];
      const index = newDeptIds.indexOf(deptId);
      if (index > -1) {
        newDeptIds.splice(index, 1);
      } else {
        newDeptIds.push(deptId);
      }
      return newDeptIds;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (selectedDeptIds.length === 0) {
      if (!confirm('Er du sikker på at du vil fjerne alle avdelinger fra denne ansatte?')) {
        return;
      }
    }
    
    // Update employee with new department assignments
    onSave({
      ...employee,
      deptIds: selectedDeptIds
    });
  };

  // Check if employee has shifts in a department (for warning)
  const hasShiftsInDept = (deptId) => {
    // This would need to be passed as a prop or fetched
    // For now, we'll just allow removal
    return false;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full border">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h2 className="text-xl font-semibold">Avdelinger for {employee?.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
            ❌
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-3">
              Velg hvilke avdelinger {employee?.name} skal tilhøre:
            </p>
            
            <div className="flex flex-wrap gap-2">
              {departments.map(dept => {
                const isSelected = selectedDeptIds.includes(dept.id);
                const hasShifts = hasShiftsInDept(dept.id);
                
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => handleDeptToggle(dept.id)}
                    className={`px-4 py-2 rounded border text-sm transition-all ${
                      isSelected 
                        ? 'border-white ring-2 ring-white' 
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    style={{
                      backgroundColor: dept.color,
                      color: isSelected ? 'white' : 'rgba(0,0,0,0.7)',
                      opacity: isSelected ? 1 : 0.7
                    }}
                    title={hasShifts ? 'Ansatt har vakter i denne avdelingen' : ''}
                  >
                    {dept.name}
                    {isSelected && <span className="ml-1">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded border border-blue-600 hover:bg-blue-700 flex-1"
            >
              Lagre
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 rounded border hover:bg-gray-300 flex-1"
            >
              Avbryt
            </button>
          </div>
        </form>

        {/* Show current selection */}
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-gray-600 mb-2">
            Valgte avdelinger: {selectedDeptIds.length > 0 ? selectedDeptIds.length : 'Ingen'}
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedDeptIds.map(deptId => {
              const dept = departments.find(d => d.id === deptId);
              return dept ? (
                <span 
                  key={deptId}
                  className="px-3 py-1 rounded-full text-xs text-white"
                  style={{ backgroundColor: dept.color }}
                >
                  {dept.name}
                </span>
              ) : null;
            })}
            {selectedDeptIds.length === 0 && (
              <span className="text-xs text-gray-500">Ingen avdelinger valgt</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmployeeDepartmentsModal;
