// api/places.js
const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { lat, lon, speed } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat/lon required' });
  const latN = parseFloat(lat), lonN = parseFloat(lon);
  const spd = parseFloat(speed) || 0;
  const R = spd < 5 ? 150 : spd < 20 ? 250 : spd < 50 ? 450 : spd < 80 ? 750 : 1200;

  // Try KV cache
  let cached = null;
  try {
    const { kv } = require('@vercel/kv');
    const cell = `${(latN*500|0)}_${(lonN*500|0)}`;
    cached = await kv.get('osm:' + cell);
    if (cached) return res.json({ source: 'cache', places: cached });
  } catch(e) {}

  const q = `[out:json][timeout:14];(node[amenity~"restaurant|cafe|bar|bank|pharmacy|hospital|cinema|hotel|fast_food|fuel|supermarket|pub|police|fire_station|library|nightclub|atm"](around:${R},${latN},${lonN});node["man_made"="surveillance"](around:${R},${latN},${lonN});node["highway"="speed_camera"](around:${R},${latN},${lonN});node["highway"="traffic_signals"](around:${R},${latN},${lonN});node[tourism~"attraction|museum|viewpoint"](around:${R},${latN},${lonN});node[leisure~"park|fitness_centre"](around:${R},${latN},${lonN});)->.r;.r out body;`;
  try {
    const resp = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(q)
    });
    const data = await resp.json();
    const elements = (data.elements || []).slice(0, 20);
    try {
      const { kv } = require('@vercel/kv');
      const cell = `${(latN*500|0)}_${(lonN*500|0)}`;
      await kv.set('osm:' + cell, elements, { ex: 300 });
    } catch(e) {}
    return res.json({ source: 'live', places: elements });
  } catch(e) {
    return res.status(502).json({ error: e.message });
  }
};
module.exports = handler;
