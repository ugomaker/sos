/* ============================================================
   SOS Urgence — app.js
   ============================================================ */

// ============================================================
// VARIABLES GLOBALES
// ============================================================
let isSoignant = false;
let previousScreen = null;
let beatCount = 0;
let metroTimer = null;
let metroOn = false;
let autoSwipeTimer = null;
let carouselIdx = 0;
let audioCtx = null;
let mapDone = false;
let defiMap = null;
let daeIdx = 0;
let daeAutoTimer = null;
const BPM = 110;
const BEAT_MS = Math.round(60000 / BPM);
const INSUF_DURATION = 1600;
const DAE_SLIDES = 6;

// ============================================================
// NAVIGATION
// ============================================================
var plsTimerInterval = null;
var plsAudioCtx = null;

function startPlsTimer() {
  if (plsTimerInterval) clearInterval(plsTimerInterval);
  plsTimerInterval = setInterval(function() {
    // Bip d'alerte
    try {
      plsAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      for (var i = 0; i < 3; i++) {
        (function(delay) {
          var osc = plsAudioCtx.createOscillator();
          var gain = plsAudioCtx.createGain();
          osc.connect(gain); gain.connect(plsAudioCtx.destination);
          osc.frequency.value = 880;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.5, plsAudioCtx.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, plsAudioCtx.currentTime + delay + 0.3);
          osc.start(plsAudioCtx.currentTime + delay);
          osc.stop(plsAudioCtx.currentTime + delay + 0.3);
        })(i * 0.4);
      }
    } catch(e) {}
    // Vibration
    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
    // Afficher la bannière
    var rem = document.getElementById('pls-reminder');
    if (rem) rem.style.display = 'block';
  }, 120000); // 2 minutes
}

function stopPlsTimer() {
  if (plsTimerInterval) { clearInterval(plsTimerInterval); plsTimerInterval = null; }
  clearPlsReminder();
}

function clearPlsReminder() {
  var rem = document.getElementById('pls-reminder');
  if (rem) rem.style.display = 'none';
}

function go(id) {
  var current = document.querySelector('.screen.active');
  if (current) previousScreen = current.id;
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
  // Afficher la barre du bas uniquement sur l'écran d'accueil
  var bar = document.getElementById('bottom-bar');
  if (bar) bar.style.display = (id === 's-welcome') ? 'flex' : 'none';
  // Timer PLS
  if (id === 's-pls') { startPlsTimer(); } else { stopPlsTimer(); }
  attachHandlers();
}
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ============================================================
// DISPATCHER
// ============================================================
function attachHandlers() {
  // Un seul listener sur le document, évite les doublons et stopPropagation
  if (attachHandlers._done) return;
  attachHandlers._done = true;
  document.addEventListener('click', function(e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    e.preventDefault();
    var action = el.getAttribute('data-action');
    var target = el.getAttribute('data-target');
    var idx    = el.getAttribute('data-idx');
      switch(action) {
        case 'go':                  go(target); break;
        case 'respireNon':          respireNon(); break;
        case 'startCardiac':        startCardiac(); break;
        case 'retourDepuisCardiac': retourDepuisCardiac(); break;
        case 'goBack': if (previousScreen) go(previousScreen); break;
        case 'activerSoignant':     activerSoignant(); break;
        case 'openDae':             openDae(); break;
        case 'closeDae':            closeDae(); break;
        case 'openModal':           openModal(target); break;
        case 'closeModal':          closeModal(target); break;
        case 'carouselLeft':        carouselMoveManual(-1); break;
        case 'carouselRight':       carouselMoveManual(1); break;
        case 'carouselGo':          carouselGo(parseInt(idx)); break;
        case 'daeLeft':             daeMoveManual(-1); break;
        case 'daeRight':            daeMoveManual(1); break;
        case 'daeGo':               daeGo(parseInt(idx)); break;
      }
  });
}
attachHandlers();

