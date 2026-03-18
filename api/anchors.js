// api/anchors.js
const haversine = (a,b,c,d) => {
  const R=6371000,r=Math.PI/180,dL=(c-a)*r,dO=(d-b)*r;
  const x=Math.sin(dL/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(dO/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
};
const getCell = (lat,lon) => `${(lat*500|0)}_${(lon*500|0)}`;
const getCells = (lat,lon) => {
  const cells=[];
  for(let a=-1;a<=1;a++) for(let b=-1;b<=1;b++) cells.push(`${((lat*500|0)+a)}_${((lon*500|0)+b)}`);
  return cells;
};

const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  let kv;
  try { kv = require('@vercel/kv').kv; } catch(e) { return res.json({ anchors: [], error: 'KV not configured' }); }
  if (req.method === 'GET') {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat/lon required' });
    const latN=parseFloat(lat), lonN=parseFloat(lon);
    const anchors = [];
    for (const cell of getCells(latN, lonN)) {
      const ids = await kv.smembers('acell:'+cell) || [];
      for (const id of ids) {
        const a = await kv.get('anchor:'+id);
        if (a && haversine(latN,lonN,a.lat,a.lon) <= 500) anchors.push(a);
      }
    }
    return res.json({ anchors: anchors.slice(0,20) });
  }
  if (req.method === 'POST') {
    const { lat, lon, label, icon, userId } = req.body;
    if (!lat || !lon || !label) return res.status(400).json({ error: 'lat, lon, label required' });
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
    const anchor = { id, lat: parseFloat(lat), lon: parseFloat(lon), label: label.slice(0,60), icon: icon||'📍', userId: userId||'anon', created: Date.now() };
    await kv.set('anchor:'+id, anchor, { ex: 86400*30 });
    await kv.sadd('acell:'+getCell(anchor.lat,anchor.lon), id);
    return res.json({ ok: true, anchor });
  }
  if (req.method === 'DELETE') {
    const { id, userId } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });
    const a = await kv.get('anchor:'+id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    if (a.userId !== userId) return res.status(403).json({ error: 'Forbidden' });
    await kv.del('anchor:'+id);
    return res.json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
};
module.exports = handler;
