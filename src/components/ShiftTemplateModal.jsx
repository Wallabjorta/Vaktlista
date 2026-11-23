import { useState } from 'react';

function ShiftTemplateModal({ templates = [], onAdd, onDelete, onClose }) {
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('08:45');
  const [endTime, setEndTime] = useState('16:00');

  const sorted = templates.slice().sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  const label = (t) => t.name ? `${t.name} (${t.startTime}-${t.endTime})` : `${t.startTime}-${t.endTime}`;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!startTime || !endTime) { alert('Fyll ut start- og sluttid!'); return; }
    if (startTime >= endTime) { alert('Sluttid må være etter starttid!'); return; }
    onAdd({ name: name.trim(), startTime, endTime });
    setName('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full border max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h2 className="text-xl font-semibold">Vaktmaler</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <p className="text-sm text-gray-600 mb-3">
          Forhåndsdefinerte vakttider som kan velges raskt når man legger til vakt.
        </p>

        <ul className="mb-4 space-y-1">
          {sorted.length === 0 && (
            <li className="text-sm text-gray-400 italic">Ingen vaktmaler ennå</li>
          )}
          {sorted.map(t => (
            <li key={t.id} className="flex justify-between items-center bg-gray-50 border rounded px-2 py-1 text-sm">
              <span>{label(t)}</span>
              <button
                onClick={() => onDelete(t.id)}
                className="text-red-600 hover:text-red-800 text-xs"
                title="Slett vaktmal"
              >
                ✕ Slett
              </button>
            </li>
          ))}
        </ul>

        <form onSubmit={handleSubmit} className="space-y-3 border-t pt-3">
          <div>
            <label className="block text-sm font-medium mb-1">Navn (valgfritt)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="f.eks. Kveldsvakt"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Starttid</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sluttid</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
              Lukk
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              + Legg til vaktmal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ShiftTemplateModal;
