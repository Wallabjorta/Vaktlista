import React, { useState, useEffect, useMemo } from 'react';
import { subscribeToRevenues, subscribeToStaffingConfig, recommendStaffing } from '../firebase';
import { generateAutoFill, toDateStr } from '../utils/autoFill';
import { EMPLOYEE_CATEGORIES, inferCategory, deptNameToCategory } from './ShiftCalendar';

const DEFAULT_STAFFING_CONFIG = {
  minimumStaff: 2,
  thresholds: [
    { minRevenue: 0, staff: 2, label: 'Lav' },
    { minRevenue: 25000, staff: 4, label: 'Middels' },
    { minRevenue: 40000, staff: 6, label: 'Høy' }
  ]
};

const MONTH_NAMES = ['jan.', 'feb.', 'mars', 'apr.', 'mai', 'juni', 'juli', 'aug.', 'sep.', 'okt.', 'nov.', 'des.'];

const formatYMD = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${Number(d)}. ${MONTH_NAMES[Number(m) - 1]} ${y}`;
};

const CATEGORY_OPTIONS = EMPLOYEE_CATEGORIES.filter(c => c !== 'Admin');

/**
 * Auto-utfylling av vakter: genererar förslag per kategori utifrån omsetning
 * (bemanningskonfig), söndager, helligdager och ansettelsesprosent.
 * Admin väljer kategori og periode per kjøring, ser forslag och godkjenner
 * før noe lagres. Bare tomme celler fylls.
 */
function AutoFillModal({
  dates = [],
  employees = [],
  allEmployees,
  shifts = [],
  departments = [],
  holidays = [],
  currentUser,
  saving = false,
  onSave,
  onClose
}) {
  const [category, setCategory] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [startTime, setStartTime] = useState('08:45');
  const [endTime, setEndTime] = useState('16:00');
  const [sundayBoost, setSundayBoost] = useState('0');
  const [holidayBoost, setHolidayBoost] = useState('0');
  const [result, setResult] = useState(null);
  const [revenues, setRevenues] = useState([]);
  const [configs, setConfigs] = useState(null);

  useEffect(() => {
    const unsub1 = subscribeToRevenues(revs => setRevenues(revs));
    const unsub2 = subscribeToStaffingConfig(cfg => {
      if (!cfg) { setConfigs({ total: DEFAULT_STAFFING_CONFIG }); return; }
      if (cfg.locations) { setConfigs(cfg.locations); return; }
      setConfigs({ total: cfg });
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  // Standardperiod = hela fönstret
  useEffect(() => {
    if (dates.length > 0) {
      setPeriodStart(toDateStr(dates[0]));
      setPeriodEnd(toDateStr(dates[dates.length - 1]));
    }
  }, [dates]);

  const candidates = useMemo(() => {
    if (!category) return [];
    return (employees || []).filter(e =>
      e && !e.isAdmin && e.category !== 'Admin' && inferCategory(e) === category
    );
  }, [employees, category]);

  // Avdeling som motsvarar kategorin (för färg/visning av nya vakter);
  // fallback är den enskilde anställdes första avdeling.
  const deptForCategory = useMemo(() => {
    if (!category) return null;
    return (departments || []).find(d => d && deptNameToCategory(d.name) === category) || null;
  }, [departments, category]);

  const handleGenerate = () => {
    if (!category) { alert('Velg kategori!'); return; }
    if (candidates.length === 0) {
      alert('Ingen ansatte (uten admin) i valgt kategori.');
      return;
    }
    if (!periodStart || !periodEnd) { alert('Velg periode (fra og til dato)!'); return; }
    if (periodStart > periodEnd) { alert('Fra-dato må være før eller lik til-dato!'); return; }
    if (startTime >= endTime) { alert('Sluttid må være etter starttid!'); return; }
    const datesInRange = dates.filter(d => {
      const s = toDateStr(d);
      return s >= periodStart && s <= periodEnd;
    });
    if (datesInRange.length === 0) { alert('Perioden ligger utenfor oversiktens vindu.'); return; }
    setResult(generateAutoFill({
      dates: datesInRange,
      employees: candidates,
      allEmployees: allEmployees || employees,
      shifts,
      departments,
      holidays,
      revenues,
      staffingConfigs: configs,
      recommend: recommendStaffing,
      options: {
        departmentId: deptForCategory?.id || '',
        startTime,
        endTime,
        sundayBoost: Number(sundayBoost) || 0,
        holidayBoost: Number(holidayBoost) || 0
      }
    }));
  };

  const relevantDates = (result?.perDate || []).filter(d => d.generated > 0);
  const totalNew = result?.assignments?.length || 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white border rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <div>
            <h2 className="text-xl font-semibold">Auto-utfylling av vakter</h2>
            <p className="text-sm text-gray-600">
              Basert på omsetning (bemanningskonfig), søndager, helligdager og ansettelsesprosent.
              Bare tomme celler fylls.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Kategori</label>
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setResult(null); }}
                className="w-full p-2 border rounded"
              >
                <option value="">Velg kategori</option>
                {CATEGORY_OPTIONS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {category && (
                <p className="text-xs text-gray-500 mt-1">
                  {candidates.length} ansatte (utan admin) i kategorien
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Fra dato</label>
                <input
                  type="date"
                  value={periodStart}
                  min={dates.length ? toDateStr(dates[0]) : undefined}
                  max={dates.length ? toDateStr(dates[dates.length - 1]) : undefined}
                  onChange={(e) => { setPeriodStart(e.target.value); setResult(null); }}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Til dato</label>
                <input
                  type="date"
                  value={periodEnd}
                  min={dates.length ? toDateStr(dates[0]) : undefined}
                  max={dates.length ? toDateStr(dates[dates.length - 1]) : undefined}
                  onChange={(e) => { setPeriodEnd(e.target.value); setResult(null); }}
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Starttid</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full p-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sluttid</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full p-2 border rounded" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Søndager</label>
                <select value={sundayBoost} onChange={(e) => setSundayBoost(e.target.value)} className="w-full p-2 border rounded">
                  <option value="0">Samme bemanning som ellers</option>
                  <option value="1">+1 ekstra</option>
                  <option value="2">+2 ekstra</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Helligdager</label>
                <select value={holidayBoost} onChange={(e) => setHolidayBoost(e.target.value)} className="w-full p-2 border rounded">
                  <option value="0">Samme bemanning som ellers</option>
                  <option value="1">+1 ekstra</option>
                  <option value="2">+2 ekstra</option>
                </select>
              </div>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            className="px-4 py-2 bg-blue-600 text-white rounded border border-blue-600 hover:bg-blue-700"
          >
            Generer forslag
          </button>

          {result && (
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm">
                <strong>{totalNew} nye vakter</strong> foreslått i perioden {formatYMD(periodStart)} – {formatYMD(periodEnd)}
                ({candidates.length} ansatte, {relevantDates.length} dager berørt).
                {totalNew === 0 && ' Ingen dager mangler bemanning innenfor disse reglene.'}
              </div>

              {result.warnings.length > 0 && (
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-sm text-yellow-800">
                  <p className="font-medium mb-1">Merk:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {relevantDates.length > 0 && (
                <div className="border rounded overflow-hidden max-h-[300px] overflow-y-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0">
                      <tr className="bg-gray-50 border-b">
                        <th className="p-2 text-left font-medium text-xs">Dag</th>
                        <th className="p-2 text-left font-medium text-xs">Anbefalt</th>
                        <th className="p-2 text-left font-medium text-xs">Eksisterer</th>
                        <th className="p-2 text-left font-medium text-xs">Nye vakter</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relevantDates.map(d => (
                        <tr key={d.date} className="border-b last:border-b-0">
                          <td className="p-2 border-r">
                            {formatYMD(d.date)}
                            {d.isSunday && <span className="text-red-600 text-xs ml-1">søn</span>}
                            {d.isHoliday && <span className="text-red-600 text-xs ml-1">helligdag</span>}
                          </td>
                          <td className="p-2 border-r">{d.recommended ?? '—'}</td>
                          <td className="p-2 border-r">{d.existing}</td>
                          <td className="p-2">
                            <span className="font-medium">{d.generated}</span>
                            <span className="text-xs text-gray-600 ml-1">({d.names.join(', ')})</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Avbryt
                </button>
                <button
                  onClick={() => onSave(result.assignments)}
                  disabled={totalNew === 0 || saving}
                  className="px-4 py-2 bg-green-600 text-white rounded border border-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Lagrer…' : `Fyll ut ${totalNew} vakter`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AutoFillModal;
