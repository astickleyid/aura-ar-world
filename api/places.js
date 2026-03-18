// api/places.js
// Proxies Overpass/OSM queries server-side with Vercel KV caching
// Cache key: grid cell at ~200m resolution so nearby queries reuse results
// Falls back to direct Overpass if KV not configured

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat/lon required' });

  const latN = parseFloat(lat), lonN = parseFloat(lon);

  // Grid cell: round to ~200m resolution for cache key
  const cell = `${(latN*500|0)}_${(lonN*500|0)}`;
  const cacheKey = `osm:${cell}`;

  // Try KV cache first
  let cached = null;
  try {
    cached = await kv.get(cacheKey);
  } catch(e) { /* KV not configured, skip */ }

  if (cached) {
    return res.json({ source: 'cache', places: cached });
  }

  // Query Overpass
  const speed = parseFloat(req.query.speed) || 0;
  const R = speed < 5 ? 150 : speed < 20 ? 250 : speed < 50 ? 450 : speed < 80 ? 750 : 1200;

  const q = `[out:json][timeout:14];(
    node[amenity~"restaurant|cafe|bar|bank|pharmacy|hospital|cinema|hotel|fast_food|fuel|supermarket|pub|police|fire_station|library|nightclub|atm"](around:${R},${latN},${lonN});
    node[shop~"convenience|clothes|electronics|bakery|bookshop"](around:${R},${latN},${lonN});
    node[tourism~"attraction|museum|viewpoint|artwork|gallery"](around:${R},${latN},${lonN});
    node[leisure~"park|fitness_centre|playground"](around:${R},${latN},${lonN});
    node[historic~"monument|memorial|castle"](around:${R},${latN},${lonN});
    node["man_made"="surveillance"](around:${R},${latN},${lonN});
    node["highway"="speed_camera"](around:${R},${latN},${lonN});
    node["highway"="traffic_signals"](around:${R},${latN},${lonN});
    node["amenity"="parking"](around:${R},${latN},${lonN});
  )->.r;.r out body;`;

  try {
    const resp = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(q)
    });
    if (!resp.ok) throw new Error('Overpass ' + resp.status);
    const data = await resp.json();
    const elements = (data.elements || []).slice(0, 20);

    // Cache for 5 minutes
    try { await kv.set(cacheKey, elements, { ex: 300 }); } catch(e) {}

    return res.json({ source: 'live', places: elements });
  } catch(e) {
    return res.status(502).json({ error: e.message });
  }
}
