import React, { useState, useCallback } from 'react';

function OverviewCalendar({
  employees = [],
  shifts = [],
  selectedDepartment,
  currentDate,
  departments = [],
  holidays = [],
  vacations = {},
  onClose
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

  // Local date state for navigation
  const [overviewDate, setOverviewDate] = useState(currentDate || new Date());

  // Filter employees by department if needed
  const filteredEmployees = selectedDepartment 
    ? employees.filter(emp => emp.deptIds?.includes(selectedDepartment))
    : employees;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white border rounded-lg shadow-sm max-w-[95vw] w-full max-h-[90vh]">
        <div className="flex justify-between items-center p-2 border-b sticky top-0 bg-white z-20">
          <h2 className="text-lg font-semibold">
            {selectedDepartment 
              ? `Oversikt (${departments.find(d => d.id === selectedDepartment)?.name || 'Ukjent'})` 
              : 'Oversiktskalender (Alle)'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        
        <div className="overflow-x-auto max-h-[calc(90vh-60px)] overflow-y-auto">
          <table className="w-full border-collapse" style={{ tableLayout: 'auto' }}>
            <thead>
              <tr className="border-b">
                <th className="p-1 border-r bg-gray-50 sticky left-0 z-10" style={{ backgroundColor: '#f9fafb', minWidth: '80px' }}>
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
                      style={{ minWidth: '40px' }}
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
              {(filteredEmployees || []).map((employee) => (
                <tr key={employee.id} className="border-b last:border-b-0">
                  <td className="p-1 border-r font-medium bg-gray-50 sticky left-0 z-10" style={{ backgroundColor: '#f9fafb', minWidth: '80px' }}>
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

                    return (
                      <td
                        key={dateIndex}
                        className="p-0.5 border-r border-b h-auto relative text-xs"
                        style={bgStyle}
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default OverviewCalendar;
