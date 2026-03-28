// api/health.js — v2
const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const t0 = Date.now();
  const checks = {};

  // PulsePoint incidents feed
  try {
    const r = await fetch(
      'https://web.pulsepoint.org/DB/giba.php?lt=42.3314&lg=-83.0458&_=' + Date.now(),
      {
        signal: AbortSignal.timeout(5000),
        headers: {
          'User-Agent': 'AURA-AR/4.0',
          'Accept': 'application/json',
          'Referer': 'https://web.pulsepoint.org/'
        }
      }
    );
    checks.incidents = { status: r.ok ? 'ok' : 'degraded', httpStatus: r.status };
  } catch (e) {
    checks.incidents = { status: 'timeout', message: 'PulsePoint unreachable' };
  }

  // Gemini API key
  checks.gemini = {
    status: process.env.GEMINI_API_KEY ? 'ok' : 'missing',
    configured: !!process.env.GEMINI_API_KEY,
  };

  // Runtime
  checks.runtime = {
    status: 'ok',
    region: process.env.VERCEL_REGION || process.env.AWS_REGION || 'unknown',
    node: process.version,
  };

  const allOk = Object.values(checks).every(c => c.status === 'ok');
  res.json({
    status: allOk ? 'ok' : 'degraded',
    latencyMs: Date.now() - t0,
    timestamp: Date.now(),
    checks,
  });
};

module.exports = handler;
