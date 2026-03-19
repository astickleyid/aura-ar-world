// AURA IFF — Identify Friend/Foe tagging system

// IFF TAGGING — tap a tracked object to mark Friend/Foe/Watch
// ═══════════════════════════════════════════════════════════════
const iffTags = new Map(); // trackerId -> {tag, label}
const IFF_CYCLE = ['UNKNOWN','FRIEND','WATCH','FOE'];
const IFF_ICONS = {UNKNOWN:'○', FRIEND:'✓', WATCH:'!', FOE:'✕'};
const IFF_COLORS = {UNKNOWN:'var(--c)', FRIEND:'#00FFD1', WATCH:'var(--o)', FOE:'var(--r)'};

function getIff(id) { return iffTags.get(id) || 'UNKNOWN'; }
function cycleIff(id) {
  const cur = getIff(id);
  const next = IFF_CYCLE[(IFF_CYCLE.indexOf(cur) + 1) % IFF_CYCLE.length];
  iffTags.set(id, next);
  playTone(next==='FOE'?220:next==='FRIEND'?880:440, 0.06, 0.08);
  return next;
}

// Override drawTracked to add IFF overlay and tap handler
// We monkey-patch via the canvas click handler
document.addEventListener('click', function(e) {
  if (!detCanvas) return;
  const rect = detCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  // Check if click is inside any tracked bbox
  for (const [id, obj] of tracker.objects) {
    const [bx,by,bw,bh] = obj.bbox;
    const cw = detCanvas.width, ch = detCanvas.height;
    const camEl = document.getElementById('cam');
    const scaleX = cw/(camEl.videoWidth||cw), scaleY = ch/(camEl.videoHeight||ch);
    const x=bx*scaleX, y=by*scaleY, w=bw*scaleX, h=bh*scaleY;
    if (mx>=x && mx<=x+w && my>=y && my<=y+h) {
      const tag = cycleIff(id);
      showToast('Target #'+id+' → '+IFF_ICONS[tag]+' '+tag);
      e.stopPropagation();
      return;
    }
  }
});

// ═══════════════════════════════════════════════════════════════
