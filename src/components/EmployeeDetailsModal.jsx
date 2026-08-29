import React from 'react';

function EmployeeDetailsModal({ employee, departments, currentUser, onClose, onEdit }) {
  const getDeptNames = () => {
    return employee?.deptIds?.map(deptId => {
      const dept = departments.find(d => d.id === deptId);
      return dept ? dept.name : deptId;
    }).join(', ') || 'Ingen avdelinger';
  };

  // Generer personlig iCal-URL
  const icalUrl = `/api/export/ical/${employee?.id}`;

  // Kopier lenke til utklippstavle
  const copyToClipboard = () => {
    navigator.clipboard.writeText(icalUrl);
    alert('iCal-lenke kopiert til utklippstavle!');
  };

  // Åpne iCal-lenken direkte
  const openICal = (e) => {
    e.preventDefault();
    window.open(icalUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full border">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h2 className="text-xl font-semibold">Ansattinformasjon</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="space-y-4">
          {/* Navn */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Navn</label>
            <p className="text-lg font-medium">{employee?.name || 'Ukjent'}</p>
          </div>

          {/* Avdelinger */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Avdelinger</label>
            <p>{getDeptNames()}</p>
          </div>

          {/* E-post */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">E-post</label>
            <p>
              {employee?.email ? (
                <a href={`mailto:${employee.email}`} className="text-blue-600 hover:text-blue-800">
                  {employee.email}
                </a>
              ) : 'Ikke oppgitt'}
            </p>
          </div>

          {/* Telefon */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Telefon</label>
            <p>
              {employee?.phone ? (
                <a href={`tel:${employee.phone}`} className="text-blue-600 hover:text-blue-800">
                  {employee.phone}
                </a>
              ) : 'Ikke oppgitt'}
            </p>
          </div>

          {/* Admin */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Rettigheter</label>
            <p>{employee?.isAdmin ? 'Admin' : 'Vanlig bruker'}</p>
          </div>

          {/* ============ iCal-LENKE ============ */}
          <div className="pt-4 border-t">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📅 Personlig kalenderlenke
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={icalUrl}
                readOnly
                className="flex-1 p-2 border rounded text-sm bg-gray-50 cursor-pointer"
                onClick={(e) => {
                  e.target.select();
                  copyToClipboard();
                }}
              />
              <button
                onClick={copyToClipboard}
                className="px-3 py-2 bg-purple-600 text-white rounded border border-purple-600 hover:bg-purple-700 text-sm whitespace-nowrap"
              >
                Kopier lenke
              </button>
            </div>
            <div className="mt-2">
              <button
                onClick={openICal}
                className="text-sm text-purple-600 hover:text-purple-800 underline"
              >
                Åpne iCal-lenke direkte
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Lim inn lenken i kalenderappen din (Outlook, Google Calendar, Apple Calendar, etc.) for automatisk oppdatering.
              Kalenderen oppdateres automatisk hver 15. minutt.
            </p>
          </div>

          {/* Rediger-knapp (bare for admin) */}
          {onEdit && currentUser?.isAdmin && (
            <div className="flex gap-2 pt-4 border-t">
              <button
                onClick={() => {
                  onClose();
                  onEdit(employee);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded border border-blue-600 hover:bg-blue-700 flex-1"
              >
                Rediger
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 rounded border hover:bg-gray-300 flex-1"
              >
                Lukk
              </button>
            </div>
          )}

          {/* Lukk-knapp for ikke-admin */}
          {onEdit && !currentUser?.isAdmin && (
            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 rounded border hover:bg-gray-300"
              >
                Lukk
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EmployeeDetailsModal;