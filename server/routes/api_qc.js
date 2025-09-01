const express = require('express');
const router = express.Router();
router.use(express.json());

// Create QC control
router.post('/controls', async (req, res) => {
  const db = req.app.locals.db;
  const { control_id, lot_id, target_level, mean, sd, unit, notes } = req.body || {};
  if (!control_id) return res.status(400).json({ ok:false, error:'control_id required' });

  const exists = await db.collection('qc_controls').findOne({ control_id });
  if (exists) return res.status(409).json({ ok:false, error:'control_id already exists' });

  const doc = {
    control_id: String(control_id).trim(),
    lot_id: lot_id || '',
    target_level: target_level || '',
    unit: unit || 'RFU',
    mean: mean != null ? Number(mean) : undefined,
    sd: sd != null ? Number(sd) : undefined,
    notes: notes || '',
    history: [],
    created_at: new Date()
  };

  await db.collection('qc_controls').insertOne(doc);
  res.json({ ok:true, control_id: doc.control_id });
});

// List controls (with trimmed history)
router.get('/controls', async (req, res) => {
  const db = req.app.locals.db;
  const docs = await db.collection('qc_controls')
    .find({}, { projection: { _id: 0 } })
    .sort({ created_at: -1 })
    .toArray();
  // Trim history to last 50 points
  docs.forEach(d => {
    if (Array.isArray(d.history) && d.history.length > 50) {
      d.history = d.history.slice(-50);
    }
  });
  res.json({ ok:true, data: docs });
});

// Add QC result for a control
router.post('/record', async (req, res) => {
  const db = req.app.locals.db;
  const { control_id, value, operator_email, run_id, note } = req.body || {};
  if (!control_id) return res.status(400).json({ ok:false, error:'control_id required' });
  if (value == null) return res.status(400).json({ ok:false, error:'value required' });

  const ctrl = await db.collection('qc_controls').findOne({ control_id });
  if (!ctrl) return res.status(404).json({ ok:false, error:'control not found' });

  const val = Number(value);
  const mean = Number(ctrl.mean);
  const sd = Number(ctrl.sd);
  let z = null, pass_2s = null, pass_3s = null, pass = null;

  if (Number.isFinite(mean) && Number.isFinite(sd) && sd > 0) {
    z = (val - mean) / sd;
    pass_2s = Math.abs(z) <= 2;
    pass_3s = Math.abs(z) <= 3;
    pass = pass_2s; // basic rule: within ±2SD
  }

  const rec = {
    at: new Date(),
    value: val,
    operator_email: operator_email || '',
    run_id: run_id || '',
    note: note || '',
    z, pass_2s, pass_3s, pass
  };

  await db.collection('qc_controls').updateOne(
    { control_id },
    { $push: { history: rec } }
  );

  res.json({ ok:true, result: rec });
});

// Recent flattened results (across all controls)
router.get('/recent', async (req, res) => {
  const db = req.app.locals.db;
  const docs = await db.collection('qc_controls').find({}, { projection: { _id:0, control_id:1, mean:1, sd:1, unit:1, history:1 } }).toArray();
  const rows = [];
  docs.forEach(d => {
    (d.history || []).forEach(h => rows.push({
      control_id: d.control_id,
      at: h.at,
      value: h.value,
      z: h.z,
      pass: h.pass,
      unit: d.unit
    }));
  });
  rows.sort((a,b)=> new Date(b.at) - new Date(a.at));
  res.json({ ok:true, data: rows.slice(0, 50) });
});

// Manually update kit lot QC status
router.post('/kitlot/status', async (req, res) => {
  const db = req.app.locals.db;
  const { kit_lot_id, qc_status } = req.body || {};
  if (!kit_lot_id || !qc_status) return res.status(400).json({ ok:false, error:'kit_lot_id and qc_status required' });

  const r = await db.collection('kit_lots').updateOne(
    { kit_lot_id: String(kit_lot_id).trim() },
    { $set: { qc_status: String(qc_status), updated_at: new Date() } }
  );
  if (!r.matchedCount) return res.status(404).json({ ok:false, error:'kit lot not found' });
  res.json({ ok:true });
});

module.exports = router;
