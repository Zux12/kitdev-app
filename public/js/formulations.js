function fmtDate(d) { try { return d ? new Date(d).toLocaleDateString() : ''; } catch { return ''; } }
function fmtDT(d)   { try { return d ? new Date(d).toLocaleString() : ''; } catch { return ''; } }

async function loadFormulationLots() {
  const res = await fetch('/api/formulations/lots');
  const j = await res.json();
  const tb = document.getElementById('formulation-body');
  tb.innerHTML = '';
  (j.data || []).forEach(x => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${x.lot_id || ''}</td>
      <td>${x.qd_core_shell || ''}</td>
      <td>${x.plga_ratio || ''}</td>
      <td>${x.dls_nm ?? ''}</td>
      <td>${x.zeta_mV ?? ''}</td>
      <td>${x.yield_pct ?? ''}</td>
      <td>${x.storage || ''}</td>
      <td>${fmtDate(x.expiry)}</td>
      <td>${fmtDT(x.created_at)}</td>
    `;
    tb.appendChild(tr);
  });
  if (!j.data || j.data.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="9">No formulation lots yet.</td>`;
    tb.appendChild(tr);
  }
}

async function loadKitLots() {
  const res = await fetch('/api/formulations/kit-lots');
  const j = await res.json();
  const tb = document.getElementById('kitlot-body');
  tb.innerHTML = '';
  (j.data || []).forEach(x => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${x.kit_lot_id || ''}</td>
      <td>${x.qc_status || ''}</td>
      <td>${(x.components || []).join(', ')}</td>
      <td>${fmtDate(x.expiry)}</td>
      <td>${fmtDT(x.created_at)}</td>
    `;
    tb.appendChild(tr);
  });
  if (!j.data || j.data.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5">No kit lots yet.</td>`;
    tb.appendChild(tr);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadFormulationLots().catch(console.error);
  loadKitLots().catch(console.error);

  // Formulation lot submit
  document.getElementById('form-formulation').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    if (data.dls_nm) data.dls_nm = Number(data.dls_nm);
    if (data.zeta_mV) data.zeta_mV = Number(data.zeta_mV);
    if (data.yield_pct) data.yield_pct = Number(data.yield_pct);

    const res = await fetch('/api/formulations/lots', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const j = await res.json();
    if (j.ok) {
      e.target.reset();
      await loadFormulationLots();
      alert('Formulation lot saved');
    } else {
      alert(j.error || 'Save error');
    }
  });

  // Kit lot submit
  document.getElementById('form-kitlot').addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.target).entries());
    const data = {
      kit_lot_id: raw.kit_lot_id,
      components: (raw.components || '').split(',').map(s => s.trim()).filter(Boolean),
      qc_status: raw.qc_status,
      expiry: raw.expiry || null,
      notes: raw.notes || ''
    };

    const res = await fetch('/api/formulations/kit-lots', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const j = await res.json();
    if (j.ok) {
      e.target.reset();
      await loadKitLots();
      alert('Kit lot saved');
    } else {
      alert(j.error || 'Save error');
    }
  });
});
