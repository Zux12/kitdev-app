function fmtDT(d){ try { return new Date(d).toLocaleString(); } catch { return ''; } }
function num(x, digits=4){ return (typeof x === 'number' && isFinite(x)) ? x.toFixed(digits) : '–'; }

async function loadDashboard(){
  const res = await fetch('/api/dashboard');
  const j = await res.json();
  if (!j.ok) { alert('Dashboard error'); return; }

  // Tiles
  document.getElementById('tile-runs').textContent = j.runs_today ?? 0;
  const cal = j.latest_calibration || {};
  document.getElementById('cal-slope').textContent = num(cal.params?.slope);
  document.getElementById('cal-lod').textContent   = num(cal.lod);
  document.getElementById('cal-r2').textContent    = (cal.params?.r2 ?? '–').toString().slice(0,8);

  const expCount = (j.expiring?.kit_lots?.length || 0) + (j.expiring?.formulation_lots?.length || 0);
  document.getElementById('tile-exp').textContent = expCount;
  document.getElementById('tile-qc').textContent  = j.qc_fails?.length || 0;

  // Expiring table
  const tbExp = document.getElementById('exp-body');
  tbExp.innerHTML = '';
  (j.expiring?.kit_lots || []).forEach(x => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>Kit</td><td>${x.kit_lot_id}</td><td>${x.qc_status || ''}</td><td>${fmtDT(x.expiry)}</td>`;
    tbExp.appendChild(tr);
  });
  (j.expiring?.formulation_lots || []).forEach(x => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>Formulation</td><td>${x.lot_id}</td><td>${x.storage || ''}</td><td>${fmtDT(x.expiry)}</td>`;
    tbExp.appendChild(tr);
  });
  if (!tbExp.children.length) {
    const tr = document.createElement('tr'); tr.innerHTML = `<td colspan="4">None</td>`; tbExp.appendChild(tr);
  }

  // QC fails
  const tbQC = document.getElementById('qc-body');
  tbQC.innerHTML = '';
  (j.qc_fails || []).forEach(x => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${x.control_id}</td><td>${fmtDT(x.at)}</td><td>${x.value}</td><td>${x.z == null ? '' : x.z.toFixed(2)}</td><td>${x.unit || ''}</td>`;
    tbQC.appendChild(tr);
  });
  if (!tbQC.children.length) {
    const tr = document.createElement('tr'); tr.innerHTML = `<td colspan="5">No fails in last 7 days 🎉</td>`; tbQC.appendChild(tr);
  }
}

document.addEventListener('DOMContentLoaded', () => { loadDashboard().catch(console.error); });
