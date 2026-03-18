// api/traffic.js
const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });
  const key = process.env.TOMTOM_KEY;
  if (!key) return res.status(200).json({ source: 'demo', ...getDemoTraffic() });
  try {
    const zoom = 16;
    const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/${zoom}/json?point=${lat},${lon}&unit=mph&key=${key}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('TomTom ' + r.status);
    const data = await r.json();
    const seg = data.flowSegmentData;
    return res.json({
      source: 'tomtom',
      roadName: seg.roadDescription || null,
      currentSpeedMph: Math.round(seg.currentSpeed),
      freeFlowSpeedMph: Math.round(seg.freeFlowSpeed),
      speedLimitMph: seg.speedLimit ? Math.round(seg.speedLimit) : null,
      confidence: seg.confidence,
      congestion: seg.currentTravelTime > seg.freeFlowTravelTime * 1.3,
      frc: seg.frc
    });
  } catch(e) {
    return res.json({ source: 'demo', error: e.message, ...getDemoTraffic() });
  }
};

function getDemoTraffic() {
  const speeds = [25, 28, 30, 35, 38, 42, 45];
  const current = speeds[Math.floor(Math.random() * speeds.length)];
  return { roadName: 'Demo Road', currentSpeedMph: current, freeFlowSpeedMph: 35, speedLimitMph: 35, confidence: 0.85, congestion: current < 25, frc: 'FRC2' };
}

module.exports = handler;
