const path = require('path');
const express = require('express');
const morgan = require('morgan');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, '..', 'public')));

// DB connect
const uri = process.env.MONGODB_URI_KITDEV || process.env.MONGODB_URI;
if (!uri) { console.error('Missing MONGODB_URI_KITDEV'); process.exit(1); }
const client = new MongoClient(uri);
async function init() {
  await client.connect();
  const db = client.db('kitdev');
  app.locals.db = db;
  console.log('MongoDB connected to database:', db.databaseName);
}
init().catch(err => { console.error('DB connect error:', err); process.exit(1); });

// --- API routes ---
app.use('/api/runs', require('./routes/api_runs'));
app.use('/api/calibration', require('./routes/api_calibration'));

// --- Page routes ---
app.get('/',            (req,res)=> res.render('dashboard',     { title: 'Dashboard',            page: 'dashboard' }));
app.get('/runs',        (req,res)=> res.render('runs',          { title: 'Runs',                 page: 'runs' }));
app.get('/calibration', (req,res)=> res.render('calibration',   { title: 'Calibration',          page: 'calibration' }));
app.get('/protocol',    (req,res)=> res.render('protocol',      { title: 'Protocol',             page: 'protocol' }));
app.get('/formulations',(req,res)=> res.render('formulations',  { title: 'Formulations',         page: 'formulations' }));
app.get('/qc',          (req,res)=> res.render('qc',            { title: 'QC & Lot Release',     page: 'qc' }));
app.get('/stability',   (req,res)=> res.render('stability',     { title: 'Stability',            page: 'stability' }));
app.get('/ecrf',        (req,res)=> res.render('ecrf',          { title: 'eCRF',                 page: 'ecrf' }));
app.get('/admin',       (req,res)=> res.render('admin',         { title: 'Admin',                page: 'admin' }));
app.get('/healthz',     (req,res)=> res.json({ ok: true }));

app.listen(PORT, ()=> console.log('Server listening on port', PORT));
