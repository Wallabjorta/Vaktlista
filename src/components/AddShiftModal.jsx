import React from 'react';

function AddShiftModal({ 
  employees, 
  departments, 
  newShift, 
  onChange, 
  onSave, 
  onClose,
  isBulkMode = false,
  bulkCount = 0,
  selectedEmployeeForBulk = null,
  bulkCells = []
}) {
  const bulkByEmployee = {};
  (bulkCells || []).forEach(cell => {
    bulkByEmployee[cell.employeeId] = (bulkByEmployee[cell.employeeId] || 0) + 1;
  });
  const bulkEmployeeIds = Object.keys(bulkByEmployee);
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full border">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h2 className="text-xl font-semibold">
            {isBulkMode ? `Legg til vakt (${bulkCount} valgte)` : 'Legg til vakt'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">\u2715</button>
        </div>
        
        {isBulkMode && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Bulk-modus:</strong> {bulkCount} vakt{bulkCount !== 1 ? 'er' : ''} vil bli opprettet for de valgte ansatte og dagene.
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Kombinasjoner som allerede har vakt vil bli hoppet over.
            </p>
          </div>
        )}
        
        <div className="space-y-4">
          {isBulkMode ? (
            <div>
              <label className="block text-sm font-medium mb-1">
                Valgte ansatte ({bulkEmployeeIds.length})
              </label>
              <div className="p-2 border rounded bg-gray-50 space-y-1 max-h-32 overflow-y-auto">
                {bulkEmployeeIds.length === 0 ? (
                  <p className="text-sm text-gray-500">Ingen valgt</p>
                ) : bulkEmployeeIds.map(id => {
                  const emp = employees.find(e => e.id === id);
                  return (
                    <div key={id} className="flex justify-between text-sm">
                      <span>{emp?.name || id}</span>
                      <span className="text-gray-500">{bulkByEmployee[id]} dag{bulkByEmployee[id] !== 1 ? 'er' : ''}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Valgte ansatte og dager settes i kalenderen. Klikk celler der for å endre.
              </p>
            </div>
          ) : (
          <div>
            <label className="block text-sm font-medium mb-1">Ansatt</label>
            <select
              value={newShift.employeeId}
              onChange={(e) => onChange('employeeId', e.target.value)}
              className="w-full p-2 border rounded"
              required
              disabled={false}
            >
              <option value="">Velg ansatt</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Avdeling</label>
            <select
              value={newShift.departmentId}
              onChange={(e) => onChange('departmentId', e.target.value)}
              className="w-full p-2 border rounded"
              required
            >
              <option value="">Velg avdeling</option>
              {(departments || []).filter(dept => dept).map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Dato</label>
            <input
              type="date"
              value={newShift.date}
              onChange={(e) => onChange('date', e.target.value)}
              className="w-full p-2 border rounded"
              required
              disabled={isBulkMode}
            />
            {isBulkMode && (
              <p className="text-xs text-gray-500 mt-1">
                Dato vises kun som eksempel. Vakter vil bli opprettet p\u00e5 alle valgte dager.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Starttid</label>
              <input
                type="time"
                value={newShift.startTime}
                onChange={(e) => onChange('startTime', e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sluttid</label>
              <input
                type="time"
                value={newShift.endTime}
                onChange={(e) => onChange('endTime', e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Kommentar / Arbeidsoppgave</label>
            <textarea
              value={newShift.comment || ''}
              onChange={(e) => onChange('comment', e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="Skriv en kommentar om arbeidsoppgaven..."
              rows={2}
            />
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <button
              onClick={onSave}
              className="px-4 py-2 bg-green-600 text-white rounded border border-green-600 hover:bg-green-700 flex-1"
            >
              {isBulkMode ? `Lagre ${bulkCount} vakter` : 'Lagre vakt'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 rounded border hover:bg-gray-300 flex-1"
            >
              Avbryt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddShiftModal;
