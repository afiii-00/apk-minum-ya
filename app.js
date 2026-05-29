// ═══════════════════════════════════════════════════════════════
// minum ya... — app.js
// ═══════════════════════════════════════════════════════════════

const STORAGE_KEY = 'minum_ya_v1';
const HISTORY_KEY = 'minum_ya_hist_v1';

const DEFAULT_STATE = {
  setup_done: false,
  target_ml: 2000,
  glass_ml: 250,
  reminder_interval: 60,   // minutes
  operating_hours: {
    enabled: false,
    start: '07:00',
    end: '22:00'
  },
  today: {
    date: '',
    drank_ml: 0,
    glasses: 0
  },
  timer: {
    running: false,
    last_reset: null        // Date.now() timestamp
  },
  install_dismissed: false
};

let state = {};
let timerInterval = null;
let deferredInstallPrompt = null;
let audioCtx = null;

// Setup wizard temp
let setupTargetMl = 2000;
let setupGlassMl  = 250;
let currentStep   = 0;

// ────────────────────────────────────────────────────────────
// STORAGE
// ────────────────────────────────────────────────────────────

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = Object.assign({}, DEFAULT_STATE, parsed);
      state.operating_hours = Object.assign({}, DEFAULT_STATE.operating_hours, parsed.operating_hours);
      state.today           = Object.assign({}, DEFAULT_STATE.today,           parsed.today);
      state.timer           = Object.assign({}, DEFAULT_STATE.timer,           parsed.timer);
    } else {
      state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  } catch (_) {
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch (_) { return []; }
}

function saveHistory(h) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch (_) {}
}

// ────────────────────────────────────────────────────────────
// DATE HELPERS
// ────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function checkDailyReset() {
  const today = todayStr();
  if (state.today.date && state.today.date !== today) {
    // Archive previous day if it had data
    if (state.today.drank_ml > 0) {
      const hist = getHistory();
      const entry = {
        date: state.today.date,
        drank_ml: state.today.drank_ml,
        target_ml: state.target_ml,
        glasses: state.today.glasses
      };
      const idx = hist.findIndex(h => h.date === state.today.date);
      if (idx >= 0) hist[idx] = entry; else hist.unshift(entry);
      saveHistory(hist.slice(0, 60));
    }
    state.today = { date: today, drank_ml: 0, glasses: 0 };
    saveState();
  } else if (!state.today.date) {
    state.today.date = today;
    saveState();
  }
}

// ────────────────────────────────────────────────────────────
// SETUP WIZARD
// ────────────────────────────────────────────────────────────

function nextStep() {
  if (currentStep === 1 && !setupTargetMl) { showToast('Pilih atau masukkan target dulu 😊'); return; }
  if (currentStep === 2 && !setupGlassMl)  { showToast('Pilih atau masukkan ukuran gelas dulu 😊'); return; }
  hide(`step-${currentStep}`);
  currentStep++;
  show(`step-${currentStep}`);
  updateStepDots();
}

function prevStep() {
  hide(`step-${currentStep}`);
  currentStep--;
  show(`step-${currentStep}`);
  updateStepDots();
}

function updateStepDots() {
  for (let i = 0; i < 3; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (!dot) continue;
    i === currentStep ? dot.classList.add('active') : dot.classList.remove('active');
  }
}

function setTargetPreset(ml) {
  setupTargetMl = ml;
  document.querySelectorAll('#step-1 .preset-btn').forEach(b => {
    parseInt(b.dataset.ml) === ml ? b.classList.add('active-preset') : b.classList.remove('active-preset');
  });
  const inp = document.getElementById('custom-target');
  if (inp) inp.value = '';
}

function setCustomTarget(val) {
  const ml = parseInt(val);
  if (ml >= 500 && ml <= 5000) {
    setupTargetMl = ml;
    document.querySelectorAll('#step-1 .preset-btn').forEach(b => b.classList.remove('active-preset'));
  }
}

