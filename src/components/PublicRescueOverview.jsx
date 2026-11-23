import { isRescueWorker } from '../utils/skills';

const toDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const sideOfDeptName = (name) => {
  const n = (name || '').toLowerCase();
  if (n.includes('vest')) return 'Vest';
  if (n.includes('øst') || n.includes('ost')) return 'Øst';
  return null;
};

/**
 * Offentlig oversikt (ingen innlogging nødvendig):
 * hvilke redningsmenn som er på jobb i dag, og hvilken side (Vest/Øst) de jobber på.
 */
function PublicRescueOverview({ employees = [], shifts = [], departments = [] }) {
  const todayStr = toDateStr(new Date());
  const todayLabel = new Date(todayStr + 'T00:00:00').toLocaleDateString('no-NO', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
  const deptNameById = new Map((departments || []).filter(Boolean).map(d => [d.id, d.name || '']));

  // Redningsmenn på jobb for en gitt dato (kun skiutleie Vest/Øst)
  const rescueRowsForDate = (dateStr) =>
    (shifts || [])
      .filter(s => s.date === dateStr)
      .map(s => {
        const deptName = deptNameById.get(s.departmentId) || '';
        const lower = deptName.toLowerCase();
        if (lower === 'fri' || lower === 'ferie') return null;
        const side = sideOfDeptName(deptName);
        if (!side) return null;
        const emp = (employees || []).find(e => String(e.id) === String(s.employeeId));
        if (!emp || !isRescueWorker(emp)) return null;
        return {
          id: s.id,
          name: emp.name || s.employeeId,
          side,
          startTime: s.startTime,
          endTime: s.endTime,
          dept: deptName
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

  const rows = rescueRowsForDate(todayStr)
    .sort((a, b) => a.side.localeCompare(b.side, 'no-NO') || (a.startTime || '').localeCompare(b.startTime || ''));

  const vest = rows.filter(r => r.side === 'Vest');
  const ost = rows.filter(r => r.side === 'Øst');

  // Neste 7 dager (fra i morgen) for den lille ukekalenderen
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayStr + 'T00:00:00');
    d.setDate(d.getDate() + 1 + i);
    return { dateStr: toDateStr(d), label: d.toLocaleDateString('no-NO', { weekday: 'short' }), dayNum: d.getDate(), rows: null };
  }).map(d => ({ ...d, rows: rescueRowsForDate(d.dateStr) }));

  const SideColumn = ({ title, items, color }) => (
    <div className="flex-1 min-w-[220px] border rounded-lg p-3" style={{ borderColor: color }}>
      <h3 className="font-semibold mb-2" style={{ color }}>{title} ({items.length})</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Ingen på vakt</p>
      ) : (
        <ul className="space-y-1">
          {items.map(r => (
            <li key={r.id} className="text-sm flex justify-between gap-2 border-b border-gray-100 pb-1">
              <span className="font-medium text-gray-800">{r.name}</span>
              <span className="text-gray-600 whitespace-nowrap">
                {r.startTime}–{r.endTime} <span className="text-gray-400">({r.dept})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="mb-6 p-4 bg-white border-2 border-red-200 rounded-lg shadow-sm">
      <div className="flex justify-between items-center flex-wrap gap-2 mb-3">
        <h2 className="text-xl font-bold text-gray-800">🚑 Redningsmenn på jobb i dag</h2>
        <span className="text-sm text-gray-500 capitalize">{todayLabel}</span>
      </div>
      <div className="flex gap-3 flex-wrap">
        <SideColumn title="Skiutleie Vest" items={vest} color="#3B82F6" />
        <SideColumn title="Skiutleie Øst" items={ost} color="#10B981" />
      </div>
      {rows.length === 0 && (
        <p className="text-sm text-gray-500 mt-2 italic">Ingen redningsmenn er satt på vakt i dag.</p>
      )}

      {/* Liten kalender: redningsmenn på jobb de neste 7 dagene */}
      <div className="mt-4 border-t pt-3">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">🗓️ Redningsmenn på jobb — neste 7 dager</h3>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          {weekDays.map(day => (
            <div key={day.dateStr} className="border rounded p-2 bg-gray-50">
              <div className="text-xs font-semibold text-gray-700 capitalize mb-1">
                {day.label} {day.dayNum}.
              </div>
              {day.rows.length === 0 ? (
                <div className="text-[11px] text-gray-400 italic">Ingen</div>
              ) : (
                <ul className="space-y-0.5">
                  {day.rows.map(r => (
                    <li key={r.id} className="text-[11px] leading-tight">
                      <span className="font-medium text-gray-800">{r.name}</span>{' '}
                      <span className={`px-1 rounded text-white ${r.side === 'Vest' ? 'bg-blue-500' : 'bg-green-600'}`}>{r.side === 'Vest' ? 'V' : 'Ø'}</span>{' '}
                      <span className="text-gray-500">{r.startTime}–{r.endTime}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PublicRescueOverview;
