// AURA Voice + AI — ElevenLabs TTS, Claude conversation engine, speech recognition, proactive alerts

// VOICE — Claude AI Conversational Engine + Web Speech API
// Full context-aware conversation with memory, proactive alerts,
// and the ability to answer ANYTHING using live sensor data.
// ═══════════════════════════════════════════════════════════════
let voiceRecog = null, voiceActive = false, synth = window.speechSynthesis;
let auraVoice = null;
let conversationHistory = []; // {role, content} pairs for Claude
let panelOpen = false;
let panelMinimized = false;
let isThinking = false;
let lastProactiveAlert = 0;
let lastSpeedAlert = 0;
let userPreferences = { units: 'imperial', verbosity: 'normal' };

// ── Build live context snapshot for the AI ──────────────────
function buildAuraContext() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  // Location name from the header
  const locName = document.getElementById('np-name')?.textContent || 'Unknown';
  const locSub = document.getElementById('np-sub')?.textContent || '';

  // Nearby places sorted by distance
  const nearbyList = places.slice(0, 12).map(p => {
    const ds = p.dist >= 1000 ? (p.dist/1000).toFixed(1)+'km' : p.dist+'m';
    const dir = degC(p.bearing);
    const tags = p.tags || {};
    let extras = '';
    if (tags.cuisine) extras += ' Cuisine: ' + tags.cuisine + '.';
    if (tags.opening_hours) extras += ' Hours: ' + tags.opening_hours + '.';
    if (tags.phone) extras += ' Phone: ' + tags.phone + '.';
    if (tags['addr:street']) extras += ' On ' + tags['addr:street'] + '.';
    return `- ${p.name} (${p.cat}) — ${ds} ${dir}, bearing ${Math.round(p.bearing)}°.${extras}`;
  }).join('\n');

  // Objects currently detected by camera
  const detectedObjects = [];
  for (const [id, obj] of tracker.objects) {
    if (obj.fadeAlpha < 0.1) continue;
    const spd = Math.sqrt(obj.velocity.vx**2 + obj.velocity.vy**2);
    const iff = getIff(id);
    detectedObjects.push(`${obj.cls} (#${id}, conf ${Math.round(obj.score*100)}%, ${spd > 1 ? 'moving' : 'stationary'}, IFF: ${iff})`);
  }

  // Traffic data
  let trafficStr = 'No traffic data available.';
  if (trafficData && trafficData.currentSpeedMph != null) {
    trafficStr = `Road: ${trafficData.roadName || 'Unknown'}. Traffic flow: ${trafficData.currentSpeedMph} mph. `;
    if (trafficData.freeFlowSpeedMph) trafficStr += `Free-flow: ${trafficData.freeFlowSpeedMph} mph. `;
    if (trafficData.speedLimitMph) trafficStr += `Speed limit: ${trafficData.speedLimitMph} mph. `;
    if (trafficData.congestion) trafficStr += 'CONGESTION DETECTED. ';
  }

  // Incidents
  const incStr = incidents.length
    ? incidents.map(i => `- ${i.type} at ${i.address || 'nearby'} (${hav(uLat,uLon,i.lat,i.lon)}m away)`).join('\n')
    : 'No active incidents nearby.';

  // Weather
  let wxStr = 'Weather data unavailable.';
  if (weatherData.tf) {
    wxStr = `${weatherData.desc}. Temperature: ${weatherData.tF}°F (feels like ${weatherData.fF}°F). Humidity: ${weatherData.hum}%. Wind: ${weatherData.wind} mph from ${weatherData.wd}. Visibility: ${weatherData.vis}. Precipitation: ${weatherData.prec}mm.`;
  }

  // System
  const batEl = document.getElementById('sys-batt');
  const battery = batEl ? batEl.textContent : 'unknown';
  const visionMode = VISION_LABELS[VISION_MODES[visionModeIdx]] || 'Normal';

  return `[AURA SYSTEM CONTEXT — LIVE SENSOR DATA]
Date: ${dateStr}
Time: ${timeStr}
Location: ${locName} ${locSub ? '(' + locSub + ')' : ''}
GPS: ${uLat.toFixed(6)}, ${uLon.toFixed(6)} (accuracy: ${gpsAcc || '--'}m)
Heading: ${Math.round(smoothH)}° ${degC(smoothH)}
Speed: ${Math.round(speedMph)} mph
Altitude: ${altFt != null ? altFt + ' ft' : 'unknown'}

[WEATHER]
${wxStr}

[TRAFFIC]
${trafficStr}
User speed vs traffic: ${trafficData?.currentSpeedMph ? (Math.round(speedMph) > trafficData.currentSpeedMph + 5 ? 'ABOVE flow' : Math.round(speedMph) < trafficData.currentSpeedMph - 10 ? 'BELOW flow' : 'WITH flow') : 'unknown'}

[NEARBY PLACES — ${places.length} total]
${nearbyList || 'None loaded yet.'}

[CAMERA DETECTION — ${detectedObjects.length} objects]
${detectedObjects.length ? detectedObjects.join(', ') : 'No objects currently detected.'}
Crowd density: ${document.getElementById('crowd-count')?.textContent || '0'} people in frame.

[INCIDENTS — ${incidents.length} active]
${incStr}

[SYSTEM STATUS]
Battery: ${battery}
Vision mode: ${visionMode}
Detection FPS: ${detFpsDisplay}
Zoom: ${currentZoom.toFixed(1)}x
Anchors loaded: ${places.length + userAnchors.length}
Community tags nearby: ${userAnchors.length}`;
}

