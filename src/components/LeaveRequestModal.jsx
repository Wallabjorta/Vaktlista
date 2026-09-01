import React, { useState, useEffect } from 'react';
import { getEmployees } from '../firebase';

function LeaveRequestModal({ employee, onClose, onSubmit }) {
  const [requestType, setRequestType] = useState('leave');
  const [date, setDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [targetEmployeeId, setTargetEmployeeId] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    if (requestType === 'swap' && employee?.id) {
      getEmployees().then(data => setEmployees(data.filter(e => e.id !== employee.id)));
    }
  }, [requestType, employee?.id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (requestType === 'leave') {
      if (!date) { alert('Velg en dato!'); return; }
      if (!reason) { alert('Skriv en årsak!'); return; }
      onSubmit({
        type: 'leave',
        employeeId: employee.id,
        employeeName: employee.name,
        date,
        endDate: endDate || date,
        reason,
        createdAt: new Date().toISOString()
      });
    } else {
      if (!date) { alert('Velg en dato du vil bytte fra!'); return; }
      if (!targetEmployeeId) { alert('Velg en ansatt å bytte med!'); return; }
      if (!targetDate) { alert('Velg en dato du vil bytte til!'); return; }
      const targetEmployee = employees.find(e => e.id === targetEmployeeId);
      onSubmit({
        type: 'swap',
        employeeId: employee.id,
        employeeName: employee.name,
        originalDate: date,
        targetEmployeeId,
        targetEmployeeName: targetEmployee?.name || 'Ukjent',
        targetDate,
        reason: reason || 'Bytte forespurt',
        createdAt: new Date().toISOString()
      });
    }
    setDate(''); setEndDate(''); setReason(''); setTargetEmployeeId(''); setTargetDate('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h2 className="text-xl font-semibold">
            {requestType === 'leave' ? 'Be om fridag' : 'Be om bytte av vakt'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">X</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2 mb-4">
            <button type="button" onClick={() => setRequestType('leave')}
              className={`px-4 py-2 rounded text-sm ${requestType === 'leave' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
              Fridag
            </button>
            <button type="button" onClick={() => setRequestType('swap')}
              className={`px-4 py-2 rounded text-sm ${requestType === 'swap' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
              Bytte vakt
            </button>
          </div>

          {requestType === 'leave' ? (
            <>
              <div>
                <label className="block text-sm mb-1">Dato *</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="w-full p-2 border rounded" required />
              </div>
              <div>
                <label className="block text-sm mb-1">T.o.m. dato</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-2 border rounded" min={date} />
              </div>
              <div>
                <label className="block text-sm mb-1">Årsak *</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)}
                  className="w-full p-2 border rounded" rows={3} required />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm mb-1">Din vakt dato *</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="w-full p-2 border rounded" required />
              </div>
              <div>
                <label className="block text-sm mb-1">Bytte med *</label>
                <select value={targetEmployeeId} onChange={(e) => setTargetEmployeeId(e.target.value)}
                  className="w-full p-2 border rounded" required>
                  <option value="">Velg ansatt</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Ønsket dato *</label>
                <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full p-2 border rounded" required />
              </div>
              <div>
                <label className="block text-sm mb-1">Årsak</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)}
                  className="w-full p-2 border rounded" rows={2} />
              </div>
            </>
          )}

          <div className="flex gap-2 pt-4 border-t">
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded flex-1">
              Send inn
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded flex-1">
              Avbryt
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LeaveRequestModal;
