import React, { useState } from 'react';

function LoginModal({ employees, onLogin, onClose }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email) {
      alert('Velg en ansatt!');
      return;
    }
    const selectedUser = employees.find(emp => emp.id === email);
    if (!selectedUser) {
      alert('Ogiltig ansatt! Vennligst velg en ansatt fra listen.');
      return;
    }
    if (!password) {
      alert('Passord er pkrevd!');
      return;
    }
    onLogin(email, password);
  };

  return (
    <div id="login-modal" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full border">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h2 className="text-xl font-semibold">Logg inn</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Velg ansatt</label>
              <select
                id="login-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="">Velg en ansatt</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} {emp.isAdmin && '(Admin)'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Passord</label>
              <input
                type="password"
                id="login-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="Oppgi passord"
                required
              />
            </div>
            <div className="flex gap-2 pt-4 border-t">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded border border-blue-600 hover:bg-blue-700 flex-1"
              >
                Logg inn
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

export default LoginModal;
