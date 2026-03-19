// AURA Config — constants, shared state, helpers

'use strict';
const FOV_H=72,FOV_V=52,SM=0.1;
let uLat=40.758,uLon=-73.9855,heading=0,smoothH=0,pitch=0,smoothP=0;
let hasSensor=false,dragActive=false,lx=0,ly=0,frame=0;
let speedMph=0,altFt=null,gpsAcc=null,prevLat=null,prevLon=null,prevTime=null;
let weatherData={},places=[],audioCtx=null;

const ss=(id,st,tx)=>{const e=document.getElementById(id);e.className='bstep '+st;if(tx)e.querySelector('.bdot').nextSibling.textContent=' '+tx};
const sp=p=>{document.getElementById('bfill').style.width=p+'%'};
const dl=ms=>new Promise(r=>setTimeout(r,ms));
