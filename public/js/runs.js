async function loadRuns() {
  const res = await fetch('/api/runs');
  const j = await res.json();
  const tbody = document.querySelector('#runs-body');
  tbody.innerHTML = '';
  (j.data || []).forEach(r => {
    const tr = document.createElement('tr');
    const created = r.created_at ? new Date(r.created_at).toLocaleString() : '';
    tr.innerHTML = `
      <td>${r.sample_id || ''}</td>
      <td>${r.operator_email || ''}</td>
      <td>${(r.intensities || []).join(', ')}</td>
      <td>${created}</td>
      <td>${r.notes || ''}</td>
    `;
    tbody.appendChild(tr);
  });
  if (!j.data || j.data.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5">No runs yet.</td>`;
    tbody.appendChild(tr);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadRuns().catch(console.error);
  const form = document.getElementById('run-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const res = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const j = await res.json();
    if (j.ok) {
      form.reset();
      await loadRuns();
      alert('Run saved');
    } else {
      alert(j.error || 'Error saving run');
    }
  });
});
