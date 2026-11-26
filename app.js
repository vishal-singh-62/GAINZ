/**
 * GAINZ — App Controller (app.js)
 * UI interactions, rendering, progress tracker, step wizard, insights, timer
 */

'use strict';

/* ── Security / rendering helpers ── */
function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  }[ch]));
}

/* Local calendar date as YYYY-MM-DD. Do NOT use toISOString() for this: it is UTC,
   which is a day behind in India between 00:00 and 05:30. */
function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function saveProfile(profile) {
  try { localStorage.setItem('gainz_profile', JSON.stringify(profile)); } catch (_) {}
  window.GAINZ_AUTH?.saveProfile?.(profile);
}

function loadSavedProfile() {
  try { return JSON.parse(localStorage.getItem('gainz_profile') || 'null'); } catch (_) { return null; }
}

/* ══════════════════════════════════════════════════════════
   TAB NAVIGATION
══════════════════════════════════════════════════════════ */
const navLinks    = document.querySelectorAll('.nav-link');
const tabSections = document.querySelectorAll('.tab-section');
const bnavItems   = document.querySelectorAll('.bnav-item');
let currentPlan = null;
let coachHistory = [];
try { coachHistory = JSON.parse(localStorage.getItem('gainz_coach_history') || '[]'); } catch (_) { coachHistory = []; }

