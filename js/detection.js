// AURA Detection — TensorFlow.js COCO-SSD, centroid tracker, drawing

// REAL OBJECT DETECTION + CENTROID TRACKER
// TensorFlow.js COCO-SSD — 80 classes, runs at 6fps
// IoU-based centroid tracker — stable boxes, velocity estimation
// ═══════════════════════════════════════════════════════════
let detModel = null;
let detRunning = false;
let detCanvas = null;
let detCtx = null;

// ── Centroid Tracker ──────────────────────────────────────
// Matches detections across frames by IoU overlap.
// Gives each object a stable ID, tracks position history,
// and estimates velocity (px/frame) for direction arrows.
const tracker = {
  nextId: 1,
  objects: new Map(), // id -> {bbox, cls, score, age, history, velocity, fadeAlpha}
  maxDisappeared: 8,  // frames before an object is dropped
  minIoU: 0.25,

  iou(a, b) {
    const [ax,ay,aw,ah] = a, [bx,by,bw,bh] = b;
    const ix = Math.max(0, Math.min(ax+aw,bx+bw) - Math.max(ax,bx));
    const iy = Math.max(0, Math.min(ay+ah,by+bh) - Math.max(ay,by));
    const inter = ix * iy;
    return inter / (aw*ah + bw*bh - inter + 1e-6);
  },

  update(detections) {
    // Increment age on all existing objects
    for (const obj of this.objects.values()) {
      obj.disappeared++;
      obj.fadeAlpha = Math.max(0, 1 - obj.disappeared / this.maxDisappeared);
    }

    if (!detections.length) {
      // Drop fully faded objects
      for (const [id, obj] of this.objects) {
        if (obj.disappeared >= this.maxDisappeared) this.objects.delete(id);
      }
      return [];
    }

    const existingIds = [...this.objects.keys()];

    if (!existingIds.length) {
      // No existing objects — register all detections
      for (const d of detections) this._register(d);
    } else {
      // Build IoU matrix: existing x new detections
      const used = new Set();
      const matched = new Set();

      for (const id of existingIds) {
        const obj = this.objects.get(id);
        let bestIoU = this.minIoU, bestIdx = -1;
        for (let i = 0; i < detections.length; i++) {
          if (used.has(i)) continue;
          // Only match same class or adjacent (e.g. car/truck)
          const sameClass = obj.cls === detections[i].class ||
            (VEHICLE_CLASSES.has(obj.cls) && VEHICLE_CLASSES.has(detections[i].class));
          if (!sameClass) continue;
          const iou = this.iou(obj.bbox, detections[i].bbox);
          if (iou > bestIoU) { bestIoU = iou; bestIdx = i; }
        }
        if (bestIdx >= 0) {
          used.add(bestIdx);
          matched.add(id);
          const d = detections[bestIdx];
          // Smooth bbox with exponential moving average (reduces jitter)
          const alpha = 0.45;
          const old = obj.bbox;
          const nb = d.bbox;
          const smoothed = [
            old[0]*alpha + nb[0]*(1-alpha),
            old[1]*alpha + nb[1]*(1-alpha),
            old[2]*alpha + nb[2]*(1-alpha),
            old[3]*alpha + nb[3]*(1-alpha),
          ];
          // Velocity = current center minus previous center
          const cx = smoothed[0]+smoothed[2]/2, cy = smoothed[1]+smoothed[3]/2;
          const pcx = old[0]+old[2]/2, pcy = old[1]+old[3]/2;
          obj.velocity = { vx: cx-pcx, vy: cy-pcy };
          obj.history.push([cx,cy]);
          if (obj.history.length > 12) obj.history.shift();
          obj.bbox = smoothed;
          obj.score = d.score;
          obj.disappeared = 0;
          obj.fadeAlpha = 1;
          obj.age++;
        }
      }

      // Register unmatched detections as new objects
      for (let i = 0; i < detections.length; i++) {
        if (!used.has(i)) this._register(detections[i]);
      }

      // Drop disappeared objects
      for (const [id, obj] of this.objects) {
        if (obj.disappeared >= this.maxDisappeared) this.objects.delete(id);
      }
    }

    return [...this.objects.values()];
  },

  _register(d) {
    const [bx,by,bw,bh] = d.bbox;
    this.objects.set(this.nextId++, {
      id: this.nextId - 1,
      cls: d.class,
      score: d.score,
      bbox: d.bbox,
      age: 1,
      disappeared: 0,
      fadeAlpha: 0.4, // fade in
      history: [[bx+bw/2, by+bh/2]],
      velocity: { vx: 0, vy: 0 }
    });
  }
};

