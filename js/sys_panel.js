// AURA System Panel — battery, GPS, FPS, network, object count

// SYSTEM STATUS PANEL
// ═══════════════════════════════════════════════════════════════
let detFpsCounter = 0, detFpsLast = Date.now(), detFpsDisplay = 0;
let objectCount = 0;

function tickDetFps() {
  detFpsCounter++;
  const now = Date.now();
  if (now - detFpsLast >= 1000) {
    detFpsDisplay = detFpsCounter;
    detFpsCounter = 0;
    detFpsLast = now;
  }
}

async function updateSysPanel() {
  // Battery
  if (navigator.getBattery) {
    try {
      const bat = await navigator.getBattery();
      const pct = Math.round(bat.level * 100);
      const bv = document.getElementById('sys-batt');
      if (bv) {
        bv.textContent = pct + '%' + (bat.charging ? ' ⚡' : '');
        bv.className = 'sys-val' + (pct < 20 ? ' crit' : pct < 40 ? ' warn' : '');
      }
    } catch(e) {}
  }
  // GPS accuracy
  const gv = document.getElementById('sys-gps');
  if (gv && gpsAcc != null) {
    gv.textContent = gpsAcc + 'm';
    gv.className = 'sys-val' + (gpsAcc > 30 ? ' warn' : gpsAcc > 60 ? ' crit' : '');
  }
  // Detection FPS
  const fv = document.getElementById('sys-fps');
  if (fv) {
    fv.textContent = detFpsDisplay;
    fv.className = 'sys-val' + (detFpsDisplay < 3 ? ' warn' : '');
  }
  // Object count
  const ov = document.getElementById('sys-obj');
  if (ov) ov.textContent = objectCount;
  // Network
  const nv = document.getElementById('sys-net');
  if (nv && navigator.connection) {
    const c = navigator.connection;
    nv.textContent = (c.effectiveType || '?').toUpperCase() + (c.downlink ? ' ' + c.downlink + 'M' : '');
  }
  // Anchor count
  const av = document.getElementById('sys-anc');
  if (av) av.textContent = places.length + userAnchors.length;
}

// ═══════════════════════════════════════════════════════════════
