import React, { useState } from 'react';

const toISODate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const monthBounds = (offset) => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { start: toISODate(first), end: toISODate(last) };
};

const MONTH_NAMES = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];

const seasonBounds = (offset = 0) => {
  const now = new Date();
  let startYear = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
  startYear += offset;
  return { start: `${startYear}-11-01`, end: `${startYear + 1}-04-30` };
};

const minutesBetween = (start, end) => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some(n => isNaN(n))) return 0;
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return mins;
};

const formatHours = (minutes) => {
  if (!minutes) return '0 t';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} t ${m} min` : `${h} t`;
};

function AdminStats({ employees, shifts, holidays, departments }) {
  const [periodMode, setPeriodMode] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const getRange = () => {
    if (periodMode === 'month') return monthBounds(0);
    if (periodMode === 'lastMonth') return monthBounds(-1);
    if (periodMode === 'season') return seasonBounds(0);
    if (periodMode === 'lastSeason') return seasonBounds(-1);
    if (periodMode === 'custom') return { start: customStart, end: customEnd };
    return null;
  };

  const range = getRange();
  const hasRange = Boolean(range && range.start && range.end);
  const periodShifts = hasRange
    ? shifts.filter(shift => shift.date >= range.start && shift.date <= range.end)
    : shifts;

  const periodLabel = (() => {
    if (periodMode === 'all') return 'Alle vakter';
    if (periodMode === 'month') {
      const now = new Date();
      return `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
    }
    if (periodMode === 'lastMonth') {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    }
    if (periodMode === 'season' || periodMode === 'lastSeason') {
      const r = periodMode === 'season' ? seasonBounds(0) : seasonBounds(-1);
      const startYear = Number(r.start.split('-')[0]);
      return `Sesong ${startYear}/${startYear + 1} (nov–apr)`;
    }
    if (hasRange) {
      const fmt = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' });
      return `${fmt(range.start)} – ${fmt(range.end)}`;
    }
    return 'Egendefinert (velg datoer)';
  })();

  // Beregn statistikk for hver ansatt
  const calculateEmployeeStats = (employee) => {
    const employeeShifts = periodShifts.filter(shift => shift.employeeId === employee.id);
    
    // Totalt antall vakter
    const totalShifts = employeeShifts.length;
    
    // Antall unike dager med vakt
    const uniqueDays = new Set(employeeShifts.map(shift => shift.date));
    const totalDays = uniqueDays.size;
    
    // Antall søndager
    let sundaysWorked = 0;
    let holidaysWorked = 0;
    let specialDaysWorked = 0;
    
    uniqueDays.forEach(dateStr => {
      const date = new Date(dateStr + 'T00:00:00');
      const dayOfWeek = date.getDay();
      const isSunday = dayOfWeek === 0;
      const isHoliday = holidays && holidays[dateStr];
      
      if (isSunday) {
        sundaysWorked++;
        specialDaysWorked++;
      }
      if (isHoliday) {
        holidaysWorked++;
        specialDaysWorked++;
      }
    });
    
    // Antall vakter per avdeling
    const shiftsByDepartment = {};
    let totalMinutes = 0;
    let friMinutes = 0;
    let ferieMinutes = 0;
    employeeShifts.forEach(shift => {
      const deptName = departments.find(d => d.id === shift.departmentId)?.name || shift.departmentId;
      const deptLower = (deptName || '').toLowerCase();
      if (deptLower === 'fri') {
        friMinutes += minutesBetween(shift.startTime, shift.endTime);
      } else if (deptLower === 'ferie') {
        ferieMinutes += minutesBetween(shift.startTime, shift.endTime);
      } else {
        shiftsByDepartment[deptName] = (shiftsByDepartment[deptName] || 0) + 1;
        totalMinutes += minutesBetween(shift.startTime, shift.endTime);
      }
    });
    
    return {
      totalShifts,
      totalDays,
      sundaysWorked,
      holidaysWorked,
      specialDaysWorked,
      shiftsByDepartment,
      totalMinutes,
      totalHours: totalMinutes / 60,
      friMinutes,
      friHours: friMinutes / 60,
      ferieMinutes,
      ferieHours: ferieMinutes / 60
    };
  };

  // Beregn total statistikk
  const calculateTotalStats = () => {
    let totalShifts = 0;
    let totalDays = 0;
    let totalSundays = 0;
    let totalHolidays = 0;
    let totalMinutes = 0;
    
    employees.forEach(employee => {
      const stats = calculateEmployeeStats(employee);
      totalShifts += stats.totalShifts;
      totalDays += stats.totalDays;
      totalSundays += stats.sundaysWorked;
      totalHolidays += stats.holidaysWorked;
      totalMinutes += stats.totalMinutes;
    });
    
    return { totalShifts, totalDays, totalSundays, totalHolidays, totalMinutes };
  };

  const totalStats = calculateTotalStats();

  const contractInfo = (employee) => {
    let contractHours = Number(employee.contractHours) || 0;
    const percent = Number(employee.contractPercent) || 0;
    if (percent && employee.contractStart && employee.contractEnd) {
      const start = new Date(employee.contractStart + 'T00:00:00');
      const end = new Date(employee.contractEnd + 'T00:00:00');
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        const days = Math.round((end - start) / 86400000) + 1;
        contractHours = Math.round((days / 7) * 40 * (percent / 100) * 2) / 2;
      }
    }
    if (!contractHours) return null;
    const stats = calculateEmployeeStats(employee);
    const usedMinutes = stats.totalMinutes + stats.friMinutes;
    const usedHours = usedMinutes / 60;
    const ferieHours = stats.ferieHours;
    const remainingHours = contractHours - usedHours - ferieHours;
    return { contractHours, usedHours, ferieHours, remainingHours };
  };

  const exportCsv = () => {
    const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Ansatt', 'Totale vakter', 'Arbeidstimer', 'Timer (desimal)', 'Fri-timer (fratrekk)', 'Ferie-timer', 'Kontraktstimer', 'Brukte timer (inkl. fri og ferie)', 'Gjenstående timer', 'Totale dager', 'Søndager', 'Helligdager', 'Spesialdager', 'Avdelinger'];
    const rows = employees.map(employee => {
      const stats = calculateEmployeeStats(employee);
      const c = contractInfo(employee);
      return [
        employee.name,
        stats.totalShifts,
        formatHours(stats.totalMinutes),
        stats.totalHours.toFixed(2).replace('.', ','),
        stats.friHours.toFixed(2).replace('.', ','),
        stats.ferieHours.toFixed(2).replace('.', ','),
        c ? String(c.contractHours).replace('.', ',') : '',
        c ? (c.usedHours + c.ferieHours).toFixed(2).replace('.', ',') : '',
        c ? c.remainingHours.toFixed(2).replace('.', ',') : '',
        stats.totalDays,
        stats.sundaysWorked,
        stats.holidaysWorked,
        stats.specialDaysWorked,
        Object.entries(stats.shiftsByDepartment).map(([name, count]) => `${name}: ${count}`).join('; ')
      ].map(csvEscape).join(',');
    });
    const csv = '\uFEFF' + [header.map(csvEscape).join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safePeriod = periodLabel.replace(/[^\w-]+/g, '-');
    link.href = url;
    link.download = `vaktstatistikk-${safePeriod}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border rounded-lg shadow-sm p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800">Administrator Statistikk</h2>
        <p className="text-gray-600">Oversikt over arbeidstimer og spesialdager</p>

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600">Periode:</span>
          <select
            value={periodMode}
            onChange={(e) => setPeriodMode(e.target.value)}
            className="px-2 py-1 border rounded text-sm bg-white"
          >
            <option value="all">Alle vakter</option>
            <option value="month">Denne måneden</option>
            <option value="lastMonth">Forrige måned</option>
            <option value="season">Denne sesongen (nov–apr)</option>
            <option value="lastSeason">Forrige sesong (nov–apr)</option>
            <option value="custom">Egendefinert</option>
          </select>
          {periodMode === 'custom' && (
            <>
              <label className="text-sm text-gray-600">
                Fra
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="ml-1 px-2 py-1 border rounded text-sm"
                />
              </label>
              <label className="text-sm text-gray-600">
                Til
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="ml-1 px-2 py-1 border rounded text-sm"
                />
              </label>
            </>
          )}
          <span className="text-sm font-medium text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
            {periodLabel}
          </span>
        </div>
      </div>

      {/* Total oversikt */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg border">
          <div className="text-2xl font-bold text-blue-600">{totalStats.totalShifts}</div>
          <div className="text-sm text-gray-600">Totalt antall vakter</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border">
          <div className="text-2xl font-bold text-green-600">{totalStats.totalDays}</div>
          <div className="text-sm text-gray-600">Totalt antall dager</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg border">
          <div className="text-2xl font-bold text-yellow-600">{totalStats.totalSundays}</div>
          <div className="text-sm text-gray-600">Totalt antall søndager</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border">
          <div className="text-2xl font-bold text-red-600">{totalStats.totalHolidays}</div>
          <div className="text-sm text-gray-600">Totalt antall helligdager</div>
        </div>
      </div>

      <button
        onClick={exportCsv}
        className="mb-4 px-4 py-2 bg-green-600 text-white rounded border border-green-600 hover:bg-green-700 text-sm"
      >
        Eksporter til CSV
      </button>

      {/* Detaljert statistikk per ansatt */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-2 text-left text-xs font-medium text-gray-700">Ansatt</th>
              <th className="p-2 text-left text-xs font-medium text-gray-700">Totale vakter</th>
              <th className="p-2 text-left text-xs font-medium text-gray-700">Arbeidstimer</th>
              <th className="p-2 text-left text-xs font-medium text-gray-700">Fri (fratrekk)</th>
              <th className="p-2 text-left text-xs font-medium text-gray-700">Ferie</th>
              <th className="p-2 text-left text-xs font-medium text-gray-700">Kontrakt</th>
              <th className="p-2 text-left text-xs font-medium text-gray-700">Totale dager</th>
              <th className="p-2 text-left text-xs font-medium text-gray-700">Søndager</th>
              <th className="p-2 text-left text-xs font-medium text-gray-700">Helligdager</th>
              <th className="p-2 text-left text-xs font-medium text-gray-700">Spesialdager</th>
              <th className="p-2 text-left text-xs font-medium text-gray-700">Avdelinger</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => {
              const stats = calculateEmployeeStats(employee);
              return (
                <tr key={employee.id} className="border-b last:border-b-0">
                  <td className="p-2 border-r">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{employee.name}</span>
                      {employee.isAdmin && <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">Admin</span>}
                    </div>
                  </td>
                  <td className="p-2 border-r">{stats.totalShifts}</td>
                  <td className="p-2 border-r">{formatHours(stats.totalMinutes)}</td>
                  <td className="p-2 border-r text-gray-500">{stats.friMinutes ? `-${formatHours(stats.friMinutes)}` : '0 t'}</td>
                  <td className="p-2 border-r text-sky-700">{stats.ferieMinutes ? formatHours(stats.ferieMinutes) : '0 t'}</td>
                  <td className="p-2 border-r">
                    {(() => {
                      const c = contractInfo(employee);
                      if (!c) return <span className="text-gray-400">Ingen kontrakt</span>;
                      const cls = c.remainingHours < 0 ? 'text-red-600 font-semibold' : c.remainingHours < 10 ? 'text-yellow-700 font-semibold' : 'text-green-700';
                      return (
                        <span className={cls} title={`Arbeid: ${c.usedHours.toFixed(1).replace('.', ',')} t, ferie: ${c.ferieHours.toFixed(1).replace('.', ',')} t, gjenstående: ${c.remainingHours.toFixed(1).replace('.', ',')} t`}>
                          {(c.usedHours + c.ferieHours).toFixed(1).replace('.', ',')} / {c.contractHours.toFixed(1).replace('.', ',')} t
                        </span>
                      );
                    })()}
                  </td>
                  <td className="p-2 border-r">{stats.totalDays}</td>
                  <td className="p-2 border-r">{stats.sundaysWorked}</td>
                  <td className="p-2 border-r">{stats.holidaysWorked}</td>
                  <td className="p-2 border-r">{stats.specialDaysWorked}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(stats.shiftsByDepartment).map(([deptName, count]) => {
                        const dept = departments.find(d => d.name === deptName);
                        return (
                          <span
                            key={deptName}
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: dept?.color || '#ccc', color: 'white' }}
                          >
                            {deptName}: {count}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminStats;
