import React, { useEffect, useState } from 'react';

function EditShiftModal({ shift, employeeName, onSave, onClose }) {
  const [comment, setComment] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    setComment(shift?.comment || '');
    setStartTime(shift?.startTime || '');
    setEndTime(shift?.endTime || '');
  }, [shift]);

  if (!shift) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!startTime) { alert('Velg starttid!'); return; }
    if (!endTime) { alert('Velg sluttid!'); return; }
    if (startTime >= endTime) { alert('Sluttid må være etter starttid!'); return; }
    onSave(shift.id, { ...shift, startTime, endTime, comment });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full border">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h2 className="text-xl font-semibold">Rediger vakt</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-sm text-gray-600">
            <p><strong>Ansatt:</strong> {employeeName || shift.employeeId}</p>
            <p><strong>Dato:</strong> {shift.date}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
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

          <div>
            <label className="block text-sm font-medium mb-1">Kommentar / Arbeidsoppgave</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="Skriv en kommentar om arbeidsoppgaven..."
              rows={3}
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            >
              Avbryt
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Lagre
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditShiftModal;
