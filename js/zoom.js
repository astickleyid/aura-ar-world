// AURA Zoom — pinch, scroll, optical/digital zoom

// PREDICTIVE PATH — extend velocity vector 2s forward
// Already computed in tracker; drawTracked will use it.
// Exposed as a toggle.
// ═══════════════════════════════════════════════════════════════
let showPredictivePath = true;

// ═══════════════════════════════════════════════════════════════
// ZOOM — pinch gesture + programmatic zoom on back camera
// ═══════════════════════════════════════════════════════════════
let currentZoom = 1.0, maxZoom = 1.0, zoomTrack = null;

async function initZoom(stream) {
  try {
    const track = stream.getVideoTracks()[0];
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    if (caps.zoom) {
      maxZoom = caps.zoom.max || 4;
      zoomTrack = track;
      initPinchZoom();
    }
  } catch(e) {}
}

async function setZoom(z) {
  z = Math.max(1, Math.min(maxZoom || 4, z));
  currentZoom = z;
  const badge = document.getElementById('zoom-badge');
  const val = document.getElementById('zoom-val');
  if (badge) badge.style.display = z > 1.05 ? 'block' : 'none';
  if (val) val.textContent = z.toFixed(1) + 'x';
  if (zoomTrack) {
    try { await zoomTrack.applyConstraints({ advanced: [{ zoom: z }] }); } catch(e) {}
  } else {
    // Digital zoom fallback — scale the video element
    const cam = document.getElementById('cam');
    cam.style.transform = `scale(${z})`;
    cam.style.transformOrigin = 'center center';
  }
}

function initPinchZoom() {
  let lastDist = null;
  let startZoom = 1;
  document.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastDist = Math.sqrt(dx*dx+dy*dy);
      startZoom = currentZoom;
    }
  }, {passive:true});
  document.addEventListener('touchmove', e => {
    if (e.touches.length !== 2 || !lastDist) return;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.sqrt(dx*dx+dy*dy);
    const scale = dist / lastDist;
    setZoom(startZoom * scale);
  }, {passive:true});
  document.addEventListener('touchend', () => { lastDist = null; }, {passive:true});
  // Mouse wheel zoom (desktop)
  document.addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(currentZoom * (e.deltaY < 0 ? 1.1 : 0.9));
    }
  }, {passive:false});
}

// ═══════════════════════════════════════════════════════════════
