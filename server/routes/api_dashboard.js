const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  const db = req.app.locals.db;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Runs today
  const runs_today = await db.collection('run_records').countDocuments({ created_at: { $gte: startOfToday } });

  // Latest calibration
  const latest_calibration = await db.collection('calibration_models')
    .find({}, { projection: { _id: 0 } })
    .sort({ created_at: -1 })
    .limit(1)
    .next();

  // Expiring lots (<= 30 days)
  const kit_expiring = await db.collection('kit_lots')
    .find({ expiry: { $lte: in30d } }, { projection: { _id: 0, kit_lot_id: 1, qc_status: 1, expiry: 1 } })
    .sort({ expiry: 1 })
    .limit(10)
    .toArray();

  const form_expiring = await db.collection('formulation_lots')
    .find({ expiry: { $lte: in30d } }, { projection: { _id: 0, lot_id: 1, storage: 1, expiry: 1 } })
    .sort({ expiry: 1 })
    .limit(10)
    .toArray();

  // QC fails in last 7 days (flatten history)
  const controls = await db.collection('qc_controls')
    .find({}, { projection: { _id: 0, control_id: 1, unit: 1, history: 1 } })
    .toArray();

  let qc_fails = [];
  controls.forEach(c => {
    (c.history || []).forEach(h => {
      const at = h?.at ? new Date(h.at) : null;
      if (at && at >= since7d && h.pass === false) {
        qc_fails.push({
          control_id: c.control_id,
          at,
          value: h.value,
          z: h.z,
          unit: c.unit || 'RFU'
        });
      }
    });
  });
  qc_fails.sort((a,b) => b.at - a.at);
  qc_fails = qc_fails.slice(0, 10);

  res.json({
    ok: true,
    runs_today,
    latest_calibration: latest_calibration || null,
    expiring: { kit_lots: kit_expiring, formulation_lots: form_expiring },
    qc_fails
  });
});

module.exports = router;
