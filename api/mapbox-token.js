// api/mapbox-token.js
const handler = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json({ token: process.env.MAPBOX_TOKEN || '' });
};

module.exports = handler;
