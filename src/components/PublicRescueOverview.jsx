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

  const rows = (shifts || [])
    .filter(s => s.date === todayStr)
    .map(s => {
      const deptName = deptNameById.get(s.departmentId) || '';
      const lower = deptName.toLowerCase();
      if (lower === 'fri' || lower === 'ferie') return null;
      const side = sideOfDeptName(deptName);
      if (!side) return null; // ikke en skiutleie-side i dag
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
    .sort((a, b) => a.side.localeCompare(b.side, 'no-NO') || (a.startTime || '').localeCompare(b.startTime || ''));

  const vest = rows.filter(r => r.side === 'Vest');
  const ost = rows.filter(r => r.side === 'Øst');

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
    </div>
  );
}

export default PublicRescueOverview;
