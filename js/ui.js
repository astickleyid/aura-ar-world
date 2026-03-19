// AURA UI — popups, toasts, speed display, radar, audio

function initMovingTargets(){
  // Replaced by real TF.js detection — initDetection() is called from boot
  initDetection();
  startTrafficPolling();
}

function updateMovingTargets(){ /* no-op — real detection runs on canvas */ }


function openPopup(id){
  const el=document.getElementById('an-'+id);if(!el||!el._detail)return;
  const d=el._detail;
  document.getElementById('p-ico').textContent=d.ico;
  document.getElementById('p-type').textContent=d.type;
  document.getElementById('p-title').textContent=d.title;
  document.getElementById('p-body').innerHTML='<div class="psg">'+d.stats.map(s=>'<div class="pst"><div class="psv">'+s.v+'</div><div class="psl">'+s.l+'</div></div>').join('')+'</div><div class="pdesc">'+d.desc+'</div><div class="pacts"><button class="pact pa" onclick="closePopup()">Tag</button><button class="pact ps2" onclick="closePopup()">Dismiss</button></div>';
  document.getElementById('popup').classList.add('on');doFlash();playTone(440,.07,.12);
}
function closePopup(){document.getElementById('popup').classList.remove('on')}
function doFlash(){const f=document.getElementById('flash');f.classList.add('on');setTimeout(()=>f.classList.remove('on'),180)}
let toastT;function showToast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),3200)}

function updateSpeedUI(){
  const mph=speedMph,sv=document.getElementById('spd-val'),blk=document.getElementById('spd-you');
  sv.textContent=Math.round(mph);
  blk.classList.remove('warn','alert');
  if(mph>65)blk.classList.add('alert');else if(mph>45)blk.classList.add('warn');
  document.getElementById('alt-val').textContent=altFt!=null?altFt:'--';
  document.getElementById('acc-val').textContent=gpsAcc!=null?gpsAcc:'--';
}

function drawRadar(){
  const rc=document.getElementById('radar'),ctx=rc.getContext('2d'),cx=39,cy=39,R=35;
  ctx.clearRect(0,0,78,78);
  [12,24].forEach(r=>{ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.strokeStyle='rgba(0,255,209,.07)';ctx.lineWidth=1;ctx.stroke()});
  ctx.strokeStyle='rgba(0,255,209,.07)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(cx-R,cy);ctx.lineTo(cx+R,cy);ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx,cy-R);ctx.lineTo(cx,cy+R);ctx.stroke();
  const wa=(smoothH-90)*Math.PI/180,hf=(FOV_H/2)*Math.PI/180;
  ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,R-2,wa-hf,wa+hf);ctx.closePath();
  ctx.fillStyle='rgba(0,255,209,.07)';ctx.fill();ctx.strokeStyle='rgba(0,255,209,.17)';ctx.lineWidth=1;ctx.stroke();
  document.querySelectorAll('.anc').forEach(el=>{
    const b=parseFloat(el.dataset.bearing)||0,rel=(b-smoothH+360)%360,rad=(rel-90)*Math.PI/180;
    const bx=cx+Math.cos(rad)*25,by=cy+Math.sin(rad)*25;
    const al=0.3+Math.max(0,1-Math.abs(bdiff(b,smoothH))/90)*0.7;
    const cl=el.className;
    ctx.beginPath();ctx.arc(bx,by,2.5,0,Math.PI*2);
    ctx.fillStyle=cl.includes('vr')?'rgba(255,64,64,'+al+')':cl.includes('vo')?'rgba(255,144,48,'+al+')':cl.includes('vy')?'rgba(255,215,0,'+al+')':cl.includes('vb')?'rgba(79,195,247,'+al+')':'rgba(0,255,209,'+al+')';
    ctx.fill();
  });
  ctx.beginPath();ctx.arc(cx,cy,3.5,0,Math.PI*2);ctx.fillStyle='#00FFD1';ctx.shadowColor='#00FFD1';ctx.shadowBlur=10;ctx.fill();ctx.shadowBlur=0;
}

function initAudio(){if(audioCtx)return;try{audioCtx=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}}
function playTone(f,g,d){if(!audioCtx)return;try{const o=audioCtx.createOscillator(),gn=audioCtx.createGain();o.type='sine';o.frequency.value=f;gn.gain.setValueAtTime(g,audioCtx.currentTime);gn.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+d);o.connect(gn);gn.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+d)}catch(e){}}

function initSensors(){
  const h=e=>{hasSensor=true;heading=e.webkitCompassHeading!==undefined?e.webkitCompassHeading:(360-(e.alpha||0)+360)%360;pitch=Math.max(-28,Math.min(28,(e.beta||0)-45))};
  if(typeof DeviceOrientationEvent!=='undefined'){
    if(typeof DeviceOrientationEvent.requestPermission==='function'){
      const btn=document.createElement('button');btn.textContent='ENABLE MOTION';btn.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:50;padding:13px 30px;background:rgba(0,255,209,.08);border:1px solid rgba(0,255,209,.3);border-radius:9px;font-family:Orbitron,monospace;font-size:10px;letter-spacing:.16em;color:#00FFD1;cursor:pointer;display:none';btn.id='motionbtn';document.body.appendChild(btn);
      btn.onclick=()=>{initAudio();DeviceOrientationEvent.requestPermission().then(s=>{if(s==='granted')window.addEventListener('deviceorientation',h,true);btn.remove();showToast('Motion sensors active')})};
      setTimeout(()=>{btn.style.display='block'},2500);
    }else{window.addEventListener('deviceorientationabsolute',h,true);window.addEventListener('deviceorientation',h,true)}
  }
  document.addEventListener('click',()=>{if(!audioCtx)initAudio()},{once:true});
}

function initDrag(){
  const dn=(x,y)=>{dragActive=true;lx=x;ly=y};
  const mv=(x,y)=>{if(!dragActive)return;heading=(heading-(x-lx)*0.35+360)%360;pitch=Math.max(-26,Math.min(26,pitch+(y-ly)*0.18));lx=x;ly=y};
  const up=()=>dragActive=false;
  document.addEventListener('mousedown',e=>{if(!e.target.closest('#popup,.pact,#motionbtn,.tbox'))dn(e.clientX,e.clientY)});
  document.addEventListener('mousemove',e=>mv(e.clientX,e.clientY));
  document.addEventListener('mouseup',up);
  document.addEventListener('touchstart',e=>{if(!e.target.closest('#popup,.pact,.anc,#motionbtn,.tbox'))dn(e.touches[0].clientX,e.touches[0].clientY)},{passive:true});
  document.addEventListener('touchmove',e=>{if(dragActive)mv(e.touches[0].clientX,e.touches[0].clientY)},{passive:true});
  document.addEventListener('touchend',up);
}


// ═══════════════════════════════════════════════════════════════
