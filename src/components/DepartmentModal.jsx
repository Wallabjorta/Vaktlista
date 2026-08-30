import React, { useState, useEffect } from 'react';

/**
 * Modal for managing departments (add, edit, delete)
 */
function DepartmentModal({ 
  departments, 
  onSave, 
  onDelete, 
  onClose,
  editingDepartment = null
}) {
  const [newDepartment, setNewDepartment] = useState({
    name: '',
    color: '#FF0000'
  });
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // If editing, populate the form
  useEffect(() => {
    if (editingDepartment) {
      setNewDepartment({
        name: editingDepartment.name || '',
        color: editingDepartment.color || '#FF0000'
      });
      setSelectedDepartment(editingDepartment);
    }
  }, [editingDepartment]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate
    if (!newDepartment.name.trim()) {
      alert('Vennligst fyll ut avdelingsnavn');
      return;
    }
    
    if (!newDepartment.color) {
      alert('Vennligst velg en farge');
      return;
    }
    
    // Check if department name already exists (case insensitive)
    const existingDept = departments.find(
      dept => dept.name.toLowerCase() === newDepartment.name.toLowerCase() && 
             (!editingDepartment || dept.id !== editingDepartment.id)
    );
    
    if (existingDept) {
      alert('En avdeling med dette navnet finnes allerede');
      return;
    }
    
    // Prepare department data
    const departmentData = {
      name: newDepartment.name.trim(),
      color: newDepartment.color
    };
    
    // If editing, include the ID
    if (editingDepartment) {
      departmentData.id = editingDepartment.id;
    }
    
    onSave(departmentData);
    resetForm();
  };

  const resetForm = () => {
    setNewDepartment({ name: '', color: '#FF0000' });
    setSelectedDepartment(null);
  };

  const handleDeleteClick = (dept) => {
    setSelectedDepartment(dept);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedDepartment) {
      onDelete(selectedDepartment.id);
      setShowDeleteConfirm(false);
      setSelectedDepartment(null);
    }
  };

  // Predefined colors for easy selection
  const colorOptions = [
    { value: '#FF0000', label: 'Rød', name: 'Fri' },
    { value: '#3B82F6', label: 'Blå', name: 'Vest' },
    { value: '#10B981', label: 'Grønn', name: 'Øst' },
    { value: '#F59E0B', label: 'Oransje', name: 'Skiskole' },
    { value: '#EF4444', label: 'Rød', name: 'Butikk' },
    { value: '#8B5CF6', label: 'Lilla', name: 'Skolegrupper' },
    { value: '#000000', label: 'Sort' },
    { value: '#FFFFFF', label: 'Hvit', border: '1px solid #ccc' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-lg w-full border max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h2 className="text-xl font-semibold">Administrer avdelinger</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
            ❌
          </button>
        </div>

        {/* Add/Edit Department Form */}
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Avdelingsnavn *</label>
              <input
                type="text"
                value={newDepartment.name}
                onChange={(e) => setNewDepartment(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-2 border rounded"
                placeholder="f.eks. Fri, Vest, Butikk"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Farge *</label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setNewDepartment(prev => ({ ...prev, color: color.value }))}
                    className={`w-8 h-8 rounded border-2 transition-all ${
                      newDepartment.color === color.value 
                        ? 'border-black ring-2 ring-black' 
                        : 'border-gray-300'
                    }`}
                    style={{
                      backgroundColor: color.value,
                      ...(color.border && { border: color.border })
                    }}
                    title={color.label}
                  />
                ))}
              </div>
              <div className="mt-2 text-xs text-gray-600">
                Valgt farge: <strong style={{ color: newDepartment.color }}>{newDepartment.color}</strong>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded border border-blue-600 hover:bg-blue-700"
              >
                {editingDepartment ? 'Lagre endringer' : '+ Legg til avdeling'}
              </button>
              {editingDepartment && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-200 rounded border hover:bg-gray-300"
                >
                  Avbryt
                </button>
              )}
            </div>
          </div>
        </form>

        {/* List of existing departments */}
        <div className="border-t pt-4">
          <h3 className="text-lg font-medium mb-3">Eksisterende avdelinger ({departments.length})</h3>
          
          {departments.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Ingen avdelinger lagt til ennå</p>
          ) : (
            <div className="space-y-2">
              {departments.map((dept) => (
                <div 
                  key={dept.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded border"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded" 
                      style={{ backgroundColor: dept.color }}
                    ></div>
                    <span className="font-medium">{dept.name}</span>
                    <span className="text-xs text-gray-500">ID: {dept.id}</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setNewDepartment({ name: dept.name, color: dept.color });
                        setSelectedDepartment(dept);
                        // Scroll to top
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
                      title="Rediger"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteClick(dept)}
                      className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                      title="Slett"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && selectedDepartment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full border">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Slett avdeling</h3>
                <button 
                  onClick={() => setShowDeleteConfirm(false)} 
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ❌
                </button>
              </div>
              
              <p className="mb-4">
                Er du sikker på at du vil slette avdelingen <strong>{selectedDepartment.name}</strong>?
              </p>
              <p className="text-sm text-red-600 mb-4">
                ⚠️ Avdelingen kan ikke slettes hvis den brukes av ansatte eller vakter.
              </p>
              
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 bg-red-600 text-white rounded border border-red-600 hover:bg-red-700 flex-1"
                >
                  Ja, slett
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 bg-gray-200 rounded border hover:bg-gray-300 flex-1"
                >
                  Avbryt
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DepartmentModal;
