// AURA Weather Module

async function fetchWeather(lat,lon){
  const r=await fetch('https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+'&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,precipitation,visibility&temperature_unit=celsius&wind_speed_unit=mph&timezone=auto');
  const d=await r.json(),c=d.current;
  const tF=Math.round(c.temperature_2m*9/5+32),fF=Math.round(c.apparent_temperature*9/5+32);
  const WD={0:'Clear',1:'Mostly Clear',2:'Partly Cloudy',3:'Overcast',45:'Foggy',51:'Drizzle',53:'Drizzle',61:'Rain',63:'Rain',65:'Heavy Rain',71:'Snow',73:'Snow',80:'Showers',95:'Thunderstorm'};
  const WI={0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',61:'🌧️',63:'🌧️',71:'❄️',80:'🌦️',95:'⛈️'};
  const dc=d=>['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(d/22.5)%16];
  const vis=c.visibility?(c.visibility>=1000?(c.visibility/1000).toFixed(1)+'km':c.visibility+'m'):'--';
  return{tf:tF+'F',tF,fF,desc:WD[c.weather_code]||'Clear',icon:WI[c.weather_code]||'🌡️',hum:c.relative_humidity_2m,wind:Math.round(c.wind_speed_10m),wd:dc(c.wind_direction_10m||0),prec:c.precipitation,vis};
}
function updateWx(){
  if(!weatherData.tf)return;
  document.getElementById('wx-t').textContent=weatherData.icon+' '+weatherData.tf;
  document.getElementById('wx-d').textContent=weatherData.desc;
  document.getElementById('wx-s').textContent='Feels '+weatherData.fF+'F - '+weatherData.wind+'mph '+weatherData.wd+' - '+weatherData.hum+'% humidity';
  document.getElementById('wx').style.display='block';
}