function setGlassPreset(ml) {
  setupGlassMl = ml;
  document.querySelectorAll('#step-2 .preset-btn').forEach(b => {
    parseInt(b.dataset.ml) === ml ? b.classList.add('active-preset') : b.classList.remove('active-preset');
  });
  const inp = document.getElementById('custom-glass');
  if (inp) inp.value = '';
}

function setCustomGlass(val) {
  const ml = parseInt(val);
  if (ml >= 50 && ml <= 2000) {
    setupGlassMl = ml;
    document.querySelectorAll('#step-2 .preset-btn').forEach(b => b.classList.remove('active-preset'));
  }
}

async function finishSetup() {
  state.target_ml          = setupTargetMl || 2000;
  state.glass_ml           = setupGlassMl  || 250;
  state.setup_done         = true;
  state.timer.running      = true;
  state.timer.last_reset   = Date.now();

  checkDailyReset();
  saveState();

  // Request notification permission
  if ('Notification' in window) {
    try { await Notification.requestPermission(); } catch (_) {}
  }

  document.getElementById('bottom-nav').classList.remove('hidden');
  showView('main');
  startTimer();
}

// ────────────────────────────────────────────────────────────
// VIEWS
// ────────────────────────────────────────────────────────────

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`${name}-view`).classList.add('active');

  ['main','history','settings'].forEach(v => {
    const btn = document.getElementById(`nav-${v}`);
    if (!btn) return;
    const lbl = btn.querySelector('.text-xs');
    if (!lbl) return;
    if (v === name) { lbl.classList.remove('text-slate-400'); lbl.classList.add('text-sky-500'); }
    else            { lbl.classList.add('text-slate-400');    lbl.classList.remove('text-sky-500'); }
  });

  if (name === 'history')  renderHistory();
  if (name === 'settings') renderSettings();
}

// ────────────────────────────────────────────────────────────
// TIMER (timestamp-based — robust to tab backgrounding)
// ────────────────────────────────────────────────────────────

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(tickTimer, 1000);
  updateTimerUI();
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

function tickTimer() {
  if (!state.timer.running || !state.timer.last_reset) return;
  const elapsed    = Date.now() - state.timer.last_reset;
  const intervalMs = state.reminder_interval * 60 * 1000;
  if (elapsed >= intervalMs) {
    triggerReminder();
    state.timer.last_reset = Date.now();
    saveState();
  }
  updateTimerUI();
}

function updateTimerUI() {
  const display    = document.getElementById('timer-display');
  const intDisplay = document.getElementById('interval-display');
  const intValue   = document.getElementById('interval-value');

  if (intDisplay) intDisplay.textContent = state.reminder_interval;
  if (intValue)   intValue.textContent   = state.reminder_interval;

  if (!display) return;

  if (!state.timer.running || !state.timer.last_reset) {
    display.textContent = '⏸️';
    display.classList.remove('timer-urgent');
    return;
  }

  const elapsed    = Date.now() - state.timer.last_reset;
  const intervalMs = state.reminder_interval * 60 * 1000;
  const remaining  = Math.max(0, intervalMs - elapsed);

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  display.textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;

  if (remaining < 120000 && remaining > 0) display.classList.add('timer-urgent');
  else display.classList.remove('timer-urgent');
}

function toggleTimer() {
  if (state.timer.running) {
    state.timer.running    = false;
    state.timer.last_reset = null;
    stopTimer();
  } else {
    state.timer.running    = true;
    state.timer.last_reset = Date.now();
    startTimer();
  }
  saveState();
  updateTimerToggleUI();
  updateTimerUI();
}

