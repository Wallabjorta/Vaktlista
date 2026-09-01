import React from 'react';

function EmployeeDetailsModal({ employee, departments, currentUser, onClose, onEdit }) {
  const getDeptNames = () => {
    return employee?.deptIds?.map(deptId => {
      const dept = departments.find(d => d.id === deptId);
      return dept ? dept.name : deptId;
    }).join(', ') || 'Ingen avdelinger';
  };

  // Generer personlig iCal-URL
  // Use Firebase Hosting URL where Functions are deployed
  const firebaseHostingUrl = 'https://vaktlista-d0efd.web.app';
  const apiUrl = import.meta.env.VITE_API_URL || firebaseHostingUrl;
  const icalUrl = `${apiUrl}/api/export/ical/${employee?.id}`;

  // Kopier lenke til utklippstavle
  const copyToClipboard = () => {
    navigator.clipboard.writeText(icalUrl);
    alert('iCal-lenke kopiert til utklippstavle!');
  };

  // Last ned iCal-fil direkte
  const downloadICal = () => {
    const filename = `${employee?.name || 'vaktlista'}.ics`;
    fetch(icalUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Server svarte med ${response.status}: ${response.statusText}`);
        }
        return response.text();
      })
      .then(icalContent => {
        const blob = new Blob([icalContent], { type: 'text/calendar; charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      })
      .catch(error => {
        alert('Feil ved nedlasting: ' + error.message);
      });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg max-w-md w-full border">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h2 className="text-xl font-semibold">Ansattinformasjon</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
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
          <div className="pt-4 border-t border-gray-200 bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium text-gray-800 mb-3">
              📅 Personlig kalenderlenke (iCal)
            </h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={icalUrl}
                  readOnly
                  className="flex-1 p-2 border border-gray-300 rounded-md text-sm bg-white cursor-pointer"
                  onClick={(e) => {
                    e.target.select();
                    copyToClipboard();
                  }}
                />
                <button
                  onClick={copyToClipboard}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md border border-purple-600 hover:bg-purple-700 text-sm whitespace-nowrap font-medium"
                >
                  Kopier
                </button>
              </div>
              <button
                onClick={downloadICal}
                className="text-sm text-purple-600 hover:text-purple-800 underline flex items-center gap-1"
              >
                📥 Last ned iCal-fil
              </button>
              <p className="text-xs text-gray-600">
                <strong>Hvordan bruke:</strong> Lim inn lenken i kalenderappen din (Outlook, Google Calendar, Apple Calendar) 
                for automatisk oppdatering. Kalenderen oppdateres i sanntid.
                <br/><br/>
                <strong>For Google Calendar:</strong> Gå til "Andre kalendere" → "Prenumerer på kalender" → Lim inn lenken.
                <br/>
                <strong>For Outlook/Apple Calendar:</strong> Velg "Åpne kalender fra Internett" og lim inn lenken.
              </p>
            </div>
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

          {/* Lukk-knapp hvis ingen onEdit */}
          {!onEdit && (
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
