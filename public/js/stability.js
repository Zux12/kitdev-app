let STUDIES = [];
let CHART = null;

function el(id){ return document.getElementById(id); }
function fmtDT(d){ try { return new Date(d).toLocaleString(); } catch { return ''; } }

async function loadStudies() {
  const res = await fetch('/api/stability/studies');
  const j = await res.json();
  STUDIES = j.data || [];

  // fill table
  const tbody = el('studies-body');
  tbody.innerHTML = '';
  STUDIES.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${s.study_id}</td><td>${s.lot_id}</td><td>${s.condition}</td><td>${(s.plan_days||[]).join(', ')}</td><td>${fmtDT(s.created_at)}</td>`;
    tbody.appendChild(tr);
  });
  if (!STUDIES.length) {
    const tr = document.createElement('tr'); tr.innerHTML = `<td colspan="5">None</td>`; tbody.appendChild(tr);
  }

  // fill select
  const sel = el('study-select');
  sel.innerHTML = '';
  STUDIES.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.study_id;
    opt.textContent = `${s.lot_id} — ${s.condition}`;
    sel.appendChild(opt);
  });
  if (STUDIES.length) {
    await loadSeries(STUDIES[0].study_id);
  } else {
    const tb = el('stab-body'); tb.innerHTML = `<tr><td colspan="6">Create a study to begin.</td></tr>`;
  }
}

async function loadSeries(study_id) {
  const res = await fetch(`/api/stability/series?study_id=${encodeURIComponent(study_id)}`);
  const j = await res.json();
  const data = j.data || [];

  // table
  const tb = el('stab-body');
  tb.innerHTML = '';
  data.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.day}</td><td>${p.signal}</td><td>${p.pct_change == null ? '' : p.pct_change.toFixed(2) + '%'}</td><td>${p.temp_c ?? ''}</td><td>${fmtDT(p.created_at)}</td><td>${p.notes || ''}</td>`;
    tb.appendChild(tr);
  });
  if (!data.length) {
    const tr = document.createElement('tr'); tr.innerHTML = `<td colspan="6">No points yet.</td>`; tb.appendChild(tr);
  }

  // chart
  const labels = data.map(p => p.day);
  const values = data.map(p => p.signal);
  if (CHART) { CHART.destroy(); CHART = null; }
  const ctx = document.getElementById('stab-chart').getContext('2d');
  CHART = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label:'Signal', data: values, fill:false, tension:0.2 }] },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: {
        x: { title: { display:true, text:'Day' } },
        y: { title: { display:true, text:'Signal (RFU)' } }
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadStudies().catch(console.error);

  // create study
  el('study-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const r = await fetch('/api/stability/study', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)
    });
    const j = await r.json();
    if (j.ok) {
      e.target.reset();
      await loadStudies();
      alert('Study created');
    } else {
      alert(j.error || 'Create error');
    }
  });

  // add point
  el('point-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.target).entries());
    const data = {
      study_id: raw.study_id,
      day: Number(raw.day),
      signal: Number(raw.signal),
      temp_c: raw.temp_c === '' ? null : Number(raw.temp_c),
      notes: raw.notes || ''
    };
    const r = await fetch('/api/stability/point', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)
    });
    const j = await r.json();
    if (j.ok) {
      el('point-feedback').textContent = 'Saved.';
      e.target.reset();
      await loadSeries(data.study_id);
    } else {
      el('point-feedback').textContent = j.error || 'Save error';
    }
  });

  // change selected study
  el('study-select').addEventListener('change', (e)=> loadSeries(e.target.value));
});