function updateTimerToggleUI() {
  const btn   = document.getElementById('timer-toggle-btn');
  const knob  = document.getElementById('timer-toggle-knob');
  const label = document.getElementById('timer-status-label');
  if (!btn) return;

  if (state.timer.running) {
    btn.classList.remove('bg-slate-200'); btn.classList.add('bg-sky-500');
    btn.setAttribute('aria-checked','true');
    if (knob)  knob.style.left = '22px';
    if (label) label.textContent = 'Aktif';
  } else {
    btn.classList.add('bg-slate-200'); btn.classList.remove('bg-sky-500');
    btn.setAttribute('aria-checked','false');
    if (knob)  knob.style.left = '4px';
    if (label) label.textContent = 'Mati';
  }
}

function resetTimerManual() {
  if (state.timer.running) {
    state.timer.last_reset = Date.now();
    saveState();
    showToast('Timer direset! ⏱️');
  } else {
    showToast('Timer sedang dimatikan');
  }
}

function adjustInterval(delta) {
  state.reminder_interval = Math.max(5, Math.min(480, state.reminder_interval + delta));
  if (state.timer.running) state.timer.last_reset = Date.now();
  saveState();
  updateTimerUI();
}

// ────────────────────────────────────────────────────────────
// REMINDER
// ────────────────────────────────────────────────────────────

function isWithinOperatingHours() {
  if (!state.operating_hours.enabled) return true;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = state.operating_hours.start.split(':').map(Number);
  const [eh, em] = state.operating_hours.end.split(':').map(Number);
  return cur >= sh * 60 + sm && cur <= eh * 60 + em;
}

function triggerReminder() {
  if (!isWithinOperatingHours()) return;
  playReminderSound();
  sendNotification();
}

function sendNotification() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const msgs = [
    'Waktunya minum! Jaga tubuhmu tetap seger 💧',
    'Hey! Udah minum belum? Yuk minum sekarang! 🌊',
    'Badanmu butuh air nih! Minum yuk~ 💦',
    'Minum air dulu sebelum lanjut aktivitas! 💧',
    'Sayang banget kalau dehidrasi! Minum sekarang 🥤',
    'Ayo semangat! Satu gelas lagi dulu 💪'
  ];
  try {
    new Notification('minum ya... 💧', {
      body: msgs[Math.floor(Math.random() * msgs.length)],
      icon: 'icon-192.png',
      tag: 'water-reminder',
      renotify: true
    });
  } catch (_) {}
}

// ────────────────────────────────────────────────────────────
// SOUND (Web Audio API — no external files needed)
// ────────────────────────────────────────────────────────────

function getAudioCtx() {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playDrinkSound() {
  try {
    const ctx  = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch (_) {}
}

function playReminderSound() {
  try {
    const ctx = getAudioCtx();
    // Pleasant ascending arpeggio: C5 → E5 → G5
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);

      const t = ctx.currentTime + i * 0.16;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.65);

      osc.start(t);
      osc.stop(t + 0.65);
    });
  } catch (_) {}
}

// ────────────────────────────────────────────────────────────
// DRINKING
// ────────────────────────────────────────────────────────────

function drinkGlass() {
  state.today.drank_ml += state.glass_ml;
  state.today.glasses  += 1;
  saveState();
  archiveTodayToHistory();

  playDrinkSound();
  animateDrinkBtn();
  updateMainDisplay();

  // First time reaching target
  if (state.today.drank_ml >= state.target_ml &&
      state.today.drank_ml - state.glass_ml < state.target_ml) {
    setTimeout(() => showToast('🎉 Target tercapai! Keren banget!'), 350);
  }
}

function undoDrink() {
  if (state.today.glasses <= 0) { showToast('Belum ada yang dicatat nih 😊'); return; }
  state.today.drank_ml = Math.max(0, state.today.drank_ml - state.glass_ml);
  state.today.glasses  = Math.max(0, state.today.glasses  - 1);
  saveState();
  archiveTodayToHistory();
  updateMainDisplay();
  showToast('Dibatalkan ↩️');
}

