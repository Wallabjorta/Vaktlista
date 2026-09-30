import React, { useState, useEffect, useMemo } from 'react';
import { subscribeToGroupEvents } from '../firebase';

const DAY_NAMES = ['man', 'tir', 'ons', 'tor', 'fre', 'lør', 'søn'];
const MONTH_NAMES = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];

const dateToYMD = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatYMD = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return `${Number(d)}. ${MONTH_NAMES[dt.getMonth()]} ${y}`;
};

function GroupEventsCalendar({ currentUser, onAddEvent, onEditEvent, onDeleteEvent }) {
  const [events, setEvents] = useState([]);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToGroupEvents(evs => setEvents(evs));
    return () => unsubscribe();
  }, []);

  const viewDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const cells = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startWeekday = (firstDay.getDay() + 6) % 7;
    const list = [];
    for (let i = 0; i < startWeekday; i++) {
      list.push({ date: null });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      list.push({ date });
    }
    while (list.length % 7 !== 0) {
      list.push({ date: null });
    }
    return list;
  }, [viewDate]);

  const eventsByDate = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      for (const key of [ev.pickupDate, ev.dropoffDate]) {
        if (!key) continue;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(ev);
      }
    }
    return map;
  }, [events]);

  const todayStr = dateToYMD(new Date());

  const eventBarStyle = (ev, type) => ({
    backgroundColor: ev.color || '#8B5CF6',
    opacity: type === 'dropoff' ? 0.75 : 1
  });

  return (
    <div className="bg-white border rounded-lg shadow-sm p-6 mt-6">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Gruppekalender</h2>
          <p className="text-gray-600">Henting og levering per gruppe — klikk på en gruppe for mer info</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonthOffset(o => o - 1)}
            className="px-2 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300"
          >
            ← Forrige
          </button>
          <span className="text-sm font-medium min-w-[130px] text-center">
            {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
          </span>
          <button
            onClick={() => setMonthOffset(o => o + 1)}
            className="px-2 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300"
          >
            Neste →
          </button>
          <button
            onClick={() => setMonthOffset(0)}
            className="px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            I dag
          </button>
          {currentUser?.isAdmin && onAddEvent && (
            <button
              onClick={onAddEvent}
              className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
            >
              + Nytt grupperevent
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DAY_NAMES.map(name => (
          <div key={name} className="text-center text-xs font-medium text-gray-500 py-1">
            {name}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell.date) return <div key={i} className="min-h-[80px] bg-gray-50 rounded" />;
          const dateStr = dateToYMD(cell.date);
          const dayEvents = eventsByDate.get(dateStr) || [];
          const isToday = dateStr === todayStr;
          return (
            <div
              key={i}
              className={`min-h-[80px] border rounded p-1 flex flex-col gap-0.5 ${isToday ? 'bg-blue-50 border-blue-400' : 'bg-white'}`}
            >
              <div className={`text-xs text-right ${isToday ? 'font-bold text-blue-700' : 'text-gray-500'}`}>
                {cell.date.getDate()}
              </div>
              {dayEvents.map(ev => (
                <button
                  key={`${ev.id}-${dateStr}`}
                  onClick={() => setSelectedEvent(ev)}
                  className="text-white text-[10px] leading-tight rounded px-1 py-0.5 text-left truncate hover:brightness-110"
                  style={eventBarStyle(
                    ev,
                    ev.pickupDate === dateStr && ev.dropoffDate === dateStr ? 'both' :
                    (ev.dropoffDate === dateStr ? 'dropoff' : 'pickup')
                  )}
                  title={`${ev.groupName}: ${ev.pickupDate === dateStr ? 'henter' : ''}${ev.pickupDate === dateStr && ev.dropoffDate === dateStr ? ' & ' : ''}${ev.dropoffDate === dateStr ? 'leverer' : ''}`}
                >
                  {ev.dropoffDate === dateStr ? '↓ ' : ''}
                  {ev.groupName}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedEvent(null)}>
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full border" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4 border-b pb-2">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <span className="w-4 h-4 rounded inline-block" style={{ backgroundColor: selectedEvent.color || '#8B5CF6' }} />
                {selectedEvent.groupName}
              </h3>
              <button onClick={() => setSelectedEvent(null)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <div className="space-y-2 text-sm">
              <p><strong>Hentedato:</strong> {formatYMD(selectedEvent.pickupDate) || '—'}</p>
              <p><strong>Leveringsdato:</strong> {formatYMD(selectedEvent.dropoffDate) || '—'}</p>
              {selectedEvent.contact && <p><strong>Kontakt:</strong> {selectedEvent.contact}</p>}
              {selectedEvent.participants != null && <p><strong>Antall deltakere:</strong> {selectedEvent.participants}</p>}
              {selectedEvent.notes && <p className="whitespace-pre-wrap"><strong>Notater:</strong> {selectedEvent.notes}</p>}
            </div>
            {currentUser?.isAdmin && (
              <div className="flex gap-2 pt-4 mt-4 border-t">
                <button
                  onClick={() => { onEditEvent?.(selectedEvent); setSelectedEvent(null); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded border border-blue-600 hover:bg-blue-700 flex-1"
                >
                  Rediger
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Slette grupperevent "${selectedEvent.groupName}"?`)) {
                      onDeleteEvent?.(selectedEvent.id);
                      setSelectedEvent(null);
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded border border-red-600 hover:bg-red-700 flex-1"
                >
                  Slett
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default GroupEventsCalendar;
