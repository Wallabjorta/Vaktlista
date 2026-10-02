import React, { useState, useEffect, useMemo, useRef } from 'react';
import { EMPLOYEE_CATEGORIES } from './ShiftCalendar';
import {
  subscribeToRevenues,
  clearRevenues,
  subscribeToStaffingConfig,
  importRevenues,
  saveRevenue,
  deleteRevenue,
  saveStaffingConfig,
  recommendStaffing,
  getStaffingConfig
} from '../firebase';

const MONTH_NAMES = ['jan.', 'feb.', 'mars', 'apr.', 'mai', 'juni', 'juli', 'aug.', 'sep.', 'okt.', 'nov.', 'des.'];
const DAY_NAMES = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];

const shiftDays = (dateStr, days) => {
  if (!dateStr || !days) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
};

const formatYMD = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${Number(d)}. ${MONTH_NAMES[Number(m) - 1]} ${y}`;
};

const formatKr = (n) => {
  if (n == null) return '—';
  return new Intl.NumberFormat('no-NO', { maximumFractionDigits: 0 }).format(n) + ' kr';
};

const LOCATION_CATEGORIES = {
  total: null,
  st: ['Skiutleie Vest', 'Butikk Vest'],
  'øst': ['Skiutleie Øst', 'Butikk Øst']
};

const DEFAULT_CONFIG = {
  peoplePerAmount: 15000,
  minimumStaff: 2,
  thresholds: [
    { minRevenue: 0, staff: 2, label: 'Lav' },
    { minRevenue: 25000, staff: 4, label: 'Middels' },
    { minRevenue: 40000, staff: 6, label: 'Høy' }
  ]
};

function StaffingPlanner({ employees, shifts, currentUser }) {
  const [revenues, setRevenues] = useState([]);
  const [configs, setConfigs] = useState(null);
  const [tab, setTab] = useState('compare');
  const [location, setLocation] = useState('total');
  const config = configs ? (configs[location] || configs.total || DEFAULT_CONFIG) : null;
  const [csvText, setCsvText] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [clearing, setClearing] = useState(false);
  const [seasonOffset, setSeasonOffset] = useState(0);
  const [editingConfig, setEditingConfig] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    const unsub1 = subscribeToRevenues(revs => setRevenues(revs));
    const unsub2 = subscribeToStaffingConfig(cfg => {
      if (!cfg) { setConfigs({ total: DEFAULT_CONFIG }); return; }
      if (cfg.locations) { setConfigs(cfg.locations); return; }
      setConfigs({ total: cfg });
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  const [editConfig, setEditConfig] = useState(null);
  useEffect(() => {
    if (config) setEditConfig(JSON.parse(JSON.stringify(config)));
  }, [config, location]);

  const revenueByDate = useMemo(() => {
    const map = new Map();
    for (const r of revenues) map.set(r.date, r.amount);
    return map;
  }, [revenues]);

  const employeeById = useMemo(() => {
    const map = new Map();
    for (const e of employees) map.set(String(e.id), e);
    return map;
  }, [employees]);

  const shiftsByDate = useMemo(() => {
    const map = new Map();
    const categories = LOCATION_CATEGORIES[location];
    for (const s of shifts) {
      if (!map.has(s.date)) map.set(s.date, []);
      if (categories) {
        const emp = employeeById.get(String(s.employeeId));
        const cat = emp?.category || null;
        if (!cat || !categories.includes(cat)) continue;
      }
      map.get(s.date).push(s);
    }
    return map;
  }, [shifts, location, employeeById]);

  const filteredRevenues = useMemo(() => {
    return revenues.filter(r => {
      if (location === 'total') return !r.location;
      return r.location === location;
    });
  }, [revenues, location]);


  const locationLabel = location === 'total' ? 'total (ingen plats)' : location === 'st' ? 'Skiutleie Vest' : 'Skiutleie Øst';

  const handleClearLocation = async () => {
    const count = filteredRevenues.length;
    if (count === 0) return;
    if (!confirm(`Rensa all omsättningsdata för ${locationLabel} (${count} dager)? Detta kan inte ångras.`)) return;
    setClearing(true);
    try {
      const loc = location === 'total' ? null : location;
      const deleted = await clearRevenues(loc === null ? undefined : loc);
      setImportMsg(`${deleted} poster raderade för ${locationLabel}.`);
    } catch (e) {
      alert('Feil vid rensning: ' + e.message);
    } finally {
      setClearing(false);
    }
  };

  const handleClearAll = async () => {
    if (revenues.length === 0) return;
    if (!confirm(`Rensa ALL omsättningsdata (${revenues.length} dager, alla platser)? Detta kan inte ångras.`)) return;
    setClearing(true);
    try {
      const deleted = await clearRevenues();
      setImportMsg(`${deleted} poster raderade (alla platser).`);
    } catch (e) {
      alert('Feil vid rensning: ' + e.message);
    } finally {
      setClearing(false);
    }
  };

  const rows = useMemo(() => {
    return filteredRevenues
      .slice()
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .map(rev => {
        const displayDate = shiftDays(rev.date, seasonOffset * 364);
        const rec = recommendStaffing(rev.amount, config);
        const dayShifts = shiftsByDate.get(displayDate) || [];
        const actual = dayShifts.length;
        const diff = rec.staff != null && actual != null ? actual - rec.staff : null;
        return {
          date: displayDate,
          amount: rev.amount,
          recommended: rec.staff,
          label: rec.label,
          actual,
          diff
        };
      });
  }, [filteredRevenues, config, shiftsByDate, seasonOffset]);

  const parseCsv = (text) => {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    const entries = [];
    const errors = [];
    for (const line of lines) {
      const parts = line.split(/[,;\t]/).map(p => p.trim());
      if (parts.length < 2) { errors.push(line); continue; }
      let date = null;
      let amount = null;
      for (const p of parts) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(p)) { date = p; }
        else if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(p)) {
          const m = p.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
          const year = m[3].length === 2 ? '20' + m[3] : m[3];
          date = `${year}-${String(Number(m[2])).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
        } else if (/^[\d\s.,]+$/.test(p)) {
          amount = Number(p.replace(/[\s]/g, '').replace(',', '.'));
        }
      }
      if (date && amount != null && !isNaN(amount)) {
        entries.push({ date, amount });
      } else {
        errors.push(line);
      }
    }
    return { entries, errors };
  };

  const handleImport = async () => {
    setImportMsg('');
    const { entries, errors } = parseCsv(csvText);
    if (entries.length === 0) {
      setImportMsg('Inga rader kunde tolkas. Format: dato (YYYY-MM-DD eller DD.MM.YYYY) og beløp per rad.');
      return;
    }
    try {
      const loc = location === 'total' ? null : location;
      await importRevenues(entries, loc);
      setImportMsg(`${entries.length} dager importert for ${location === 'total' ? 'total (ingen plats)' : location}${errors.length ? `, ${errors.length} rader hoppet over` : ''}.`);
      setCsvText('');
    } catch (e) {
      setImportMsg('Feil ved import: ' + e.message);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ''));
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveConfig = async () => {
    try {
      const clean = {
        peoplePerAmount: Number(editConfig.peoplePerAmount) || 15000,
        minimumStaff: Number(editConfig.minimumStaff) || 0,
        thresholds: (editConfig.thresholds || []).map(t => ({
          minRevenue: Number(t.minRevenue) || 0,
          staff: Number(t.staff) || 0,
          label: t.label || ''
        })).sort((a, b) => a.minRevenue - b.minRevenue)
      };
      const existing = await getStaffingConfig();
      let locations;
      if (existing && existing.locations) {
        locations = { ...existing.locations, [location]: clean };
      } else if (existing) {
        locations = { total: existing, [location]: clean };
      } else {
        locations = { total: DEFAULT_CONFIG, [location]: clean };
      }
      await saveStaffingConfig({ locations });
      setEditingConfig(false);
    } catch (e) {
      alert('Feil ved lagring: ' + e.message);
    }
  };

  const diffColor = (diff) => {
    if (diff == null) return 'text-gray-400';
    if (diff === 0) return 'text-green-600 font-semibold';
    if (diff > 0) return 'text-yellow-700';
    return 'text-red-600 font-semibold';
  };

  const diffText = (diff) => {
    if (diff == null) return '—';
    if (diff === 0) return '✓ riktig';
    if (diff > 0) return `+${diff} over`;
    return `${diff} under`;
  };

  return (
    <div className="bg-white border rounded-lg shadow-sm p-6 mt-6">
      <div className="mb-4 flex justify-between items-center flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Bemanning från omsättning</h2>
          <p className="text-gray-600">Rekommenderad bemanning per dag utifrån sist säsongs omsättning</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={seasonOffset}
            onChange={(e) => setSeasonOffset(Number(e.target.value))}
            className="px-2 py-1 border rounded text-sm bg-white"
            title="Förskjut omsättningsdatumen till aktuell säsong (bevarar veckodag)"
          >
            <option value={0}>Ursprungliga datum</option>
            <option value={1}>+1 säsong (+1 år, samma veckodag)</option>
          </select>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="px-2 py-1 border rounded text-sm bg-white"
          >
            <option value="total">Total (ingen plats)</option>
            <option value="st">Skiutleie Vest</option>
            <option value="øst">Skiutleie Øst</option>
          </select>
          {['compare', 'import', 'settings'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded text-sm border ${tab === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-100'}`}
            >
              {t === 'compare' ? 'Jämför' : t === 'import' ? 'Import' : 'Inställningar'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'compare' && (
        <div>
          {rows.length === 0 ? (
            <p className="text-gray-500 text-sm">Ingen omsättningsdata för {location === 'total' ? 'total' : location} — gå till Import-fliken och välj rätt plats.</p>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0">
                  <tr className="border-b bg-gray-50">
                    <th className="p-2 text-left text-xs font-medium text-gray-700">Dag</th>
                    <th className="p-2 text-left text-xs font-medium text-gray-700">Veckodag</th>
                    <th className="p-2 text-right text-xs font-medium text-gray-700">Omsättning</th>
                    <th className="p-2 text-right text-xs font-medium text-gray-700">Rek. bemanning</th>
                    <th className="p-2 text-right text-xs font-medium text-gray-700">Faktisk bemanning</th>
                    <th className="p-2 text-left text-xs font-medium text-gray-700">Skillnad</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const d = new Date(r.date + 'T00:00:00');
                    return (
                      <tr key={r.date} className="border-b last:border-b-0">
                        <td className="p-2 border-r text-sm">{formatYMD(r.date)}</td>
                        <td className="p-2 border-r text-sm">{DAY_NAMES[d.getDay()]}</td>
                        <td className="p-2 border-r text-sm text-right">{formatKr(r.amount)}</td>
                        <td className="p-2 border-r text-sm text-right font-medium">
                          {r.recommended ?? '—'}{r.label ? ` (${r.label})` : ''}
                        </td>
                        <td className="p-2 border-r text-sm text-right">{r.actual}</td>
                        <td className={`p-2 text-sm ${diffColor(r.diff)}`}>{diffText(r.diff)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'import' && (
        <div className="space-y-4 max-w-2xl">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm text-blue-800">
            Klistra in daglig omsättning (CSV/tabell från Excel) — en rad per dag med <strong>dato og beløp</strong>.
            Format som tolkas: <code>2025-02-03;43500</code>, <code>03.02.2025, 43 500</code> etc. Befintlig data för samma dato ersätts.
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ladda upp fil</label>
            <input type="file" accept=".csv,.txt" onChange={handleFile} className="text-sm" ref={fileRef} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Eller klistra in här</label>
            <textarea
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              rows={8}
              placeholder={'2025-02-01;38500\n2025-02-02;51200\n2025-02-03;43500'}
              className="w-full p-2 border rounded font-mono text-sm"
            />
          </div>
          {importMsg && <p className="text-sm text-gray-700">{importMsg}</p>}
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleImport} className="px-4 py-2 bg-green-600 text-white rounded border border-green-600 hover:bg-green-700">
              Importera {csvText.trim() ? `(${parseCsv(csvText).entries.length} rader)` : ''}
            </button>
            <button
              onClick={handleClearLocation}
              disabled={clearing || filteredRevenues.length === 0}
              className="px-4 py-2 bg-orange-500 text-white rounded border border-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Rensa {locationLabel} ({filteredRevenues.length})
            </button>
            <button
              onClick={handleClearAll}
              disabled={clearing || revenues.length === 0}
              className="px-4 py-2 bg-red-600 text-white rounded border border-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Rensa ALLT ({revenues.length})
            </button>
          </div>
        </div>
      )}

      {tab === 'settings' && editConfig && (
        <div className="space-y-4 max-w-2xl">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm text-blue-800">
            Redigerar bemanningsinställningar för <strong>{location === 'total' ? 'Total (ingen plats)' : location === 'st' ? 'Skiutleie Vest' : 'Skiutleie Øst'}</strong> — välj plats i dropdownen ovan för att växla.
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Personer per belopp (kr)</label>
              <input
                type="number"
                min="1"
                value={editConfig.peoplePerAmount}
                onChange={e => setEditConfig(prev => ({ ...prev, peoplePerAmount: e.target.value }))}
                className="w-full p-2 border rounded"
              />
              <p className="text-xs text-gray-500 mt-1">Formel: bemanning = ceil(omsättning / detta tal)</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Minimumsbemanning</label>
              <input
                type="number"
                min="0"
                value={editConfig.minimumStaff}
                onChange={e => setEditConfig(prev => ({ ...prev, minimumStaff: e.target.value }))}
                className="w-full p-2 border rounded"
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm font-medium">Trösklar per nivå</label>
              <button
                onClick={() => setEditConfig(prev => ({ ...prev, thresholds: [...(prev.thresholds || []), { minRevenue: 0, staff: 2, label: '' }] }))}
                className="px-2 py-1 bg-gray-200 rounded text-xs hover:bg-gray-300"
              >
                + Lägg till nivå
              </button>
            </div>
            <div className="space-y-2">
              {(editConfig.thresholds || []).map((t, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={t.minRevenue}
                    onChange={e => setEditConfig(prev => {
                      const thresholds = [...prev.thresholds];
                      thresholds[i] = { ...t, minRevenue: Number(e.target.value) };
                      return { ...prev, thresholds };
                    })}
                    className="w-28 p-2 border rounded text-sm"
                    placeholder="Från kr"
                  />
                  <span className="text-sm text-gray-500">kr →</span>
                  <input
                    type="number"
                    value={t.staff}
                    onChange={e => setEditConfig(prev => {
                      const thresholds = [...prev.thresholds];
                      thresholds[i] = { ...t, staff: Number(e.target.value) };
                      return { ...prev, thresholds };
                    })}
                    className="w-20 p-2 border rounded text-sm"
                    placeholder="Pers"
                  />
                  <input
                    type="text"
                    value={t.label}
                    onChange={e => setEditConfig(prev => {
                      const thresholds = [...prev.thresholds];
                      thresholds[i] = { ...t, label: e.target.value };
                      return { ...prev, thresholds };
                    })}
                    className="flex-1 p-2 border rounded text-sm"
                    placeholder="Etikett (t.ex. Høy)"
                  />
                  <button
                    onClick={() => setEditConfig(prev => ({ ...prev, thresholds: prev.thresholds.filter((_, j) => j !== i) }))}
                    className="text-red-500 hover:text-red-700 px-1"
                    title="Ta bort nivå"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Rekommenderad bemanning = max(formel, högsta matchande tröskel). Trösklar sorteras automatiskt på belopp.
            </p>
          </div>
          <div className="flex gap-2 pt-4 border-t">
            <button onClick={handleSaveConfig} className="px-4 py-2 bg-blue-600 text-white rounded border border-blue-600 hover:bg-blue-700">
              Spara inställningar
            </button>
            <button onClick={() => setEditingConfig(false) || setEditConfig(JSON.parse(JSON.stringify(config)))} className="px-4 py-2 bg-gray-200 rounded border hover:bg-gray-300">
              Återställ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default StaffingPlanner;
