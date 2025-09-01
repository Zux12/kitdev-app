const express = require('express');
const router = express.Router();
router.use(express.json());

// Create eCRF record
router.post('/', async (req, res) => {
  const db = req.app.locals.db;
  const {
    subject_id, sample_id, age, sex, site, operator_email,
    symptoms, kit_result, comparator_result, notes, consent
  } = req.body || {};

  if (!consent) return res.status(400).json({ ok:false, error:'consent required' });
  if (!subject_id || !sample_id) return res.status(400).json({ ok:false, error:'subject_id and sample_id required' });

  const doc = {
    subject_id: String(subject_id).trim(),
    sample_id: String(sample_id).trim(),
    age: age == null || age === '' ? undefined : Number(age),
    sex: sex || '',
    site: site || '',
    operator_email: operator_email || '',
    symptoms: symptoms || '',
    kit_result: kit_result || '',
    comparator_result: comparator_result || '',
    notes: notes || '',
    created_at: new Date()
  };

  await db.collection('ecrf_records').insertOne(doc);
  res.json({ ok:true });
});

// Recent (last 100)
router.get('/recent', async (req, res) => {
  const db = req.app.locals.db;
  const data = await db.collection('ecrf_records')
    .find({}, { projection: { _id:0 } })
    .sort({ created_at: -1 })
    .limit(100)
    .toArray();
  res.json({ ok:true, data });
});

// CSV export (last 1000)
router.get('/export', async (req, res) => {
  const db = req.app.locals.db;
  const rows = await db.collection('ecrf_records')
    .find({}, { projection: { _id:0 } })
    .sort({ created_at: -1 })
    .limit(1000)
    .toArray();

  const cols = ["subject_id","sample_id","age","sex","site","operator_email","symptoms","kit_result","comparator_result","notes","created_at"];
  const esc = v => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  };
  const lines = [cols.join(",")];
  rows.forEach(r => lines.push(cols.map(c => esc(r[c])).join(",")));
  const csv = lines.join("\n");

  res.set('Content-Type','text/csv; charset=utf-8');
  res.set('Content-Disposition','attachment; filename="ecrf_export.csv"');
  res.send(csv);
});

module.exports = router;