const CLASS_COLORS = {
  car:'#FF9030',truck:'#FF9030',bus:'#FF9030',motorcycle:'#FF9030',bicycle:'#FFD700',
  person:'#FF4040',
  dog:'#FFD700',cat:'#FFD700',bird:'#FFD700',
  laptop:'#00FFD1',cell_phone:'#00FFD1',tv:'#00FFD1',keyboard:'#00FFD1',
  bottle:'#00FFD1',cup:'#00FFD1',chair:'#4FC3F7',couch:'#4FC3F7',
  backpack:'#4FC3F7',handbag:'#4FC3F7',suitcase:'#4FC3F7',
  _default:'#00FFD1'
};
const VEHICLE_CLASSES = new Set(['car','truck','bus','motorcycle','bicycle','train','boat']);

function getColor(cls){ return CLASS_COLORS[cls.replace(/ /g,'_')]||CLASS_COLORS._default }

// Real focal length from camera — makes distance estimates accurate
let focalLengthPx = null;
async function getRealFocalLength(stream) {
  try {
    const track = stream.getVideoTracks()[0];
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    const settings = track.getSettings ? track.getSettings() : {};
    // Some browsers expose focalLength in mm and sensor size
    // We derive focal length in pixels using: f_px = f_mm * (imageWidth / sensorWidth_mm)
    if (caps.focalLength && settings.focalLength && caps.zoom) {
      // focal length available — convert to pixels
      const imgW = settings.width || window.innerWidth;
      // Standard phone sensor width ~6mm (varies, but this gets us to ±10%)
      const SENSOR_W_MM = 6.0;
      focalLengthPx = settings.focalLength * (imgW / SENSOR_W_MM);
    } else {
      // Fallback: estimate from FOV
      // f = (w/2) / tan(hfov/2)
      const imgW = settings.width || window.innerWidth;
      const fovRad = (FOV_H * Math.PI) / 180;
      focalLengthPx = (imgW / 2) / Math.tan(fovRad / 2);
    }
  } catch(e) {
    const fovRad = (FOV_H * Math.PI) / 180;
    focalLengthPx = (window.innerWidth / 2) / Math.tan(fovRad / 2);
  }
}

function estimateDistM(bboxWidthPx, realWidthM, canvasW, videoW) {
  if (!focalLengthPx) return null;
  // Scale focal length to canvas coords
  const scale = canvasW / (videoW || canvasW);
  const f = focalLengthPx * scale;
  const dist = (realWidthM * f) / bboxWidthPx;
  return dist;
}

// Real widths for common objects (meters)
const REAL_WIDTHS = {
  car: 1.9, truck: 2.5, bus: 2.6, motorcycle: 0.8, bicycle: 0.6,
  person: 0.5, dog: 0.4, cat: 0.25,
  laptop: 0.35, tv: 1.2, chair: 0.5,
};

async function initDetection() {
  detCanvas = document.getElementById('det-canvas');
  if (!detCanvas) return;
  detCtx = detCanvas.getContext('2d');
  resizeDetCanvas();
  window.addEventListener('resize', resizeDetCanvas);

  // Load TF.js async — doesn't block boot
  showToast('Loading vision model...');
  try {
    if (!window._tfReady) await loadTF();
    if (typeof cocoSsd === 'undefined') throw new Error('TF.js unavailable');
    detModel = await cocoSsd.load({ base: 'mobilenet_v2' });
    showToast('Vision system online');
    startDetectionLoop();
  } catch(e) {
    try {
      if (typeof cocoSsd !== 'undefined') {
        detModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
        showToast('Vision online (lite mode)');
        startDetectionLoop();
      } else {
        showToast('Vision offline — slow connection');
      }
    } catch(e2) {
      showToast('Vision unavailable');
    }
  }
}

