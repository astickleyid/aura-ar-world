// AURA Vision Modes — night vision, thermal, EM, normal

// VISION FILTER MODES — night vision, thermal, EM
// ═══════════════════════════════════════════════════════════════
const VISION_MODES = ['normal','nv','thermal','em'];
const VISION_LABELS = {normal:'👁 NORMAL', nv:'🟢 NIGHT VIS', thermal:'🔴 THERMAL', em:'⚪ ENHANCE'};
let visionModeIdx = 0;

function cycleVisionMode() {
  visionModeIdx = (visionModeIdx + 1) % VISION_MODES.length;
  const mode = VISION_MODES[visionModeIdx];
  const cam = document.getElementById('cam');
  const fb = document.getElementById('fallback');
  cam.className = mode;
  fb.className = mode; // also apply to fallback
  document.getElementById('vision-mode-btn').textContent = VISION_LABELS[mode];
  // Adjust detection canvas opacity in thermal/nv modes
  const dc = document.getElementById('det-canvas');
  if (dc) dc.style.mixBlendMode = mode === 'thermal' ? 'screen' : 'normal';
  showToast('Vision: ' + VISION_LABELS[mode]);
  playTone(660, 0.05, 0.1);
}

// ═══════════════════════════════════════════════════════════════
