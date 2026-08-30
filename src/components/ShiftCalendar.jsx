import React from 'react';

function ShiftCalendar({
  employees,
  shifts,
  selectedDepartment,
  currentDate,
  departments,
  holidays,
  vacations,
  currentUser,
  onAddShift,
  onDeleteShift,
  showHistory = true
}) {
  const getDates = () => {
    const dates = [];
    const startDate = new Date(currentDate);
    startDate.setHours(0, 0, 0, 0);

    const dayOfWeek = startDate.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(startDate.getDate() - daysToSubtract);

    // startDate är nu måndag i aktuell vecka
    // Om showHistory=false: starta från aktuell vecka (vecka 0)
    // Om showHistory=true: starta från förra vecka (vecka -1)
    const startWeek = showHistory ? -1 : 0;

    for (let week = startWeek; week < 32; week++) {
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

  const getDeptColor = (deptId) => {
    const dept = departments.find(d => d.id === deptId);
    return dept ? dept.color : '#ccc';
  };

  const holidayColor = '#FEF2F2';
  const vacationColor = '#FED7AA';
  const sundayColor = '#FECACA';

  const getShiftsForDateAndEmployee = (dateStr, employeeId) => {
    return shifts.filter(shift =>
      shift.date === dateStr &&
      shift.employeeId === employeeId
    );
  };

  const isHoliday = (dateStr) => {
    return holidays[dateStr] !== undefined;
  };

  const isVacation = (dateStr) => {
    return vacations[dateStr] !== undefined;
  };

  // Søndag = getDay() === 0 (standard JavaScript)
  const isSunday = (date) => {
    return date.getDay() === 0;
  };

  return (
    <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            {/* Tom cell for ansatt-kolonnen */}
            <th className="p-2 border-r bg-gray-50 min-w-[150px]"></th>
            {dates.map((date, index) => {
              const isToday = date.toDateString() === new Date().toDateString();
              return (
                <th 
                  key={index} 
                  className={`p-2 text-center border-r last:border-r-0 ${isToday ? 'bg-gray-100' : 'bg-gray-50'}`}
                >
                  <div className="text-sm font-medium text-gray-700">
                    {date.toLocaleDateString('no-NO', { timeZone: 'Europe/Oslo', weekday: 'short', day: 'numeric', month: 'short' })}
                  </div>
                  <div className="text-xs text-gray-500">
                    Uke {getWeekNumber(date)}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id} className="border-b last:border-b-0">
              <td className="p-2 border-r font-medium bg-gray-50 sticky left-0 z-10 min-w-[150px]">
                <div className="flex items-center gap-2">
                  <span>{employee.name}</span>
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
                    className="p-1 border-r border-b h-16 min-w-[100px] relative"
                    style={bgStyle}
                  >
                    {shiftsForDay.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {shiftsForDay.map((shift, shiftIndex) => (
                          <div
                            key={shiftIndex}
                            className="p-1 rounded text-xs text-white font-medium truncate group relative"
                            style={{ backgroundColor: getDeptColor(shift.departmentId) }}
                            title={shift.comment ? `${shift.startTime}-${shift.endTime} (${departments.find(d => d.id === shift.departmentId)?.name || shift.departmentId}): ${shift.comment}` : `${shift.startTime}-${shift.endTime} (${departments.find(d => d.id === shift.departmentId)?.name || shift.departmentId})`}
                          >
                            <div className="truncate">
                              {shift.startTime} - {shift.endTime}
                              {currentUser?.isAdmin && (
                                <button 
                                  onClick={(e) => {e.stopPropagation(); onDeleteShift(shift.id);}}
                                  className="ml-1 text-xs hover:opacity-70"
                                >x</button>
                              )}
                            </div>
                            {shift.comment && (
                              <div className="text-xs opacity-80 truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.9)' }}>
                                {shift.comment}
                              </div>
                            )}
                          </div>
                        ))}
                        {currentUser && (
                          <button
                            onClick={() => onAddShift(employee.id, dateStr, selectedDepartment)}
                            className="text-xs text-blue-600 hover:text-blue-800 p-1 w-full text-left"
                            title="Legg til vakt"
                          >
                            + Ny
                          </button>
                        )}
                      </div>
                    ) : (
                      currentUser && (
                        <button
                          onClick={() => onAddShift(employee.id, dateStr, selectedDepartment)}
                          className="text-xs text-blue-600 hover:text-blue-800 p-1 w-full text-left"
                          title="Legg til vakt"
                        >
                          + Ny
                        </button>
                      )
                    )}
                    {holiday && (
                      <div className="text-xs text-red-700 mt-1 truncate font-medium" title={holidays[dateStr]}>
                        {holidays[dateStr]}
                      </div>
                    )}
                    {vacation && !holiday && (
                      <div className="text-xs text-orange-700 mt-1 truncate font-medium" title={vacations[dateStr]}>
                        {vacations[dateStr]}
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
  );
}

export default ShiftCalendar;