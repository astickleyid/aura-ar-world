// AURA Crowd Density — people counting from detection

// CROWD DENSITY
// ═══════════════════════════════════════════════════════════════
function updateCrowdDensity(trackedObjects) {
  const people = trackedObjects.filter(o => o.cls === 'person').length;
  objectCount = trackedObjects.length;
  const badge = document.getElementById('crowd-badge');
  const count = document.getElementById('crowd-count');
  const label = document.getElementById('crowd-label');
  if (!badge) return;
  if (people === 0) { badge.style.display = 'none'; return; }
  badge.style.display = 'block';
  count.textContent = people;
  const density = people < 3 ? 'LOW DENSITY' : people < 8 ? 'MODERATE' : 'HIGH DENSITY';
  const col = people < 3 ? 'var(--c)' : people < 8 ? 'var(--o)' : 'var(--r)';
  count.style.color = col;
  count.style.textShadow = '0 0 10px ' + col + '80';
  label.textContent = density + ' · ' + people + ' IN FRAME';
}

// ═══════════════════════════════════════════════════════════════
