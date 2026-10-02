import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { EMPLOYEE_CATEGORIES } from './ShiftCalendar';
import GroupBarsRow from './GroupBarsRow';
import { subscribeToRevenues, subscribeToStaffingConfig, recommendStaffing } from '../firebase';

const DEFAULT_STAFFING_CONFIG = {
  minimumStaff: 2,
  thresholds: [
    { minRevenue: 0, staff: 2, label: 'Lav' },
    { minRevenue: 25000, staff: 4, label: 'Middels' },
    { minRevenue: 40000, staff: 6, label: 'Høy' }
  ]
};

const toDateStr = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const inferCategory = (employee) => {
  if (employee.category && EMPLOYEE_CATEGORIES.includes(employee.category)) {
    return employee.category;
  }
  const deptIds = employee.deptIds || [];
  if (deptIds.includes('dept-4')) return 'Butikk Vest';
  if (deptIds.includes('dept-3')) return 'Skiskole';
  return 'Skiutleie Vest';
};

const groupByCategory = (employeeList) => {
  const groups = new Map();
  for (const category of EMPLOYEE_CATEGORIES) {
    groups.set(category, []);
  }
  for (const employee of employeeList) {
    const category = inferCategory(employee);
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(employee);
  }
  return [...groups.entries()].filter(([, emps]) => emps.length > 0);
};

