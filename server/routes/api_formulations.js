const express = require('express');
const router = express.Router();
router.use(express.json());

// ---- FORMULATION LOTS ----
// List latest 50 formulation lots
router.get('/lots', async (req, res) => {
  const db = req.app.locals.db;
  const data = await db.collection('formulation_lots')
    .find({}, { projection: { _id: 0 } })
    .sort({ created_at: -1 })
    .limit(50)
    .toArray();
  res.json({ ok: true, data });
});

// Create formulation lot
router.post('/lots', async (req, res) => {
  const db = req.app.locals.db;
  const {
    lot_id, qd_core_shell, ligand, plga_ratio,
    dls_nm, zeta_mV, yield_pct, storage, notes, expiry
  } = req.body || {};

  if (!lot_id) return res.status(400).json({ ok:false, error:'lot_id required' });

  const doc = {
    lot_id: String(lot_id).trim(),
    qd_core_shell: qd_core_shell || '',
    ligand: ligand || '',
    plga_ratio: plga_ratio || '',
    dls_nm: dls_nm != null ? Number(dls_nm) : undefined,
    zeta_mV: zeta_mV != null ? Number(zeta_mV) : undefined,
    yield_pct: yield_pct != null ? Number(yield_pct) : undefined,
    storage: storage || '',
    notes: notes || '',
    expiry: expiry ? new Date(expiry) : undefined,
    created_at: new Date()
  };

  try {
    await db.collection('formulation_lots').insertOne(doc);
    res.json({ ok:true, lot_id: doc.lot_id });
  } catch (e) {
    if (String(e).includes('E11000')) return res.status(409).json({ ok:false, error:'lot_id already exists' });
    throw e;
  }
});

// ---- KIT LOTS ----
// List latest 50 kit lots
router.get('/kit-lots', async (req, res) => {
  const db = req.app.locals.db;
  const data = await db.collection('kit_lots')
    .find({}, { projection: { _id: 0 } })
    .sort({ created_at: -1 })
    .limit(50)
    .toArray();
  res.json({ ok: true, data });
});

// Create kit lot
router.post('/kit-lots', async (req, res) => {
  const db = req.app.locals.db;
  const {
    kit_lot_id, components, qc_status, expiry, notes
  } = req.body || {};

  if (!kit_lot_id) return res.status(400).json({ ok:false, error:'kit_lot_id required' });

  const doc = {
    kit_lot_id: String(kit_lot_id).trim(),
    components: Array.isArray(components) ? components.map(String) : [],
    qc_status: (qc_status || 'Draft'),
    expiry: expiry ? new Date(expiry) : undefined,
    notes: notes || '',
    created_at: new Date()
  };

  try {
    await db.collection('kit_lots').insertOne(doc);
    res.json({ ok:true, kit_lot_id: doc.kit_lot_id });
  } catch (e) {
    if (String(e).includes('E11000')) return res.status(409).json({ ok:false, error:'kit_lot_id already exists' });
    throw e;
  }
});

module.exports = router;
