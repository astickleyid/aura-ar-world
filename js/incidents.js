// AURA Incidents — PulsePoint 911 CAD feed

// LIVE INCIDENT FEED — PulsePoint / 911 near GPS
// ═══════════════════════════════════════════════════════════════
let incidents = [];

async function fetchIncidents() {
  try {
    // PulsePoint public API — real 911 CAD data in supported cities
    const r = await fetch('/api/incidents?lat='+uLat+'&lon='+uLon, {signal: AbortSignal.timeout(5000)});
    if (r.ok) {
      const d = await r.json();
      incidents = d.incidents || [];
      addIncidentAnchors();
    }
  } catch(e) {
    // PulsePoint may not cover all areas — silent fail
  }
}

function addIncidentAnchors() {
  const layer = document.getElementById('anc-layer');
  incidents.forEach((inc, i) => {
    const id = 'inc_'+i;
    if (document.getElementById('an-'+id)) return;
    const dist = hav(uLat,uLon,inc.lat,inc.lon);
    const ds = dist>=1000?(dist/1000).toFixed(1)+'km':dist+'m';
    const el = document.createElement('div');
    el.className = 'anc vr incident-anc';
    el.id = 'an-'+id;
    el.style.setProperty('--w','175px');
    el.dataset.bearing = brg(uLat,uLon,inc.lat,inc.lon);
    el.dataset.elev = 20;
    el.innerHTML = '<div class="acard"><div class="acbr"></div>'
      +'<div class="adist">'+ds+'</div>'
      +'<div class="atype"><div class="atd"></div>INCIDENT</div>'
      +'<div class="atitle">🚨 '+inc.type+'</div>'
      +'<div class="asub">'+(inc.address||'Nearby')+' · '+ds+'</div>'
      +'</div>'
      +'<div class="dist-live">dist: '+ds+'</div>'
      +'<div class="astem" style="height:70px"></div>'
      +'<div class="adot"></div>';
    el.addEventListener('click', () => {
      document.getElementById('p-ico').textContent='🚨';
      document.getElementById('p-type').textContent='LIVE INCIDENT · 911 CAD';
      document.getElementById('p-title').textContent=inc.type;
      document.getElementById('p-body').innerHTML='<div class="psg">'
        +'<div class="pst"><div class="psv">'+ds+'</div><div class="psl">Distance</div></div>'
        +'<div class="pst"><div class="psv">'+(inc.units||1)+'</div><div class="psl">Units</div></div>'
        +'<div class="pst"><div class="psv">'+(inc.age||'Now')+'</div><div class="psl">Age</div></div>'
        +'</div><div class="pdesc">'+inc.type+' reported at '+(inc.address||'nearby location')+'. Source: PulsePoint 911 CAD feed.</div>'
        +'<div class="pacts"><button class="pact pa" onclick="closePopup()">Track</button><button class="pact ps2" onclick="closePopup()">Dismiss</button></div>';
      document.getElementById('popup').classList.add('on');
      doFlash();
    });
    layer.appendChild(el);
  });
}

// ═══════════════════════════════════════════════════════════════