function OverviewCalendar({
  employees = [],
  shifts = [],
  selectedDepartment,
  currentDate,
  departments = [],
  holidays = [],
  vacations = {},
  onBulkAddShifts,
  onDeleteShift,
  onClose,
  currentUser,
  onAddGroupEvent,
  onEditGroupEvent,
  onDeleteGroupEvent
}) {
  const getDates = () => {
    const dates = [];
    const startDate = new Date(currentDate || new Date());
    startDate.setHours(0, 0, 0, 0);

    const dayOfWeek = startDate.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(startDate.getDate() - daysToSubtract);

    // 12 weeks for 3 months overview (instead of 32)
    for (let week = 0; week < 12; week++) {
      for (let day = 0; day < 7; day++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + week * 7 + day);
        date.setHours(0, 0, 0, 0);
        dates.push(date);
      }
    }
    return dates;
  };

  const dates = getDates();

  const getWeekNumber = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    week1.setHours(0, 0, 0, 0);
    return 1 + Math.round(((d - week1) / 86400000 + 3) / 7);
  };

  const isSunday = (date) => {
    return date.getDay() === 0;
  };

  const isHoliday = useCallback((dateStr) => {
    return (holidays || []).includes(dateStr);
  }, [holidays]);

  const isVacation = useCallback((dateStr) => {
    return (vacations || {})[dateStr] !== undefined;
  }, [vacations]);

  const getShiftsForDateAndEmployee = useCallback((date, employeeId) => {
    return shifts.filter(shift => {
      if (shift.date !== date) return false;
      if (!selectedDepartment) return shift.employeeId === employeeId;
      return shift.employeeId === employeeId && shift.departmentId === selectedDepartment;
    });
  }, [shifts, selectedDepartment]);

  const getDeptColor = useCallback((deptId) => {
    const dept = (departments || []).find(d => d && d.id === deptId);
    return dept ? dept.color : '#3B82F6';
  }, [departments]);

  const getDeptName = useCallback((deptId) => {
    const dept = (departments || []).find(d => d && d.id === deptId);
    return dept ? dept.name : deptId;
  }, [departments]);

  const sundayColor = '#FCA5A5';
  const holidayColor = '#F87171';
  const vacationColor = '#FEF3C7';

  const [revenues, setRevenues] = useState([]);
  const [staffingConfigs, setStaffingConfigs] = useState(null);

  useEffect(() => {
    const unsub1 = subscribeToRevenues(revs => setRevenues(revs));
    const unsub2 = subscribeToStaffingConfig(cfg => {
      if (!cfg) { setStaffingConfigs({ total: DEFAULT_STAFFING_CONFIG }); return; }
      if (cfg.locations) { setStaffingConfigs(cfg.locations); return; }
      setStaffingConfigs({ total: cfg });
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  // Omsättningsdatum är från sist säsong — mappa framåt hela säsonger
  // (364 dagar = samma veckodag) så datumen täcker aktuell kalender.
  const revenueByDateAndLocation = useMemo(() => {
    const map = new Map();
    for (const rev of revenues) {
      if (!rev.date) continue;
      const [y, m, d] = rev.date.split('-').map(Number);
      const base = new Date(y, m - 1, d);
      for (let offset = 0; offset <= 3; offset++) {
        const dt = new Date(base);
        dt.setDate(dt.getDate() + offset * 364);
        map.set(`${rev.location || 'total'}_${toDateStr(dt)}`, rev.amount);
      }
    }
    return map;
  }, [revenues]);

  const LOCATION_CATEGORIES = {
    st: ['Skiutleie Vest', 'Butikk Vest'],
    'øst': ['Skiutleie Øst', 'Butikk Øst']
  };

  const employeeById = useMemo(() => {
    const map = new Map();
    for (const e of employees) map.set(String(e.id), e);
    return map;
  }, [employees]);

  const deptNameById = useMemo(() => {
    const map = new Map();
    for (const d of departments || []) {
      if (d && d.id) map.set(d.id, d.name || '');
    }
    return map;
  }, [departments]);

  const actualByDateAndLocation = useMemo(() => {
    const map = new Map();
    for (const shift of shifts) {
      if (!shift.date) continue;
      const deptName = (deptNameById.get(shift.departmentId) || '').toLowerCase();
      if (deptName === 'fri') continue;
      const emp = employeeById.get(String(shift.employeeId));
      const cat = emp ? inferCategory(emp) : null;
      const deptIsVest = deptName.includes('vest');
      const deptIsOst = deptName.includes('øst') || deptName.includes('ost');
      let loc = null;
      if (deptIsVest) loc = 'st';
      else if (deptIsOst) loc = 'øst';
      else if (cat && LOCATION_CATEGORIES.st.includes(cat)) loc = 'st';
      else if (cat && LOCATION_CATEGORIES['øst'].includes(cat)) loc = 'øst';
      if (loc) {
        const key = `${loc}_${shift.date}`;
        map.set(key, (map.get(key) || 0) + 1);
      }
    }
    return map;
  }, [shifts, employeeById, deptNameById]);

  const getRecommended = useCallback((dateStr) => {
    const configFor = (loc) => {
      const cfgs = staffingConfigs || {};
      return cfgs[loc] || cfgs.total || DEFAULT_STAFFING_CONFIG;
    };
    const result = {};
    let hasData = false;
    for (const loc of ['st', 'øst']) {
      const amount = revenueByDateAndLocation.get(`${loc}_${dateStr}`);
      if (amount == null) continue;
      hasData = true;
      const rec = recommendStaffing(amount, configFor(loc));
      result[loc] = { amount, staff: rec.staff, label: rec.label };
    }
    if (!hasData) return null;
    for (const loc of Object.keys(result)) {
      result[loc].actual = actualByDateAndLocation.get(`${loc}_${dateStr}`) || 0;
    }
    return result;
  }, [revenueByDateAndLocation, staffingConfigs, actualByDateAndLocation]);

  // Local date state for navigation
  const [overviewDate, setOverviewDate] = useState(currentDate || new Date());
  // Utvalg for bulkvakter: array av { date, employeeId }
  const [selectedCells, setSelectedCells] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    departmentId: '',
    startTime: '08:45',
    endTime: '16:00',
    comment: ''
  });

  // Filter employees by department if needed
  const filteredEmployees = selectedDepartment 
    ? employees.filter(emp => emp.deptIds?.includes(selectedDepartment))
    : employees;

  const toggleCell = (dateStr, employeeId, isCtrlOrMeta) => {
    setSelectedCells(prev => {
      const exists = prev.some(c => c.date === dateStr && c.employeeId === employeeId);
      if (exists) {
        return prev.filter(c => !(c.date === dateStr && c.employeeId === employeeId));
      }
      return [...prev, { date: dateStr, employeeId }];
    });
  };

  const uniqueSelectedDates = [...new Set(selectedCells.map(c => c.date))];
  const uniqueSelectedEmployees = [...new Set(selectedCells.map(c => c.employeeId))];

  const handleBulkSave = () => {
    if (!onBulkAddShifts) return;
    onBulkAddShifts(selectedCells, bulkForm);
    setSelectedCells([]);
    setShowBulkModal(false);
  };

  const shiftsInSelectedCells = shifts.filter(s =>
    selectedCells.some(c => c.date === s.date && c.employeeId === s.employeeId)
  );

  const handleBulkDelete = () => {
    if (!onDeleteShift || shiftsInSelectedCells.length === 0) return;
    if (!confirm('Slett ' + shiftsInSelectedCells.length + ' vakter?')) return;
    shiftsInSelectedCells.forEach(shift => onDeleteShift(shift.id));
    setSelectedCells([]);
  };

  const formatDateNo = (dateStr) => {
    const [y, m, d] = dateStr.split('-');
    const days = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    return `${d}.${m} (${days[dt.getDay()]})`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white border rounded-lg shadow-sm max-w-[95vw] w-full max-h-[90vh]">
        <div className="flex justify-between items-center p-2 border-b sticky top-0 bg-white z-20">
          <h2 className="text-lg font-semibold">
            {selectedDepartment 
              ? `Oversikt (${departments.find(d => d.id === selectedDepartment)?.name || 'Ukjent'})` 
              : 'Oversiktskalender (Alle)'}
          </h2>
          <div className="flex items-center gap-2">
            {selectedCells.length > 0 && (
              <button
                onClick={() => {
                  setBulkForm(prev => prev.departmentId
                    ? prev
                    : { ...prev, departmentId: selectedDepartment || '' });
                  setShowBulkModal(true);
                }}
                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 whitespace-nowrap"
              >
                Ny vakt ({uniqueSelectedEmployees.length} ansatte, {uniqueSelectedDates.length} dager)
              </button>
            )}
            {shiftsInSelectedCells.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 whitespace-nowrap"
              >
                Slett vakter ({shiftsInSelectedCells.length})
              </button>
            )}
            {selectedCells.length > 0 && (
              <button
                onClick={() => setSelectedCells([])}
                className="px-2 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300"
              >
                Nullstill
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
          </div>
        </div>
        
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(90vh-60px)]" style={{ overflowX: 'scroll', overflowY: 'scroll' }}>
          <table className="w-full border-collapse" style={{ tableLayout: 'auto' }}>
            <thead>
              <tr className="border-b">
                <th className="p-1 border-r bg-gray-50 sticky left-0 z-10" style={{ backgroundColor: '#f9fafb', minWidth: '70px' }}>
                  <div className="flex gap-1 justify-center">
                    <button onClick={() => {
                      const newDate = new Date(overviewDate);
                      newDate.setDate(newDate.getDate() - 7);
                      setOverviewDate(newDate);
                    }} className="px-1 py-0.5 bg-gray-200 rounded text-xs hover:bg-gray-300">Forrige</button>
                    <button onClick={() => setOverviewDate(new Date())} className="px-1 py-0.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">Idag</button>
                    <button onClick={() => {
                      const newDate = new Date(overviewDate);
                      newDate.setDate(newDate.getDate() + 7);
                      setOverviewDate(newDate);
                    }} className="px-1 py-0.5 bg-gray-200 rounded text-xs hover:bg-gray-300">Neste</button>
                  </div>
                </th>
                {dates.map((date, index) => {
                  const isToday = date.toDateString() === new Date().toDateString();
                  return (
                    <th
                      key={index}
                      className={`p-0.5 text-center border-r last:border-r-0 text-xs ${isToday ? 'bg-gray-100' : 'bg-gray-50'}`}
                      style={{ minWidth: '30px' }}
                    >
                      <div className="font-medium text-gray-700 truncate">
                        {date.getDate()}
                      </div>
                      {index % 7 === 0 && (
                        <div className="text-xs text-gray-500">
                          Uke {getWeekNumber(date)}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <GroupBarsRow
                compact
                dates={dates}
                currentUser={currentUser}
                onAddEvent={onAddGroupEvent}
                onEditEvent={onEditGroupEvent}
                onDeleteEvent={onDeleteGroupEvent}
              />
              {currentUser?.isAdmin && (
                <tr className="border-b bg-blue-50">
                  <td className="p-1 border-r text-xs font-medium text-gray-700 bg-blue-50 sticky left-0 z-10" style={{ minWidth: '70px' }}>
                    Bemanning V/Ø
                  </td>
                  {dates.map((date, dateIndex) => {
                    const dateStr = toDateStr(date);
                    const rec = getRecommended(dateStr);
                    const v = rec?.st;
                    const o = rec?.['øst'];
                    const badgeClass = (r) => {
                      if (!r) return 'px-0.5 rounded bg-gray-200 text-gray-500 font-medium';
                      if (r.actual === r.staff) return 'px-1 rounded bg-green-500 text-white font-bold';
                      if (r.actual < r.staff) return 'px-1 rounded bg-red-600 text-white font-bold';
                      return 'px-1 rounded bg-orange-500 text-white font-bold';
                    };
                    const partTitle = (name, r) => r
                      ? `${name}: rek. ${r.staff}, faktisk ${r.actual} (${new Intl.NumberFormat('no-NO').format(r.amount)} kr)${r.actual === r.staff ? ' — riktig' : r.actual < r.staff ? ` — ${r.staff - r.actual} under` : ` — ${r.actual - r.staff} over`}`
                      : `${name}: ingen data`;
                    const title = v || o
                      ? `Rek. bemanning — ${partTitle('Vest', v)} · ${partTitle('Øst', o)}`
                      : 'Ingen omsättningsdata';
                    return (
                      <td key={dateIndex} className="p-0.5 border-r text-center text-[10px]" title={title}>
                        {rec ? (
                          <span className="inline-flex gap-0.5 justify-center">
                            <span className={badgeClass(v)}>V{v ? v.staff : '–'}</span>
                            <span className={badgeClass(o)}>Ø{o ? o.staff : '–'}</span>
                          </span>
                        ) : (
                          <span className="text-gray-300">·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              )}
              {groupByCategory(filteredEmployees || []).flatMap(([category, categoryEmployees]) => [
                <tr key={`cat-${category}`} className="border-b-2 border-gray-700 bg-gray-700 text-white">
                  <td
                    colSpan={1 + dates.length}
                    className="py-px px-3 font-semibold text-xs uppercase tracking-wide sticky left-0"
                    style={{ backgroundColor: '#374151' }}
                  >
                    {category}
                  </td>
                </tr>,
                ...categoryEmployees.map((employee) => (
                <tr key={employee.id} className="border-b last:border-b-0">
                  <td className="p-1 border-r font-medium bg-gray-50 sticky left-0 z-10" style={{ backgroundColor: '#f9fafb', minWidth: '70px' }}>
                    <div className="flex items-center gap-1 text-sm truncate">
                      <span className="truncate">{employee.name}</span>
                      {employee.isAdmin && <span className="text-xs bg-yellow-100 text-yellow-800 px-1 rounded">Admin</span>}
                    </div>
                  </td>
                  {dates.map((date, dateIndex) => {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const dateStr = `${year}-${month}-${day}`;
                    const shiftsForDay = getShiftsForDateAndEmployee(dateStr, employee.id);
                    const holiday = isHoliday(dateStr);
                    const vacation = isVacation(dateStr);
                    const sunday = isSunday(date);
                    const isToday = date.toDateString() === new Date().toDateString();

                    let bgStyle = { backgroundColor: 'white', minWidth: '20px' };
                    if (isToday) {
                      bgStyle = { ...bgStyle, backgroundColor: '#f3f4f6' };
                    } else if (holiday) {
                      bgStyle = { ...bgStyle, backgroundColor: holidayColor };
                    } else if (sunday) {
                      bgStyle = { ...bgStyle, backgroundColor: sundayColor };
                    } else if (vacation) {
                      bgStyle = { ...bgStyle, backgroundColor: vacationColor };
                    }

                    const isCellSelected = selectedCells.some(c => c.date === dateStr && c.employeeId === employee.id);
                    const cellStyle = isCellSelected ? { ...bgStyle, backgroundColor: '#86efac' } : bgStyle;
                    return (
                      <td
                        key={dateIndex}
                        className="p-0.5 border-r border-b h-auto relative text-[10px] cursor-pointer"
                        style={cellStyle}
                        onClick={(e) => toggleCell(dateStr, employee.id, e.ctrlKey || e.metaKey)}
                      >
                        {shiftsForDay.length > 0 && (
                          <div className="flex flex-wrap gap-0.5">
                            {shiftsForDay.map((shift, shiftIndex) => {
                              const deptColor = getDeptColor(shift.departmentId);
                              const deptName = getDeptName(shift.departmentId);
                              
                              return (
                                <div
                                  key={shiftIndex}
                                  className="p-0.5 rounded text-xs text-white font-medium truncate"
                                  style={{ backgroundColor: deptColor }}
                                  title={`${employee.name}: ${shift.startTime}-${shift.endTime} (${deptName})${shift.comment ? `: ${shift.comment}` : ''}`}
                                >
                                  {deptName === 'Fri' ? 'Fri' : shift.startTime.replace(':00', '')}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
                ))
              ])}
            </tbody>
          </table>
        </div>
        {showBulkModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full border max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h2 className="text-xl font-semibold">
                  Ny vakt ({uniqueSelectedEmployees.length} ansatte × {uniqueSelectedDates.length} {uniqueSelectedDates.length === 1 ? 'dag' : 'dager'})
                </h2>
                <button onClick={() => setShowBulkModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>{selectedCells.length} vakter</strong> vil bli opprettet:
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    {[...uniqueSelectedDates].sort().map(d => formatDateNo(d)).join(', ')}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Celler der ansatte allerede har vakt hoppes over.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Avdeling</label>
                  <select
                    value={bulkForm.departmentId}
                    onChange={(e) => setBulkForm(prev => ({ ...prev, departmentId: e.target.value }))}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">Velg avdeling</option>
                    {(departments || []).filter(dept => dept).map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Starttid</label>
                    <input
                      type="time"
                      value={bulkForm.startTime}
                      onChange={(e) => setBulkForm(prev => ({ ...prev, startTime: e.target.value }))}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Sluttid</label>
                    <input
                      type="time"
                      value={bulkForm.endTime}
                      onChange={(e) => setBulkForm(prev => ({ ...prev, endTime: e.target.value }))}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Kommentar / Arbeidsoppgave</label>
                  <textarea
                    value={bulkForm.comment}
                    onChange={(e) => setBulkForm(prev => ({ ...prev, comment: e.target.value }))}
                    className="w-full p-2 border rounded"
                    placeholder="Skriv en kommentar om arbeidsoppgaven..."
                    rows={2}
                  />
                </div>
                <div className="flex gap-2 pt-4 border-t">
                  <button
                    onClick={handleBulkSave}
                    className="px-4 py-2 bg-green-600 text-white rounded border border-green-600 hover:bg-green-700 flex-1"
                  >
                    Lagre {selectedCells.length} vakter
                  </button>
                  <button
                    onClick={() => setShowBulkModal(false)}
                    className="px-4 py-2 bg-gray-200 rounded border hover:bg-gray-300 flex-1"
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OverviewCalendar;
