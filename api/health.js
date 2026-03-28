const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
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

  // Gemini API key configured
  checks.gemini = {
    status: process.env.GEMINI_API_KEY ? 'ok' : 'missing',
    configured: !!process.env.GEMINI_API_KEY,
  };

  // Vercel KV
  checks.kv = {
    status: 'ok',
    configured: !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL),
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
