function el(id){ return document.getElementById(id); }
function fmtDT(d){ try { return new Date(d).toLocaleString(); } catch { return ''; } }

async function loadRecent(){
  const res = await fetch('/api/ecrf/recent');
  const j = await res.json();
  const tb = el('ecrf-body');
  tb.innerHTML = '';
  (j.data || []).forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.subject_id||''}</td>
      <td>${r.sample_id||''}</td>
      <td>${r.age ?? ''}</td>
      <td>${r.sex||''}</td>
      <td>${r.site||''}</td>
      <td>${r.operator_email||''}</td>
      <td>${r.kit_result||''}</td>
      <td>${r.comparator_result||''}</td>
      <td>${fmtDT(r.created_at)}</td>
    `;
    tb.appendChild(tr);
  });
  if (!j.data || j.data.length === 0) {
    const tr = document.createElement('tr'); tr.innerHTML = `<td colspan="9">None yet.</td>`; tb.appendChild(tr);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadRecent().catch(console.error);

  el('ecrf-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    data.age = data.age === '' ? null : Number(data.age);
    data.consent = !!data.consent;
    const r = await fetch('/api/ecrf', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)
    });
    const j = await r.json();
    el('ecrf-feedback').textContent = j.ok ? 'Saved.' : (j.error || 'Save error');
    if (j.ok) { e.target.reset(); loadRecent().catch(console.error); }
  });

  el('btn-export').addEventListener('click', () => {
    window.location.href = '/api/ecrf/export';
  });
});
