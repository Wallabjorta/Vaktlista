import React, { useState } from 'react';

function OverviewCalendar({
  employees = [],
  shifts = [],
  departments = [],
  holidays = [],
  vacations = {},
  selectedDepartment,
  onClose
}) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Hent ukenummer
  const getWeekNumber = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    week1.setHours(0, 0, 0, 0);
    return 1 + Math.round(((d - week1) / 86400000 + 3) / 7);
  };

  // Generer dager for 3 måneder (ca. 12 uker)
  const getDates = () => {
    const dates = [];
    const startDate = new Date(currentDate);
    startDate.setHours(0, 0, 0, 0);

    const dayOfWeek = startDate.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(startDate.getDate() - daysToSubtract);

    // Generer ca. 12 uker (3 måneder)
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

  const isSunday = (date) => {
    return date.getDay() === 0;
  };

  const isHoliday = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return (holidays || []).includes(dateStr);
  };

  const isVacation = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return (vacations || {})[dateStr] !== undefined;
  };

  const getShiftsForDateAndEmployee = (date, employeeId) => {
    const dateStr = date.toISOString().split('T')[0];
    return shifts.filter(shift => {
      if (shift.date !== dateStr) return false;
      if (!selectedDepartment) return shift.employeeId === employeeId;
      return shift.employeeId === employeeId && shift.departmentId === selectedDepartment;
    });
  };

  const getDeptColor = (deptId) => {
    const dept = (departments || []).find(d => d?.id === deptId);
    return dept ? dept.color : '#3B82F6';
  };

  const getDeptName = (deptId) => {
    const dept = (departments || []).find(d => d?.id === deptId);
    return dept ? dept.name : deptId;
  };

  const sundayColor = '#FCA5A5';
  const holidayColor = '#F87171';
  const vacationColor = '#FEF3C7';

  // Filter employees by department if needed
  const filteredEmployees = selectedDepartment 
    ? employees.filter(emp => emp.deptIds?.includes(selectedDepartment))
    : employees;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-[95vw] max-h-[90vh] overflow-auto border">
        <div className="flex justify-between items-center p-2 border-b sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold">
            {selectedDepartment 
              ? `Oversikt (${departments.find(d => d.id === selectedDepartment)?.name || 'Ukjent'})` 
              : 'Oversiktskalender (Alle)'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        
        <div className="p-2 overflow-x-auto">
          <table className="w-full border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b">
                <th className="p-1 border-r bg-gray-50 sticky left-0 z-10 w-[80px]">
                  <div className="flex gap-1 justify-center">
                    <button onClick={() => {
                      const newDate = new Date(currentDate);
                      newDate.setDate(newDate.getDate() - 7);
                      setCurrentDate(newDate);
                    }} className="px-1 py-0.25 bg-gray-200 rounded text-xs hover:bg-gray-300">Forrige</button>
                    <button onClick={() => setCurrentDate(new Date())} className="px-1 py-0.25 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">Idag</button>
                    <button onClick={() => {
                      const newDate = new Date(currentDate);
                      newDate.setDate(newDate.getDate() + 7);
                      setCurrentDate(newDate);
                    }} className="px-1 py-0.25 bg-gray-200 rounded text-xs hover:bg-gray-300">Neste</button>
                  </div>
                </th>
                {dates.map((date, index) => {
                  const isToday = date.toDateString() === new Date().toDateString();
                  return (
                    <th
                      key={index}
                      className={`p-0.5 text-center border-r last:border-r-0 text-xs ${isToday ? 'bg-gray-100' : 'bg-gray-50'}`}
                    >
                      <div className="font-medium text-gray-700 truncate">
                        {date.toLocaleDateString('no-NO', { timeZone: 'Europe/Oslo', weekday: 'short', day: 'numeric' })}
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
              {(filteredEmployees || []).map((employee) => (
                <tr key={employee.id} className="border-b last:border-b-0">
                  <td className="p-1 border-r font-medium bg-gray-50 sticky left-0 z-10 w-[80px] truncate text-sm">
                    <div className="flex items-center gap-1 truncate">
                      <span className="truncate">{employee.name}</span>
                      {employee.isAdmin && <span className="text-xs bg-yellow-100 text-yellow-800 px-0.5 rounded">Admin</span>}
                    </div>
                  </td>
                  {dates.map((date, dateIndex) => {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const dateStr = `${year}-${month}-${day}`;
                    const shiftsForDay = getShiftsForDateAndEmployee(date, employee.id);
                    const holiday = isHoliday(date);
                    const vacation = isVacation(date);
                    const sunday = isSunday(date);
                    const isToday = date.toDateString() === new Date().toDateString();

                    let bgStyle = { backgroundColor: 'white' };
                    if (isToday) {
                      bgStyle = { backgroundColor: '#f3f4f6' };
                    } else if (holiday) {
                      bgStyle = { backgroundColor: holidayColor };
                    } else if (sunday) {
                      bgStyle = { backgroundColor: sundayColor };
                    } else if (vacation) {
                      bgStyle = { backgroundColor: vacationColor };
                    }

                    return (
                      <td
                        key={dateIndex}
                        className="p-0.5 border-r border-b h-8 w-[40px] text-xs relative"
                        style={bgStyle}
                      >
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
                              <div className="truncate text-center">
                                {deptName === 'Fri' ? 'Fri' : `${shift.startTime}-${shift.endTime}`}
                              </div>
                              {shift.comment && (
                                <div className="text-xs opacity-80 truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>
                                  {shift.comment}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default OverviewCalendar;