function activateTab(id) {
  const current = [...tabSections].find(s => !s.classList.contains('hidden'));
  if (current && current.id !== `tab-${id}`) {
    current.classList.add('tab-exit');
    current.addEventListener('animationend', () => {
      current.classList.add('hidden');
      current.classList.remove('tab-exit');
    }, { once: true });
  }
  const next = document.getElementById(`tab-${id}`);
  if (next) {
    next.classList.remove('hidden');
    void next.offsetWidth;
    next.classList.add('tab-enter');
    next.addEventListener('animationend', () => next.classList.remove('tab-enter'), { once: true });
  }
  navLinks.forEach(l  => l.classList.toggle('active', l.dataset.tab === id));
  bnavItems.forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

navLinks.forEach(l => l.addEventListener('click', e => { e.preventDefault(); activateTab(l.dataset.tab); }));
bnavItems.forEach(b => b.addEventListener('click', () => activateTab(b.dataset.tab)));

const profileBtn = document.getElementById('profile-btn');
if (profileBtn) profileBtn.addEventListener('click', () => { activateTab('planner'); goToStep(1); document.getElementById('name')?.focus(); });

/* ══════════════════════════════════════════════════════════
   STEP WIZARD
══════════════════════════════════════════════════════════ */
let currentStep = 1;
const TOTAL_STEPS = 4;

function goToStep(n) {
  document.querySelectorAll('.form-step').forEach(s => s.classList.add('hidden'));
  document.getElementById(`step-${n}`).classList.remove('hidden');

  document.querySelectorAll('.step-bar .step').forEach(s => {
    const sn = parseInt(s.dataset.step);
    s.classList.toggle('active', sn === n);
    s.classList.toggle('done',   sn < n);
  });
  document.querySelectorAll('.step-bar .step-line').forEach((line, i) => {
    line.classList.toggle('done', i < n - 1);
  });

  currentStep = n;
  if (n === 4) buildReview();
}

function validateStep(n) {
  const ids = {
    1: ['name','age','gender','weight','height','goal'],
    2: ['activity','schedule','equipment'],
    3: ['cuisine','diet_type','budget'],
  };
  const fields = ids[n];
  if (!fields) return true;
  for (const id of fields) {
    const el = document.getElementById(id);
    if (!el || !el.value.trim()) {
      el && el.focus();
      if (el) {
        el.style.borderColor = 'var(--accent-r)';
        el.style.boxShadow   = '0 0 0 3px rgba(229,38,58,.2)';
        setTimeout(() => { el.style.borderColor = ''; el.style.boxShadow = ''; }, 1400);
      }
      return false;
    }
  }
  return true;
}

document.getElementById('btn-step1').addEventListener('click', () => { if (validateStep(1)) goToStep(2); });
document.getElementById('btn-step2').addEventListener('click', () => { if (validateStep(2)) goToStep(3); });
document.getElementById('btn-step3').addEventListener('click', () => { if (validateStep(3)) goToStep(4); });
document.getElementById('btn-back2').addEventListener('click', () => goToStep(1));
document.getElementById('btn-back3').addEventListener('click', () => goToStep(2));
document.getElementById('btn-back4').addEventListener('click', () => goToStep(3));

/* ── Review grid builder ── */
const REVIEW_LABELS = {
  name: 'Name', age: 'Age', gender: 'Gender',
  weight: 'Weight', height: 'Height', goal: 'Goal',
  activity: 'Activity', schedule: 'Days/Week', equipment: 'Equipment',
  cuisine: 'Cuisine', diet_type: 'Diet', budget: 'Budget',
};
const READABLE = {
  male:'Male', female:'Female', other:'Other',
  lose_weight:'Lose Weight', build_muscle:'Build Muscle', maintain:'Maintain',
  endurance:'Endurance', flexibility:'Flexibility',
  sedentary:'Sedentary', light:'Light', moderate:'Moderate', active:'Active', very_active:'Very Active',
  2:'2 days', 3:'3 days', 4:'4 days', 5:'5 days', 6:'6 days',
  none:'None', minimal:'Minimal', home_gym:'Home Gym', full_gym:'Full Gym',
  south_asian:'South Asian', east_asian:'East Asian', middle_eastern:'Middle Eastern',
  african:'African', latin:'Latin', western:'Western', mediterranean:'Mediterranean', mixed:'Mixed',
  vegetarian:'Vegetarian', vegan:'Vegan', halal:'Halal', gluten_free:'Gluten-Free', lactose_free:'Lactose-Free',
  low:'Low (<$30/wk)', medium:'Medium ($30-70)', high:'High ($70+)',
};

function buildReview() {
  const grid = document.getElementById('review-grid');
  grid.innerHTML = Object.entries(REVIEW_LABELS).map(([id, label]) => {
    const el  = document.getElementById(id);
    const raw = el ? el.value : '';
    const val = escapeHTML(READABLE[raw] || raw || '—');
    const suffix = id === 'age' ? ' yrs' : id === 'weight' ? ' kg' : id === 'height' ? ' cm' : '';
    return `<div class="review-item"><div class="rlabel">${escapeHTML(label)}</div><div class="rval">${val}${suffix}</div></div>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════════
   CHAR COUNTER
══════════════════════════════════════════════════════════ */
const healthTA    = document.getElementById('health_notes');
const charCounter = document.getElementById('char-count');
if (healthTA && charCounter) {
  healthTA.addEventListener('input', () => {
    charCounter.textContent = `${healthTA.value.length}/200`;
  });
}

/* ══════════════════════════════════════════════════════════
   AI LOADING OVERLAY
══════════════════════════════════════════════════════════ */
const AI_MESSAGES = [
  ['Analyzing your profile…',          'Reading your biometrics & goals'],
  ['Building your workout plan…',      'Selecting exercises for your equipment'],
  ['Optimizing your nutrition…',       'Matching meals to your culture & budget'],
  ['Personalizing your schedule…',     'Calculating your optimal training split'],
  ['Finalizing your plan…',            'Almost ready — polishing the details'],
];

function showAILoader(onComplete) {
  const overlay  = document.getElementById('ai-overlay');
  const msgEl    = document.getElementById('ai-msg');
  const subEl    = document.getElementById('ai-msg-sub');
  let   step     = 0;
  const total    = AI_MESSAGES.length;
  const interval = 520;

  overlay.classList.add('active');

  function nextMsg() {
    if (step >= total) {
      overlay.classList.remove('active');
      onComplete();
      return;
    }
    msgEl.style.animation = 'none'; subEl.style.animation = 'none';
    void msgEl.offsetWidth;
    msgEl.style.animation = ''; subEl.style.animation = '';
    msgEl.textContent = AI_MESSAGES[step][0];
    subEl.textContent = AI_MESSAGES[step][1];
    step++;
    setTimeout(nextMsg, interval);
  }
  nextMsg();
}

/* ══════════════════════════════════════════════════════════
   STAT COUNT-UP HELPER
══════════════════════════════════════════════════════════ */
function animateCountUp(el, target, suffix, duration) {
  const num   = parseFloat(target);
  const float = String(target).includes('.');
  const start = performance.now();
  function tick(now) {
    const p     = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const val   = float ? (eased * num).toFixed(1) : Math.round(eased * num);
    el.textContent = val + (suffix || '');
    if (p < 1) requestAnimationFrame(tick);
    else        el.textContent = target + (suffix || '');
  }
  requestAnimationFrame(tick);
}

/* Scoped to a specific container so it doesn't touch other tabs' stats */
function animateStatsIn(containerEl) {
  containerEl.querySelectorAll('.stat-val').forEach(el => {
    const text   = el.textContent.trim();
    const raw    = text.replace(/[^\d.]/g, '');
    const suffix = text.replace(/[\d.]/g, '');
    if (!raw || isNaN(parseFloat(raw))) return;
    el.textContent = '0' + suffix;
    animateCountUp(el, raw, suffix, 900);
  });
}

/* ══════════════════════════════════════════════════════════
   FORM SUBMIT
══════════════════════════════════════════════════════════ */
const form        = document.getElementById('profile-form');
const generateBtn = document.getElementById('generate-btn');
const btnText     = generateBtn.querySelector('.btn-text');
const btnLoader   = generateBtn.querySelector('.btn-loader');

form.addEventListener('submit', e => {
  e.preventDefault();
  const profile = readProfile();
  saveProfile(profile);

  generateBtn.disabled = true;
  showAILoader(() => {
    const plan = generateFullPlan(profile);
    currentPlan = plan;
    try { localStorage.setItem('gainz_plan', JSON.stringify(plan)); } catch (_) {}
    window.GAINZ_AUTH?.savePlan?.(plan);
    renderWorkoutTab(plan);
    renderDietTab(plan);
    renderInsightsTab(plan);
    generateBtn.disabled = false;
    activateTab('workout');
    goToStep(1);
  });
});

function readProfile() {
  return {
    name:         document.getElementById('name').value.trim(),
    age:          parseInt(document.getElementById('age').value, 10),
    gender:       document.getElementById('gender').value,
    weight:       parseFloat(document.getElementById('weight').value),
    height:       parseFloat(document.getElementById('height').value),
    goal:         document.getElementById('goal').value,
    activity:     document.getElementById('activity').value,
    schedule:     document.getElementById('schedule').value,
    equipment:    document.getElementById('equipment').value,
    cuisine:      document.getElementById('cuisine').value,
    diet_type:    document.getElementById('diet_type').value,
    budget:       document.getElementById('budget').value,
    health_notes: document.getElementById('health_notes').value.trim(),
  };
}

/* ══════════════════════════════════════════════════════════
   WORKOUT RENDERER
══════════════════════════════════════════════════════════ */
function renderWorkoutTab(plan) {
  const { profile: p, calories, macros, bmi, workoutPlan, tips } = plan;
  const GLABELS = { lose_weight:'Lose Weight', build_muscle:'Build Muscle', maintain:'Maintain', endurance:'Endurance', flexibility:'Flexibility' };
  const ELABELS = { none:'Bodyweight', minimal:'Minimal Equip.', home_gym:'Home Gym', full_gym:'Full Gym' };

  const daysHtml = workoutPlan.plan.map(day => {
    if (day.isRest) return `
      <div class="day-card">
        <div class="day-card-head"><span class="day-name">${day.day}</span><span class="day-type" style="color:var(--muted)">Rest</span></div>
        <div class="day-card-body"><div class="rest-day"><span>😴</span><span>Recovery &amp; light stretching</span></div></div>
      </div>`;
    const exHtml = day.exercises.map((e, i) => `
      <li class="exercise-item" style="animation-delay:${i*0.05}s">
        <span class="ex-icon">${escapeHTML(e.icon)}</span>
        <div>
          <div class="ex-name">${escapeHTML(e.name)}</div>
          <div class="ex-detail">${escapeHTML(e.detail)} — <em>${escapeHTML(e.muscle)}</em></div>
        </div>
        <button class="ex-timer-btn" title="Start timer" data-name="${escapeHTML(e.name)}" data-work="40" data-rest="20">▶</button>
      </li>`).join('');
    return `
      <div class="day-card">
        <div class="day-card-head"><span class="day-name">${escapeHTML(day.day)}</span><span class="day-type">${escapeHTML(day.type)}</span></div>
        <div class="day-card-body"><ul class="exercise-list">${exHtml}</ul></div>
      </div>`;
  }).join('');

  const tipsHtml = tips.map(t => `
    <div class="tip-card">
      <span class="tip-icon">${escapeHTML(t.icon)}</span>
      <div class="tip-text"><strong>${escapeHTML(t.title)}</strong>${escapeHTML(t.text)}</div>
    </div>`).join('');

  const html = `<div class="card">
    <div class="plan-header">
      <div>
        <h2>💪 ${escapeHTML(p.name)}'s Workout Plan</h2>
        <p class="muted" style="font-size:13px;margin-top:4px">${escapeHTML(workoutPlan.label)} — ${escapeHTML(workoutPlan.focus)}</p>
      </div>
      <div class="plan-meta">
        <span class="badge badge-blue">${GLABELS[p.goal] || p.goal}</span>
        <span class="badge badge-green">${p.schedule} days/wk</span>
        <span class="badge badge-red">${ELABELS[p.equipment] || p.equipment}</span>
      </div>
    </div>
    <div class="stats-row">
      <div class="stat-card"><div class="stat-val">${calories}</div><div class="stat-lbl">Daily kcal</div></div>
      <div class="stat-card"><div class="stat-val">${macros.protein}g</div><div class="stat-lbl">Protein</div></div>
      <div class="stat-card"><div class="stat-val">${macros.carbs}g</div><div class="stat-lbl">Carbs</div></div>
      <div class="stat-card"><div class="stat-val">${macros.fat}g</div><div class="stat-lbl">Fat</div></div>
      <div class="stat-card"><div class="stat-val">${bmi}</div><div class="stat-lbl">BMI</div></div>
      <div class="stat-card"><div class="stat-val">${p.schedule}</div><div class="stat-lbl">Train Days</div></div>
    </div>
    <div class="section-divider"><span>📅 Weekly Schedule</span></div>
    <div class="workout-status-bar">
      <div><strong>Today's session</strong><span class="muted"> Mark it complete after training to build your streak.</span></div>
      <button class="btn-complete-workout" id="complete-workout-btn" type="button">✓ COMPLETE WORKOUT</button>
    </div>
    <div class="week-grid">${daysHtml}</div>
    <div class="section-divider" style="margin-top:32px"><span>💡 Smart Tips</span></div>
    <div class="tips-row">${tipsHtml}</div>
    <div class="print-bar">
      <button class="btn-print" onclick="window.print()">🖨️ Print / Export Plan</button>
    </div>
  </div>`;

  document.getElementById('workout-output').outerHTML = `<div id="workout-output">${html}</div>`;
  const wo = document.getElementById('workout-output');
  requestAnimationFrame(() => animateStatsIn(wo));

  // Attach timer buttons
  wo.addEventListener('click', e => {
    const btn = e.target.closest('.ex-timer-btn');
    if (btn) openTimer(btn.dataset.name, +btn.dataset.work, +btn.dataset.rest);
  });

  const completeBtn = wo.querySelector('#complete-workout-btn');
  if (completeBtn) {
    const key = localDateKey();
    const completed = JSON.parse(localStorage.getItem('gainz_workouts') || '{}');
    // The plan starts on Monday; JS getDay() starts on Sunday.
    const todayPlan = workoutPlan.plan[(new Date().getDay() + 6) % 7];
    if (todayPlan && todayPlan.isRest) {
      completeBtn.disabled = true;
      completeBtn.textContent = '😴 REST DAY — NO SESSION TODAY';
    } else if (completed[key]) {
      completeBtn.classList.add('completed');
      completeBtn.textContent = '✓ WORKOUT COMPLETED';
    }
    completeBtn.addEventListener('click', () => {
      if (completeBtn.disabled) return;
      const data = JSON.parse(localStorage.getItem('gainz_workouts') || '{}');
      data[key] = { completedAt: new Date().toISOString(), goal: p.goal };
      localStorage.setItem('gainz_workouts', JSON.stringify(data));
      window.GAINZ_AUTH?.saveWorkoutCompletion?.(key, data[key]);
      completeBtn.classList.add('completed');
      completeBtn.textContent = '✓ WORKOUT COMPLETED';
      updateStreak();
    });
  }
}

/* ══════════════════════════════════════════════════════════
   DIET RENDERER
══════════════════════════════════════════════════════════ */
function renderDietTab(plan) {
  const { profile: p, dietPlan } = plan;
  const CLABELS = { south_asian:'South Asian', east_asian:'East Asian', middle_eastern:'Middle Eastern', african:'African/Caribbean', latin:'Latin American', western:'Western', mediterranean:'Mediterranean', mixed:'Mixed' };
  const BLABELS = { low:'<$30/wk', medium:'$30–70/wk', high:'$70+/wk' };
  const DLABELS = { none:'No Restriction', vegetarian:'Vegetarian', vegan:'Vegan', halal:'Halal', gluten_free:'Gluten-Free', lactose_free:'Lactose-Free' };

  const gapNote = dietPlan.gap > 0
    ? `<span style="color:var(--accent-y)">⚠ ${dietPlan.gap} kcal below target — add a protein shake or snack.</span>`
    : `<span style="color:var(--accent-g)">✔ Within target (${Math.abs(dietPlan.gap)} kcal over).</span>`;

  const warnHtml = (dietPlan.warnings || []).map(w =>
    `<div class="diet-warning" style="margin:0 0 12px;padding:10px 14px;border-radius:8px;border:1px solid var(--accent-y);color:var(--accent-y);font-size:13px">⚠ ${escapeHTML(w)}</div>`
  ).join('');

  const mealsHtml = dietPlan.meals.map(m => `
    <div class="meal-card">
      <div class="meal-card-head"><span class="meal-time">${escapeHTML(m.label)} · ${escapeHTML(m.time)}</span><span class="meal-cals">${escapeHTML(m.cal)} kcal</span></div>
      <div class="meal-name">${escapeHTML(m.name)}</div>
      <div class="meal-desc">${escapeHTML(m.desc)}</div>
      <div class="macro-row">
        <span class="macro-chip macro-p">P: ${escapeHTML(m.p)}g</span>
        <span class="macro-chip macro-c">C: ${escapeHTML(m.c)}g</span>
        <span class="macro-chip macro-f">F: ${escapeHTML(m.f)}g</span>
      </div>
      <div class="budget-note">🛒 Budget: <strong>${escapeHTML(String(m.budget || '').charAt(0).toUpperCase() + String(m.budget || '').slice(1))}</strong></div>
    </div>`).join('');

  const grocHtml = Object.entries(dietPlan.grocery).map(([cat, items]) => `
    <div class="grocery-cat">
      <div class="grocery-cat-title">${escapeHTML(cat)}</div>
      <ul class="grocery-items">${items.map(i => `<li>${escapeHTML(i)}</li>`).join('')}</ul>
    </div>`).join('');

  // Water tracker
  const waterGoalL = (calcWaterIntake(p.weight, p.activity) / 1000).toFixed(1);
  const glasses    = Math.round(parseFloat(waterGoalL) * 4);   // 250ml per glass
  const glassIcons = Array.from({length: glasses}, (_, i) =>
    `<button class="glass-btn" data-idx="${i}" title="Toggle glass ${i+1}" aria-pressed="false">💧</button>`
  ).join('');

  const html = `<div class="card">
    <div class="plan-header">
      <div>
        <h2>🥗 ${escapeHTML(p.name)}'s Meal Plan</h2>
        <p class="muted" style="font-size:13px;margin-top:4px">Culturally personalised · ${DLABELS[p.diet_type] || 'No Restriction'}</p>
      </div>
      <div class="plan-meta">
        <span class="badge badge-green">${CLABELS[p.cuisine] || p.cuisine}</span>
        <span class="badge badge-yellow">${BLABELS[p.budget] || p.budget}</span>
        <span class="badge badge-blue">${DLABELS[p.diet_type] || 'No Restriction'}</span>
      </div>
    </div>
    <div class="stats-row">
      <div class="stat-card"><div class="stat-val">${dietPlan.targetCalories}</div><div class="stat-lbl">Target kcal</div></div>
      <div class="stat-card"><div class="stat-val">${dietPlan.totalCal}</div><div class="stat-lbl">Plan Total</div></div>
      <div class="stat-card"><div class="stat-val">${dietPlan.macros.protein}g</div><div class="stat-lbl">Protein/day</div></div>
      <div class="stat-card"><div class="stat-val">${dietPlan.macros.carbs}g</div><div class="stat-lbl">Carbs/day</div></div>
      <div class="stat-card"><div class="stat-val">${dietPlan.macros.fat}g</div><div class="stat-lbl">Fat/day</div></div>
    </div>
    <div style="margin-bottom:16px;font-size:13px">${gapNote}</div>
    ${warnHtml}

    <!-- Water Tracker -->
    <div class="water-tracker">
      <div class="water-tracker-head">
        <span class="water-title">💧 Daily Water Tracker</span>
        <span class="water-goal-label">Goal: <strong>${waterGoalL} L</strong> (${glasses} glasses)</span>
      </div>
      <div class="water-glasses" id="water-glasses">${glassIcons}</div>
      <div class="water-progress-bar"><div class="water-progress-fill" id="water-fill" style="width:0%"></div></div>
      <div class="water-count-label"><span id="water-count">0</span> / ${glasses} glasses</div>
    </div>

    <div class="section-divider"><span>🍽️ Daily Meals</span></div>
    <div class="meals-grid">${mealsHtml}</div>
    <div class="grocery-section">
      <h3>🛒 Weekly Grocery List</h3>
      <div class="grocery-grid">${grocHtml}</div>
    </div>
    <div class="section-divider" style="margin-top:28px"><span>📌 Nutrition Guidelines</span></div>
    <div class="tips-row">
      <div class="tip-card"><span class="tip-icon">🥛</span><div class="tip-text"><strong>Protein Timing</strong>Consume protein within 30–45 min post-workout to maximise muscle synthesis.</div></div>
      <div class="tip-card"><span class="tip-icon">🍚</span><div class="tip-text"><strong>Carbs = Fuel</strong>Eat heaviest carb meals around workouts. Low-carb at night if losing weight.</div></div>
      <div class="tip-card"><span class="tip-icon">🧂</span><div class="tip-text"><strong>Limit Processed Food</strong>Swap packaged snacks for whole foods — same budget, far better results.</div></div>
      <div class="tip-card"><span class="tip-icon">💧</span><div class="tip-text"><strong>Hydration First</strong>Drink a large glass of water before each meal. Thirst is often mistaken for hunger.</div></div>
    </div>
    <div class="print-bar">
      <button class="btn-print" onclick="window.print()">🖨️ Print / Export Plan</button>
    </div>
  </div>`;

  document.getElementById('diet-output').outerHTML = `<div id="diet-output">${html}</div>`;
  const dOut = document.getElementById('diet-output');
  requestAnimationFrame(() => animateStatsIn(dOut));
  initWaterTracker(dOut, glasses);
}

/* ── Water Tracker Logic ── */
function initWaterTracker(container, total) {
  const glassWrap = container.querySelector('#water-glasses');
  const fill      = container.querySelector('#water-fill');
  const countEl   = container.querySelector('#water-count');
  if (!glassWrap) return;
  // Use the browser's local calendar date (not UTC) so the key matches Supabase's tracking_date in India and other time zones.
  const today = new Date();
  const localDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const waterKey = `gainz_water_${localDay}`;
  let filled = Math.min(parseInt(localStorage.getItem(waterKey) || '0', 10) || 0, total);
  function syncWaterUI() {
    glassWrap.querySelectorAll('.glass-btn').forEach((b, i) => {
      const on = i < filled;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('glass-filled', on);
    });
    countEl.textContent = filled;
    fill.style.width = `${(filled / total) * 100}%`;
  }
  syncWaterUI();

  glassWrap.addEventListener('click', e => {
    const btn = e.target.closest('.glass-btn');
    if (!btn) return;
    const idx  = +btn.dataset.idx;
    const isOn = btn.getAttribute('aria-pressed') === 'true';
    // Toggle: fill up to idx+1 or clear from idx
    if (!isOn) {
      // Fill all up to and including this glass
      glassWrap.querySelectorAll('.glass-btn').forEach((b, i) => {
        const on = i <= idx;
        b.setAttribute('aria-pressed', on);
        b.classList.toggle('glass-filled', on);
      });
      filled = idx + 1;
    } else {
      // Clear from this one onward
      glassWrap.querySelectorAll('.glass-btn').forEach((b, i) => {
        const on = i < idx;
        b.setAttribute('aria-pressed', on);
        b.classList.toggle('glass-filled', on);
      });
      filled = idx;
    }
    const pct = Math.round((filled / total) * 100);
    fill.style.width  = pct + '%';
    countEl.textContent = filled;
    fill.style.background = pct >= 100 ? '#00d4aa' : '#3a7eff';
    try { localStorage.setItem(waterKey, String(filled)); } catch (_) {}
    // Save locally immediately, then sync the same local date to Supabase.
    if (window.GAINZ_AUTH?.saveWater) {
      window.GAINZ_AUTH.saveWater(localDay, filled).catch(err => console.error('GAINZ water sync failed:', err));
    }
  });
}

/* ══════════════════════════════════════════════════════════
   INSIGHTS RENDERER
══════════════════════════════════════════════════════════ */
function renderInsightsTab(plan) {
  const { profile: p, insights } = plan;
  const { bmi, bmiCat, water, ideal, macroBreakdown, goalDesc, aiCards } = insights;

  // Adaptive progress summary: uses the user's locally stored check-ins/workouts.
  const storedProgress = progressLog || [];
  const workoutHistory = JSON.parse(localStorage.getItem('gainz_workouts') || '{}');
  const completedWorkoutDates = Object.keys(workoutHistory);
  let adaptiveMessage = 'Start logging your progress and completed workouts to unlock adaptive coaching.';
  if (storedProgress.length >= 2) {
    const first = storedProgress[0].weight;
    const latest = storedProgress[storedProgress.length - 1].weight;
    const delta = latest - first;
    const direction = delta < 0 ? 'down' : delta > 0 ? 'up' : 'steady';
    adaptiveMessage = `Your logged weight is <strong>${Math.abs(delta).toFixed(1)} kg ${direction}</strong> from your first check-in, with <strong>${completedWorkoutDates.length}</strong> completed workout${completedWorkoutDates.length === 1 ? '' : 's'} recorded.`;
  }

  /* ── SVG Donut chart for macros ── */
  const size = 160, cx = 80, cy = 80, r = 60, stroke = 22;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const slices = macroBreakdown.map(m => {
    const dash = (m.pct / 100) * circumference;
    const gap  = circumference - dash;
    const s = `<circle cx="${cx}" cy="${cy}" r="${r}"
      fill="none" stroke="${m.color}" stroke-width="${stroke}"
      stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
      stroke-dashoffset="${(-offset).toFixed(2)}"
      stroke-linecap="butt"
      style="transform-origin:${cx}px ${cy}px;transform:rotate(-90deg)"
    />`;
    offset += dash;
    return s;
  }).join('');

  const legend = macroBreakdown.map(m => `
    <div class="macro-legend-item">
      <span class="macro-legend-dot" style="background:${m.color}"></span>
      <div>
        <div class="macro-legend-label">${m.label}</div>
        <div class="macro-legend-val">${m.grams}g · ${m.pct}%</div>
      </div>
    </div>`).join('');

  /* ── BMI meter ── */
  const bmiVal = parseFloat(bmi);
  const bmiPct = Math.min(Math.max((bmiVal - 10) / (45 - 10), 0), 1) * 100;

  /* ── AI insight cards ── */
  const cardsHtml = aiCards.map(c => `
    <div class="insight-card" style="border-left: 3px solid ${c.accent}">
      <div class="insight-icon">${escapeHTML(c.icon)}</div>
      <div class="insight-body">
        <div class="insight-title">${escapeHTML(c.title)}</div>
        <div class="insight-text">${c.text}</div>
      </div>
    </div>`).join('');

  const html = `<div class="card">
    <div class="plan-header">
      <div>
        <h2>🧠 AI Health Insights</h2>
        <p class="muted" style="font-size:13px;margin-top:4px">Personalised analysis based on your biometrics and goals</p>
      </div>
      <div class="plan-meta">
        <span class="badge badge-blue">BMI ${bmi}</span>
        <span class="badge" style="background:rgba(0,0,0,.15);color:${bmiCat.color};border:1px solid ${bmiCat.color}40">${bmiCat.label}</span>
      </div>
    </div>

    <!-- Goal summary -->
    <div class="goal-banner">
      <div class="goal-banner-icon">🎯</div>
      <div class="goal-banner-text">${goalDesc}</div>
    </div>

    <!-- Two-column: donut + BMI meter -->
    <div class="insights-top-grid">
      <!-- Macro donut -->
      <div class="insight-panel">
        <div class="insight-panel-title">Macro Distribution</div>
        <div class="macro-donut-wrap">
          <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${slices}</svg>
          <div class="donut-center">
            <div class="donut-cal">${insights.calories}</div>
            <div class="donut-lbl">kcal/day</div>
          </div>
        </div>
        <div class="macro-legend">${legend}</div>
      </div>

      <!-- BMI Gauge -->
      <div class="insight-panel">
        <div class="insight-panel-title">BMI Gauge</div>
        <div class="bmi-gauge-wrap">
          <div class="bmi-track">
            <div class="bmi-fill" style="width:${bmiPct.toFixed(1)}%"></div>
            <div class="bmi-thumb" style="left:${bmiPct.toFixed(1)}%"></div>
          </div>
          <div class="bmi-scale-labels">
            <span>10</span><span>18.5</span><span>25</span><span>30</span><span>45</span>
          </div>
          <div class="bmi-current-label" style="color:${bmiCat.color}">
            ${bmi} — ${bmiCat.label}
          </div>
          <div class="bmi-zone-key">
            <span style="color:#3a7eff">■ Under</span>
            <span style="color:#00d4aa">■ Normal</span>
            <span style="color:#ffd166">■ Over</span>
            <span style="color:#e5263a">■ Obese</span>
          </div>
        </div>

        <!-- Key numbers -->
        <div class="key-numbers">
          <div class="key-num"><span class="kn-val" style="color:#3a7eff">${ideal} kg</span><span class="kn-lbl">Ideal Weight</span></div>
          <div class="key-num"><span class="kn-val" style="color:#00d4aa">${(water/1000).toFixed(1)} L</span><span class="kn-lbl">Water/Day</span></div>
          <div class="key-num"><span class="kn-val" style="color:#ffd166">${insights.bmr}</span><span class="kn-lbl">BMR kcal</span></div>
        </div>
      </div>
    </div>

    <div class="section-divider" style="margin-top:28px"><span>📈 Adaptive Progress</span></div>
    <div class="adaptive-progress-card"><span class="adaptive-progress-icon">↗</span><div><strong>Your plan should evolve with you.</strong><p class="muted">${adaptiveMessage}</p></div></div>

    <div class="section-divider" style="margin-top:28px"><span>🤖 AI Recommendations</span></div>
    <div class="insights-cards-grid">${cardsHtml}</div>
  </div>`;

  document.getElementById('insights-output').outerHTML = `<div id="insights-output">${html}</div>`;
}

/* ══════════════════════════════════════════════════════════
   AI COACH — Gemini-backed natural language assistant
══════════════════════════════════════════════════════════ */
function getCoachPlan() {
  if (currentPlan) return currentPlan;
  try { return JSON.parse(localStorage.getItem('gainz_plan') || 'null'); } catch (_) { return null; }
}

function collectProgressForCoach() {
  let workouts = {};
  try { workouts = JSON.parse(localStorage.getItem('gainz_workouts') || '{}'); } catch (_) {}
  return {
    weightEntries: (progressLog || []).slice(-12),
    completedWorkoutDates: Object.keys(workouts).slice(-30),
    streak: parseInt(document.getElementById('streak-count')?.textContent, 10) || 0
  };
}

function allExerciseOptions() {
  return Object.entries(EXERCISES || {}).map(([key, e]) => ({ key, name:e.name, muscle:e.muscle, equipment:e.equipment }));
}

function allMealOptions() {
  const out = [];
  for (const meals of Object.values(MEALS || {})) {
    for (const group of Object.values(meals)) {
      if (Array.isArray(group)) group.forEach(m => out.push({name:m.name, cal:m.cal, p:m.p, tags:m.tags}));
    }
  }
  return [...new Map(out.map(x => [x.name, x])).values()].slice(0, 150);
}

function addCoachMessage(role, text, action) {
  const box = document.getElementById('coach-messages');
  if (!box) return;
  const div = document.createElement('div');
  div.className = `coach-message coach-message-${role}`;
  const avatar = role === 'ai' ? '✦' : 'YOU';
  div.innerHTML = `<div class="coach-avatar">${avatar}</div><div><strong>${role === 'ai' ? 'GAINZ AI' : 'YOU'}</strong><p>${escapeHTML(text).replace(/\n/g,'<br>')}</p>${action ? `<div class="coach-action-pill">✓ ${escapeHTML(action)}</div>` : ''}</div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function applyCoachAction(action) {
  const plan = getCoachPlan();
  if (!plan || !action) return null;
  if (action.type === 'replace_exercise') {
    const replacement = EXERCISES?.[action.replacementKey];
    if (!replacement) return null;
    for (const day of plan.workoutPlan.plan) {
      if (!day.exercises) continue;
      const idx = day.exercises.findIndex(e => e.name === action.target);
      if (idx >= 0) { day.exercises[idx] = {...replacement}; currentPlan = plan; renderWorkoutTab(plan); localStorage.setItem('gainz_plan', JSON.stringify(plan)); window.GAINZ_AUTH?.savePlan?.(plan); return `Replaced ${action.target} with ${replacement.name}`; }
    }
  }
  if (action.type === 'swap_meal') {
    const all = allMealOptions();
    const replacement = all.find(m => m.name === action.replacementMeal);
    if (!replacement) return null;
    const idx = plan.dietPlan.meals.findIndex(m => m.name === action.target);
    if (idx >= 0) {
      plan.dietPlan.meals[idx] = {...plan.dietPlan.meals[idx], ...replacement, label: plan.dietPlan.meals[idx].label, time: plan.dietPlan.meals[idx].time};
      currentPlan = plan; renderDietTab(plan); localStorage.setItem('gainz_plan', JSON.stringify(plan)); window.GAINZ_AUTH?.savePlan?.(plan); return `Swapped ${action.target} for ${replacement.name}`;
    }
  }
  return null;
}

async function askCoach(message) {
  const status = document.getElementById('coach-status');
  const send = document.getElementById('coach-send');
  const plan = getCoachPlan();
  if (!plan) {
    addCoachMessage('ai', 'Generate your personalized plan first. Once it exists, I can use your workout, diet, goals, and progress as context.', null);
    return;
  }
  status?.classList.add('busy');
  if (status) status.innerHTML = '<span class="coach-status-dot"></span> Thinking…';
  if (send) send.disabled = true;
  addCoachMessage('user', message, null);
  try {
    const response = await fetch('/api/coach', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
      message,
      profile: plan.profile,
      plan: { calories:plan.calories, macros:plan.macros, workoutPlan:plan.workoutPlan, dietPlan:plan.dietPlan },
      progress: collectProgressForCoach(),
      availableExercises: allExerciseOptions(),
      availableMeals: allMealOptions(),
      history: coachHistory
    })});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Coach request failed.');
    const applied = applyCoachAction(data.action);
    const reply = data.reply || 'I am ready. Tell me what you want to change.';
    addCoachMessage('ai', reply, applied);
    coachHistory.push({role:'user',content:message},{role:'assistant',content:reply});
    coachHistory = coachHistory.slice(-16);
    localStorage.setItem('gainz_coach_history', JSON.stringify(coachHistory));
  } catch (err) {
    addCoachMessage('ai', `I couldn't reach the AI coach. ${err.message} Start the GAINZ server and make sure GEMINI_API_KEY is configured.`, null);
  } finally {
    status?.classList.remove('busy');
    if (status) status.innerHTML = '<span class="coach-status-dot"></span> Ready';
    if (send) send.disabled = false;
  }
}

const coachForm = document.getElementById('coach-form');
if (coachForm) {
  coachForm.addEventListener('submit', e => { e.preventDefault(); const input = document.getElementById('coach-input'); const text = input.value.trim(); if (!text) return; input.value=''; askCoach(text); });
  document.querySelectorAll('.coach-chip').forEach(chip => chip.addEventListener('click', () => { const input=document.getElementById('coach-input'); input.value=chip.textContent.trim(); input.focus(); }));
  const input = document.getElementById('coach-input');
  input?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); coachForm.requestSubmit(); } });
}

