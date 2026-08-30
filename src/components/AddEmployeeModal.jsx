import React, { useState } from 'react';

function AddEmployeeModal({ departments, onSave, onClose }) {
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    deptIds: [],
    email: '',
    phone: '',
    isAdmin: false
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validation
    if (!newEmployee.name) {
      alert('Navn er påkrevd!');
      return;
    }

    if (!newEmployee.deptIds || newEmployee.deptIds.length === 0) {
      alert('Velg minst én avdeling!');
      return;
    }

    // Generate ID - let Firebase handle it
    const employeeToSave = {
      ...newEmployee
    };

    onSave(employeeToSave);
  };

  const handleDeptToggle = (deptId) => {
    setNewEmployee(prev => {
      const newDeptIds = [...prev.deptIds];
      const index = newDeptIds.indexOf(deptId);
      if (index > -1) {
        newDeptIds.splice(index, 1);
      } else {
        newDeptIds.push(deptId);
      }
      return { ...prev, deptIds: newDeptIds };
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full border">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h2 className="text-xl font-semibold">Legg til ny ansatt</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Navn */}
            <div>
              <label className="block text-sm font-medium mb-1">Navn *</label>
              <input
                type="text"
                value={newEmployee.name}
                onChange={(e) => setNewEmployee(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-2 border rounded"
                placeholder="Fullt navn"
                required
              />
            </div>

            {/* E-post */}
            <div>
              <label className="block text-sm font-medium mb-1">E-post</label>
              <input
                type="email"
                value={newEmployee.email}
                onChange={(e) => setNewEmployee(prev => ({ ...prev, email: e.target.value }))}
                className="w-full p-2 border rounded"
                placeholder="E-postadresse"
              />
            </div>

            {/* Telefon */}
            <div>
              <label className="block text-sm font-medium mb-1">Telefon</label>
              <input
                type="tel"
                value={newEmployee.phone}
                onChange={(e) => setNewEmployee(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full p-2 border rounded"
                placeholder="Telefonnummer"
              />
            </div>

            {/* Avdelinger */}
            <div>
              <label className="block text-sm font-medium mb-1">Avdelinger *</label>
              <div className="flex flex-wrap gap-2">
                {departments.map(dept => (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => handleDeptToggle(dept.id)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      newEmployee.deptIds?.includes(dept.id)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                    style={newEmployee.deptIds?.includes(dept.id) ? { backgroundColor: dept.color } : {}}
                  >
                    {dept.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Admin */}
            <div className="flex items-center gap-2">
              <label className="block text-sm font-medium">Admin</label>
              <input
                type="checkbox"
                checked={newEmployee.isAdmin}
                onChange={(e) => setNewEmployee(prev => ({ ...prev, isAdmin: e.target.checked }))}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-500">Gi admin-rettigheter</span>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded border border-green-600 hover:bg-green-700 flex-1"
              >
                Lagre ny ansatt
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 rounded border hover:bg-gray-300 flex-1"
              >
                Avbryt
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddEmployeeModal;