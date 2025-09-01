let lastAnalysis = null;

async function loadLatest() {
  const res = await fetch('/api/calibration/latest');
  const j = await res.json();
  const tbody = document.getElementById('latest-body');
  tbody.innerHTML = '';
  (j.data || []).forEach(m => {
    const tr = document.createElement('tr');
    const when = m.created_at ? new Date(m.created_at).toLocaleString() : '';
    tr.innerHTML = `
      <td>${m.target || ''}</td>
      <td>${m.params?.slope?.toFixed?.(4) ?? ''}</td>
      <td>${m.params?.intercept?.toFixed?.(4) ?? ''}</td>
      <td>${(m.params?.r2 ?? '').toString().slice(0,8)}</td>
      <td>${Number.isFinite(m.lod) ? m.lod.toFixed(4) : ''}</td>
      <td>${Number.isFinite(m.loq) ? m.loq.toFixed(4) : ''}</td>
      <td>${when}</td>
    `;
    tbody.appendChild(tr);
  });
  if (!j.data || j.data.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="7">No saved models yet.</td>`;
    tbody.appendChild(tr);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadLatest().catch(console.error);

  const form = document.getElementById('calib-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const res = await fetch('/api/calibration/analyze', { method: 'POST', body: fd });
    const j = await res.json();
    if (!j.ok) { alert(j.error || 'Analyze error'); return; }

    lastAnalysis = j.analysis;
    document.getElementById('res-slope').textContent     = (j.analysis.slope ?? '').toFixed?.(6) ?? j.analysis.slope;
    document.getElementById('res-intercept').textContent = (j.analysis.intercept ?? '').toFixed?.(6) ?? j.analysis.intercept;
    document.getElementById('res-r2').textContent        = (j.analysis.r2 ?? '').toString().slice(0,8);
    document.getElementById('res-sigma').textContent     = Number.isFinite(j.analysis.sigma_blank) ? j.analysis.sigma_blank.toFixed(6) : '';
    document.getElementById('res-lod').textContent       = Number.isFinite(j.analysis.lod) ? j.analysis.lod.toFixed(6) : '';
    document.getElementById('res-loq').textContent       = Number.isFinite(j.analysis.loq) ? j.analysis.loq.toFixed(6) : '';
    document.getElementById('res-levels').textContent    = j.analysis.n_levels ?? '';
    document.getElementById('res-range').textContent     = `${j.analysis.conc_min} to ${j.analysis.conc_max}`;
    document.getElementById('res-warn').textContent      = (j.analysis.warnings || []).join('; ');
    document.getElementById('results').style.display = '';
  });

  document.getElementById('btn-save').addEventListener('click', async () => {
    if (!lastAnalysis) { alert('Analyze first'); return; }
    const target = document.querySelector('input[name="target"]').value || 'miR-21';
    const notes = document.getElementById('save-notes').value || '';
    const res = await fetch('/api/calibration/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, notes, analysis: lastAnalysis })
    });
    const j = await res.json();
    if (j.ok) {
      await loadLatest();
      alert('Calibration saved');
    } else {
      alert(j.error || 'Save error');
    }
  });
});
