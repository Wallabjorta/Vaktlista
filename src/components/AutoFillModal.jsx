import React, { useState, useEffect, useMemo } from 'react';
import { subscribeToRevenues, subscribeToStaffingConfig, recommendStaffing } from '../firebase';
import { generateAutoFill, toDateStr, buildRevenueMap } from '../utils/autoFill';
import { EMPLOYEE_CATEGORIES, inferCategory, deptNameToCategory } from './ShiftCalendar';

// Samma platsmappning som OverviewCalendar:s bemanningsstatistik — så att
// auto-fyllen bemannar till EXAKT det behov statistiken visar rött/grönt för.
const LOCATION_BY_CATEGORY = {
  'Skiutleie Vest': 'st',
  'Butikk Vest': 'st',
  'Skiutleie Øst': 'øst',
  'Butikk Øst': 'øst'
};

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
  const [pairId1, setPairId1] = useState('');
  const [pairId2, setPairId2] = useState('');
  const [weekendOnlyIds, setWeekendOnlyIds] = useState([]);
  const [result, setResult] = useState(null);
  const [revenues, setRevenues] = useState([]);
  const [configs, setConfigs] = useState(null);
  const [aiText, setAiText] = useState('');
  const [aiCopied, setAiCopied] = useState(false);

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

  // Helgansatte: jobbar bare lördag/söndag (kan vara utanför kategorin)
  const weekendOnlyEmps = useMemo(() => {
    const ids = new Set(weekendOnlyIds.map(String));
    return (employees || []).filter(e =>
      e && !e.isAdmin && e.category !== 'Admin' && ids.has(String(e.id))
    );
  }, [employees, weekendOnlyIds]);

  const engineCandidates = useMemo(() => {
    const seen = new Set();
    return [...candidates, ...weekendOnlyEmps].filter(e => {
      if (seen.has(String(e.id))) return false;
      seen.add(String(e.id));
      return true;
    });
  }, [candidates, weekendOnlyEmps]);

  // Avdeling som motsvarar kategorin (för färg/visning av nya vakter);
  // fallback är den enskilde anställdes första avdeling.
  const deptForCategory = useMemo(() => {
    if (!category) return null;
    return (departments || []).find(d => d && deptNameToCategory(d.name) === category) || null;
  }, [departments, category]);

  // Per-ansatt avdeling: kategorins avdeling om possible, annars den anställdes
  // första avdeling som mappas till kategorin, annars första giltiga avdeling —
  // nya vakter ska ALDRIG sparas utan giltig avdeling (då syns de ikke i kalendern).
  const departmentIdByEmp = useMemo(() => {
    const map = {};
    for (const e of engineCandidates || []) {
      const own = (e.deptIds || []).find(id =>
        departments?.some(d => d && d.id === id && deptNameToCategory(d.name) === category)
      );
      map[String(e.id)] = deptForCategory?.id || own ||
        (e.deptIds || [])[0] || null;
    }
    return map;
  }, [engineCandidates, departments, category, deptForCategory]);

  const datesInRange = useMemo(() => {
    if (!periodStart || !periodEnd) return [];
    return dates.filter(d => {
      const s = toDateStr(d);
      return s >= periodStart && s <= periodEnd;
    });
  }, [dates, periodStart, periodEnd]);

  const handleGenerate = () => {
    if (!category) { alert('Velg kategori!'); return; }
    if (candidates.length === 0 && weekendOnlyEmps.length === 0) {
      alert('Ingen ansatte (uten admin) i valgt kategori.');
      return;
    }
    if (!periodStart || !periodEnd) { alert('Velg periode (fra og til dato)!'); return; }
    if (periodStart > periodEnd) { alert('Fra-dato må være før eller lik til-dato!'); return; }
    if (startTime >= endTime) { alert('Sluttid må være etter starttid!'); return; }
    if (datesInRange.length === 0) { alert('Perioden ligger utenfor oversiktens vindu.'); return; }
    setResult(generateAutoFill({
      dates: datesInRange,
      employees: engineCandidates,
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
        minPerDay: 2,
        pairIds: [pairId1, pairId2].filter(Boolean),
        weekendOnlyIds: weekendOnlyIds,
        departmentIdByEmp,
        location: LOCATION_BY_CATEGORY[category] || null,
        category
      }
    }));
  };

  // ===== AI-assistent: kopiera kompakt sammandrag, klistra in AI-förslag =====
  const aiSummary = () => {
    const loc = LOCATION_BY_CATEGORY[category] || 'total';
    const revMap = buildRevenueMap(revenues);
    const cfgFor = (configs && (configs[loc] || configs.total)) || DEFAULT_STAFFING_CONFIG;
    const candIds = new Set(engineCandidates.map(e => String(e.id)));
    const busyByEmp = new Map();
    for (const sh of shifts || []) {
      if (!sh.date) continue;
      const id = String(sh.employeeId);
      if (!busyByEmp.has(id)) busyByEmp.set(id, []);
      busyByEmp.get(id).push(sh.date);
    }
    const behovPerDag = datesInRange.map(d => {
      const ds = toDateStr(d);
      const amount = revMap.get(`${loc}_${ds}`);
      const rec = amount != null ? recommendStaffing(amount, cfgFor) : null;
      const allerede = (shifts || [])
        .filter(sh => sh.date === ds && candIds.has(String(sh.employeeId)))
        .map(sh => {
          const e = engineCandidates.find(x => String(x.id) === String(sh.employeeId));
          return e ? e.name : String(sh.employeeId);
        });
      return {
        dato: ds,
        ukedag: d.toLocaleDateString('no-NO', { weekday: 'short' }),
        rødDag: d.getDay() === 0 || d.getDay() === 6 || (holidays || []).includes(ds),
        omsetning: amount ?? null,
        behov: Math.max(rec ? rec.staff : 0, 2),
        alleredePåJobb: allerede
      };
    });
    return {
      instruksjon: 'Foreslå vaktliste for denne kategorien/perioden. Svar KUN med en JSON-array: [{"employeeId":"<id>","date":"YYYY-MM-DD","startTime":"08:45","endTime":"16:00"}] — én oppføring per ny vakt.',
      kategori: category,
      sted: loc,
      periode: { fra: periodStart, til: periodEnd },
      standardTid: { start: startTime, slutt: endTime },
      minPerDag: 2,
      parAlltidÉnPåJobb: [pairId1, pairId2].filter(Boolean).map(id => {
        const e = engineCandidates.find(x => String(x.id) === String(id));
        return e ? e.name : id;
      }),
      helgansatte: weekendOnlyEmps.map(e => e.name),
      ansatte: engineCandidates.map(e => ({
        id: String(e.id),
        navn: e.name,
        kontraktProsent: Number(e.contractPercent) || 100,
        helgKun: weekendOnlyIds.some(id => String(id) === String(e.id)),
        opptattDager: (busyByEmp.get(String(e.id)) || [])
          .filter(ds => ds >= periodStart && ds <= periodEnd).sort()
      })),
      behovPerDag,
      regler: 'Maks 5 arbeidsdager/uke og maks 8 sammenhengende dager per ansatt; maks 2 røde dager (søn/helligdag) i rad; helgansatte jobber bare lør+søn+helligdager/juleferie; kontrakts% er MINIMUM — fordel overskudd likt mellan alle; paret (om satt) må ha minst én på jobb hver dag; foretrekk blokker på ~2 dager i lavsesong; helger bemannes til samme behov som ukedager; bare tomme celler får nye vakter.'
    };
  };

  const handleCopyAi = async () => {
    if (!category || !periodStart || !periodEnd) { alert('Velg kategori og periode først!'); return; }
    const text = JSON.stringify(aiSummary(), null, 1);
    try {
      await navigator.clipboard.writeText(text);
      setAiCopied(true);
      setTimeout(() => setAiCopied(false), 2500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setAiCopied(true);
        setTimeout(() => setAiCopied(false), 2500);
      } catch {
        alert('Kopiering feilet — kopier teksten manuelt.');
      }
      document.body.removeChild(ta);
    }
  };

  const handleApplyAi = () => {
    let parsed;
    try {
      parsed = JSON.parse(aiText);
    } catch (e) {
      alert('Kunne ikke lese JSON: ' + e.message);
      return;
    }
    const list = Array.isArray(parsed) ? parsed : (parsed.assignments || parsed.forslag || parsed.vakter || []);
    if (!Array.isArray(list) || list.length === 0) {
      alert('Fant ingen vakter i svaret. Forventet en JSON-array, eller objekt med "assignments"/"forslag"/"vakter".');
      return;
    }
    const nameToEmp = new Map(engineCandidates.map(e => [String(e.name).toLowerCase(), e]));
    const assignments = [];
    let ignored = 0;
    for (const item of list) {
      if (!item || !item.date) { ignored++; continue; }
      const emp = engineCandidates.find(e => String(e.id) === String(item.employeeId)) ||
        nameToEmp.get(String(item.name || item.employeeName || '').toLowerCase());
      if (!emp) { ignored++; continue; }
      assignments.push({
        employeeId: emp.id,
        employeeName: emp.name,
        date: item.date,
        departmentId: item.departmentId || departmentIdByEmp[String(emp.id)] || deptForCategory?.id || null,
        startTime: item.startTime || startTime,
        endTime: item.endTime || endTime,
        comment: item.comment || 'AI-forslag',
        autoFilled: true,
        breaks: []
      });
    }
    if (assignments.length === 0) { alert('Ingen gyldige vakter (ukjent ansatt eller dato).'); return; }
    // Bygg perDate-förhandsvisning över samma period
    const loc = LOCATION_BY_CATEGORY[category] || 'total';
    const revMap = buildRevenueMap(revenues);
    const cfgFor = (configs && (configs[loc] || configs.total)) || DEFAULT_STAFFING_CONFIG;
    const candIds = new Set(engineCandidates.map(e => String(e.id)));
    const perDate = datesInRange.map(d => {
      const ds = toDateStr(d);
      const amount = revMap.get(`${loc}_${ds}`);
      const rec = amount != null ? recommendStaffing(amount, cfgFor) : null;
      const gen = assignments.filter(a => a.date === ds);
      return {
        date: ds,
        recommended: rec ? rec.staff : null,
        need: Math.max(rec ? rec.staff : 0, 2),
        isSunday: d.getDay() === 0,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        isHoliday: (holidays || []).includes(ds),
        existing: (shifts || []).filter(sh => sh.date === ds && candIds.has(String(sh.employeeId))).length,
        generated: gen.length,
        names: gen.map(a => a.employeeName)
      };
    });
    setResult({
      assignments,
      warnings: ignored > 0 ? [`${ignored} oppføringer i AI-svaret ble ignorert (ukjent ansatt/dato)`] : [],
      perDate
    });
    setAiText('');
  };

  // Visa alla dagar i perioden — även de utan nya vakter — så att
  // «2 behövs, 1 finns redan, 1 läggs till, 0 saknas» syns tydligt.
  const relevantDates = (result?.perDate || [])
    .filter(d => (d.need || 0) > 0 || d.generated > 0)
    .map(d => ({ ...d, missing: Math.max(0, (d.need || 0) - (d.existing || 0) - (d.generated || 0)) }));
  const totalNew = result?.assignments?.length || 0;

  // Per-ansatt oversikt over forslaget: nye vakter + arbeidsdager per uke (man–søn)
  const perEmployeeSummary = useMemo(() => {
    if (!result?.assignments) return [];
    const byEmp = new Map();
    for (const a of result.assignments) {
      if (!byEmp.has(String(a.employeeId))) byEmp.set(String(a.employeeId), { emp: null, dates: [] });
      byEmp.get(String(a.employeeId)).dates.push(a.date);
    }
    for (const e of engineCandidates) byEmp.get(String(e.id))?.emp || byEmp.set(String(e.id), { emp: e, dates: byEmp.get(String(e.id))?.dates || [] });
    const rows = [];
    for (const [id, v] of byEmp) {
      const emp = v.emp || engineCandidates.find(e => String(e.id) === id) || allEmployees?.find(e => String(e.id) === id);
      if (!emp) continue;
      const weeks = new Map();
      for (const ds of v.dates) {
        const d = new Date(ds + 'T00:00:00');
        const dow = d.getDay();
        d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
        const wk = toDateStr(d);
        weeks.set(wk, (weeks.get(wk) || 0) + 1);
      }
      rows.push({
        id,
        navn: emp.name,
        pct: Number(emp.contractPercent) || 100,
        nye: v.dates.length,
        perUke: [...weeks.values()].sort((a, b) => b - a)
      });
    }
    return rows.sort((a, b) => b.nye - a.nye || a.navn.localeCompare(b.navn));
  }, [result, engineCandidates, allEmployees]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white border rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <div>
            <h2 className="text-xl font-semibold">Auto-utfylling av vakter</h2>
            <p className="text-sm text-gray-600">
              Minst 2 fra kategorien hver dag, fordelt jevnt — maks 5 arbeidsdager
              per ansatt per uke, ingen mer æn 2 helgedager på rad, prioriteras
              2 dagar fri på rad — basert på omsetning.
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
                  {weekendOnlyEmps.length > 0 && ` + ${weekendOnlyEmps.length} helgansatte`}
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
              <div className="col-span-2 text-xs text-gray-500">
                Alla dagar — inkludert helger, juleferien och røda dager — bemannas
                till EXAKT omsetningsbemanningen. Inga extra läggs till utöver behovet.
              </div>
            </div>
          </div>

          <div className="border-t pt-3 space-y-2">
            <p className="text-sm font-medium">Alltid én på jobb (valgfritt)</p>
            <p className="text-xs text-gray-500">
              Välj två ansatte — minst en av dem är alltid på jobb. Övriga vakter
              fördelas rättvist (alla ska minst fylla sitt kontrakt); extra kan fylla
              flera vakter samma dag.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Ansatte 1</label>
                <select
                  value={pairId1}
                  onChange={(e) => { setPairId1(e.target.value); setResult(null); }}
                  className="w-full p-2 border rounded"
                >
                  <option value="">—</option>
                  {candidates.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Ansatte 2</label>
                <select
                  value={pairId2}
                  onChange={(e) => { setPairId2(e.target.value); setResult(null); }}
                  className="w-full p-2 border rounded"
                >
                  <option value="">—</option>
                  {candidates.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="border-t pt-3 space-y-2">
            <p className="text-sm font-medium">Helgansatte (valgfritt — kun kategorien Ekstra)</p>
            <p className="text-xs text-gray-500">
              Ansatte som jobbar bare helg (lørdag/söndag) och juleferien/røda
              dager. Røda dagar fördelas JÄMT mellan fasta och extra anställda —
              ingen får mer æn 2 røda dagar på rad.
            </p>
            <div className="max-h-[120px] overflow-y-auto border rounded p-2 space-y-1">
              {(employees || []).filter(e => e && !e.isAdmin && e.category !== 'Admin' && inferCategory(e) === 'Ekstra').map(e => (
                <label key={e.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={weekendOnlyIds.some(id => String(id) === String(e.id))}
                    onChange={(ev) => {
                      setWeekendOnlyIds(prev =>
                        ev.target.checked
                          ? [...prev, e.id]
                          : prev.filter(id => String(id) !== String(e.id))
                      );
                      setResult(null);
                    }}
                  />
                  <span>{e.name}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            className="px-4 py-2 bg-blue-600 text-white rounded border border-blue-600 hover:bg-blue-700"
          >
            Generer forslag
          </button>

          <div className="border-t pt-3 space-y-2">
            <p className="text-sm font-medium">🤖 AI-assistent (valgfritt)</p>
            <p className="text-xs text-gray-500">
              Kopier et kompakt sammendrag → lim det inn hos AI-assistenten (f.eks. denne chatten)
              og be om forslag → lim inn AI-svaret (JSON) under og klikk «Bruk AI-forslag».
              Forslaget vises i forhåndsvisningen og lagres som vanlig.
            </p>
            <div className="flex gap-2 flex-wrap items-center">
              <button
                onClick={handleCopyAi}
                disabled={!category || !periodStart || !periodEnd}
                className="px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 text-sm"
              >
                {aiCopied ? '✅ Kopiert til utklippstavle!' : '📋 Kopier AI-sammendrag'}
              </button>
            </div>
            <textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder='Lim inn AI-forslag her — JSON, f.eks. [{"employeeId":"abc","date":"2026-11-23","startTime":"08:45","endTime":"16:00"}]'
              className="w-full p-2 border rounded text-xs h-20 font-mono"
            />
            <button
              onClick={handleApplyAi}
              disabled={!aiText.trim()}
              className="px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 text-sm"
            >
              📥 Bruk AI-forslag
            </button>
          </div>

          {result && (
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm">
                <strong>{totalNew} nye vakter</strong> foreslått i perioden {formatYMD(periodStart)} – {formatYMD(periodEnd)}
                ({candidates.length} ansatte, {relevantDates.length} dager berørt).
                {totalNew === 0 && ' Ingen dager mangler bemanning innenfor disse reglene.'}
                {perEmployeeSummary.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    {perEmployeeSummary.map(r => (
                      <span key={r.id} className="px-2 py-0.5 rounded bg-white border border-blue-200 text-gray-700" title={`Dager per uke: ${r.perUke.join(', ') || '—'}`}>
                        {r.navn} ({r.pct} %): <strong>{r.nye}</strong> nye
                        {r.perUke.length > 0 && <span className="text-gray-500"> — maks {r.perUke[0]}/uke</span>}
                      </span>
                    ))}
                  </div>
                )}
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
                        <th className="p-2 text-left font-medium text-xs">Behov</th>
                        <th className="p-2 text-left font-medium text-xs">Eksisterer</th>
                        <th className="p-2 text-left font-medium text-xs">Nye vakter</th>
                        <th className="p-2 text-left font-medium text-xs">Mangler</th>
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
                          <td className="p-2 border-r">{d.need ?? d.recommended ?? '—'}</td>
                          <td className="p-2 border-r">{d.existing}</td>
                          <td className="p-2">
                            <span className="font-medium">{d.generated}</span>
                            <span className="text-xs text-gray-600 ml-1">({d.names.join(', ')})</span>
                          </td>
                          <td className="p-2">
                            {d.missing > 0 ? (
                              <span className="text-red-600 font-medium">{d.missing}</span>
                            ) : (
                              <span className="text-green-600">0</span>
                            )}
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
