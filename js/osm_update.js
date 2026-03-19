// AURA Smart OSM Re-query — radius scaling, movement-based refresh

// ── SMART OSM RE-QUERY ───────────────────────────────────────────────────────
// Radius scales with speed, re-queries when you've moved enough
let lastOsmLat = null, lastOsmLon = null;

function osmRadius() {
  if (speedMph < 5) return 150;       // walking
  if (speedMph < 20) return 250;      // cycling / slow drive
  if (speedMph < 50) return 450;      // city driving
  if (speedMph < 80) return 750;      // highway
  return 1200;                         // fast highway
}

function shouldRequery() {
  if (lastOsmLat === null) return true;
  const moved = hav(lastOsmLat, lastOsmLon, uLat, uLon);
  const threshold = osmRadius() * 0.4; // re-query when moved 40% of radius
  return moved > threshold;
}

async function smartOsmUpdate() {
  if (!shouldRequery()) return;
  try {
    const newPlaces = await fetchPlaces(uLat, uLon);
    if (newPlaces.length) {
      places = newPlaces;
      lastOsmLat = uLat; lastOsmLon = uLon;
      buildAnchors();
      document.getElementById('v-anc').textContent = '↻';
      setTimeout(() => document.getElementById('v-anc').textContent = places.length, 1200);
    }
  } catch(e) { /* keep existing anchors */ }
}