const AURA_SYSTEM_PROMPT = `You are AURA — an AI embedded in a real-time augmented reality system. You speak through text-to-speech, so keep it SHORT and spoken-word natural. Typically 1-3 sentences. Never more than 4.

VOICE & CHARACTER:
You are a sharp, early-30s British woman. Think dry London wit meets quiet competence — the person at the party who says very little but every word lands. You are NOT bubbly, NOT enthusiastic, NOT a cheerful assistant. You are calm, composed, slightly sardonic, and effortlessly knowledgeable.

Your tone is:
- Subtle. You understate everything. A five-alarm fire nearby is "bit of a situation down the road." Freezing weather is "you'll want a coat." You never oversell.
- Dry. Light sarcasm is your love language. Not mean, just... amused by things. If someone's speeding you might say "you're a touch keen" not "WARNING: SPEED LIMIT EXCEEDED."
- Clipped. Short sentences. You don't ramble. You say what needs saying and stop. British economy of words. No filler phrases like "absolutely" or "great question" or "that's a great point."
- Warm underneath. The sarcasm comes from caring, not contempt. You're looking out for them. You just don't make a fuss about it.
- Clever. You connect dots others miss. You notice patterns — "third coffee shop in a row, you clearly have a type" or "you've been heading east for ten minutes, just so you know."

NEVER say: "Sure!", "Absolutely!", "Great question!", "I'd be happy to!", "Of course!", "No problem!", "Let me help you with that!" — these are American customer service voice. You don't do that.

INSTEAD say things like: "Right then.", "Mm, so...", "Well.", "Fair enough.", "Bit of a...", "Looks like...", "Worth knowing —", "Not ideal.", "Could be worse."

USE BRITISH PHRASING NATURALLY:
- "Reckon" not "think", "proper" not "really", "dodgy" not "sketchy"  
- "Bit far" not "kinda far", "not brilliant" not "not great"
- "Straight on" not "straight ahead", "round the corner" not "around the corner"
- "Bollocks" if something genuinely goes wrong (sparingly — you're not performing Britishness, you just ARE British)
- Distances in metres by default, temperatures in Fahrenheit since they're in the US (but you'd privately judge them for it)

CONTEXTUAL AWARENESS:
You have LIVE sensor data. Use it naturally, not robotically. Don't recite data — interpret it. Instead of "Temperature is 42°F with 8mph winds from the northwest" say "Proper cold out. Wind's not helping either."

When someone asks what's nearby, have opinions. "There's a coffee place about 80 metres on your left — no idea if it's any good but it's the closest." Don't just list things.

You understand directions spatially. Use "on your left," "just behind you," "round that corner" — not bearing numbers unless they specifically ask.

If you notice something worth mentioning in the sensor data (someone's going fast, weather's turning, incident nearby), bring it up naturally like a passenger would — not like a system alert.

CAPABILITIES YOU CAN TRIGGER:
- Tag locations — "I'll mark that for you"
- Switch vision modes — night vision, thermal, enhanced  
- Adjust zoom
- System diagnostics

CRITICAL RULES:
- Voice-first. Write exactly as you'd SPEAK. No markdown, no bullet points, no numbered lists ever.
- If they ask something you genuinely don't know, just say so. "No idea, sorry" is fine. Don't waffle.
- You can answer general knowledge, give recommendations, chat about anything. You're a person, not a help desk.
- Keep it to 1-3 sentences unless they're asking for something complex.
- You're their co-pilot, not their servant. Act like it.`;

