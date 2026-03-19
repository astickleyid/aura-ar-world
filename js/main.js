// AURA Main Loop — render loop, orchestration

function startLoop(){
  (function loop(){
    requestAnimationFrame(loop);frame++;
    const dh=((heading-smoothH)+540)%360-180;
    smoothH=(smoothH+dh*(hasSensor?0.14:SM)+360)%360;
    if(!dragActive&&!hasSensor)pitch*=0.94;
    smoothP+=(pitch-smoothP)*0.12;
    updateAnchors();updateMovingTargets();
    if(frame%3===0){updateCompass();drawRadar();updateSpeedUI()}
    if(frame%600===0){ smartOsmUpdate(); } // check every ~10s
    if(frame%180===0){ checkProactiveAlerts(); } // check every ~3s
    if(frame%60===0){const n=new Date(),h=n.getHours(),m=n.getMinutes().toString().padStart(2,'0');document.getElementById('v-time').textContent=(h>12?h-12:h||12)+':'+m;document.getElementById('v-pitch').textContent=(smoothP>=0?'+':'')+Math.round(smoothP)}
  })();
}

boot();
