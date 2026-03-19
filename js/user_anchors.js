// AURA User Anchors — community tags, tagging dialog

// ── USER ANCHORS (Vercel KV) ─────────────────────────────────────────────
let userAnchors = [];
let myUserId = localStorage.getItem('aura_uid') || (() => {
  const id = Math.random().toString(36).slice(2);
  localStorage.setItem('aura_uid', id);
  return id;
})();

async function fetchUserAnchors() {
  try {
    const r = await fetch('/api/anchors?lat='+uLat+'&lon='+uLon);
    const d = await r.json();
    userAnchors = d.anchors || [];
    if (userAnchors.length) addUserAnchorNodes();
  } catch(e) { /* KV not set up yet */ }
}

function addUserAnchorNodes() {
  const layer = document.getElementById('anc-layer');
  userAnchors.forEach(a => {
    if (document.getElementById('an-ua-'+a.id)) return; // already added
    const dist = hav(uLat,uLon,a.lat,a.lon);
    const ds = dist >= 1000 ? (dist/1000).toFixed(1)+'km' : dist+'m';
    mkAnc(layer, {
      id: 'ua-'+a.id, bearing: brg(uLat,uLon,a.lat,a.lon),
      elev: 10, cls: 'vb', w: '155px', stem: 60, sh: '0s',
      lat: a.lat, lon: a.lon,
      ico: a.icon || '📍', cat: 'USER TAG',
      val: a.label.length > 14 ? a.label.slice(0,13)+'…' : a.label,
      sub: 'Tagged by community · '+ds, dist: ds,
      detail: { ico: a.icon||'📍', type: 'Community Anchor · AURA',
        title: a.label,
        stats: [{v:ds,l:'Distance'},{v:new Date(a.created).toLocaleDateString(),l:'Tagged'},{v:'Community',l:'Source'}],
        desc: 'Community-tagged location. '+(a.label)+' at '+ds+' from your position.' }
    });
  });
}

async function tagHere(label, icon) {
  try {
    const r = await fetch('/api/anchors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: uLat, lon: uLon, label, icon: icon||'📍', userId: myUserId })
    });
    const d = await r.json();
    if (d.ok) {
      showToast('Tagged: '+label);
      fetchUserAnchors();
    }
  } catch(e) { showToast('Tag failed — check connection'); }
}

// Tag popup — launched from the center reticle tap
function openTagDialog() {
  const labels = ['Here!','Meet here','Watch out','Road closed','Police ahead','Good food','Landmark'];
  const icons =  ['📍','👋','⚠️','🚧','🚔','🍔','⭐'];
  document.getElementById('p-ico').textContent = '📍';
  document.getElementById('p-type').textContent = 'Drop Anchor · Community';
  document.getElementById('p-title').textContent = 'Tag This Location';
  document.getElementById('p-body').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
      ${labels.map((l,i)=>`<button onclick="tagHere('${l}','${icons[i]}');closePopup()" style="background:rgba(79,195,247,.07);border:1px solid rgba(79,195,247,.25);border-radius:9px;padding:10px 6px;font-family:'DM Mono',monospace;font-size:9px;color:#4FC3F7;cursor:pointer;letter-spacing:.06em">${icons[i]} ${l}</button>`).join('')}
    </div>
    <div style="display:flex;gap:8px">
      <input id="custom-tag" placeholder="Custom label..." style="flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:9px 12px;font-family:'DM Mono',monospace;font-size:11px;color:#fff;outline:none" maxlength="60">
      <button onclick="const v=document.getElementById('custom-tag').value.trim();if(v){tagHere(v,'📍');closePopup()}" style="background:rgba(0,255,209,.07);border:1px solid rgba(0,255,209,.27);border-radius:8px;padding:9px 14px;font-family:'Orbitron',monospace;font-size:9px;color:#00FFD1;cursor:pointer">TAG</button>
    </div>`;
  document.getElementById('popup').classList.add('on');
}