// ============================================================
// MODE SOIGNANT
// ============================================================
function activerSoignant() {
  isSoignant = !isSoignant;
  document.body.classList.toggle('mode-soignant', isSoignant);
  document.querySelectorAll('.btn-soignant').forEach(function(btn) {
    btn.classList.toggle('active', isSoignant);
    var box = btn.querySelector('.check-box');
    if (box) box.textContent = isSoignant ? '\u2713' : '';
  });
  if (isSoignant) {
    var slide = document.getElementById('slide-insufflation');
    if (slide) slide.style.display = 'flex';
    var dots = document.getElementById('carouselDots');
    if (dots && dots.children.length === 3) {
      var d = document.createElement('div');
      d.className = 'cdot'; d.style.background = 'var(--blue)';
      d.setAttribute('data-action', 'carouselGo'); d.setAttribute('data-idx', '3');
      dots.appendChild(d); attachHandlers();
    }
    var mt = document.querySelector('.slide-main-text');
    if (mt) mt.innerHTML = 'COMMENCEZ LE<br>MASSAGE CARDIAQUE<br><span style="font-size:1.4rem;color:var(--blue);">30 : 2</span>';
  } else {
    var slide2 = document.getElementById('slide-insufflation');
    if (slide2) slide2.style.display = 'none';
    var mt2 = document.querySelector('.slide-main-text');
    if (mt2) mt2.innerHTML = 'COMMENCEZ LE<br>MASSAGE CARDIAQUE';
  }
}

function respireNon() {
  startCardiac();
}

function retourDepuisCardiac() {
  stopMetro(); stopAutoSwipe(); stopChrono();
  go('s-respire');
}

// ============================================================
// CAROUSEL
// ============================================================
function slideCount() { return isSoignant ? 4 : 3; }
function carouselGo(idx) {
  carouselIdx = (idx + slideCount()) % slideCount();
  var track = document.getElementById('carouselTrack');
  if (track) track.style.transform = 'translateX(-' + (carouselIdx * 100) + '%)';
  document.querySelectorAll('.cdot').forEach(function(d, i) { d.classList.toggle('active', i === carouselIdx); });
}
function carouselMove(dir) { carouselGo(carouselIdx + dir); }
function carouselMoveManual(dir) { carouselMove(dir); startAutoSwipe(); }
function startAutoSwipe() { stopAutoSwipe(); autoSwipeTimer = setInterval(function() { carouselMove(1); }, 5000); }
function stopAutoSwipe() { clearInterval(autoSwipeTimer); }
(function() {
  var sx = 0;
  var el = document.getElementById('carousel');
  if (!el) return;
  el.addEventListener('touchstart', function(e) { sx = e.touches[0].clientX; }, {passive:true});
  el.addEventListener('touchend', function(e) { var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) carouselMoveManual(dx < 0 ? 1 : -1); }, {passive:true});
})();

// ============================================================
// SON & FLASH
// ============================================================
function playClick(freq, gain, duration) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  var o = audioCtx.createOscillator(); var g = audioCtx.createGain();
  o.connect(g); g.connect(audioCtx.destination);
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  o.start(); o.stop(audioCtx.currentTime + duration);
}
function flashEl(id, cls, duration) {
  var el = document.getElementById(id);
  if (el) { el.classList.add(cls); setTimeout(function() { el.classList.remove(cls); }, duration); }
}
function flashDae() {
  var daeScr = document.getElementById('dae-screen');
  var daeCar = document.getElementById('daeCarousel');
  if (daeScr && daeScr.classList.contains('open')) {
    daeScr.classList.add('beat-flash'); if (daeCar) daeCar.classList.add('beat-flash');
    setTimeout(function() { daeScr.classList.remove('beat-flash'); if (daeCar) daeCar.classList.remove('beat-flash'); }, 130);
  }
  // Flash modale noyade si ouverte
  var modalNoyade = document.getElementById('modal-noyade');
  if (modalNoyade && modalNoyade.style.display !== 'none') {
    var inner = modalNoyade.querySelector('.modal-inner');
    if (inner) { inner.classList.add('beat-flash'); setTimeout(function() { inner.classList.remove('beat-flash'); }, 130); }
  }
  // Flash carte DAE
  var map = document.getElementById('defi-map2');
  if (map) { map.classList.add('beat-flash'); setTimeout(function() { map.classList.remove('beat-flash'); }, 130); }
}