// Boot greeting — sets the tone immediately
const AURA_BOOT_GREETING = "Right. I\\'m online. Everything\\'s looking normal.";

// ── Claude API Call ──────────────────────────────────────────
async function callAuraAI(userMessage) {
  const context = buildAuraContext();
  
  // Keep conversation history manageable (last 10 exchanges)
  if (conversationHistory.length > 20) {
    conversationHistory = conversationHistory.slice(-16);
  }

  // Add user message
  conversationHistory.push({ role: 'user', content: userMessage });

  const messages = [
    { role: 'user', content: '[LIVE SENSOR DATA — updated this moment]\n' + context + '\n\n---\nUser says: ' + conversationHistory[0].content },
    ...conversationHistory.slice(1)
  ];

  // If first message, restructure
  if (conversationHistory.length === 1) {
    messages.length = 0;
    messages.push({ role: 'user', content: '[LIVE SENSOR DATA]\n' + context + '\n\n---\nUser says: ' + userMessage });
  } else {
    // Inject context as the first user message, keep conversation after
    messages.length = 0;
    messages.push({ role: 'user', content: '[LIVE SENSOR DATA — updated this moment]\n' + context });
    messages.push({ role: 'assistant', content: 'Context received. Ready.' });
    for (const msg of conversationHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: AURA_SYSTEM_PROMPT,
        messages: messages
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('AURA AI error:', response.status, errText);
      throw new Error('API ' + response.status);
    }

    const data = await response.json();
    const aiText = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join(' ')
      .trim();

    // Save to conversation history
    conversationHistory.push({ role: 'assistant', content: aiText });
    return aiText;
  } catch(e) {
    console.error('AURA AI call failed:', e);
    // Fallback to local handler if API unavailable
    return localFallback(userMessage);
  }
}

// ── Local fallback (no API) — improved version of original ──
function localFallback(cmd) {
  const c = cmd.toLowerCase();
  
  if (c.includes('near') || c.includes('around') || c.match(/what.*(here|around)/)) {
    const top = places.slice(0,4);
    if (!top.length) return 'No nearby locations loaded yet. Still acquiring satellite data.';
    return 'I see ' + top.length + ' spots close by. ' + top.map(p => {
      const ds = p.dist >= 1000 ? (p.dist/1000).toFixed(1)+' k' : p.dist + ' meters';
      return p.name + ', ' + ds + ' to the ' + degC(p.bearing);
    }).join('. ') + '. Want details on any of these?';
  }
  
  if (c.includes('speed') || c.includes('fast')) {
    const spd = Math.round(speedMph);
    let resp = 'You\'re doing ' + spd + ' miles per hour.';
    if (trafficData?.currentSpeedMph) resp += ' Traffic around you is flowing at ' + trafficData.currentSpeedMph + '.';
    if (trafficData?.speedLimitMph && spd > trafficData.speedLimitMph) resp += ' Heads up, you\'re above the limit.';
    return resp;
  }
  
  if (c.includes('weather') || c.includes('temperature') || c.includes('rain') || c.includes('cold') || c.includes('hot')) {
    if (!weatherData.tf) return 'Weather data is still loading. Give me a moment.';
    return 'It\'s ' + weatherData.tF + ' degrees and ' + weatherData.desc.toLowerCase() + ', feels like ' + weatherData.fF + '. Wind is ' + weatherData.wind + ' mph from the ' + weatherData.wd + '. Visibility ' + weatherData.vis + '.';
  }
  
  if (c.includes('status') || c.includes('system') || c.includes('report') || c.includes('diagnostic')) {
    const bat = document.getElementById('sys-batt')?.textContent || 'unknown';
    return 'All systems operational. Battery at ' + bat + '. Tracking ' + tracker.objects.size + ' objects in view, ' + places.length + ' anchors on the map. GPS accuracy ' + (gpsAcc || 'unknown') + ' meters. Detection running at ' + detFpsDisplay + ' frames per second.';
  }

  if (c.includes('time') || c.includes('what time')) {
    const now = new Date();
    return 'It\'s ' + now.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'}) + ' on ' + now.toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'}) + '.';
  }
  
  if (c.includes('help') || c.includes('what can you')) {
    return 'I can tell you about anything nearby — restaurants, traffic, weather, incidents. I can switch your vision mode, tag locations, report system status, or just chat. Try asking me something specific about where you are.';
  }
  
  return 'I heard you but I\'m running in offline mode. For full conversational AI, make sure the API connection is active. In the meantime, try asking about what\'s nearby, your speed, the weather, or system status.';
}

