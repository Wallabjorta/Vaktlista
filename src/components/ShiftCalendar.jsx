import React, { useCallback, useRef } from 'react';

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
  showHistory = true,
  selectedDates = [],
  selectedEmployeeForBulk = null,
  onDateSelection,
  onClearSelection
}) {
  const getDates = () => {
    const dates = [];
    const startDate = new Date(currentDate);
    startDate.setHours(0, 0, 0, 0);

    const dayOfWeek = startDate.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(startDate.getDate() - daysToSubtract);

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

  const isSunday = (date) => {
    return date.getDay() === 0;
  };

  const isDateSelected = (dateStr, employeeId) => {
    if (selectedEmployeeForBulk) {
      return selectedDates.includes(dateStr) && employeeId === selectedEmployeeForBulk;
    }
    return selectedDates.includes(dateStr);
  };

  const hasExistingShift = (dateStr, employeeId) => {
    return shifts.some(shift => shift.date === dateStr && shift.employeeId === employeeId);
  };

  const lastClickedRef = useRef(null);

  const handleDateClick = useCallback((dateStr, employeeId, event) => {
    if (!currentUser || !onDateSelection) return;

    const targetEmployee = selectedEmployeeForBulk || employeeId;

    if (selectedEmployeeForBulk && selectedEmployeeForBulk !== employeeId) {
      return;
    }

    const isShiftKey = event.shiftKey;
    const isCtrlKey = event.ctrlKey || event.metaKey;

    if (isShiftKey && lastClickedRef.current) {
      const allDates = dates.map(d => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      });
      
      const lastIndex = allDates.indexOf(lastClickedRef.current);
      const currentIndex = allDates.indexOf(dateStr);
      
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const datesInRange = allDates.slice(start, end + 1);
        
        const newSelected = datesInRange.filter(d => !hasExistingShift(d, targetEmployee));
        
        newSelected.forEach(d => onDateSelection(d, targetEmployee));
        return;
      }
    } else if (isCtrlKey) {
      if (isDateSelected(dateStr, employeeId)) {
        onDateSelection(dateStr, targetEmployee);
      } else {
        if (!hasExistingShift(dateStr, targetEmployee)) {
          onDateSelection(dateStr, targetEmployee);
        }
      }
      return;
    } else {
      if (isDateSelected(dateStr, employeeId)) {
        onDateSelection(dateStr, targetEmployee);
      } else {
        if (!hasExistingShift(dateStr, targetEmployee)) {
          onDateSelection(dateStr, targetEmployee);
        }
      }
    }

    lastClickedRef.current = dateStr;
  }, [dates, selectedDates, selectedEmployeeForBulk, employees, hasExistingShift, onDateSelection, currentUser]);

  return (
    <div className="bg-white border rounded-lg shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b">
              <th className="p-2 border-r bg-gray-50 sticky left-0 z-10 min-w-[120px] md:min-w-[150px]"></th>
              {dates.map((date, index) => {
                const isToday = date.toDateString() === new Date().toDateString();
                return (
                  <th
                    key={index}
                    className={`p-1 md:p-2 text-center border-r last:border-r-0 text-xs md:text-sm ${isToday ? 'bg-gray-100' : 'bg-gray-50'}`}
                  >
                    <div className="font-medium text-gray-700">
                      {date.toLocaleDateString('no-NO', { timeZone: 'Europe/Oslo', weekday: 'short', day: 'numeric', month: 'short' })}
                    </div>
                    <div className="hidden md:block text-xs text-gray-500">
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
                <td className="p-2 border-r font-medium bg-gray-50 sticky left-0 z-10 min-w-[120px] md:min-w-[150px]">
                  <div className="flex items-center gap-2">
                    <span className="truncate max-w-full">{employee.name}</span>
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

                  const isSelected = isDateSelected(dateStr, employee.id);
                  const hasShift = shiftsForDay.length > 0;
                  const isBulkMode = selectedEmployeeForBulk !== null;
                  const isForSelectedEmployee = !selectedEmployeeForBulk || employee.id === selectedEmployeeForBulk;

                  return (
                    <td
                      key={dateIndex}
                      className="p-1 border-r border-b h-12 md:h-16 min-w-[80px] md:min-w-[100px] relative"
                      style={{
                        ...bgStyle,
                        ...(isSelected && isForSelectedEmployee && !hasShift ? { backgroundColor: '#DBEAFE' } : {})
                      }}
                    >
                      {hasShift ? (
                        <>
                          <div className="flex flex-col gap-1">
                            {shiftsForDay.map((shift, shiftIndex) => (
                              <div
                                key={shiftIndex}
                                className="p-1 md:p-2 rounded text-xs md:text-sm text-white font-medium truncate cursor-pointer hover:opacity-80 group relative"
                                style={{ backgroundColor: getDeptColor(shift.departmentId) }}
                                onClick={() => currentUser?.isAdmin && onDeleteShift(shift.id)}
                                title={`${shift.startTime}-${shift.endTime} (${departments.find(d => d.id === shift.departmentId)?.name || shift.departmentId})${shift.comment ? `: ${shift.comment}` : ''}`}
                              >
                                <div className="truncate">
                                  {shift.startTime} - {shift.endTime}
                                  {currentUser?.isAdmin && (
                                    <button className="ml-1 text-xs">x</button>
                                  )}
                                </div>
                                {shift.comment && (
                                  <div className="text-xs opacity-80 truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.9)' }}>
                                    {shift.comment}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          {currentUser && (
                            <button
                              onClick={() => onAddShift(employee.id, dateStr, selectedDepartment)}
                              className="text-xs text-blue-600 hover:text-blue-800 p-1 w-full text-left"
                              title="Legg til vakt"
                            >
                              + Legg til
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          {currentUser && (
                            <div
                              className="w-full h-full relative"
                              onClick={(e) => {
                                if (isBulkMode && !isForSelectedEmployee) {
                                  if (confirm(`Vil du bytte til ${employee.name}?`)) {
                                    onClearSelection();
                                    onDateSelection(dateStr, employee.id);
                                  }
                                } else {
                                  handleDateClick(dateStr, employee.id, e);
                                }
                              }}
                              title={isSelected && isForSelectedEmployee ? "Dato valgt - klikk igjen for \u00e5 avvelge" : "Klikk for \u00e5 velge dato (Shift/Ctrl for flere)"}
                            >
                              {isSelected && isForSelectedEmployee ? (
                                <span className="text-blue-700">\u2713 Valgt</span>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAddShift(employee.id, dateStr, selectedDepartment);
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-800 p-1 w-full text-left"
                                  title="Legg til vakt for denne dagen"
                                >
                                  + Legg til
                                </button>
                              )}
                            </div>
                          )}
                        </>
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
  );
}

export default ShiftCalendar;
