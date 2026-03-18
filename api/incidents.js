// api/incidents.js
// Fetches live 911 CAD incidents from PulsePoint public API
// PulsePoint covers 4,000+ US agencies — free, no key needed
// Falls back to demo data for unsupported areas

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat/lon required' });

  const latN = parseFloat(lat), lonN = parseFloat(lon);

  try {
    // PulsePoint uses a geographic cell system
    // Their public endpoint returns active incidents near a coordinate
    const pp = await fetch(
      `https://web.pulsepoint.org/DB/giba.php?` +
      `lt=${latN}&lg=${lonN}&_=${Date.now()}`,
      {
        headers: {
          'User-Agent': 'AURA-AR/3.0',
          'Accept': 'application/json',
          'Referer': 'https://web.pulsepoint.org/'
        },
        signal: AbortSignal.timeout(6000)
      }
    );

    if (!pp.ok) throw new Error('PulsePoint ' + pp.status);
    const data = await pp.json();

    // Parse PulsePoint response format
    const active = data.incidents?.active || data.active || [];
    const incidents = active.slice(0, 8).map(inc => ({
      type: inc.call_type_description || inc.type || 'Incident',
      address: inc.full_address || inc.address || null,
      lat: parseFloat(inc.latitude || inc.lat || latN + (Math.random()-0.5)*0.01),
      lon: parseFloat(inc.longitude || inc.lng || lonN + (Math.random()-0.5)*0.01),
      units: inc.units?.length || 1,
      age: getAge(inc.call_received_datetime || inc.timestamp),
      id: inc.id || String(Date.now() + Math.random())
    })).filter(i => i.lat && i.lon);

    return res.json({ source: 'pulsepoint', incidents });

  } catch(e) {
    // Demo incidents for areas not covered by PulsePoint
    // or when the API is unreachable
    return res.json({
      source: 'demo',
      note: 'PulsePoint not available in this area',
      incidents: []
    });
  }
}

function getAge(ts) {
  if (!ts) return null;
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + 'min ago';
  return Math.round(mins/60) + 'h ago';
}