function archiveTodayToHistory() {
  const hist  = getHistory();
  const today = todayStr();
  const entry = { date: today, drank_ml: state.today.drank_ml, target_ml: state.target_ml, glasses: state.today.glasses };
  const idx   = hist.findIndex(h => h.date === today);
  if (idx >= 0) hist[idx] = entry; else hist.unshift(entry);
  saveHistory(hist.slice(0, 60));
}

// ────────────────────────────────────────────────────────────
// DISPLAY
// ────────────────────────────────────────────────────────────

function updateMainDisplay() {
  const pct         = Math.min(1, state.today.drank_ml / Math.max(1, state.target_ml));
  const totalGlasses = Math.ceil(state.target_ml / state.glass_ml);

  setText('drank-ml-display',    state.today.drank_ml);
  setText('target-ml-display',   state.target_ml);
  setText('glass-ml-label',      state.glass_ml);
  setText('glasses-status-text', `${state.today.glasses} dari ${totalGlasses} gelas hari ini`);

  const bar = document.getElementById('progress-bar');
  if (bar) bar.style.width = `${Math.min(100, pct * 100)}%`;

  const wrap = document.getElementById('progress-bar-wrap');
  if (wrap) wrap.setAttribute('aria-valuenow', Math.round(pct * 100));

  updateGlassAnimation(pct);

  // Completion banner
  const msg = document.getElementById('completion-msg');
  if (msg) {
    if (state.today.drank_ml >= state.target_ml) {
      if (msg.classList.contains('hidden')) {
        msg.classList.remove('hidden');
        msg.classList.add('bounce-in');
        setTimeout(() => msg.classList.remove('bounce-in'), 600);
      }
    } else {
      msg.classList.add('hidden');
    }
  }
}

// Glass water level: SVG glass area y=10..y=148 (138px)
// wave-group translateY: 148 (empty) → 10 (full)
function updateGlassAnimation(percent) {
  const pct        = Math.min(1, Math.max(0, percent));
  const translateY = 148 - 138 * pct;          // 148 = empty, 10 = full

  const wg = document.getElementById('wave-group');
  if (wg) wg.style.transform = `translateY(${translateY}px)`;

  // Percent label (show when > 8% filled)
  const lbl = document.getElementById('percent-label');
  if (lbl) {
    if (pct > 0.08) {
      lbl.textContent  = `${Math.round(pct * 100)}%`;
      lbl.style.opacity = '1';
    } else {
      lbl.style.opacity = '0';
    }
  }
}

function animateDrinkBtn() {
  const btn = document.getElementById('drink-btn');
  const svg = document.getElementById('water-glass-svg');
  [btn, svg].forEach(el => {
    if (!el) return;
    el.classList.remove('celebrate-anim');
    void el.offsetWidth; // reflow
    el.classList.add('celebrate-anim');
    setTimeout(() => el.classList.remove('celebrate-anim'), 1000);
  });
}

// ────────────────────────────────────────────────────────────
// GREETING
// ────────────────────────────────────────────────────────────

function updateGreeting() {
  const h = new Date().getHours();
  const g = h >= 5 && h < 12 ? 'Selamat pagi! ☀️'
          : h >= 12 && h < 15 ? 'Selamat siang! 🌤️'
          : h >= 15 && h < 19 ? 'Selamat sore! 🌅'
          : 'Selamat malam! 🌙';
  setText('greeting-text', g);
}

// ────────────────────────────────────────────────────────────
// HISTORY
// ────────────────────────────────────────────────────────────