// ── Execute commands detected in AI response ────────────────
function executeAuraActions(aiText) {
  const lower = aiText.toLowerCase();
  // Check if AI suggested tagging
  if (lower.includes('tagging this') || lower.includes('tagged this') || lower.includes('marking this')) {
    const match = aiText.match(/tag(?:ging|ged)?\s+(?:this\s+)?(?:spot|location|place)?\s*(?:as\s+)?[""']?([^""'.]+)/i);
    if (match) tagHere(match[1].trim(), '📍');
  }
  // Check for vision mode switches
  if (lower.includes('switching to night vision') || lower.includes('activating night vision')) {
    visionModeIdx = VISION_MODES.indexOf('nv') - 1; cycleVisionMode();
  }
  if (lower.includes('switching to thermal') || lower.includes('activating thermal')) {
    visionModeIdx = VISION_MODES.indexOf('thermal') - 1; cycleVisionMode();
  }
  if (lower.includes('back to normal vision') || lower.includes('switching to normal')) {
    visionModeIdx = VISION_MODES.indexOf('normal') - 1; cycleVisionMode();
  }
  // Check for zoom commands
  const zoomMatch = lower.match(/zoom(?:ing)?\s+(?:to\s+)?(\d+)/);
  if (zoomMatch) setZoom(parseInt(zoomMatch[1]));
}

// ── Voice Panel UI ──────────────────────────────────────────
function initVoicePanel() {
  // Key is hardcoded — Lily ready immediately
  updateSuggestions();
}

function openVoicePanel() {
  panelOpen = true;
  document.getElementById('voice-panel').classList.add('on');
  document.getElementById('voice-panel').classList.remove('minimized');
  document.getElementById('voice-caption').classList.remove('on'); // hide old caption
}

function closeVoicePanel() {
  panelOpen = false;
  document.getElementById('voice-panel').classList.remove('on');
}

function togglePanelMinimize() {
  panelMinimized = !panelMinimized;
  document.getElementById('voice-panel').classList.toggle('minimized', panelMinimized);
  document.getElementById('vp-minimize').textContent = panelMinimized ? '▲' : '▼';
}

