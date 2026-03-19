// AURA Traffic Module — speed data, road info, delta display

// ── TRAFFIC API + SPEED DELTA ────────────────────────────────────────────────
let trafficData = null;
let trafficPollTimer = null;
let lastTrafficLat = null, lastTrafficLon = null;

async function startTrafficPolling() {
  pollTraffic();
  trafficPollTimer = setInterval(() => {
    // Only re-poll if moved >50m since last poll (saves API calls)
    if (lastTrafficLat === null ||
        hav(lastTrafficLat, lastTrafficLon, uLat, uLon) > 50) {
      pollTraffic();
    }
  }, 15000);
}

async function pollTraffic() {
  try {
    const r = await fetch('/api/traffic?lat='+uLat+'&lon='+uLon);
    const data = await r.json();
    trafficData = data;
    lastTrafficLat = uLat; lastTrafficLon = uLon;
    updateTrafficUI(data);
  } catch(e) { /* silent */ }
}

function updateTrafficUI(data) {
  const strip = document.getElementById('traffic-strip');
  if (!strip) return;
  strip.style.display = 'block';

  const spd = document.getElementById('ts-speed');
  const road = document.getElementById('ts-road');
  const limit = document.getElementById('ts-limit');
  const delta = document.getElementById('ts-delta');

  if (data.currentSpeedMph != null) {
    spd.textContent = data.currentSpeedMph;
    const ratio = data.freeFlowSpeedMph
      ? data.currentSpeedMph / data.freeFlowSpeedMph : 1;
    const tColor = ratio > 0.8 ? '#00FFD1' : ratio > 0.5 ? '#FF9030' : '#FF4040';
    spd.style.color = tColor;
    spd.style.textShadow = '0 0 14px '+tColor+'80';

    // Speed delta — you vs traffic flow
    if (delta) {
      const diff = Math.round(speedMph - data.currentSpeedMph);
      if (Math.abs(diff) >= 3) {
        const sign = diff > 0 ? '+' : '';
        delta.textContent = 'YOU '+sign+diff+' vs FLOW';
        delta.style.color = diff > 10 ? '#FF4040'
          : diff > 0 ? '#FF9030'
          : '#00FFD1';
      } else {
        delta.textContent = 'WITH FLOW';
        delta.style.color = '#00FFD1';
      }
      delta.style.display = 'block';
    }
  }

  if (data.roadName) road.textContent = data.roadName.toUpperCase();

  if (data.speedLimitMph) {
    const overLimit = speedMph > data.speedLimitMph + 5;
    limit.textContent = 'LIMIT '+data.speedLimitMph+'mph'+(data.congestion?' · JAM':'');
    limit.style.color = overLimit ? '#FF4040' : data.congestion ? '#FF4040' : 'rgba(255,144,48,.5)';
  } else {
    limit.textContent = data.source === 'demo' ? 'ADD TOMTOM KEY' : '';
  }
}