function getLast7Days() {
  const hist  = getHistory();
  const today = todayStr();
  const days  = [];

  for (let i = 6; i >= 0; i--) {
    const d  = new Date();
    d.setDate(d.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    if (ds === today) {
      days.push({ date: ds, drank_ml: state.today.drank_ml, target_ml: state.target_ml, glasses: state.today.glasses });
    } else {
      const found = hist.find(h => h.date === ds);
      days.push(found || { date: ds, drank_ml: 0, target_ml: state.target_ml, glasses: 0 });
    }
  }
  return days;
}

function renderHistory() {
  const days    = getLast7Days();
  const today   = todayStr();
  const DAY_NAMES = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  const maxMl   = Math.max(...days.map(d => d.drank_ml), state.target_ml, 100);

  // ── Chart bars ──
  const chartEl = document.getElementById('history-chart');
  if (chartEl) {
    chartEl.innerHTML = days.map(day => {
      const pct     = day.drank_ml / maxMl;
      const h       = Math.max(4, Math.round(pct * 128));
      const reached = day.drank_ml > 0 && day.drank_ml >= day.target_ml;
      const isToday = day.date === today;
      const color   = reached ? 'bg-emerald-400' : (isToday ? 'bg-sky-400' : 'bg-sky-200');
      const liters  = day.drank_ml >= 100 ? (Math.round(day.drank_ml / 100) / 10) + 'L' : '';

      return `<div class="flex-1 flex flex-col items-center gap-1" role="presentation">
        <span class="text-xs text-slate-400 font-semibold">${liters}</span>
        <div class="w-full flex items-end justify-center">
          <div class="w-full rounded-t-lg h-bar ${color}" style="height:${h}px"
               title="${day.drank_ml} mL"></div>
        </div>
      </div>`;
    }).join('');
  }

  // ── Day labels ──
  const daysEl = document.getElementById('history-days');
  if (daysEl) {
    daysEl.innerHTML = days.map(day => {
      const d    = new Date(day.date + 'T12:00:00');
      const name = DAY_NAMES[d.getDay()];
      const cls  = day.date === today ? 'text-sky-500' : 'text-slate-400';
      return `<div class="flex-1 text-center text-xs font-bold ${cls}">${name}</div>`;
    }).join('');
  }

  // ── Stats ──
  const withData    = days.filter(d => d.drank_ml > 0);
  const avg         = withData.length > 0 ? Math.round(withData.reduce((s,d) => s + d.drank_ml, 0) / withData.length) : 0;
  const targetDays  = days.filter(d => d.drank_ml > 0 && d.drank_ml >= d.target_ml).length;
  const best        = days.reduce((m,d) => Math.max(m, d.drank_ml), 0);

  setText('stat-avg',         avg  > 0 ? `${avg} mL`  : '-- mL');
  setText('stat-target-days', `${targetDays}/7`);
  setText('stat-best',        best > 0 ? `${best} mL` : '-- mL');
  setText('stat-streak',      calculateStreak());

  // ── Daily list (newest first) ──
  const listEl = document.getElementById('history-list');
  if (listEl) {
    listEl.innerHTML = days.slice().reverse().map(day => {
      const reached = day.drank_ml > 0 && day.drank_ml >= day.target_ml;
      const pct     = day.target_ml > 0 ? Math.min(100, Math.round(day.drank_ml / day.target_ml * 100)) : 0;
      const d       = new Date(day.date + 'T12:00:00');
      const isToday = day.date === today;
      const label   = isToday
        ? 'Hari Ini'
        : d.toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'short' });
      const barColor = reached ? 'bg-emerald-400' : 'bg-sky-400';
      const icon     = reached ? '✅' : '💧';

      return `<div class="bg-white/80 rounded-2xl p-4 shadow-sm border border-sky-50">
        <div class="flex items-center justify-between mb-2">
          <span class="font-bold text-slate-700 text-sm">${label}</span>
          <span class="font-black text-sm ${reached ? 'text-emerald-500' : 'text-slate-500'}">
            ${icon} ${day.drank_ml} / ${day.target_ml} mL
          </span>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <div class="h-2 rounded-full ${barColor}" style="width:${pct}%"></div>
        </div>
        <p class="text-xs text-slate-400 mt-1.5">${pct}% dari target · ${day.glasses || 0} gelas</p>
      </div>`;
    }).join('');
  }
}

