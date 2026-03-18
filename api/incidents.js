// api/incidents.js
const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat/lon required' });
  const latN = parseFloat(lat), lonN = parseFloat(lon);
  try {
    const r = await fetch(
      `https://web.pulsepoint.org/DB/giba.php?lt=${latN}&lg=${lonN}&_=${Date.now()}`,
      { headers: { 'User-Agent': 'AURA-AR/4.0', 'Accept': 'application/json', 'Referer': 'https://web.pulsepoint.org/' }, signal: AbortSignal.timeout(6000) }
    );
    if (!r.ok) throw new Error('PulsePoint ' + r.status);
    const data = await r.json();
    const active = data.incidents?.active || data.active || [];
    const incidents = active.slice(0, 8).map(inc => ({
      type: inc.call_type_description || inc.type || 'Incident',
      address: inc.full_address || inc.address || null,
      lat: parseFloat(inc.latitude || inc.lat || latN),
      lon: parseFloat(inc.longitude || inc.lng || lonN),
      units: inc.units?.length || 1,
      age: getAge(inc.call_received_datetime || inc.timestamp),
      id: inc.id || String(Date.now())
    }));
    return res.json({ source: 'pulsepoint', incidents });
  } catch(e) {
    return res.json({ source: 'unavailable', incidents: [] });
  }
};

function getAge(ts) {
  if (!ts) return null;
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return 'Now'; if (mins < 60) return mins+'m'; return Math.round(mins/60)+'h';
}
module.exports = handler;
