const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');

const router = express.Router();
const upload = multer(); // memory storage

function toNum(v) {
  if (v === null || v === undefined) return NaN;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (!s) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function mean(arr){ return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : NaN; }
function variance(arr){
  const m = mean(arr); if (!arr.length) return NaN;
  const v = arr.reduce((a,b)=>a + Math.pow(b - m, 2), 0) / (arr.length - (arr.length>1 ? 1 : 0));
  return v;
}
function stddev(arr){ const v = variance(arr); return Number.isFinite(v) ? Math.sqrt(v) : NaN; }

function analyzeTable(rows) {
  // Determine concentration column
  const headers = Object.keys(rows[0] || {}).map(h => h.trim());
  const lower = headers.map(h => h.toLowerCase());
  let concKey = null;
  const concCandidates = ['conc', 'concentration', 'x', 'level'];
  for (const c of concCandidates) {
    const idx = lower.indexOf(c);
    if (idx >= 0) { concKey = headers[idx]; break; }
  }
  if (!concKey) {
    return { ok:false, error: "CSV must have a concentration column named one of: conc, concentration, x, level" };
  }

  // Replicate columns = all others
  const replKeys = headers.filter(h => h !== concKey);
  if (!replKeys.length) {
    return { ok:false, error: "CSV needs at least one replicate column besides concentration" };
  }

  const blanks = [];
  const levelsX = [];
  const levelsY = [];

  const warnings = [];

  rows.forEach((r, idx) => {
    const rawConc = (r[concKey] ?? '').toString().trim().toLowerCase();
    const isBlank = rawConc === '' || rawConc === 'blank' || rawConc === 'blanks' || rawConc === 'control' || rawConc === '0' || rawConc === '0.0';
    const conc = isBlank ? 0 : toNum(r[concKey]);

    const reps = replKeys.map(k => toNum(r[k])).filter(n => Number.isFinite(n));
    if (!reps.length) return;

    if (isBlank || conc === 0) {
      blanks.push(...reps);
    } else {
      const m = mean(reps);
      if (Number.isFinite(m) && Number.isFinite(conc)) {
        levelsX.push(conc);
        levelsY.push(m);
      }
    }
  });

  if (levelsX.length < 2) {
    return { ok:false, error: "Need at least 2 nonblank concentration levels with numeric replicates" };
  }

  // Linear regression (y = a + b x)
  const n = levelsX.length;
  const sumX = levelsX.reduce((a,b)=>a+b,0);
  const sumY = levelsY.reduce((a,b)=>a+b,0);
  const sumXY = levelsX.reduce((acc, x, i)=> acc + x * levelsY[i], 0);
  const sumX2 = levelsX.reduce((acc, x)=> acc + x*x, 0);
  const denom = n * sumX2 - sumX * sumX;

  if (denom === 0) return { ok:false, error: "Degenerate data (all concentrations same?)" };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const meanY = sumY / n;
  const ssTot = levelsY.reduce((a,y)=> a + Math.pow(y - meanY, 2), 0);
  const ssRes = levelsY.reduce((a,y,i)=> a + Math.pow(y - (slope * levelsX[i] + intercept), 2), 0);
  const r2 = ssTot ? (1 - ssRes / ssTot) : NaN;

  const sigmaBlank = blanks.length ? stddev(blanks) : NaN;
  if (!Number.isFinite(sigmaBlank)) warnings.push("No blanks detected → LOD/LOQ cannot be computed");

  const lod = (Number.isFinite(sigmaBlank) && slope !== 0) ? (3 * sigmaBlank / slope) : NaN;
  const loq = (Number.isFinite(sigmaBlank) && slope !== 0) ? (10 * sigmaBlank / slope) : NaN;

  return {
    ok: true,
    analysis: {
      curve_type: "linear",
      slope, intercept, r2,
      sigma_blank: sigmaBlank,
      lod, loq,
      n_levels: n,
      conc_min: Math.min(...levelsX),
      conc_max: Math.max(...levelsX),
      warnings
    }
  };
}

// POST /api/calibration/analyze (multipart CSV)
router.post('/analyze', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok:false, error: "CSV file is required (field name: file)" });
  let text = req.file.buffer.toString('utf8');
  // Normalize Windows newlines
  text = text.replace(/\r\n/g, '\n');
  const rows = parse(text, { columns: true, skip_empty_lines: true });
  const result = analyzeTable(rows);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

// POST /api/calibration/save (JSON)
router.post('/save', express.json(), async (req, res) => {
  const db = req.app.locals.db;
  const { target, notes, analysis } = req.body || {};
  if (!analysis || typeof analysis !== 'object') return res.status(400).json({ ok:false, error: "Missing analysis" });

  const doc = {
    target: (target || 'miR-21'),
    notes,
    curve_type: analysis.curve_type || 'linear',
    params: { slope: analysis.slope, intercept: analysis.intercept, r2: analysis.r2 },
    sigma_blank: analysis.sigma_blank,
    lod: analysis.lod,
    loq: analysis.loq,
    n_levels: analysis.n_levels,
    conc_min: analysis.conc_min,
    conc_max: analysis.conc_max,
    created_at: new Date(),
    valid_from: new Date()
  };
  await db.collection('calibration_models').insertOne(doc);
  res.json({ ok:true, id: doc._id?.toString?.() });
});

// GET /api/calibration/latest
router.get('/latest', async (req, res) => {
  const db = req.app.locals.db;
  const data = await db.collection('calibration_models')
    .find({}, { projection: { _id: 0 } })
    .sort({ created_at: -1 })
    .limit(5)
    .toArray();
  res.json({ ok:true, data });
});

module.exports = router;