function calculateStreak() {
  const hist  = getHistory();
  let streak  = 0;

  // Check today
  if (state.today.drank_ml >= state.target_ml) streak++;

  for (let i = 1; i <= 60; i++) {
    const d  = new Date();
    d.setDate(d.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const f  = hist.find(h => h.date === ds);
    if (f && f.drank_ml >= f.target_ml) streak++;
    else break;
  }
  return streak;
}

// ────────────────────────────────────────────────────────────
// SETTINGS
// ────────────────────────────────────────────────────────────

function renderSettings() {
  setInputVal('settings-target-ml',  state.target_ml);
  setInputVal('settings-glass-ml',   state.glass_ml);
  setInputVal('settings-interval',   state.reminder_interval);
  setInputVal('settings-start-time', state.operating_hours.start);
  setInputVal('settings-end-time',   state.operating_hours.end);
  updateOpHoursUI();
  updateNotifStatusUI();
}

function toggleOperatingHours() {
  state.operating_hours.enabled = !state.operating_hours.enabled;
  saveState();
  updateOpHoursUI();
}

function updateOpHoursUI() {
  const btn    = document.getElementById('op-hours-toggle-btn');
  const knob   = document.getElementById('op-hours-knob');
  const inputs = document.getElementById('op-hours-inputs');
  const on     = state.operating_hours.enabled;

  if (btn) {
    on ? btn.classList.replace('bg-slate-200','bg-sky-500') : btn.classList.replace('bg-sky-500','bg-slate-200');
    btn.setAttribute('aria-checked', String(on));
  }
  if (knob)   knob.style.left = on ? '28px' : '4px';
  if (inputs) {
    on ? inputs.classList.remove('opacity-40','pointer-events-none')
       : inputs.classList.add('opacity-40','pointer-events-none');
  }
}

function updateNotifStatusUI() {
  const txt = document.getElementById('notif-status-text');
  const btn = document.getElementById('req-notif-btn');
  if (!('Notification' in window)) {
    if (txt) txt.textContent = '❌ Browser tidak mendukung notifikasi';
    return;
  }
  const perm = Notification.permission;
  if (perm === 'granted') {
    if (txt) txt.textContent = '✅ Notifikasi aktif';
    if (btn) btn.classList.add('hidden');
  } else if (perm === 'denied') {
    if (txt) txt.textContent = '❌ Ditolak — aktifkan di pengaturan browser';
    if (btn) btn.classList.add('hidden');
  } else {
    if (txt) txt.textContent = '⚠️ Belum diaktifkan';
    if (btn) btn.classList.remove('hidden');
  }
}

function saveSettings() {
  const t  = parseInt(document.getElementById('settings-target-ml')?.value);
  const g  = parseInt(document.getElementById('settings-glass-ml')?.value);
  const iv = parseInt(document.getElementById('settings-interval')?.value);
  const st = document.getElementById('settings-start-time')?.value;
  const et = document.getElementById('settings-end-time')?.value;

  if (t  >= 500  && t  <= 5000) state.target_ml = t;
  if (g  >= 50   && g  <= 2000) state.glass_ml  = g;
  if (iv >= 5    && iv <= 480)  {
    state.reminder_interval = iv;
    if (state.timer.running) state.timer.last_reset = Date.now();
  }
  if (st) state.operating_hours.start = st;
  if (et) state.operating_hours.end   = et;

  saveState();
  updateMainDisplay();
  showToast('Pengaturan tersimpan! ✅');
  showView('main');
}

function confirmResetToday() {
  if (!confirm('Yakin mau reset catatan hari ini?')) return;
  state.today.drank_ml = 0;
  state.today.glasses  = 0;
  saveState();
  archiveTodayToHistory();
  updateMainDisplay();
  showToast('Reset! Yuk mulai dari awal 💪');
  showView('main');
}

// ────────────────────────────────────────────────────────────
// NOTIFICATION PERMISSION
// ────────────────────────────────────────────────────────────

async function requestNotificationPermission() {
  if (!('Notification' in window)) { showToast('Browser ini tidak mendukung notifikasi 😢'); return; }
  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      showToast('Notifikasi aktif! 🎉');
      checkNotifBanner();
    } else {
      showToast('Ditolak 😢 Aktifkan manual di pengaturan browser ya');
    }
    updateNotifStatusUI();
  } catch (_) {}
}

