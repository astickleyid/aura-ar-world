// AURA Places Module — OSM/Overpass POI fetching + classification

async function fetchPlaces(lat,lon){
  // Try backend API (cached, speed-aware radius) first
  try {
    const r = await fetch('/api/places?lat='+lat+'&lon='+lon+'&speed='+Math.round(speedMph));
    if (!r.ok) throw new Error('api '+r.status);
    const d = await r.json();
    if (d.places && d.places.length) {
      return processElements(d.places, lat, lon);
    }
  } catch(e) { /* fall through to direct */ }

  // Direct Overpass fallback
  const R=osmRadius();
  const q='[out:json][timeout:14];(node[amenity~"restaurant|cafe|bar|bank|pharmacy|hospital|cinema|hotel|fast_food|fuel|supermarket|pub|police|fire_station|library|nightclub|atm"](around:'+R+','+lat+','+lon+');node["man_made"="surveillance"](around:'+R+','+lat+','+lon+');node["highway"="speed_camera"](around:'+R+','+lat+','+lon+');node["highway"="traffic_signals"](around:'+R+','+lat+','+lon+');node[tourism~"attraction|museum|viewpoint"](around:'+R+','+lat+','+lon+');node[leisure~"park|fitness_centre"](around:'+R+','+lat+','+lon+');)->.r;.r out body;';
  const resp=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(q)});
  const data=await resp.json();
  return processElements(data.elements||[], lat, lon);
}

function processElements(elements, lat, lon){
  return(elements).slice(0,18).map(e=>{
    const tags=e.tags||{};
    const type=tags.amenity||tags.shop||tags.tourism||tags.leisure||tags.historic||tags.man_made||tags.highway||'place';
    const name=tags.name||autoName(type,tags);
    if(!name)return null;
    const{ico,cls,cat,pri}=clsT(type,tags);
    return{id:'osm_'+e.id,name,type,ico,cls,cat,pri,lat:e.lat,lon:e.lon,
      dist:hav(uLat,uLon,e.lat,e.lon),bearing:brg(uLat,uLon,e.lat,e.lon),
      elev:3+Math.random()*16,tags};
  }).filter(Boolean).sort((a,b)=>a.pri-b.pri||a.dist-b.dist);
}

function autoName(t,tags){const m={surveillance:'CCTV Camera',speed_camera:'Speed Camera',traffic_signals:'Traffic Light',parking:'Parking',police:'Police',fire_station:'Fire Station'};if(tags['surveillance:type'])return tags['surveillance:type'].toUpperCase()+' Cam';return m[t]||null}
function clsT(t,tags){
  if(t==='surveillance'||t==='speed_camera'||tags['man_made']==='surveillance')return{ico:'📷',cls:'vr',cat:'SURVEILLANCE',pri:1};
  if(t==='police'||tags.amenity==='police')return{ico:'🚔',cls:'vr',cat:'POLICE',pri:1};
  if(t==='traffic_signals')return{ico:'🚦',cls:'vo',cat:'TRAFFIC',pri:2};
  if(t==='fire_station')return{ico:'🚒',cls:'vr',cat:'FIRE',pri:2};
  const M={restaurant:{ico:'🍽️',cls:'',cat:'Restaurant',pri:5},cafe:{ico:'☕',cls:'',cat:'Cafe',pri:5},bar:{ico:'🍺',cls:'vo',cat:'Bar',pri:5},pub:{ico:'🍺',cls:'vo',cat:'Pub',pri:5},nightclub:{ico:'🎶',cls:'vo',cat:'Club',pri:5},bank:{ico:'🏦',cls:'',cat:'Bank',pri:4},atm:{ico:'💳',cls:'',cat:'ATM',pri:4},pharmacy:{ico:'💊',cls:'vr',cat:'Pharmacy',pri:3},hospital:{ico:'🏥',cls:'vr',cat:'Hospital',pri:2},library:{ico:'📚',cls:'vy',cat:'Library',pri:5},cinema:{ico:'🎬',cls:'',cat:'Cinema',pri:5},hotel:{ico:'🏨',cls:'vy',cat:'Hotel',pri:5},fast_food:{ico:'🍔',cls:'vo',cat:'Fast Food',pri:5},fuel:{ico:'⛽',cls:'vo',cat:'Gas',pri:4},supermarket:{ico:'🛒',cls:'',cat:'Market',pri:4},parking:{ico:'🅿️',cls:'vb',cat:'Parking',pri:5},park:{ico:'🌳',cls:'',cat:'Park',pri:5},fitness_centre:{ico:'💪',cls:'',cat:'Gym',pri:5},museum:{ico:'🏛️',cls:'vy',cat:'Museum',pri:5},attraction:{ico:'⭐',cls:'vy',cat:'Attraction',pri:5},viewpoint:{ico:'👁️',cls:'vy',cat:'Viewpoint',pri:5},artwork:{ico:'🎨',cls:'',cat:'Art',pri:5},monument:{ico:'🗿',cls:'vy',cat:'Monument',pri:5},memorial:{ico:'🕊️',cls:'vy',cat:'Memorial',pri:5},castle:{ico:'🏰',cls:'vy',cat:'Castle',pri:4},bookshop:{ico:'📖',cls:'vy',cat:'Books',pri:5},bakery:{ico:'🥐',cls:'',cat:'Bakery',pri:5},electronics:{ico:'📱',cls:'',cat:'Electronics',pri:5}};
  const r=M[t];return r||{ico:'📍',cls:'',cat:(t||'place').replace(/_/g,' '),pri:5};
}
function getMock(){return[{id:'m1',name:'CCTV Camera',type:'surveillance',ico:'📷',cls:'vr',cat:'SURVEILLANCE',pri:1,bearing:28,dist:45,elev:12,lat:uLat+0.0003,lon:uLon+0.0002,tags:{}},{id:'m2',name:'Blue Bottle Coffee',type:'cafe',ico:'☕',cls:'',cat:'Cafe',pri:5,bearing:72,dist:88,elev:6,lat:uLat+0.0006,lon:uLon+0.0007,tags:{}},{id:'m3',name:'Speed Camera',type:'speed_camera',ico:'📷',cls:'vr',cat:'SPEED CAM',pri:1,bearing:105,dist:120,elev:8,lat:uLat-0.0001,lon:uLon+0.001,tags:{}},{id:'m4',name:'City Park',type:'park',ico:'🌳',cls:'',cat:'Park',pri:5,bearing:158,dist:210,elev:5,lat:uLat-0.0015,lon:uLon+0.0004,tags:{}},{id:'m5',name:'Police Precinct',type:'police',ico:'🚔',cls:'vr',cat:'POLICE',pri:1,bearing:195,dist:175,elev:9,lat:uLat-0.0012,lon:uLon-0.0007,tags:{}},{id:'m6',name:'Grand Hotel',type:'hotel',ico:'🏨',cls:'vy',cat:'Hotel',pri:5,bearing:238,dist:190,elev:20,lat:uLat-0.0008,lon:uLon-0.0013,tags:{}},{id:'m7',name:'ATM',type:'atm',ico:'💳',cls:'',cat:'ATM',pri:4,bearing:285,dist:65,elev:4,lat:uLat+0.0001,lon:uLon-0.0005,tags:{}},{id:'m8',name:'Traffic Light',type:'traffic_signals',ico:'🚦',cls:'vo',cat:'TRAFFIC',pri:2,bearing:322,dist:55,elev:7,lat:uLat+0.0004,lon:uLon-0.0002,tags:{}}]}
