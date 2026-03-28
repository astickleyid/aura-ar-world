export default function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json({ token: process.env.MAPBOX_TOKEN || '' });
}
