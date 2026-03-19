// AURA Boot Sequence

async function boot(){
  ss('s1','run');
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});
    const v=document.getElementById('cam');v.srcObject=stream;
    await new Promise(r=>{v.onloadedmetadata=()=>{v.play();r()}});
    ss('s1','ok','Back camera active');
    getRealFocalLength(stream);
    initZoom(stream);
  }catch(e){ss('s1','err','No camera - skyline mode');document.getElementById('cam').style.display='none';document.getElementById('fallback').style.display='block'}
  sp(18);
  ss('s2','run');
  try{
    const pos=await new Promise((res,rej)=>navigator.geolocation?navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:10000}):rej());
    uLat=pos.coords.latitude;uLon=pos.coords.longitude;
    if(pos.coords.speed!=null)speedMph=pos.coords.speed*2.2369;
    if(pos.coords.altitude!=null)altFt=Math.round(pos.coords.altitude*3.281);
    gpsAcc=Math.round(pos.coords.accuracy);
    ss('s2','ok',uLat.toFixed(4)+', '+uLon.toFixed(4));
    navigator.geolocation.watchPosition(onGPS,null,{enableHighAccuracy:true,maximumAge:1000});
  }catch(e){ss('s2','err','GPS denied - Times Square demo')}
  sp(36);
  ss('s3','run');
  try{weatherData=await fetchWeather(uLat,uLon);ss('s3','ok',weatherData.tf+' - '+weatherData.desc);updateWx()}catch(e){ss('s3','err','Weather unavailable')}
  sp(55);
  ss('s4','run');
  try{places=await fetchPlaces(uLat,uLon);if(!places.length)throw 0;ss('s4','ok',places.length+' targets acquired')}catch(e){places=getMock();ss('s4','err',places.length+' demo targets')}
  buildAnchors();
  fetchUserAnchors();sp(75);
  ss('s5','run');initSensors();await dl(500);ss('s5','ok',hasSensor?'Gyro active':'Drag mode');sp(100);
  await dl(700);
  const b=document.getElementById('boot');b.style.transition='opacity .8s';b.style.opacity='0';
  setTimeout(()=>{b.style.display='none';buildCompass();initDrag();initVoice();startLoop();
    fetchIncidents();
    setInterval(fetchIncidents, 120000); // refresh every 2 min
    setInterval(updateSysPanel, 3000);   // sys panel every 3s
    setTimeout(() => auraSpeak(AURA_BOOT_GREETING.replace(/\\'/g,"'")), 1500);initMovingTargets();fetchLocName(uLat,uLon);showToast('AR Targeting online - '+places.length+' targets')},800);
}