// ============================================================
// METRONOME
// ============================================================
function beat() {
  if (!isSoignant) {
    playClick(880, 0.55, 0.08);
    flashEl('s-cardiac', 'beat-flash', 130); flashEl('carousel', 'beat-flash', 130); flashDae();
  } else {
    beatCount++;
    if (beatCount <= 30) {
      playClick(880, 0.6, 0.08);
      flashEl('s-cardiac', 'beat-flash', 130); flashEl('carousel', 'beat-flash', 130); flashDae();
      if (beatCount === 30) { clearInterval(metroTimer); metroOn = false; setTimeout(function() { insufflation(1); }, 250); }
    }
  }
}
function insufflation(n) {
  playClick(440, 0.5, 0.6);
  flashEl('s-cardiac', 'insuf-flash', 500); flashEl('carousel', 'insuf-flash', 500);
  if (n < 2) { setTimeout(function() { insufflation(n + 1); }, INSUF_DURATION); }
  else { setTimeout(function() { beatCount = 0; metroOn = true; beat(); metroTimer = setInterval(beat, BEAT_MS); }, INSUF_DURATION); }
}
function startMetro() { if (metroOn) return; metroOn = true; beat(); metroTimer = setInterval(beat, BEAT_MS); }
function stopMetro() {
  metroOn = false; clearInterval(metroTimer);
  var s = document.getElementById('s-cardiac'); var c = document.getElementById('carousel');
  if (s) s.classList.remove('beat-flash', 'insuf-flash');
  if (c) c.classList.remove('beat-flash', 'insuf-flash');
}


// ============================================================
// CHRONOMETRE + ADRESSE GPS
// ============================================================
let chronoTimer = null;
let chronoSeconds = 0;

function startChrono() {
  chronoSeconds = 0;
  updateChronoDisplay();
  clearInterval(chronoTimer);
  chronoTimer = setInterval(function() {
    chronoSeconds++;
    updateChronoDisplay();
  }, 1000);
  fetchAddress();
}

function stopChrono() {
  clearInterval(chronoTimer);
  chronoSeconds = 0;
  var d = document.getElementById('chrono-display');
  if (d) { d.textContent = '00:00'; d.classList.remove('chrono-alert'); }
  var a = document.getElementById('chrono-addr');
  if (a) a.textContent = '';
}

function updateChronoDisplay() {
  var d = document.getElementById('chrono-display');
  if (!d) return;
  var m = Math.floor(chronoSeconds / 60);
  var s = chronoSeconds % 60;
  d.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  // Alerte jaune après 2 minutes
  // pas d'alerte couleur
}

function fetchAddress() {
  var addr = document.getElementById('chrono-addr');
  if (!addr) return;
  if (!navigator.geolocation) { addr.textContent = 'Position non disponible'; return; }
  navigator.geolocation.getCurrentPosition(function(p) {
    var lat = p.coords.latitude, lng = p.coords.longitude;
    fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&zoom=18&addressdetails=1')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var a = data.address;
        var parts = [];
        if (a.house_number) parts.push(a.house_number);
        if (a.road) parts.push(a.road);
        if (a.city || a.town || a.village) parts.push(a.city || a.town || a.village);
        addr.textContent = parts.join(', ') || data.display_name;
      }).catch(function() { addr.textContent = lat.toFixed(5) + ', ' + lng.toFixed(5); });
  }, function() { addr.textContent = 'Activez la géolocalisation'; });
}

// ============================================================
// ECRAN CARDIAQUE
// ============================================================
function startCardiac() {
  go('s-cardiac'); setTimeout(startMetro, 200); startAutoSwipe();
  if (!mapDone) { mapDone = true; setTimeout(initMap, 300); }
  startChrono();
  attachHandlers();
}

