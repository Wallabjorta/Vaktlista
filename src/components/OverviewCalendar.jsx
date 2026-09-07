import React, { useState, useEffect } from 'react';

function OverviewCalendar({
  employees = [],
  shifts = [],
  departments = [],
  holidays = [],
  vacations = {},
  onClose
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(null);

  // Generer 3 måneder fremover
  const getMonths = () => {
    const months = [];
    const startDate = new Date(currentDate);
    startDate.setDate(1); // Start på første dag i måneden

    for (let i = 0; i < 3; i++) {
      const monthStart = new Date(startDate);
      monthStart.setMonth(startDate.getMonth() + i);
      
      const year = monthStart.getFullYear();
      const month = monthStart.getMonth();
      const monthName = monthStart.toLocaleDateString('no-NO', { month: 'long', year: 'numeric' });
      
      // Generer dager i måneden
      const days = [];
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      // Legg til tomme dager for å starte på mandag
      const startDay = firstDay.getDay();
      const daysToAdd = startDay === 0 ? 6 : startDay - 1;
      
      for (let d = 0; d < daysToAdd; d++) {
        days.push(null);
      }
      
      // Legg til alle dager i måneden
      for (let day = 1; day <= lastDay.getDate(); day++) {
        days.push(new Date(year, month, day));
      }
      
      // Legg til tomme dager for å fullføre uken
      const endDay = lastDay.getDay();
      const daysToAddEnd = endDay === 0 ? 0 : 7 - endDay;
      for (let d = 0; d < daysToAddEnd; d++) {
        days.push(null);
      }
      
      months.push({
        name: monthName,
        year,
        month,
        days
      });
    }
    return months;
  };

  const months = getMonths();

  const isSunday = (date) => {
    return date?.getDay() === 0;
  };

  const isHoliday = (date) => {
    if (!date) return false;
    const dateStr = date.toISOString().split('T')[0];
    return (holidays || []).includes(dateStr);
  };

  const isVacation = (date) => {
    if (!date) return false;
    const dateStr = date.toISOString().split('T')[0];
    return (vacations || {})[dateStr] !== undefined;
  };

  const getShiftsForDate = (date) => {
    if (!date) return [];
    const dateStr = date.toISOString().split('T')[0];
    return shifts.filter(shift => shift.date === dateStr);
  };

  const getDeptColor = (deptId) => {
    const dept = (departments || []).find(d => d?.id === deptId);
    return dept ? dept.color : '#3B82F6';
  };

  const getDeptName = (deptId) => {
    const dept = (departments || []).find(d => d?.id === deptId);
    return dept ? dept.name : deptId;
  };

  const getEmployeeName = (employeeId) => {
    const emp = (employees || []).find(e => e.id === employeeId);
    return emp ? emp.name : 'Ukjent';
  };

  const sundayColor = '#FCA5A5';
  const holidayColor = '#F87171';
  const vacationColor = '#FEF3C7';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-[95vw] max-h-[90vh] overflow-auto border">
        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold">Oversiktskalender (3 måneder)</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        
        <div className="p-4">
          {months.map((month, monthIndex) => (
            <div key={monthIndex} className="mb-8">
              <h3 className="text-lg font-semibold text-center mb-3">{month.name}</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b">
                      {['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map((day, i) => (
                        <th key={i} className="p-2 text-center border-r last:border-r-0 bg-gray-50 text-sm font-medium">{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: Math.ceil(month.days.length / 7) }).map((_, weekIndex) => {
                      const weekDays = month.days.slice(weekIndex * 7, (weekIndex + 1) * 7);
                      return (
                        <tr key={weekIndex} className="border-b last:border-b-0">
                          {weekDays.map((date, dayIndex) => {
                            if (!date) {
                              return <td key={dayIndex} className="p-1 border-r last:border-r-0 bg-gray-50"></td>;
                            }
                            
                            const dateStr = date.toISOString().split('T')[0];
                            const dayShifts = getShiftsForDate(date);
                            const sunday = isSunday(date);
                            const holiday = isHoliday(date);
                            const vacation = isVacation(date);
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
                                key={dayIndex}
                                className="p-1 border-r last:border-r-0 h-20 relative"
                                style={bgStyle}
                              >
                                <div className="text-sm font-medium text-gray-700">{date.getDate()}</div>
                                {dayShifts.map((shift, shiftIndex) => {
                                  const deptColor = getDeptColor(shift.departmentId);
                                  const deptName = getDeptName(shift.departmentId);
                                  const employeeName = getEmployeeName(shift.employeeId);
                                  
                                  return (
                                    <div
                                      key={shiftIndex}
                                      className="mt-1 p-1 rounded text-xs text-white font-medium truncate"
                                      style={{ backgroundColor: deptColor }}
                                      title={`${employeeName}: ${shift.startTime}-${shift.endTime} (${deptName})${shift.comment ? `: ${shift.comment}` : ''}`}
                                    >
                                      <div className="truncate">
                                        {employeeName.split(' ')[0]} {shift.startTime}-{shift.endTime}
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default OverviewCalendar;