function resizeDetCanvas() {
  if (!detCanvas) return;
  detCanvas.width = window.innerWidth;
  detCanvas.height = window.innerHeight;
}

function startDetectionLoop() {
  if (detRunning) return;
  detRunning = true;
  let lastRun = 0;
  const FPS = 6;
  const camEl = document.getElementById('cam');

  async function detectFrame(ts) {
    requestAnimationFrame(detectFrame);
    if (ts - lastRun < 1000/FPS) return;
    lastRun = ts;
    if (!detModel || !camEl || camEl.readyState < 2) return;
    try {
      const preds = await detModel.detect(camEl);
      // Lower threshold for vehicles (they're often partially occluded)
      const filtered = preds.filter(p => {
        const isVeh = VEHICLE_CLASSES.has(p.class);
        return p.score >= (isVeh ? 0.22 : 0.30);
      });
      const tracked = tracker.update(filtered);
      drawTracked(tracked, camEl.videoWidth, camEl.videoHeight);
    } catch(e) { /* busy */ }
  }
  requestAnimationFrame(detectFrame);
}

function drawTracked(objects, vw, vh) {
  if (!detCtx || !detCanvas) return;
  const cw = detCanvas.width, ch = detCanvas.height;
  detCtx.clearRect(0, 0, cw, ch);
  tickDetFps();
  updateCrowdDensity(objects || []);
  if (!objects || !objects.length) return;

  const scaleX = cw / (vw || cw);
  const scaleY = ch / (vh || ch);

  objects.forEach(obj => {
    const { cls, score, bbox, fadeAlpha, age, history, velocity, id } = obj;
    if (fadeAlpha < 0.05) return;

    const [bx,by,bw,bh] = bbox;
    const x = bx*scaleX, y = by*scaleY, w = bw*scaleX, h = bh*scaleY;
    const color = getColor(cls);
    const isVehicle = VEHICLE_CLASSES.has(cls);

    // IFF + threat — compute FIRST before drawing anything
    const iff = getIff(id);
    const iffColor = IFF_COLORS[iff] || color;
    const iffIcon = IFF_ICONS[iff] || '';
    const threat = assessThreat(cls, score, velocity, iff);

    // Global alpha for fade in/out
    detCtx.globalAlpha = Math.min(1, fadeAlpha * (age > 3 ? 1 : age/3));

    // Box (IFF color overrides default)
    const boxColor = iff !== 'UNKNOWN' ? iffColor : color;
    detCtx.strokeStyle = boxColor;
    detCtx.lineWidth = isVehicle ? 1.5 : 1;
    detCtx.shadowColor = boxColor;
    detCtx.shadowBlur = age > 2 ? 8 : 3; // glow intensifies as object stabilizes
    detCtx.strokeRect(x, y, w, h);
    detCtx.shadowBlur = 0;

    // Corner ticks
    const tick = Math.min(w, h) * 0.2;
    detCtx.lineWidth = isVehicle ? 2 : 1.5;
    detCtx.strokeStyle = boxColor;
    detCtx.beginPath();
    detCtx.moveTo(x,y+tick); detCtx.lineTo(x,y); detCtx.lineTo(x+tick,y);
    detCtx.moveTo(x+w-tick,y); detCtx.lineTo(x+w,y); detCtx.lineTo(x+w,y+tick);
    detCtx.moveTo(x,y+h-tick); detCtx.lineTo(x,y+h); detCtx.lineTo(x+tick,y+h);
    detCtx.moveTo(x+w-tick,y+h); detCtx.lineTo(x+w,y+h); detCtx.lineTo(x+w,y+h-tick);
    detCtx.stroke();

    // Motion trail (history of center points)
    if (history.length > 2 && (Math.abs(velocity.vx) > 0.8 || Math.abs(velocity.vy) > 0.8)) {
      detCtx.beginPath();
      detCtx.strokeStyle = color;
      detCtx.lineWidth = 1;
      detCtx.globalAlpha *= 0.4;
      for (let i = 0; i < history.length; i++) {
        const [hx, hy] = history[i];
        const sx = hx * scaleX, sy = hy * scaleY;
        i === 0 ? detCtx.moveTo(sx, sy) : detCtx.lineTo(sx, sy);
      }
      detCtx.stroke();
      detCtx.globalAlpha = Math.min(1, fadeAlpha * (age > 3 ? 1 : age/3));
    }

    // Velocity arrow + predictive path
    const speed_px = Math.sqrt(velocity.vx**2 + velocity.vy**2);
    if (speed_px > 0.8) {
      const cx = x+w/2, cy = y+h/2;
      const angle = Math.atan2(velocity.vy, velocity.vx);
      // Current velocity arrow
      const arrowLen = Math.min(speed_px * 8, 50);
      detCtx.beginPath();
      detCtx.strokeStyle = color;
      detCtx.lineWidth = 1.5;
      detCtx.globalAlpha *= 0.75;
      detCtx.moveTo(cx, cy);
      detCtx.lineTo(cx + Math.cos(angle)*arrowLen, cy + Math.sin(angle)*arrowLen);
      detCtx.stroke();
      // Predictive path — 2s forward (at 6fps = 12 frames)
      if (showPredictivePath && speed_px > 1.5) {
        const predX = cx + velocity.vx * 12;
        const predY = cy + velocity.vy * 12;
        detCtx.setLineDash([3, 4]);
        detCtx.lineWidth = 1;
        detCtx.globalAlpha *= 0.5;
        detCtx.beginPath();
        detCtx.moveTo(cx + Math.cos(angle)*arrowLen, cy + Math.sin(angle)*arrowLen);
        detCtx.lineTo(predX, predY);
        detCtx.stroke();
        // Predicted position dot
        detCtx.setLineDash([]);
        detCtx.beginPath();
        detCtx.arc(predX, predY, 3, 0, Math.PI*2);
        detCtx.fillStyle = color;
        detCtx.globalAlpha *= 1.5;
        detCtx.fill();
        detCtx.setLineDash([]);
      }
      detCtx.setLineDash([]);
      detCtx.globalAlpha = Math.min(1, fadeAlpha * (age > 3 ? 1 : age/3));
    }

    // Label
    const pct = Math.round(score * 100);
    const confLabel = score >= 0.72 ? cls : score >= 0.48 ? cls+'?' : 'object?';
    const displayCls = confLabel.replace(/_/g,' ').toUpperCase();

    // Distance estimate
    let distLabel = '';
    const realW = REAL_WIDTHS[cls];
    if (realW) {
      const distM = estimateDistM(bw, realW, cw, vw);
      if (distM) {
        const d = Math.round(distM);
        distLabel = d < 5 ? ' CLOSE' : d > 150 ? ' >150m' : ' ~'+d+'m';
      }
    }

    // ID badge (helps you see same object tracked across frames)
    const idLabel = age > 2 ? ' #'+id : '';
    // IFF + threat already computed at top of forEach
    const threatStr = threat.level !== 'LOW' ? ' ['+threat.level+']' : '';
    const fullLabel = (iff !== 'UNKNOWN' ? iffIcon+' ' : '') + displayCls + ' ' + pct + '%' + distLabel + threatStr;

    detCtx.font = '600 9px "DM Mono", monospace';
    const tw = detCtx.measureText(fullLabel).width;
    const ly = y > 22 ? y - 5 : y + h + 15;

    detCtx.globalAlpha *= 0.9;
    detCtx.fillStyle = 'rgba(0,2,10,0.78)';
    detCtx.fillRect(x-1, ly-12, tw+10, 15);
    detCtx.globalAlpha = Math.min(1, fadeAlpha * (age > 3 ? 1 : age/3));

    detCtx.fillStyle = iffColor;
    detCtx.shadowColor = iffColor;
    detCtx.shadowBlur = 5;
    detCtx.fillText(fullLabel, x+4, ly);
    detCtx.shadowBlur = 0;
    detCtx.globalAlpha = 1;
  });
}
