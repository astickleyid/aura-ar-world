// AURA GPS Module

function onGPS(pos){
  const lat=pos.coords.latitude,lon=pos.coords.longitude,now=Date.now();
  if(pos.coords.speed!=null&&pos.coords.speed>=0)speedMph=pos.coords.speed*2.2369;
  else if(prevLat!=null){const d=hav(prevLat,prevLon,lat,lon),dt=(now-prevTime)/1000;if(dt>0)speedMph=(d/dt)*2.2369}
  if(pos.coords.altitude!=null)altFt=Math.round(pos.coords.altitude*3.281);
  gpsAcc=Math.round(pos.coords.accuracy);
  prevLat=lat;prevLon=lon;prevTime=now;uLat=lat;uLon=lon;
  document.querySelectorAll('.anc[data-lat]').forEach(el=>{
    const d=hav(lat,lon,parseFloat(el.dataset.lat),parseFloat(el.dataset.lon));
    const ds=d>=1000?(d/1000).toFixed(1)+'km':d+'m';
    const dt=el.querySelector('.dist-live');if(dt)dt.textContent='dist: '+ds;
    el.dataset.bearing=brg(lat,lon,parseFloat(el.dataset.lat),parseFloat(el.dataset.lon)).toString();
  });
}
