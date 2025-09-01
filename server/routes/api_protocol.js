const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();

router.use(express.json());

// GET active protocol (highest version marked active)
router.get('/active', async (req, res) => {
  const db = req.app.locals.db;
  const proto = await db.collection('protocols')
    .find({ active: true })
    .sort({ version: -1, created_at: -1 })
    .limit(1)
    .project({ _id: 0 })
    .next();
  if (!proto) return res.status(404).json({ ok:false, error:'No active protocol' });
  res.json({ ok:true, protocol: proto });
});

// Start a session
router.post('/session/start', async (req, res) => {
  const db = req.app.locals.db;
  const { operator_email, protocol_name } = req.body || {};
  if (!operator_email) return res.status(400).json({ ok:false, error:'operator_email required' });

  const proto = await db.collection('protocols')
    .find({ active: true, ...(protocol_name ? { name: protocol_name } : {}) })
    .sort({ version: -1, created_at: -1 })
    .limit(1).next();

  if (!proto) return res.status(404).json({ ok:false, error:'No active protocol' });

  const steps = (proto.steps || []).map(s => ({
    label: s.label,
    duration_s: s.duration_s,
    tips: s.tips || '',
    started_at: null,
    completed_at: null,
    deviations: []
  }));

  const doc = {
    protocol_name: proto.name,
    version: proto.version,
    operator_email,
    started_at: new Date(),
    steps,
    finished_at: null,
    total_time_s: null
  };

  const r = await db.collection('protocol_sessions').insertOne(doc);
  res.json({ ok:true, session_id: r.insertedId.toString(), protocol: { name: proto.name, version: proto.version }, steps });
});

// Record a step event: start / complete / deviation
router.post('/session/step', async (req, res) => {
  const db = req.app.locals.db;
  const { session_id, step_index, event, deviation_text } = req.body || {};
  if (!session_id || step_index == null || !event) {
    return res.status(400).json({ ok:false, error:'session_id, step_index, event required' });
  }
  let _id;
  try { _id = new ObjectId(session_id); } catch { return res.status(400).json({ ok:false, error:'bad session_id' }); }

  const path = `steps.${step_index}`;
  const now = new Date();
  let update;

  if (event === 'start') {
    update = { $set: { [`${path}.started_at`]: now } };
  } else if (event === 'complete') {
    update = { $set: { [`${path}.completed_at`]: now } };
  } else if (event === 'deviation') {
    if (!deviation_text) return res.status(400).json({ ok:false, error:'deviation_text required' });
    update = { $push: { [`${path}.deviations`]: { at: now, text: deviation_text } } };
  } else {
    return res.status(400).json({ ok:false, error:'unknown event' });
  }

  await db.collection('protocol_sessions').updateOne({ _id }, update);
  res.json({ ok:true });
});

// Finish session
router.post('/session/finish', async (req, res) => {
  const db = req.app.locals.db;
  const { session_id } = req.body || {};
  if (!session_id) return res.status(400).json({ ok:false, error:'session_id required' });
  let _id;
  try { _id = new ObjectId(session_id); } catch { return res.status(400).json({ ok:false, error:'bad session_id' }); }

  const now = new Date();
  const sess = await db.collection('protocol_sessions').findOne({ _id });
  if (!sess) return res.status(404).json({ ok:false, error:'session not found' });

  const total_time_s = Math.max(0, Math.round((now - new Date(sess.started_at)) / 1000));
  await db.collection('protocol_sessions').updateOne({ _id }, { $set: { finished_at: now, total_time_s } });
  res.json({ ok:true, total_time_s });
});

// Recent sessions
router.get('/session/recent', async (req, res) => {
  const db = req.app.locals.db;
  const data = await db.collection('protocol_sessions')
    .find({}, { projection: { operator_email:1, protocol_name:1, version:1, started_at:1, finished_at:1, total_time_s:1 } })
    .sort({ started_at: -1 })
    .limit(20)
    .toArray();
  res.json({ ok:true, data });
});

module.exports = router;