/* ══════════════════════════════════════════════════════════
   WORKOUT TIMER MODAL
══════════════════════════════════════════════════════════ */
let timerInterval = null;

function openTimer(name, workSec, restSec) {
  // Remove existing if any
  const existing = document.getElementById('timer-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'timer-modal';
  modal.className = 'timer-modal';
  modal.innerHTML = `
    <div class="timer-backdrop"></div>
    <div class="timer-box">
      <div class="timer-name">${escapeHTML(name)}</div>
      <div class="timer-phase" id="timer-phase">WORK</div>
      <div class="timer-display" id="timer-display">00:${String(workSec).padStart(2,'0')}</div>
      <div class="timer-ring-wrap">
        <svg class="timer-ring-svg" viewBox="0 0 120 120">
          <circle class="timer-ring-bg" cx="60" cy="60" r="52"/>
          <circle class="timer-ring-prog" id="timer-prog-circle" cx="60" cy="60" r="52"
            stroke-dasharray="326.7" stroke-dashoffset="0"
            style="transform-origin:60px 60px;transform:rotate(-90deg)"/>
        </svg>
        <div class="timer-inner-text" id="timer-display-inner">00:${String(workSec).padStart(2,'0')}</div>
      </div>
      <div class="timer-controls">
        <button class="timer-btn timer-btn-main" id="timer-start-btn">▶ START</button>
        <button class="timer-btn timer-btn-reset" id="timer-reset-btn">↺ RESET</button>
      </div>
      <div class="timer-sets-row">
        <span class="timer-sets-label">Sets completed:</span>
        <span class="timer-sets-count" id="timer-sets">0</span>
      </div>
      <button class="timer-close-btn" id="timer-close">✕</button>
    </div>`;
  document.body.appendChild(modal);
  void modal.offsetWidth;
  modal.classList.add('timer-modal-show');

  let phase = 'work';   // 'work' | 'rest'
  let remaining = workSec;
  let sets = 0;
  let running = false;
  const circumference = 326.7;
  const progCircle = modal.querySelector('#timer-prog-circle');
  const displayEl  = modal.querySelector('#timer-display-inner');
  const phaseEl    = modal.querySelector('#timer-phase');
  const startBtn   = modal.querySelector('#timer-start-btn');
  const setsEl     = modal.querySelector('#timer-sets');

  function fmt(s) { return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }
  function updateUI() {
    displayEl.textContent = fmt(remaining);
    const total = phase === 'work' ? workSec : restSec;
    const pct   = remaining / total;
    progCircle.style.strokeDashoffset = (circumference * (1 - pct)).toFixed(2);
    progCircle.style.stroke = phase === 'work' ? '#3a7eff' : '#00d4aa';
    phaseEl.textContent  = phase === 'work' ? 'WORK' : 'REST';
    phaseEl.style.color  = phase === 'work' ? '#3a7eff' : '#00d4aa';
    setsEl.textContent   = sets;
  }

  function tick() {
    if (remaining <= 0) {
      if (phase === 'work') {
        phase = 'rest'; remaining = restSec;
      } else {
        phase = 'work'; remaining = workSec; sets++;
      }
      // Brief beep via AudioContext if available
      try {
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ac.createOscillator();
        osc.connect(ac.destination);
        osc.frequency.value = phase === 'rest' ? 880 : 440;
        osc.start(); osc.stop(ac.currentTime + 0.15);
      } catch(_) {}
    } else {
      remaining--;
    }
    updateUI();
  }

  function startStop() {
    if (running) {
      clearInterval(timerInterval); running = false;
      startBtn.textContent = '▶ RESUME';
    } else {
      timerInterval = setInterval(tick, 1000); running = true;
      startBtn.textContent = '⏸ PAUSE';
    }
  }

  startBtn.addEventListener('click', startStop);
  modal.querySelector('#timer-reset-btn').addEventListener('click', () => {
    clearInterval(timerInterval); running = false;
    phase = 'work'; remaining = workSec; sets = 0;
    startBtn.textContent = '▶ START';
    updateUI();
  });

  function closeTimer() {
    clearInterval(timerInterval);
    modal.classList.remove('timer-modal-show');
    modal.addEventListener('transitionend', () => modal.remove(), { once: true });
  }
  modal.querySelector('#timer-close').addEventListener('click', closeTimer);
  modal.querySelector('.timer-backdrop').addEventListener('click', closeTimer);

  updateUI();
}

/* ══════════════════════════════════════════════════════════
   PROGRESS TRACKER
══════════════════════════════════════════════════════════ */
let progressLog = JSON.parse(localStorage.getItem('gainz_progress') || '[]');

const logDateInput = document.getElementById('log-date');
if (logDateInput) logDateInput.value = localDateKey();

document.getElementById('log-btn').addEventListener('click', () => {
  const date   = document.getElementById('log-date').value;
  const weight = parseFloat(document.getElementById('log-weight').value);
  const note   = document.getElementById('log-note').value.trim();

  if (!date || isNaN(weight)) {
    const wEl = document.getElementById('log-weight');
    wEl.style.borderColor = 'var(--accent-r)';
    setTimeout(() => wEl.style.borderColor = '', 1400);
    return;
  }

  // Prevent duplicate dates — update instead
  const existing = progressLog.findIndex(e => e.date === date);
  if (existing >= 0) progressLog[existing] = { date, weight, note };
  else progressLog.push({ date, weight, note });
  progressLog.sort((a, b) => new Date(a.date) - new Date(b.date));
  localStorage.setItem('gainz_progress', JSON.stringify(progressLog));
  window.GAINZ_AUTH?.saveProgress?.({ date, weight, note });

  document.getElementById('log-weight').value = '';
  document.getElementById('log-note').value   = '';

  renderProgressTable();
  renderWeightChart();
  updateStreak();
  renderStreakCalendar();
});

function renderProgressTable() {
  const tbody = document.getElementById('progress-body');
  if (!progressLog.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="muted center">No entries yet.</td></tr>';
    return;
  }
  const sw = progressLog[0].weight;
  tbody.innerHTML = progressLog.slice().reverse().map(e => {
    const d   = (e.weight - sw).toFixed(1);
    const cls = d > 0 ? 'delta-pos' : d < 0 ? 'delta-neg' : '';
    return `<tr>
      <td>${escapeHTML(e.date)}</td><td>${escapeHTML(e.weight)} kg</td>
      <td>${escapeHTML(e.note || '—')}</td>
      <td class="${cls}">${d > 0 ? '+' : ''}${d} kg</td>
    </tr>`;
  }).join('');
}

function renderWeightChart() {
  if (progressLog.length < 2) return;
  const wrap = document.getElementById('weight-chart-wrap');
  wrap.classList.remove('hidden');
  const canvas  = document.getElementById('weight-chart');
  const ctx     = canvas.getContext('2d');
  const weights = progressLog.map(e => e.weight);
  const labels  = progressLog.map(e => e.date);
  const W = canvas.parentElement.offsetWidth || 700, H = 200;
  canvas.width = W; canvas.height = H;
  const isDark   = !document.body.classList.contains('light');
  const bg       = isDark ? '#111318' : '#f7f8fa';
  const gridCol  = isDark ? '#252a3a' : '#e5e7eb';
  const textCol  = isDark ? '#5a6080' : '#888da0';
  const minW = Math.min(...weights) - 2, maxW = Math.max(...weights) + 2;
  const pL = 48, pR = 20, pT = 20, pB = 44;
  const xS = i => pL + (i / (weights.length - 1 || 1)) * (W - pL - pR);
  const yS = v => pT + (1 - (v - minW) / (maxW - minW || 1)) * (H - pT - pB);

  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = gridCol; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pT + (i / 4) * (H - pT - pB);
    ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(W - pR, y); ctx.stroke();
    ctx.fillStyle = textCol; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText((maxW - (i / 4) * (maxW - minW)).toFixed(1), pL - 6, y + 4);
  }

  // Fill gradient
  const g = ctx.createLinearGradient(0, pT, 0, H - pB);
  g.addColorStop(0, 'rgba(58,126,255,.35)'); g.addColorStop(1, 'rgba(58,126,255,.02)');
  ctx.beginPath(); ctx.moveTo(xS(0), yS(weights[0]));
  weights.forEach((w, i) => ctx.lineTo(xS(i), yS(w)));
  ctx.lineTo(xS(weights.length - 1), H - pB); ctx.lineTo(xS(0), H - pB);
  ctx.closePath(); ctx.fillStyle = g; ctx.fill();

  // Line
  ctx.beginPath(); ctx.strokeStyle = '#3a7eff'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  weights.forEach((w, i) => i === 0 ? ctx.moveTo(xS(i), yS(w)) : ctx.lineTo(xS(i), yS(w)));
  ctx.stroke();

  // Dots + hover tooltips via imageData — simple dots
  weights.forEach((w, i) => {
    ctx.beginPath(); ctx.arc(xS(i), yS(w), 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#3a7eff'; ctx.fill();
    ctx.strokeStyle = bg; ctx.lineWidth = 2; ctx.stroke();
  });

  // X labels
  ctx.fillStyle = textCol; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
  const step = Math.max(1, Math.floor(labels.length / 7));
  labels.forEach((l, i) => { if (i % step === 0) ctx.fillText(l.slice(5), xS(i), H - pB + 18); });
}

/* ── Streak calendar (last 30 days) ── */
function renderStreakCalendar() {
  const wrap = document.getElementById('streak-calendar');
  if (!wrap) return;
  const workoutDates = Object.keys(JSON.parse(localStorage.getItem('gainz_workouts') || '{}'));
  const logged = new Set([...progressLog.map(e => e.date), ...workoutDates]);
  const today  = new Date();
  const days   = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    days.push(localDateKey(d));
  }
  const todayKey = localDateKey(today);
  wrap.innerHTML = days.map(d => {
    const cls = logged.has(d) ? 'cal-day logged' : d === todayKey ? 'cal-day today' : 'cal-day';
    return `<div class="${cls}" title="${d}"></div>`;
  }).join('');
}

