import React, { useState, useEffect } from 'react';

function EditEmployeeModal({ employee, departments, onSave, onClose }) {
  const [editedEmployee, setEditedEmployee] = useState({
    id: employee?.id || '',
    name: employee?.name || '',
    deptIds: employee?.deptIds || [],
    email: employee?.email || '',
    phone: employee?.phone || '',
    isAdmin: employee?.isAdmin || false,
    password: employee?.password || ''
  });

  // Update state when employee changes
  useEffect(() => {
    if (employee) {
      setEditedEmployee({
        id: employee.id,
        name: employee.name,
        deptIds: employee.deptIds || [],
        email: employee.email || '',
        phone: employee.phone || '',
        isAdmin: employee.isAdmin || false,
        password: employee.password || ''
      });
    }
  }, [employee]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(editedEmployee);
  };

  const handleDeptToggle = (deptId) => {
    setEditedEmployee(prev => {
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
          <h2 className="text-xl font-semibold">Rediger ansatt</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Navn */}
            <div>
              <label className="block text-sm font-medium mb-1">Navn *</label>
              <input
                type="text"
                value={editedEmployee.name}
                onChange={(e) => setEditedEmployee(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-2 border rounded"
                required
              />
            </div>

            {/* E-post */}
            <div>
              <label className="block text-sm font-medium mb-1">E-post</label>
              <input
                type="email"
                value={editedEmployee.email}
                onChange={(e) => setEditedEmployee(prev => ({ ...prev, email: e.target.value }))}
                className="w-full p-2 border rounded"
                placeholder="E-postadresse"
              />
            </div>

            {/* Telefon */}
            <div>
              <label className="block text-sm font-medium mb-1">Telefon</label>
              <input
                type="tel"
                value={editedEmployee.phone}
                onChange={(e) => setEditedEmployee(prev => ({ ...prev, phone: e.target.value }))}
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
                      editedEmployee.deptIds?.includes(dept.id)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                    style={editedEmployee.deptIds?.includes(dept.id) ? { backgroundColor: dept.color } : {}}
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
                checked={editedEmployee.isAdmin}
                onChange={(e) => setEditedEmployee(prev => ({ ...prev, isAdmin: e.target.checked }))}
                className="w-4 h-4"
              />
            </div>

            {/* Passord */}
            <div>
              <label className="block text-sm font-medium mb-1">Passord</label>
              <input
                type="password"
                value={editedEmployee.password}
                onChange={(e) => setEditedEmployee(prev => ({ ...prev, password: e.target.value }))}
                className="w-full p-2 border rounded"
                placeholder="Passord"
              />
            </div>

            <div className="flex gap-2 pt-4 border-t">
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
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditEmployeeModal;