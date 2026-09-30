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

/**
 * Horisontale gruppebarer rett over datokolonnen i hovedkalenderen.
 * Hver gruppe får en farget bar som strekker seg over alle datoer
 * mellom hentedato og leveringsdato (inkludert).
 * Klikk på en bar åpner detaljvindu.
 */
function GroupBarsRow({ dates, currentUser, onAddEvent, onEditEvent, onDeleteEvent }) {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToGroupEvents(evs => setEvents(evs));
    return () => unsubscribe();
  }, []);

  const dateStrs = useMemo(() => dates.map(toYMD), [dates]);

  const rows = useMemo(() => {
    const bars = [];
    for (const ev of events) {
      if (!ev.pickupDate && !ev.dropoffDate) continue;
      const from = ev.pickupDate || ev.dropoffDate;
      const to = ev.dropoffDate || ev.pickupDate;
      let startIdx = dateStrs.indexOf(from);
      let endIdx = dateStrs.indexOf(to);
      if (startIdx === -1 && endIdx === -1) continue;
      if (startIdx === -1) startIdx = 0;
      if (endIdx === -1) endIdx = dateStrs.length - 1;
      if (endIdx < startIdx) [startIdx, endIdx] = [endIdx, startIdx];
      bars.push({ event: ev, startIdx, endIdx });
    }
    bars.sort((a, b) => a.startIdx - b.startIdx || a.endIdx - b.endIdx);
    const lanes = [];
    for (const bar of bars) {
      let lane = lanes.find(l => l[l.length - 1].endIdx < bar.startIdx);
      if (!lane) {
        lane = [];
        lanes.push(lane);
      }
      lane.push(bar);
    }
    return lanes;
  }, [events, dateStrs]);

  if (rows.length === 0 && !currentUser?.isAdmin) return null;

  return (
    <>
      <tr className="border-b bg-gray-50">
        <td className="p-1 border-r bg-gray-50 sticky left-0 z-10 min-w-[100px] md:min-w-[140px] lg:min-w-[180px]">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-medium text-gray-600 uppercase">Grupper</span>
            {currentUser?.isAdmin && onAddEvent && (
              <button
                onClick={onAddEvent}
                className="px-1 py-0.5 bg-purple-600 text-white rounded text-[10px] hover:bg-purple-700 whitespace-nowrap"
                title="Nytt grupperevent"
              >
                + Gruppe
              </button>
            )}
          </div>
        </td>
        <td colSpan={dates.length} className="p-0">
          {rows.length === 0 ? (
            <div className="h-6 text-xs text-gray-400 px-2 flex items-center">Ingen grupper i denne perioden</div>
          ) : (
            rows.map((lane, laneIdx) => (
              <div key={laneIdx} className="h-6 relative border-b last:border-b-0">
                {lane.map(({ event, startIdx, endIdx }) => (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    className="absolute top-0.5 h-5 rounded text-white text-[10px] leading-none flex items-center px-1.5 hover:brightness-110 cursor-pointer overflow-hidden whitespace-nowrap"
                    style={{
                      backgroundColor: event.color || '#8B5CF6',
                      left: `calc(${(startIdx / dates.length) * 100}% + 2px)`,
                      width: `calc(${((endIdx - startIdx + 1) / dates.length) * 100}% - 4px)`
                    }}
                    title={`${event.groupName}: henter ${formatYMD(event.pickupDate) || '—'}, leverer ${formatYMD(event.dropoffDate) || '—'}`}
                  >
                    <span className="truncate">{event.groupName}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </td>
      </tr>

      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4" onClick={() => setSelectedEvent(null)}>
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
    </>
  );
}

export default GroupBarsRow;