function checkNotifBanner() {
  const banner = document.getElementById('notif-banner');
  if (!banner) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

// ────────────────────────────────────────────────────────────
// PWA INSTALL
// ────────────────────────────────────────────────────────────

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (!state.install_dismissed) {
    setTimeout(() => {
      const b = document.getElementById('install-banner');
      if (b) b.classList.remove('hidden');
    }, 4000);
  }
});

window.addEventListener('appinstalled', () => {
  const b = document.getElementById('install-banner');
  if (b) b.classList.add('hidden');
  showToast('App berhasil dipasang! 🎉');
  deferredInstallPrompt = null;
});

function installPWA() {
  if (!deferredInstallPrompt) { showToast('Install tidak tersedia saat ini'); return; }
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.then(r => {
    if (r.outcome === 'accepted') showToast('Dipasang! 🎉');
    const b = document.getElementById('install-banner');
    if (b) b.classList.add('hidden');
    deferredInstallPrompt = null;
  });
}

function dismissInstall() {
  state.install_dismissed = true;
  saveState();
  const b = document.getElementById('install-banner');
  if (b) b.classList.add('hidden');
}

// ────────────────────────────────────────────────────────────
// TOAST
// ────────────────────────────────────────────────────────────

let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  if (!toast || !msgEl) return;
  msgEl.textContent = msg;
  toast.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 2600);
}

// ────────────────────────────────────────────────────────────
// VISIBILITY CHANGE — handle tab coming back from background
// ────────────────────────────────────────────────────────────

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && state.setup_done) {
    checkDailyReset();
    updateMainDisplay();
    updateGreeting();

    if (state.timer.running && state.timer.last_reset) {
      const elapsed    = Date.now() - state.timer.last_reset;
      const intervalMs = state.reminder_interval * 60 * 1000;
      if (elapsed >= intervalMs) {
        triggerReminder();
        state.timer.last_reset = Date.now();
        saveState();
      }
    }
    updateTimerUI();
  }
});

// ────────────────────────────────────────────────────────────
// UTILITY
// ────────────────────────────────────────────────────────────

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function setInputVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}
function show(id) { const el = document.getElementById(id); if (el) el.classList.remove('hidden'); }
function hide(id) { const el = document.getElementById(id); if (el) el.classList.add('hidden'); }

// ────────────────────────────────────────────────────────────
// INIT
// ────────────────────────────────────────────────────────────

function init() {
  loadState();

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  if (state.setup_done) {
    checkDailyReset();
    document.getElementById('bottom-nav').classList.remove('hidden');
    showView('main');
    updateMainDisplay();
    updateGreeting();
    updateTimerToggleUI();
    checkNotifBanner();

    if (state.timer.running) {
      // Catch up on any missed reminders while the tab was closed
      if (state.timer.last_reset) {
        const elapsed    = Date.now() - state.timer.last_reset;
        const intervalMs = state.reminder_interval * 60 * 1000;
        if (elapsed >= intervalMs) {
          triggerReminder();
          state.timer.last_reset = Date.now();
          saveState();
        }
      } else {
        state.timer.last_reset = Date.now();
        saveState();
      }
      startTimer();
    } else {
      updateTimerUI();
    }
  } else {
    // Fresh install → show setup
    setupTargetMl = 2000;
    setupGlassMl  = 250;
    currentStep   = 0;
    document.getElementById('setup-view').classList.add('active');
  }

  // Refresh greeting every minute
  setInterval(updateGreeting, 60000);
}

document.addEventListener('DOMContentLoaded', init);
