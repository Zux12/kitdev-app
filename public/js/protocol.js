let ACTIVE_PROTOCOL = null;
let SESSION_ID = null;
let STEP_TIMERS = {}; // step_index -> intervalId
let STEP_STATE = {};  // step_index -> {remaining, running}

function fmt(t) {
  return t ? new Date(t).toLocaleString() : '';
}

async function loadActive() {
  const res = await fetch('/api/protocol/active');
  const j = await res.json();
  if (!j.ok) { document.getElementById('proto-meta').textContent = 'No active protocol'; return; }
  ACTIVE_PROTOCOL = j.protocol;
  document.getElementById('proto-meta').textContent =
    `${ACTIVE_PROTOCOL.name} (v${ACTIVE_PROTOCOL.version})`;
  const ul = document.getElementById('steps-list');
  ul.innerHTML = '';
  (ACTIVE_PROTOCOL.steps || []).forEach((s, i) => {
    const li = document.createElement('li');
    li.id = `step-${i}`;
    li.innerHTML = `<strong>${i+1}. ${s.label}</strong> — ${s.duration_s}s
      <em style="color:#666; margin-left:8px;">${s.tips || ''}</em>
      <div id="status-${i}" style="margin-top:2px; font-size:13px; color:#555;">Not started</div>`;
    ul.appendChild(li);
    STEP_STATE[i] = { remaining: s.duration_s, running: false };
  });
}

async function loadRecent() {
  const res = await fetch('/api/protocol/session/recent');
  const j = await res.json();
  const tbody = document.getElementById('recent-body');
  tbody.innerHTML = '';
  (j.data || []).forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.operator_email || ''}</td>
      <td>${r.protocol_name || ''}</td>
      <td>${r.version ?? ''}</td>
      <td>${fmt(r.started_at)}</td>
      <td>${fmt(r.finished_at)}</td>
      <td>${r.total_time_s ?? ''}</td>
    `;
    tbody.appendChild(tr);
  });
  if (!j.data || j.data.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6">No sessions yet.</td>`;
    tbody.appendChild(tr);
  }
}

function renderControls() {
  const area = document.getElementById('controls-area');
  area.innerHTML = '';
  (ACTIVE_PROTOCOL.steps || []).forEach((s, i) => {
    const wrap = document.createElement('div');
    wrap.style.marginBottom = '8px';
    wrap.innerHTML = `
      <div><strong>${i+1}. ${s.label}</strong> — timer: <span id="t-${i}">${s.duration_s}</span>s</div>
      <button data-i="${i}" class="btn-start">Start step</button>
      <button data-i="${i}" class="btn-complete">Complete step</button>
      <button data-i="${i}" class="btn-deviation">+ Deviation</button>
    `;
    area.appendChild(wrap);
  });

  area.querySelectorAll('.btn-start').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const i = Number(e.target.getAttribute('data-i'));
      await fetch('/api/protocol/session/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: SESSION_ID, step_index: i, event: 'start' })
      });
      startTimer(i);
      document.getElementById(`status-${i}`).textContent = 'Running...';
    });
  });

  area.querySelectorAll('.btn-complete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const i = Number(e.target.getAttribute('data-i'));
      await fetch('/api/protocol/session/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: SESSION_ID, step_index: i, event: 'complete' })
      });
      stopTimer(i);
      document.getElementById(`status-${i}`).textContent = 'Completed';
    });
  });

  area.querySelectorAll('.btn-deviation').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const i = Number(e.target.getAttribute('data-i'));
      const txt = prompt('Describe deviation:');
      if (!txt) return;
      await fetch('/api/protocol/session/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: SESSION_ID, step_index: i, event: 'deviation', deviation_text: txt })
      });
      const s = document.getElementById(`status-${i}`);
      s.textContent = (s.textContent + ' | deviation logged').trim();
    });
  });
}

function startTimer(i) {
  stopTimer(i);
  STEP_STATE[i].running = true;
  STEP_TIMERS[i] = setInterval(() => {
    if (STEP_STATE[i].remaining > 0) {
      STEP_STATE[i].remaining -= 1;
      document.getElementById(`t-${i}`).textContent = STEP_STATE[i].remaining;
    } else {
      stopTimer(i);
    }
  }, 1000);
}

function stopTimer(i) {
  if (STEP_TIMERS[i]) {
    clearInterval(STEP_TIMERS[i]);
    STEP_TIMERS[i] = null;
  }
  STEP_STATE[i].running = false;
}

document.addEventListener('DOMContentLoaded', () => {
  loadActive().catch(console.error);
  loadRecent().catch(console.error);

  document.getElementById('btn-start').addEventListener('click', async () => {
    const email = document.getElementById('op-email').value.trim();
    if (!email) { alert('Enter operator email'); return; }
    const res = await fetch('/api/protocol/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operator_email: email })
    });
    const j = await res.json();
    if (!j.ok) { alert(j.error || 'Start failed'); return; }
    SESSION_ID = j.session_id;
    document.getElementById('session-id').textContent = SESSION_ID;
    document.getElementById('session-info').style.display = '';
    document.getElementById('controls').style.display = '';
    renderControls();
  });

  document.getElementById('btn-finish').addEventListener('click', async () => {
    if (!SESSION_ID) return;
    const res = await fetch('/api/protocol/session/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: SESSION_ID })
    });
    const j = await res.json();
    if (j.ok) {
      alert('Session finished. Total seconds: ' + j.total_time_s);
      SESSION_ID = null;
      document.getElementById('controls').style.display = 'none';
      loadRecent().catch(console.error);
    }
  });
});