function updateStreak() {
  const workouts = JSON.parse(localStorage.getItem('gainz_workouts') || '{}');
  const dates = new Set([...progressLog.map(e => e.date), ...Object.keys(workouts)]);
  let streak = 0;
  const cur = new Date();
  // If today has no entry yet, the streak is still alive from yesterday.
  if (!dates.has(localDateKey(cur))) cur.setDate(cur.getDate() - 1);
  while (dates.has(localDateKey(cur))) { streak++; cur.setDate(cur.getDate() - 1); }
  const el = document.getElementById('streak-count');
  if (el) el.textContent = `${streak} day${streak !== 1 ? 's' : ''}`;
}

/* ══════════════════════════════════════════════════════════
   THEME TOGGLE
══════════════════════════════════════════════════════════ */
(function initTheme() {
  const switcher = document.getElementById('theme-toggle');
  const saved    = localStorage.getItem('gainz_theme') || 'dark';

  function applyTheme(theme) {
    document.body.classList.toggle('light', theme === 'light');
    localStorage.setItem('gainz_theme', theme);
  }

  applyTheme(saved);
  switcher.addEventListener('click', () => {
    const next = document.body.classList.contains('light') ? 'dark' : 'light';
    applyTheme(next);
    // Redraw chart with correct colors
    if (progressLog.length >= 2) renderWeightChart();
  });
})();

