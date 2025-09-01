let CONTROLS = [];
let CHART = null;

function el(id){ return document.getElementById(id); }
function td(t){ const x=document.createElement('td'); x.textContent=t; return x; }
function fmtDT(d){ try { return new Date(d).toLocaleString(); } catch { return ''; } }

async function loadControls() {
  const res = await fetch('/api/qc/controls');
  const j = await res.json();
  CONTROLS = j.data || [];
  const sel = el('qc-select');
  sel.innerHTML = '';
  CONTROLS.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.control_id;
    opt.textContent = `${c.control_id} (${c.target_level || ''})`;
    sel.appendChild(opt);
  });
  if (CONTROLS.length) renderChart(CONTROLS[0].control_id);
}

async function loadRecent() {
  const res = await fetch('/api/qc/recent');
  const j = await res.json();
  const tb = el('qc-recent');
  tb.innerHTML = '';
  (j.data || []).forEach(r => {
    const tr = document.createElement('tr');
    tr.append(td(r.control_id));
    tr.append(td(fmtDT(r.at)));
    tr.append(td(r.value));
    tr.append(td(r.z == null ? '' : r.z.toFixed(2)));
    tr.append(td(r.pass === null ? '' : (r.pass ? 'PASS' : 'FAIL')));
    tb.appendChild(tr);
  });
  if (!j.data || j.data.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5">No results yet.</td>`;
    tb.appendChild(tr);
  }
}

function getControl(id){ return CONTROLS.find(c => c.control_id === id); }

function renderChart(control_id) {
  const c = getControl(control_id);
  if (!c) return;

  const values = (c.history || []).map(h => h.value);
  const labels = values.map((_, i) => i + 1);

  const mean = Number(c.mean);
  const sd   = Number(c.sd);

  if (CHART) { CHART.destroy(); CHART = null; }
  const ctx = document.getElementById('qc-chart').getContext('2d');

  const datasets = [
    { label: 'Value', data: values, fill: false, tension: 0.2 }
  ];

  // Add guide lines as datasets (no external plugin needed)
  const mkLine = (y, label) => ({
    label,
    data: labels.map(() => y),
    fill: false,
    tension: 0,
    pointRadius: 0,
    borderWidth: 1,
    borderDash: [4,4]
  });

  if (Number.isFinite(mean)) {
    datasets.push(mkLine(mean, 'Mean'));
    if (Number.isFinite(sd) && sd > 0) {
      datasets.push(mkLine(mean + 2*sd, '+2SD'));
      datasets.push(mkLine(mean - 2*sd, '-2SD'));
      datasets.push(mkLine(mean + 3*sd, '+3SD'));
      datasets.push(mkLine(mean - 3*sd, '-3SD'));
    }
  }

  CHART = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: {
        x: { title: { display: true, text: 'Run #' } },
        y: { title: { display: true, text: c.unit || 'RFU' } }
      }
    }
  });

  el('qc-meta').textContent = `Mean: ${Number.isFinite(mean)?mean:''}  SD: ${Number.isFinite(sd)?sd:''}  Points: ${(c.history||[]).length}`;
}

document.addEventListener('DOMContentLoaded', () => {
  loadControls().catch(console.error);
  loadRecent().catch(console.error);

  el('qc-create').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    if (data.mean) data.mean = Number(data.mean);
    if (data.sd) data.sd = Number(data.sd);
    const r = await fetch('/api/qc/controls', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)
    });
    const j = await r.json();
    if (j.ok) { e.target.reset(); await loadControls(); alert('Control created'); }
    else alert(j.error || 'Create error');
  });

  el('qc-add').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    data.value = Number(data.value);
    const r = await fetch('/api/qc/record', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)
    });
    const j = await r.json();
    if (j.ok) {
      el('qc-feedback').textContent = `Saved. ${j.result.pass === null ? '' : (j.result.pass ? 'PASS (±2SD)' : 'FAIL (±2SD)')}`;
      await loadRecent();
      await loadControls();
      renderChart(data.control_id);
      e.target.reset();
    } else {
      el('qc-feedback').textContent = j.error || 'Save error';
    }
  });

  el('qc-select').addEventListener('change', (e)=> renderChart(e.target.value));

  el('kit-status').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const r = await fetch('/api/qc/kitlot/status', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)
    });
    const j = await r.json();
    el('kit-feedback').textContent = j.ok ? 'Kit lot updated' : (j.error || 'Update failed');
    if (j.ok) e.target.reset();
  });
});
