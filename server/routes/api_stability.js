const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();

router.use(express.json());

// Create a stability study (lot + condition + plan days)
router.post('/study', async (req, res) => {
  const db = req.app.locals.db;
  const { lot_id, condition, plan_days } = req.body || {};
  if (!lot_id) return res.status(400).json({ ok:false, error:'lot_id required' });

  // plan_days can be CSV string or array
  let days = [];
  if (Array.isArray(plan_days)) {
    days = plan_days.map(Number).filter(n => Number.isFinite(n));
  } else if (typeof plan_days === 'string') {
    days = plan_days.split(/[,\s]+/).map(Number).filter(n => Number.isFinite(n));
  } else {
    days = [0,7,14,30,60,90];
  }

  const doc = {
    lot_id: String(lot_id).trim(),
    condition: (condition || 'RT dark'),
    plan_days: days.sort((a,b)=>a-b),
    created_at: new Date()
  };

  const r = await db.collection('stability_studies').insertOne(doc);
  res.json({ ok:true, study_id: r.insertedId.toString() });
});

// List studies (latest 50)
router.get('/studies', async (req, res) => {
  const db = req.app.locals.db;
  const data = await db.collection('stability_studies')
    .find({}, { projection: { _id: 1, lot_id:1, condition:1, plan_days:1, created_at:1 } })
    .sort({ created_at: -1 })
    .limit(50)
    .toArray();

  res.json({ ok:true, data: data.map(d => ({
    study_id: d._id.toString(),
    lot_id: d.lot_id,
    condition: d.condition,
    plan_days: d.plan_days,
    created_at: d.created_at
  }))});
});

// Add a measurement point
router.post('/point', async (req, res) => {
  const db = req.app.locals.db;
  const { study_id, lot_id, condition, day, signal, temp_c, notes } = req.body || {};
  if (!study_id && !lot_id) return res.status(400).json({ ok:false, error:'study_id or lot_id required' });
  if (day == null) return res.status(400).json({ ok:false, error:'day required' });
  if (signal == null) return res.status(400).json({ ok:false, error:'signal required' });

  let study = null, _sid = null, _lot = lot_id, _cond = condition;
  if (study_id) {
    try { _sid = new ObjectId(study_id); } catch { return res.status(400).json({ ok:false, error:'bad study_id' }); }
    study = await db.collection('stability_studies').findOne({ _id: _sid });
    if (!study) return res.status(404).json({ ok:false, error:'study not found' });
    _lot = study.lot_id;
    _cond = study.condition;
  }

  const doc = {
    study_id: _sid || null,
    lot_id: _lot ? String(_lot).trim() : '',
    condition: _cond || '',
    day: Number(day),
    signal: Number(signal),
    temp_c: (temp_c == null || temp_c === '') ? undefined : Number(temp_c),
    notes: notes || '',
    created_at: new Date()
  };

  await db.collection('stability_points').insertOne(doc);
  res.json({ ok:true });
});

// Get a time series for a study
router.get('/series', async (req, res) => {
  const db = req.app.locals.db;
  const { study_id } = req.query || {};
  if (!study_id) return res.status(400).json({ ok:false, error:'study_id required' });
  let _sid;
  try { _sid = new ObjectId(study_id); } catch { return res.status(400).json({ ok:false, error:'bad study_id' }); }

  const study = await db.collection('stability_studies')
    .findOne({ _id: _sid }, { projection: { _id:0 } });

  const pts = await db.collection('stability_points')
    .find({ study_id: _sid })
    .project({ _id:0 })
    .sort({ day: 1, created_at: 1 })
    .toArray();

  // Baseline = first Day 0 if present, else first point
  let base = null;
  const day0 = pts.find(p => Number(p.day) === 0);
  if (day0 && Number.isFinite(day0.signal)) base = day0.signal;
  else if (pts.length && Number.isFinite(pts[0].signal)) base = pts[0].signal;

  const data = pts.map(p => ({
    ...p,
    pct_change: (Number.isFinite(base) && base !== 0) ? ((p.signal - base) / base) * 100 : null
  }));

  res.json({ ok:true, study, base, data });
});

module.exports = router;