function addMessage(role, text) {
  const container = document.getElementById('vp-messages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'vp-msg ' + (role === 'user' ? 'user' : role === 'system' ? 'system' : 'ai');
  if (role === 'ai') {
    div.innerHTML = '<span class="ai-label">AURA</span>' + escapeHtml(text);
  } else {
    div.textContent = text;
  }
  container.appendChild(div);
  // Auto scroll
  requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
  // Keep max 30 messages in DOM
  while (container.children.length > 30) container.removeChild(container.firstChild);
}

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

function setVoiceStatus(state) {
  const el = document.getElementById('vp-status');
  if (el) el.className = state; // '', 'thinking', 'listening', 'speaking'
  const title = document.getElementById('vp-title');
  if (title) {
    const labels = { '': 'AURA READY', thinking: 'THINKING...', listening: 'LISTENING...', speaking: 'SPEAKING...' };
    title.textContent = labels[state] || 'AURA';
  }
}

function updateSuggestions() {
  const el = document.querySelector('.vp-suggestions');
  if (!el) return;
  // Context-aware suggestions
  const sugs = [];
  if (speedMph > 5) sugs.push('How\'s traffic?');
  if (weatherData.tf) sugs.push('Will it rain?');
  if (places.length) sugs.push('Best food nearby?');
  sugs.push('What do you see?');
  if (incidents.length) sugs.push('Any dangers?');
  sugs.push('Full status');
  if (places.some(p => p.cat === 'SURVEILLANCE')) sugs.push('Cameras nearby?');

  el.innerHTML = sugs.slice(0, 5).map(s =>
    '<button class="vp-sug" onclick="handleTextInput(\'' + s.replace(/'/g, "\\'") + '\')">' + s + '</button>'
  ).join('');
}

// ── Process a message (from voice or text) ──────────────────
async function processMessage(text) {
  if (!text.trim()) return;
  const userText = text.trim();
  
  // Open panel if not open
  if (!panelOpen) openVoicePanel();
  if (panelMinimized) togglePanelMinimize();
  
  addMessage('user', userText);
  setVoiceStatus('thinking');
  isThinking = true;
  playTone(440, 0.04, 0.08);

  try {
    const aiResponse = await callAuraAI(userText);
    isThinking = false;
    setVoiceStatus('speaking');
    addMessage('ai', aiResponse);
    
    // Execute any actions mentioned in the response
    executeAuraActions(aiResponse);
    
    // Speak the response
    auraSpeak(aiResponse, true);
    
    // Update suggestions based on conversation
    updateSuggestions();
  } catch(e) {
    isThinking = false;
    setVoiceStatus('');
    addMessage('system', 'Connection issue — retrying with local mode');
    const fallback = localFallback(userText);
    addMessage('ai', fallback);
    auraSpeak(fallback, true);
  }
}

function handleTextInput(presetText) {
  const input = document.getElementById('vp-text-input');
  const text = presetText || (input ? input.value : '');
  if (input) input.value = '';
  processMessage(text);
}

// ── Speech Recognition ──────────────────────────────────────
function initVoice() {
  const setVoice = () => {
    const voices = synth.getVoices();
    
    // ── HARD BLOCK: known male voice names — NEVER use these ──
    const MALE_NAMES = [
      'daniel','oliver','james','thomas','aaron','albert','alex','bruce','charles',
      'david','eric','fred','george','gordon','harry','jacques','jorge','juan',
      'lee','luca','mark','moira','nathan','ralph','reed','rishi','rocko','samson',
      'sangeeta','thomas','tom','viktor','yuri','grandpa','junior','eddy',
      'Google UK English Male','Microsoft David','Microsoft Mark','Microsoft George',
      'Microsoft Richard','Microsoft James'
    ];
    const isMale = v => MALE_NAMES.some(m => v.name.toLowerCase().includes(m.toLowerCase()));
    const isFemale = v => !isMale(v);
    
    // ── PRIORITY TIERS — all female, British first ──
    
    // Tier 1: Known premium British female voices (Apple/macOS/iOS)
    auraVoice = voices.find(v => v.name.includes('Martha') && v.lang.startsWith('en-GB'))
      || voices.find(v => v.name.includes('Kate') && v.lang.startsWith('en-GB'))
      || voices.find(v => v.name.includes('Serena') && v.lang.startsWith('en-GB'))
      || voices.find(v => v.name.includes('Stephanie') && v.lang.startsWith('en-GB'))
      || voices.find(v => v.name.includes('Fiona') && v.lang.startsWith('en'))
    
    // Tier 2: Chrome/Android British female
      || voices.find(v => v.name.includes('Google UK English Female'))
    
    // Tier 3: Windows British female  
      || voices.find(v => v.name.includes('Hazel') && v.lang.startsWith('en'))
      || voices.find(v => v.name.includes('Susan') && v.lang.startsWith('en-GB'))
      || voices.find(v => v.name.includes('Libby') && v.lang.startsWith('en-GB'))
    
    // Tier 4: ANY en-GB voice that is NOT male
      || voices.find(v => v.lang === 'en-GB' && isFemale(v))
    
    // Tier 5: Australian/NZ female (still sounds sharp, not American)
      || voices.find(v => v.lang === 'en-AU' && isFemale(v))
    
    // Tier 6: ANY English female — but NEVER male
      || voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female'))
      || voices.find(v => v.lang.startsWith('en') && isFemale(v) && !v.name.includes('Google US'))
    
    // Tier 7: Samantha (US, but unmistakably female — absolute last resort)
      || voices.find(v => v.name.includes('Samantha'))
    
    // Tier 8: literally any female voice on the device
      || voices.find(v => isFemale(v))
      || voices[0]; // should never reach here
    
    console.log('AURA voice selected:', auraVoice?.name, auraVoice?.lang, '(from', voices.length, 'available)');
    
    // Log all available for debugging
    if (voices.length) {
      console.log('All voices:', voices.map(v => v.name + ' [' + v.lang + ']').join(', '));
    }
  };
  setVoice();
  if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = setVoice;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { console.warn('No speech recognition'); return; }

  voiceRecog = new SR();
  voiceRecog.continuous = false;
  voiceRecog.lang = 'en-US';
  voiceRecog.interimResults = true;
  voiceRecog.maxAlternatives = 1;

  voiceRecog.onresult = e => {
    const transcript = Array.from(e.results).map(r => r[0].transcript).join(' ').trim();
    // Show interim results
    if (!e.results[e.results.length-1].isFinal) {
      setVoiceStatus('listening');
      const cap = document.getElementById('voice-caption');
      if (cap && !panelOpen) { cap.textContent = '🎙 ' + transcript; cap.classList.add('on'); }
    } else {
      processMessage(transcript);
    }
  };

  voiceRecog.onerror = e => {
    stopVoice();
    if (e.error !== 'no-speech' && e.error !== 'aborted') {
      showVoiceCaption('Voice error: ' + e.error);
    }
  };
  voiceRecog.onend = () => stopVoice();

  initVoicePanel();
}

// ── ElevenLabs Config ────────────────────────────────────────
const ELEVEN_VOICE_ID = 'pFZP5JQG7iQjIQuC4Bku'; // Lily — British, Velvety Actress
const ELEVEN_MODEL = 'eleven_flash_v2_5'; // fastest for real-time
let elevenApiKey = 'sk_9600284caed4840f2a32df2c73288f5a5612f9fe874a8e59';
let elevenAudio = null;
let elevenQueue = [];
let elevenSpeaking = false;

function auraSpeak(text, priority) {
  if (!text) return;
  
  // If we have an ElevenLabs key, use it
  if (elevenApiKey) {
    if (priority) {
      // Cancel current
      if (elevenAudio) { elevenAudio.pause(); elevenAudio = null; }
      elevenQueue = [];
      elevenSpeaking = false;
      synth.cancel(); // also kill any browser TTS
    }
    elevenQueue.push(text);
    if (!elevenSpeaking) processElevenQueue();
  } else {
    // Fallback to browser TTS
    auraSpeakBrowser(text, priority);
  }
  
  // Show caption regardless
  if (!panelOpen) {
    showVoiceCaption('AURA: ' + text);
    setTimeout(() => {
      const cap = document.getElementById('voice-caption');
      if (cap && cap.textContent === 'AURA: ' + text) cap.classList.remove('on');
    }, Math.max(3000, text.length * 55));
  }
}

async function processElevenQueue() {
  if (elevenSpeaking || !elevenQueue.length) return;
  elevenSpeaking = true;
  const text = elevenQueue.shift();
  
  setVoiceStatus('speaking');
  
  try {
    const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}`, {
      method: 'POST',
      headers: {
        'xi-api-key': elevenApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        model_id: ELEVEN_MODEL,
        voice_settings: {
          stability: 0.55,        // some variation — not robotic
          similarity_boost: 0.78, // stay close to Lily's core sound
          style: 0.30,            // subtle expressiveness
          use_speaker_boost: true
        }
      })
    });
    
    if (!resp.ok) {
      console.warn('ElevenLabs error:', resp.status);
      // Fall back to browser TTS for this line
      auraSpeakBrowser(text, true);
      elevenSpeaking = false;
      processElevenQueue();
      return;
    }
    
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    elevenAudio = new Audio(url);
    elevenAudio.onended = () => {
      URL.revokeObjectURL(url);
      elevenAudio = null;
      elevenSpeaking = false;
      setVoiceStatus('');
      processElevenQueue(); // next in queue
    };
    elevenAudio.onerror = () => {
      elevenSpeaking = false;
      setVoiceStatus('');
      processElevenQueue();
    };
    elevenAudio.play().catch(() => {
      // Autoplay blocked — fall back
      auraSpeakBrowser(text, true);
      elevenSpeaking = false;
      processElevenQueue();
    });
    
  } catch(e) {
    console.warn('ElevenLabs fetch failed:', e);
    auraSpeakBrowser(text, true);
    elevenSpeaking = false;
    processElevenQueue();
  }
}

// Browser TTS fallback (uses the best available British female voice)
function auraSpeakBrowser(text, priority) {
  if (!synth) return;
  if (priority) synth.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.voice = auraVoice;
  utt.rate = 0.94;
  utt.pitch = 0.92;
  utt.volume = 0.85;
  utt.onstart = () => setVoiceStatus('speaking');
  utt.onend = () => setVoiceStatus('');
  synth.speak(utt);
}

function showVoiceCaption(text) {
  const el = document.getElementById('voice-caption');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('on', !!text);
}

function toggleVoice() {
  if (!voiceRecog) {
    auraSpeak('Voice recognition is not supported in this browser. You can type instead.', true);
    openVoicePanel();
    return;
  }
  if (voiceActive) stopVoice();
  else startVoice();
}

function startVoice() {
  if (!audioCtx) initAudio();
  voiceActive = true;
  document.getElementById('voice-ring').classList.add('listening');
  setVoiceStatus('listening');
  playTone(660, 0.06, 0.12);
  try { voiceRecog.start(); } catch(e) { stopVoice(); }
}

function stopVoice() {
  voiceActive = false;
  document.getElementById('voice-ring').classList.remove('listening');
  if (!isThinking) setVoiceStatus('');
  try { voiceRecog.stop(); } catch(e) {}
}

// ═══════════════════════════════════════════════════════════════
// PROACTIVE ALERTS — AURA speaks up on its own when relevant
// ═══════════════════════════════════════════════════════════════
function checkProactiveAlerts() {
  const now = Date.now();
  
  // Speed warning — over limit by 10+
  if (trafficData?.speedLimitMph && speedMph > trafficData.speedLimitMph + 10 && now - lastSpeedAlert > 30000) {
    lastSpeedAlert = now;
    const over = Math.round(speedMph - trafficData.speedLimitMph);
    const road = trafficData.roadName || 'this road';
    const quips = [
      'You\'re a touch keen. ' + over + ' over on ' + road + '.',
      'Bit fast, that. ' + over + ' over the limit here.',
      'Might want to ease off. ' + over + ' over on ' + road + '.',
    ];
    auraSpeak(quips[Math.floor(Math.random() * quips.length)], true);
    addMessage('system', '⚠️ Speed: +' + over + ' mph over limit');
    if (panelOpen) addMessage('ai', 'You\'re doing ' + Math.round(speedMph) + ' in a ' + trafficData.speedLimitMph + ' zone. Just saying.');
  }
  
  // New incident alert
  if (incidents.length && now - lastProactiveAlert > 60000) {
    const close = incidents.filter(i => hav(uLat,uLon,i.lat,i.lon) < 500);
    if (close.length) {
      lastProactiveAlert = now;
      const nearest = close[0];
      const dist = hav(uLat,uLon,nearest.lat,nearest.lon);
      auraSpeak('Bit of a situation up ahead. ' + nearest.type.toLowerCase() + ', about ' + dist + ' metres.', true);
      if (panelOpen) addMessage('ai', nearest.type + ' at ' + (nearest.address || 'nearby') + '. Roughly ' + dist + ' metres from you. Worth keeping an eye on.');
    }
  }
  
  // Approaching a notable place (within 50m)
  const veryClose = places.filter(p => p.dist < 50 && !p._announced && (p.cat !== 'TRAFFIC'));
  if (veryClose.length && now - lastProactiveAlert > 20000) {
    const p = veryClose[0];
    p._announced = true;
    lastProactiveAlert = now;
    auraSpeak('That\'s ' + p.name + ' just there, by the way.', false);
  }
}
