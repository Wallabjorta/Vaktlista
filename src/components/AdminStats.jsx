import React from 'react';

function AdminStats({ employees, shifts, holidays, departments }) {
  // Beregn statistikk for hver ansatt
  const calculateEmployeeStats = (employee) => {
    const employeeShifts = shifts.filter(shift => shift.employeeId === employee.id);
    
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
    employeeShifts.forEach(shift => {
      const deptName = departments.find(d => d.id === shift.departmentId)?.name || shift.departmentId;
      shiftsByDepartment[deptName] = (shiftsByDepartment[deptName] || 0) + 1;
    });
    
    return {
      totalShifts,
      totalDays,
      sundaysWorked,
      holidaysWorked,
      specialDaysWorked,
      shiftsByDepartment
    };
  };

  // Beregn total statistikk
  const calculateTotalStats = () => {
    let totalShifts = 0;
    let totalDays = 0;
    let totalSundays = 0;
    let totalHolidays = 0;
    
    employees.forEach(employee => {
      const stats = calculateEmployeeStats(employee);
      totalShifts += stats.totalShifts;
      totalDays += stats.totalDays;
      totalSundays += stats.sundaysWorked;
      totalHolidays += stats.holidaysWorked;
    });
    
    return { totalShifts, totalDays, totalSundays, totalHolidays };
  };

  const totalStats = calculateTotalStats();

  return (
    <div className="bg-white border rounded-lg shadow-sm p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800">Administrator Statistikk</h2>
        <p className="text-gray-600">Oversikt over arbeidstimer og spesialdager</p>
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

      {/* Detaljert statistikk per ansatt */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-2 text-left text-xs font-medium text-gray-700">Ansatt</th>
              <th className="p-2 text-left text-xs font-medium text-gray-700">Totale vakter</th>
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
