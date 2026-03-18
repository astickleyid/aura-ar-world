// api/anchors.js
// GET /api/anchors?lat=&lon=&r=  — fetch nearby user anchors
// POST /api/anchors               — create a new anchor
// DELETE /api/anchors?id=         — delete an anchor (owner only)

import { kv } from '@vercel/kv';

const ANCHOR_RADIUS_M = 500;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') return getAnchors(req, res);
  if (req.method === 'POST') return createAnchor(req, res);
  if (req.method === 'DELETE') return deleteAnchor(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function getAnchors(req, res) {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat/lon required' });

  try {
    // Fetch all anchor IDs in nearby grid cells
    const latN = parseFloat(lat), lonN = parseFloat(lon);
    const cells = getNearbyGridCells(latN, lonN);
    const anchors = [];

    for (const cell of cells) {
      const ids = await kv.smembers('acell:' + cell) || [];
      for (const id of ids) {
        const a = await kv.get('anchor:' + id);
        if (a) {
          const dist = haversine(latN, lonN, a.lat, a.lon);
          if (dist <= ANCHOR_RADIUS_M) anchors.push({ ...a, dist });
        }
      }
    }

    return res.json({ anchors: anchors.sort((a,b) => a.dist - b.dist).slice(0, 20) });
  } catch(e) {
    return res.json({ anchors: [], error: e.message });
  }
}

async function createAnchor(req, res) {
  try {
    const { lat, lon, label, icon, color, userId } = req.body;
    if (!lat || !lon || !label) return res.status(400).json({ error: 'lat, lon, label required' });

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const anchor = {
      id, lat: parseFloat(lat), lon: parseFloat(lon),
      label: label.slice(0, 60),
      icon: icon || '📍',
      color: color || '#00FFD1',
      userId: userId || 'anon',
      created: Date.now()
    };

    await kv.set('anchor:' + id, anchor, { ex: 60 * 60 * 24 * 30 }); // 30 day TTL

    // Add to grid cell index
    const cell = getGridCell(anchor.lat, anchor.lon);
    await kv.sadd('acell:' + cell, id);

    return res.json({ ok: true, anchor });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}

async function deleteAnchor(req, res) {
  const { id, userId } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });
  try {
    const a = await kv.get('anchor:' + id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    if (a.userId !== userId && userId !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    await kv.del('anchor:' + id);
    return res.json({ ok: true });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}

function getGridCell(lat, lon) {
  return `${(lat*500|0)}_${(lon*500|0)}`;
}

function getNearbyGridCells(lat, lon) {
  // Return the cell and 8 neighbors to catch anchors near cell boundaries
  const cells = [];
  for (let dlat = -1; dlat <= 1; dlat++) {
    for (let dlon = -1; dlon <= 1; dlon++) {
      cells.push(`${((lat*500|0)+dlat)}_${((lon*500|0)+dlon)}`);
    }
  }
  return cells;
}

function haversine(a, b, c, d) {
  const R=6371000, r=Math.PI/180;
  const dL=(c-a)*r, dO=(d-b)*r;
  const x = Math.sin(dL/2)**2 + Math.cos(a*r)*Math.cos(c*r)*Math.sin(dO/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}
