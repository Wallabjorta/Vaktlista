import React, { useState } from 'react';
import { verifyPassword, hashPassword } from '../utils/passwords';

function ChangePasswordModal({ currentUser, onSubmit, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert('Fyll ut alle feltene!');
      return;
    }
    if (newPassword.length < 4) {
      alert('Det nye passordet må være minst 4 tegn!');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('De nye passordene er ikke like!');
      return;
    }
    setSaving(true);
    try {
      const valid = await onSubmit(currentPassword, newPassword);
      if (valid) {
        alert('Passordet er endret!');
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
        <h2 className="text-xl font-bold mb-4">Endre passord</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Nåværende passord</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              autoFocus
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Nytt passord</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Gjenta nytt passord</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div className="flex gap-2 pt-4 border-t">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded border border-blue-600 hover:bg-blue-700 flex-1 disabled:opacity-50"
            >
              {saving ? 'Lagrer...' : 'Lagre'}
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

export default ChangePasswordModal;
