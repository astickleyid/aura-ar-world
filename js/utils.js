// AURA Utilities — haversine, bearing, compass math

function hav(a,b,c,d){const R=6371000,r=Math.PI/180,dL=(c-a)*r,dO=(d-b)*r,x=Math.sin(dL/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(dO/2)**2;return Math.round(R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x)))}
function brg(a,b,c,d){const r=Math.PI/180,dO=(d-b)*r,y=Math.sin(dO)*Math.cos(c*r),x=Math.cos(a*r)*Math.sin(c*r)-Math.sin(a*r)*Math.cos(c*r)*Math.cos(dO);return(Math.atan2(y,x)/r+360)%360}
function bdiff(a,b){return((a-b)+540)%360-180}
const degC=d=>['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(d/22.5)%16];

async function fetchLocName(lat,lon){try{const r=await fetch('https://nominatim.openstreetmap.org/reverse?lat='+lat+'&lon='+lon+'&format=json',{headers:{'User-Agent':'AURA-AR/3.0'}});const d=await r.json();const a=d.address||{};const road=a.road||a.pedestrian||a.neighbourhood||'';const city=a.city||a.town||a.village||'';document.getElementById('np-name').textContent=(road||city||'Live AR').toUpperCase();document.getElementById('np-sub').innerHTML='<span class="lpip"></span>'+(city||'AR LAYER').toUpperCase()}catch(e){}}