// ============================================================
// CARTE
// ============================================================
function initMap() {
  var st = document.getElementById('map-status2');
  if (!navigator.geolocation) { st.textContent = 'Géolocalisation non disponible.'; buildMap(45.764, 4.835); return; }
  navigator.geolocation.getCurrentPosition(
    function(p) { st.textContent = ''; buildMap(p.coords.latitude, p.coords.longitude); loadDefis(p.coords.latitude, p.coords.longitude); },
    function(err) { st.textContent = 'Activez la géolocalisation (' + err.message + ').'; buildMap(48.857, 2.347); },
    { timeout: 15000, enableHighAccuracy: true, maximumAge: 0 }
  );
}
function buildMap(lat, lng) {
  defiMap = L.map('defi-map2', { zoomControl: true }).setView([lat, lng], 15);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '\u00a9 OSM \u00a9 CARTO', maxZoom: 19
  }).addTo(defiMap);
  L.circleMarker([lat, lng], { color: '#CC1A1A', weight: 3, fillColor: '#CC1A1A', fillOpacity: 1, radius: 8 })
    .addTo(defiMap).bindPopup('Vous êtes ici').openPopup();
  setTimeout(function() { defiMap.invalidateSize(); }, 300);
}
function loadDefis(lat, lng) {
  var st = document.getElementById('map-status2');
  st.textContent = 'Recherche en cours...';
  var q = '[out:json][timeout:20];('
    + 'node["emergency"="defibrillator"](around:1500,' + lat + ',' + lng + ');'
    + 'node["amenity"="hospital"]["emergency"="yes"](around:5000,' + lat + ',' + lng + ');'
    + 'way["amenity"="hospital"]["emergency"="yes"](around:5000,' + lat + ',' + lng + ');'
    + ');out center;';
  fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(q))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var defis = 0;
      var daeIcon = L.divIcon({
        html: '<div style="background:#F6E05E;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;color:#1a1a1a;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);">DAE</div>',
        iconSize: [34, 34], iconAnchor: [17, 17], className: ''
      });
      var hopIcon = L.divIcon({
        html: '<div style="background:#1A4A8A;width:34px;height:34px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:16px;color:#fff;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);">H</div>',
        iconSize: [34, 34], iconAnchor: [17, 17], className: ''
      });
      data.elements.forEach(function(n) {
        var clat = n.lat || (n.center && n.center.lat);
        var clng = n.lon || (n.center && n.center.lon);
        if (!clat || !clng) return;
        var name = (n.tags && (n.tags.name || n.tags.operator)) || '';
        if (n.tags && n.tags.emergency === 'defibrillator') {
          defis++;
          var tags = n.tags || {};
          var popup = '<strong>' + (name || 'Défibrillateur') + '</strong>';
          if (tags.opening_hours) popup += '<br>🕐 ' + tags.opening_hours;
          else if (tags['defibrillator:location']) popup += '<br>📍 ' + tags['defibrillator:location'];
          if (tags.indoor === 'yes') popup += '<br>Intérieur';
          else if (tags.indoor === 'no') popup += '<br>Extérieur';
          if (tags.access) popup += '<br>Accès : ' + tags.access;
          L.marker([clat, clng], { icon: daeIcon }).addTo(defiMap).bindPopup(popup);
        } else if (n.tags && n.tags.amenity === 'hospital') {
          L.marker([clat, clng], { icon: hopIcon }).addTo(defiMap).bindPopup('<strong>' + (name || 'Hôpital') + '</strong>');
        }
      });
      st.textContent = defis ? defis + ' défibrillateur(s) à proximité' : 'Aucun DAE trouvé dans 1,5 km.';
    }).catch(function() { st.textContent = 'Réseau indisponible.'; });
}

// ============================================================
// ECRAN DAE
// ============================================================
function openDae() {
  document.getElementById('dae-screen').classList.add('open');
  daeIdx = 0; daeGo(0);
  daeAutoTimer = setInterval(function() { daeMove(1); }, 4000);
}
function closeDae() { document.getElementById('dae-screen').classList.remove('open', 'beat-flash'); clearInterval(daeAutoTimer); }
function daeMove(dir) { daeGo(daeIdx + dir); }
function daeMoveManual(dir) { daeMove(dir); clearInterval(daeAutoTimer); daeAutoTimer = setInterval(function() { daeMove(1); }, 4000); }
function daeGo(idx) {
  daeIdx = (idx + DAE_SLIDES) % DAE_SLIDES;
  var track = document.getElementById('daeTrack');
  if (track) track.style.transform = 'translateX(-' + (daeIdx * 100) + '%)';
  document.querySelectorAll('.dae-dot').forEach(function(d, i) { d.classList.toggle('active', i === daeIdx); });
}
(function() {
  var sx = 0; var el = document.getElementById('daeCarousel');
  if (!el) return;
  el.addEventListener('touchstart', function(e) { sx = e.touches[0].clientX; }, {passive:true});
  el.addEventListener('touchend', function(e) { var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) daeMoveManual(dx < 0 ? 1 : -1); }, {passive:true});
})();

attachHandlers();

// ============================================================
// MODE NUIT
// ============================================================
function toggleNuit() {
  var isNuit = document.body.classList.toggle('mode-nuit');
  document.getElementById('btn-night').textContent = isNuit ? 'Mode jour' : 'Mode nuit';
  localStorage.setItem('modeNuit', isNuit ? '1' : '0');
}
// Restaurer le mode au chargement
(function() {
  if (localStorage.getItem('modeNuit') === '1') {
    document.body.classList.add('mode-nuit');
    var btn = document.getElementById('btn-night');
    if (btn) btn.textContent = 'Mode jour';
  }
})();



// Service Worker pour PWA offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('sw.js').catch(function() {});
  });
}