/* ══════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════ */
(function init() {
  // Restore the saved profile into the form.
  const saved = loadSavedProfile();
  if (saved) {
    Object.entries(saved).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el && value !== undefined && value !== null) el.value = value;
    });
    if (healthTA && charCounter) {
      charCounter.textContent = `${healthTA.value.length}/200`;
    }
  }

  // Restore the previously generated plan. Saving it was already implemented;
  // the missing piece was loading it and rendering its tabs when the app starts.
  try {
    currentPlan = JSON.parse(localStorage.getItem('gainz_plan') || 'null');
  } catch (error) {
    console.warn('GAINZ could not read the saved plan:', error);
    currentPlan = null;
  }

  if (currentPlan) {
    try {
      if (currentPlan.workoutPlan?.plan && currentPlan.dietPlan?.meals) {
        renderWorkoutTab(currentPlan);
        renderDietTab(currentPlan);
        renderInsightsTab(currentPlan);
      } else {
        console.warn('GAINZ found saved plan data, but its structure is incomplete. Generate the plan again to refresh it.');
      }
    } catch (error) {
      console.error('GAINZ could not restore the saved plan:', error);
    }
  }

  renderProgressTable();
  renderWeightChart();
  updateStreak();
  renderStreakCalendar();
  goToStep(1);
})();

/* ══════════════════════════════════════════════════════════
   AI CONNECTION CHECK
══════════════════════════════════════════════════════════ */
const coachTestBtn = document.getElementById('coach-test-btn');
if (coachTestBtn) {
  coachTestBtn.addEventListener('click', async () => {
    const status = document.getElementById('coach-status');
    coachTestBtn.disabled = true;
    if (status) status.innerHTML = '<span class="coach-status-dot"></span> Checking…';
    try {
      const response = await fetch('/api/test-ai', { method:'POST', headers:{'Content-Type':'application/json'} });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'AI service is not ready.');
      if (status) status.innerHTML = `<span class="coach-status-dot"></span> Connected · ${escapeHTML(data.model || 'Gemini')}`;
      addCoachMessage('ai', `AI connection is working. GAINZ is using ${data.model || 'Gemini'} for the coach.`, null);
    } catch (err) {
      if (status) status.innerHTML = '<span class="coach-status-dot"></span> Not connected';
      addCoachMessage('ai', `AI connection check failed: ${err.message}. Make sure .env is beside server.js and that the server was restarted after changing it.`, null);
    } finally {
      coachTestBtn.disabled = false;
    }
  });
}