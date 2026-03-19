// AURA Anchors — compass, AR card building, spatial positioning

function buildCompass(){const s=document.getElementById('cs');s.innerHTML='';for(let i=0;i<720;i+=5){const el=document.createElement('span');el.className='ct';const m=i%360;if(m%90===0){el.classList.add('mj');el.textContent=['N','E','S','W'][m/90]}else if(m%45===0){el.classList.add('mj');el.textContent=['NE','SE','SW','NW'][(m/45-1)/2|0]}else if(m%30===0){el.textContent=m}else{el.textContent='.'}s.appendChild(el)}}
function updateCompass(){const s=document.getElementById('cs'),w=document.getElementById('cw');s.style.transform='translateX('+(-(smoothH%360)*s.scrollWidth/720+w.offsetWidth/2)+'px)';const dirs=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];document.getElementById('v-hdg').textContent=dirs[Math.round(smoothH/22.5)%16]+' '+Math.round(smoothH).toString().padStart(3,'0')}

function buildAnchors(){
  const layer=document.getElementById('anc-layer');layer.innerHTML='';
  if(weatherData.tf)mkAnc(layer,{id:'wx',bearing:2,elev:18,cls:'vy',w:'165px',stem:80,sh:'-1s',lat:uLat+0.0015,lon:uLon,ico:weatherData.icon,cat:'WEATHER',val:weatherData.tf,sub:weatherData.desc+' feels '+weatherData.fF+'F',dist:'--',detail:{ico:weatherData.icon,type:'Live Weather - Open-Meteo',title:'Current Conditions',stats:[{v:weatherData.tf,l:'Temp'},{v:weatherData.hum+'%',l:'Humidity'},{v:weatherData.wind+' mph',l:'Wind '+weatherData.wd}],desc:weatherData.desc+'. Feels '+weatherData.fF+'F. Vis '+weatherData.vis+'.'}});
  places.forEach((p,i)=>{const ds=p.dist>=1000?(p.dist/1000).toFixed(1)+'km':p.dist+'m';mkAnc(layer,{id:p.id,bearing:p.bearing,elev:p.elev,cls:p.cls,w:'158px',stem:48+Math.random()*40,sh:-(i*1.3)+'s',lat:p.lat,lon:p.lon,ico:p.ico,cat:p.cat,val:p.name.length>15?p.name.slice(0,14)+'...':p.name,sub:p.cat+' - '+ds,dist:ds,detail:{ico:p.ico,type:p.cat+' - OpenStreetMap',title:p.name,stats:[{v:ds,l:'Distance'},{v:Math.round(p.bearing)+'',l:'Bearing'},{v:p.type.replace(/_/g,' '),l:'Type'}],desc:mkDesc(p)}})});
}

function mkAnc(layer,a){
  const el=document.createElement('div');el.className='anc '+a.cls;el.id='an-'+a.id;
  el.style.setProperty('--w',a.w);el.style.setProperty('--sh',a.sh);
  el.dataset.bearing=a.bearing;el.dataset.elev=a.elev;
  if(a.lat)el.dataset.lat=a.lat;if(a.lon)el.dataset.lon=a.lon;
  el._detail=a.detail;
  el.innerHTML='<div class="acard"><div class="acbr"></div><div class="adist">'+a.dist+'</div><div class="atype"><div class="atd"></div>'+a.cat+'</div><div class="atitle">'+a.ico+' '+a.val+'</div><div class="asub">'+a.sub+'</div></div><div class="dist-live">dist: '+a.dist+'</div><div class="astem" style="height:'+a.stem+'px"></div><div class="adot"></div>';
  el.addEventListener('click',()=>openPopup(a.id));
  el.addEventListener('touchend',e=>{e.preventDefault();openPopup(a.id)},{passive:false});
  layer.appendChild(el);
}

function mkDesc(p){
  const t=p.tags||{},pts=[];
  if(p.cat==='SURVEILLANCE'||p.cat==='SPEED CAM'||p.cat==='TRAFFIC'){pts.push('Active surveillance infrastructure detected.');if(t['surveillance:type'])pts.push('Type: '+t['surveillance:type']);pts.push('Source: OpenStreetMap')}
  else{if(t.opening_hours)pts.push('Hours: '+t.opening_hours);if(t.phone)pts.push('Phone: '+t.phone);if(t.cuisine)pts.push('Cuisine: '+t.cuisine);if(t['addr:street'])pts.push(t['addr:street']);if(!pts.length)pts.push(p.cat+' at '+p.dist+'m '+degC(p.bearing)+'. Source: OpenStreetMap.')}
  return pts.join(' - ');
}

function updateAnchors(){
  const w=window.innerWidth,h=window.innerHeight,hw=FOV_H/2,hv=FOV_V/2;let vis=0;
  document.querySelectorAll('.anc').forEach(el=>{
    const b=parseFloat(el.dataset.bearing)||0,ev=parseFloat(el.dataset.elev)||0;
    const dh=bdiff(b,smoothH),dv=ev-smoothP;
    if(Math.abs(dh)<hw+10&&Math.abs(dv)<hv+14){
      el.style.left=(w/2+(dh/hw)*(w/2))+'px';el.style.top=(h/2-(dv/hv)*(h/2)+20)+'px';
      const edge=Math.max(Math.abs(dh)/hw,Math.abs(dv)/hv);
      const alpha=Math.pow(Math.max(0,1-edge),1.3);
      el.style.opacity=alpha.toFixed(3);el.classList.toggle('vis',alpha>0.04);vis++;
    }else{el.style.opacity='0';el.classList.remove('vis')}
  });
  document.getElementById('v-anc').textContent=vis;
}

// ═══════════════════════════════════════════════════════════
