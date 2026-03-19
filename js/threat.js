// AURA Threat Assessment — scoring detected objects

// THREAT ASSESSMENT — scores each detected object
// ═══════════════════════════════════════════════════════════════
function assessThreat(cls, score, velocity, iff) {
  if (iff === 'FOE') return {level:'HIGH', reason:'Marked FOE'};
  if (iff === 'FRIEND') return {level:'LOW', reason:'Marked FRIEND'};

  let points = 0;
  const speed_px = velocity ? Math.sqrt(velocity.vx**2 + velocity.vy**2) : 0;

  // Class-based base threat
  if (cls === 'person') points += 1;
  if (cls === 'car' || cls === 'truck' || cls === 'bus') points += 1;
  if (cls === 'motorcycle') points += 2;
  if (cls === 'knife' || cls === 'scissors') points += 3;
  if (cls === 'sports_ball' && speed_px > 3) points += 1;

  // Movement-based threat
  if (speed_px > 5) points += 1;    // fast moving
  if (speed_px > 10) points += 1;   // very fast
  if (velocity && velocity.vx < -2 && velocity.vy < -2) points += 1; // approaching

  // Confidence modifier
  if (score > 0.85) points = Math.round(points * 1.2);

  const level = points >= 5 ? 'HIGH' : points >= 2 ? 'MED' : 'LOW';
  const reason = speed_px > 8 ? 'Fast movement' : cls === 'person' ? 'Person detected' : cls;
  return {level, reason, score: points};
}

// ═══════════════════════════════════════════════════════════════
