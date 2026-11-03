import React, { useState, useEffect, useMemo } from 'react';
import { subscribeToGroupEvents } from '../firebase';

const toYMD = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const MONTH_NAMES = ['jan.', 'feb.', 'mars', 'apr.', 'mai', 'juni', 'juli', 'aug.', 'sep.', 'okt.', 'nov.', 'des.'];

const formatYMD = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${Number(d)}. ${MONTH_NAMES[Number(m) - 1]} ${y}`;
};

const formatDateTime = (dateStr, time) => {
  const date = formatYMD(dateStr);
  if (!date) return '—';
  return time ? `${date} kl. ${time}` : date;
};

const getWeekNumber = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  week1.setHours(0, 0, 0, 0);
  return 1 + Math.round(((d - week1) / 86400000 + 3) / 7);
};

/**
 * 3-måneders gruppeoversikt: én rad per grupperevent med farget bar
 * fra hentedato til leveringsdato. Åpnes ved å klikke «Grupper»-teksten
 * i gruppemodulen (GroupBarsRow).
 */
function GroupOverviewCalendar({ currentDate, currentUser, onClose, onAddEvent, onEditEvent }) {
  const [overviewDate, setOverviewDate] = useState(currentDate || new Date());
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeToGroupEvents(evs => setEvents(evs));
    return () => unsubscribe();
  }, []);

  const dates = useMemo(() => {
    const result = [];
    const startDate = new Date(overviewDate || new Date());
    startDate.setHours(0, 0, 0, 0);
    const dayOfWeek = startDate.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(startDate.getDate() - daysToSubtract);
    for (let week = 0; week < 12; week++) {
      for (let day = 0; day < 7; day++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + week * 7 + day);
        date.setHours(0, 0, 0, 0);
        result.push(date);
      }
    }
    return result;
  }, [overviewDate]);

  const dateStrs = useMemo(() => dates.map(toYMD), [dates]);

  const rows = useMemo(() => {
    return events
      .map(ev => {
        if (!ev.pickupDate && !ev.dropoffDate) return null;
        const from = ev.pickupDate || ev.dropoffDate;
        const to = ev.dropoffDate || ev.pickupDate;
        let startIdx = dateStrs.indexOf(from);
        let endIdx = dateStrs.indexOf(to);
        if (startIdx === -1 && endIdx === -1) return null;
        if (startIdx === -1) startIdx = 0;
        if (endIdx === -1) endIdx = dateStrs.length - 1;
        if (endIdx < startIdx) [startIdx, endIdx] = [endIdx, startIdx];
        return { event: ev, startIdx, endIdx };
      })
      .filter(Boolean)
      .sort((a, b) => a.startIdx - b.startIdx || a.endIdx - b.endIdx || String(a.event.groupName || '').localeCompare(String(b.event.groupName || '')));
  }, [events, dateStrs]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white border rounded-lg shadow-sm max-w-[95vw] w-full max-h-[90vh]">
        <div className="flex justify-between items-center p-2 border-b sticky top-0 bg-white z-20">
          <h2 className="text-lg font-semibold">Gruppeoversikt (3 måneder)</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => {
              const newDate = new Date(overviewDate);
              newDate.setDate(newDate.getDate() - 7);
              setOverviewDate(newDate);
            }} className="px-2 py-1 bg-gray-200 rounded text-xs hover:bg-gray-300">Forrige</button>
            <button onClick={() => setOverviewDate(new Date())} className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">Idag</button>
            <button onClick={() => {
              const newDate = new Date(overviewDate);
              newDate.setDate(newDate.getDate() + 7);
              setOverviewDate(newDate);
            }} className="px-2 py-1 bg-gray-200 rounded text-xs hover:bg-gray-300">Neste</button>
            {currentUser?.isAdmin && onAddEvent && (
              <button onClick={onAddEvent} className="px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700">+ Gruppe</button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[calc(90vh-60px)]">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b">
                <th className="p-1 border-r bg-gray-50 sticky left-0 top-0 z-30" style={{ backgroundColor: '#f9fafb', minWidth: '140px' }}>
                  <span className="text-xs font-medium text-gray-600 uppercase">Grupper</span>
                </th>
                {dates.map((date, index) => {
                  const isToday = date.toDateString() === new Date().toDateString();
                  return (
                    <th
                      key={index}
                      className={`p-0.5 text-center border-r last:border-r-0 text-xs sticky top-0 z-20 ${isToday ? 'bg-gray-100' : 'bg-gray-50'}`}
                      style={{ minWidth: '30px' }}
                    >
                      <div className="font-medium text-gray-700 truncate">{date.getDate()}</div>
                      {index % 7 === 0 && (
                        <div className="text-xs text-gray-500">Uke {getWeekNumber(date)}</div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td className="p-2 border-r bg-gray-50 sticky left-0 z-10 text-xs text-gray-500" style={{ minWidth: '140px' }}>—</td>
                  <td className="p-2 text-xs text-gray-400">Ingen grupper i denne perioden</td>
                </tr>
              )}
              {rows.map(({ event, startIdx, endIdx }) => (
                <tr key={event.id} className="border-b last:border-b-0">
                  <td className="p-1 border-r bg-gray-50 sticky left-0 z-10" style={{ backgroundColor: '#f9fafb', minWidth: '140px' }}>
                    <div className="text-sm font-medium truncate" title={event.groupName}>{event.groupName}</div>
                    <div className="text-[10px] text-gray-500 truncate">
                      {formatDateTime(event.pickupDate, event.pickupTime)} → {formatDateTime(event.dropoffDate, event.dropoffTime)}
                    </div>
                  </td>
                  <td colSpan={dates.length} className="p-0 relative h-8 border-r">
                    <button
                      onClick={() => onEditEvent && onEditEvent(event)}
                      className="absolute top-1 h-6 rounded text-white text-[10px] px-1.5 flex items-center gap-1 hover:brightness-110 cursor-pointer overflow-hidden whitespace-nowrap"
                      style={{
                        backgroundColor: event.color || '#8B5CF6',
                        left: `calc(${(startIdx / dates.length) * 100}% + 2px)`,
                        width: `calc(${((endIdx - startIdx + 1) / dates.length) * 100}% - 4px)`
                      }}
                      title={`${event.groupName}: henter ${formatDateTime(event.pickupDate, event.pickupTime)}, leverer ${formatDateTime(event.dropoffDate, event.dropoffTime)}`}
                    >
                      {event.pickupTime && <span className="font-semibold shrink-0">ut {event.pickupTime}</span>}
                      <span className="truncate flex-1 text-center">{event.groupName}</span>
                      {event.dropoffTime && <span className="font-semibold shrink-0">lev {event.dropoffTime}</span>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default GroupOverviewCalendar;
