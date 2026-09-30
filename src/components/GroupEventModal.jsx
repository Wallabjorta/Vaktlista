import React, { useState } from 'react';

const COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899'];

const EMPTY_FORM = {
  groupName: '',
  pickupDate: '',
  dropoffDate: '',
  contact: '',
  participants: '',
  notes: '',
  color: COLORS[0]
};

function GroupEventModal({ event, onSave, onClose }) {
  const [form, setForm] = useState(() => {
    if (!event) return EMPTY_FORM;
    return {
      groupName: event.groupName || '',
      pickupDate: event.pickupDate || '',
      dropoffDate: event.dropoffDate || '',
      contact: event.contact || '',
      participants: event.participants != null ? String(event.participants) : '',
      notes: event.notes || '',
      color: event.color || COLORS[0]
    };
  });

  const handleChange = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.groupName.trim()) {
      alert('Gruppenavn er påkrevd!');
      return;
    }
    if (!form.pickupDate && !form.dropoffDate) {
      alert('Minst én dato (henting eller levering) må settes!');
      return;
    }
    onSave({
      groupName: form.groupName.trim(),
      pickupDate: form.pickupDate || null,
      dropoffDate: form.dropoffDate || null,
      contact: form.contact.trim() || null,
      participants: form.participants ? Number(form.participants) : null,
      notes: form.notes.trim() || null,
      color: form.color
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full border max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h2 className="text-xl font-semibold">{event ? 'Rediger grupperevent' : 'Nytt grupperevent'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Gruppenavn *</label>
            <input
              type="text"
              value={form.groupName}
              onChange={handleChange('groupName')}
              className="w-full p-2 border rounded"
              placeholder="F.eks. Skolegruppe Tromsø"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Hentedato</label>
              <input
                type="date"
                value={form.pickupDate}
                onChange={handleChange('pickupDate')}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Leveringsdato</label>
              <input
                type="date"
                value={form.dropoffDate}
                onChange={handleChange('dropoffDate')}
                className="w-full p-2 border rounded"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Kontaktperson</label>
              <input
                type="text"
                value={form.contact}
                onChange={handleChange('contact')}
                className="w-full p-2 border rounded"
                placeholder="Navn / telefon"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Antall deltakere</label>
              <input
                type="number"
                min="0"
                value={form.participants}
                onChange={handleChange('participants')}
                className="w-full p-2 border rounded"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notater</label>
            <textarea
              value={form.notes}
              onChange={handleChange('notes')}
              className="w-full p-2 border rounded"
              rows={2}
              placeholder="Annen nyttig informasjon..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Farge</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, color }))}
                  className={`w-8 h-8 rounded-full border-2 ${form.color === color ? 'border-gray-800' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-4 border-t">
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 text-white rounded border border-purple-600 hover:bg-purple-700 flex-1"
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
      </div>
    </div>
  );
}

export default GroupEventModal;
