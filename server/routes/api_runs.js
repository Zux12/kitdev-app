const express = require('express');
const router = express.Router();

// List latest 50 runs
router.get('/', async (req, res) => {
  const db = req.app.locals.db;
  const data = await db.collection('run_records')
    .find({}, { projection: { _id: 0 } })
    .sort({ created_at: -1 })
    .limit(50)
    .toArray();
  res.json({ ok: true, data });
});

// Create a new run
router.post('/', express.json(), async (req, res) => {
  const db = req.app.locals.db;
  const { sample_id, operator_email, intensities_csv, notes } = req.body || {};
  if (!sample_id) return res.status(400).json({ ok: false, error: 'sample_id required' });

  let intensities = [];
  if (typeof intensities_csv === 'string' && intensities_csv.trim()) {
    intensities = intensities_csv.split(/[,\s]+/).map(Number).filter(n => !isNaN(n));
  }

  const doc = {
    sample_id,
    operator_email,
    intensities,
    notes,
    created_at: new Date()
  };

  await db.collection('run_records').insertOne(doc);
  res.json({ ok: true, data: { sample_id } });
});

module.exports = router;
