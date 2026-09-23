import React, { useState, useEffect, useMemo } from 'react';
import { getAuditLogs } from '../firebase';

const ACTION_LABELS = {
  shift_add: 'La til vakt',
  shift_update: 'Endret vakt',
  shift_delete: 'Slettet vakt',
  employee_add: 'La til ansatt',
  employee_update: 'Endret ansatt',
  employee_delete: 'Slettet ansatt',
  department_add: 'La til avdeling',
  department_update: 'Endret avdeling',
  department_delete: 'Slettet avdeling',
  leave_status: 'Håndterte fraværsforespørsel',
  swap_status: 'Håndterte bytteforespørsel'
};

const formatTimestamp = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('no-NO', {
    timeZone: 'Europe/Oslo',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const describeDetails = (log, employees) => {
  const d = log.details || {};
  const emp = employees.find(e => String(e.id) === String(d.employeeId));
  const empName = emp?.name || d.employeeId || '';
  const parts = [];
  if (empName) parts.push(empName);
  if (d.date) parts.push(d.date);
  if (d.bulk) parts.push(`bulk: ${d.count} vakter (${(d.dates || []).join(', ')})`);
  if (d.startTime && d.endTime) parts.push(`${d.startTime}\u2013${d.endTime}`);
  if (d.status) parts.push(`status: ${d.status}`);
  if (d.name && !empName) parts.push(d.name);
  return parts.join(' \u00b7 ');
};

function AuditLogView({ employees }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [adminFilter, setAdminFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    let active = true;
    getAuditLogs().then(result => {
      if (active) {
        setLogs(result);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

  const adminNames = useMemo(() => {
    const names = new Set(logs.map(l => l.adminName).filter(Boolean));
    return Array.from(names).sort();
  }, [logs]);

  const actionTypes = useMemo(() => {
    const types = new Set(logs.map(l => l.action).filter(Boolean));
    return Array.from(types).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter(log => {
      if (adminFilter && log.adminName !== adminFilter) return false;
      if (typeFilter && log.action !== typeFilter) return false;
      if (!q) return true;
      const haystack = [
        log.adminName,
        ACTION_LABELS[log.action] || log.action,
        describeDetails(log, employees),
        formatTimestamp(log.timestamp)
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [logs, search, adminFilter, typeFilter, employees]);

  return (
    <div className="bg-white border rounded-lg shadow-sm p-6 mt-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-800">Endringslogg</h2>
        <p className="text-gray-600">Hvem som har gjort hvilke adminendringer</p>
      </div>

      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="S\u00f8k i loggen (navn, dato, handling)..."
          className="px-3 py-1.5 border rounded text-sm flex-1 min-w-[200px]"
        />
        <select
          value={adminFilter}
          onChange={(e) => setAdminFilter(e.target.value)}
          className="px-2 py-1.5 border rounded text-sm bg-white"
        >
          <option value="">Alle administratorer</option>
          {adminNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-2 py-1.5 border rounded text-sm bg-white"
        >
          <option value="">Alle handlinger</option>
          {actionTypes.map(type => (
            <option key={type} value={type}>{ACTION_LABELS[type] || type}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Laster logg...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500 text-sm">Ingen logghendelser funnet.</p>
      ) : (
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0">
              <tr className="border-b bg-gray-50">
                <th className="p-2 text-left text-xs font-medium text-gray-700">Tidspunkt</th>
                <th className="p-2 text-left text-xs font-medium text-gray-700">Administrator</th>
                <th className="p-2 text-left text-xs font-medium text-gray-700">Handling</th>
                <th className="p-2 text-left text-xs font-medium text-gray-700">Detaljer</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => (
                <tr key={log.id} className="border-b last:border-b-0">
                  <td className="p-2 border-r text-sm whitespace-nowrap">{formatTimestamp(log.timestamp)}</td>
                  <td className="p-2 border-r text-sm">{log.adminName}</td>
                  <td className="p-2 border-r text-sm">{ACTION_LABELS[log.action] || log.action}</td>
                  <td className="p-2 text-sm text-gray-600">{describeDetails(log, employees)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AuditLogView;
