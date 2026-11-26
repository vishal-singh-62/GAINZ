/* GAINZ — Supabase authentication and cloud persistence */
(() => {
  'use strict';

  const config = window.GAINZ_SUPABASE_CONFIG || {};
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.url || '') &&
    typeof config.anonKey === 'string' && config.anonKey.length > 20 &&
    !config.anonKey.startsWith('PASTE_');
  const gate = document.getElementById('auth-gate');
  const form = document.getElementById('auth-form');
  const title = document.getElementById('auth-title');
  const subtitle = document.getElementById('auth-subtitle');
  const message = document.getElementById('auth-message');
  const submit = document.getElementById('auth-submit');
  const toggle = document.getElementById('auth-toggle');
  const forgot = document.getElementById('auth-forgot');
  const nameInput = document.getElementById('auth-name');
  const nameLabel = document.getElementById('auth-name-label');
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const signOutButton = document.getElementById('auth-user-btn');

  let supabase = null;
  let mode = 'login';
  let currentUser = null;
  let hydrationBusy = false;

  function showMessage(text, isError = false) {
    message.textContent = text || '';
    message.classList.toggle('error', !!isError);
  }
  function setMode(next) {
    mode = next;
    const signup = mode === 'signup';
    title.textContent = signup ? 'Create your account' : 'Welcome back';
    subtitle.textContent = signup
      ? 'Create an account to save your fitness journey across devices.'
      : 'Sign in to access your workouts, nutrition and progress.';
    nameInput.classList.toggle('hidden', !signup);
    nameLabel.classList.toggle('hidden', !signup);
    nameInput.required = signup;
    passwordInput.autocomplete = signup ? 'new-password' : 'current-password';
    submit.textContent = signup ? 'Create account' : 'Sign in';
    toggle.textContent = signup ? 'Already have an account? Sign in' : 'Create an account';
    forgot.classList.toggle('hidden', signup);
    showMessage('');
  }
  function showGate(text, isError = false) {
    gate.classList.remove('hidden');
    showMessage(text, isError);
  }
  function hideGate() { gate.classList.add('hidden'); }

  function cache(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }
  function cacheRaw(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (_) {}
  }
  function localDate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  async function hydrateUser(user) {
    if (!supabase || !user || hydrationBusy) return;
    hydrationBusy = true;
    try {
      const [profileRes, workoutRes, dietRes, progressRes, completionRes, waterRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('workout_plans').select('plan_data,created_at').eq('user_id', user.id).order('created_at', {ascending:false}).limit(1).maybeSingle(),
        supabase.from('diet_plans').select('plan_data,created_at').eq('user_id', user.id).order('created_at', {ascending:false}).limit(1).maybeSingle(),
        supabase.from('progress').select('recorded_at,weight,notes').eq('user_id', user.id).order('recorded_at'),
        supabase.from('workout_completions').select('workout_date,completed_at,goal').eq('user_id', user.id),
        supabase.from('water_tracking').select('tracking_date,glasses').eq('user_id', user.id).eq('tracking_date', localDate()).maybeSingle()
      ]);
      const errors = [profileRes, workoutRes, dietRes, progressRes, completionRes, waterRes]
        .filter(r => r.error).map(r => r.error.message);
      if (errors.length) throw new Error(errors.join(' | '));

      const row = profileRes.data;
      if (row) {
        const profile = {
          name: row.full_name || '', age: row.age, gender: row.gender,
          weight: row.weight, height: row.height, goal: row.fitness_goal,
          activity: row.activity_level, schedule: row.schedule, equipment: row.equipment,
          cuisine: row.cuisine, diet_type: row.diet_type, budget: row.budget,
          health_notes: row.health_notes || ''
        };
        cache('gainz_profile', profile);
      } else {
        localStorage.removeItem('gainz_profile');
      }

      let plan = workoutRes.data?.plan_data || null;
      if (plan && typeof plan === 'object') {
        if (dietRes.data?.plan_data) plan.dietPlan = dietRes.data.plan_data;
        cache('gainz_plan', plan);
      } else {
        // Cloud data is authoritative for a signed-in account. Do not leave an
        // old browser-local plan visible if this account has not generated one.
        localStorage.removeItem('gainz_plan');
      }

      const progress = (progressRes.data || []).map(r => ({
        date: r.recorded_at, weight: Number(r.weight), note: r.notes || ''
      }));
      cache('gainz_progress', progress);

      const workouts = {};
      (completionRes.data || []).forEach(r => {
        workouts[r.workout_date] = { completedAt: r.completed_at, goal: r.goal };
      });
      cache('gainz_workouts', workouts);
      if (waterRes.data) cacheRaw(`gainz_water_${waterRes.data.tracking_date}`, waterRes.data.glasses);

      // Keep browser-local chat history isolated between signed-in accounts.
      const historyOwner = sessionStorage.getItem('gainz_chat_owner');
      if (historyOwner !== user.id) {
        localStorage.removeItem('gainz_coach_history');
        sessionStorage.setItem('gainz_chat_owner', user.id);
      }

      const marker = sessionStorage.getItem('gainz_hydrated_user');
      if (marker !== user.id) {
        sessionStorage.setItem('gainz_hydrated_user', user.id);
        window.location.reload();
        return;
      }
      hideGate();
      if (signOutButton) {
        signOutButton.classList.remove('hidden');
        signOutButton.textContent = user.email ? `SIGN OUT · ${user.email}` : 'SIGN OUT';
      }
    } catch (err) {
      showGate(`Could not load your cloud data: ${err.message}. Check the database tables, grants and RLS policies.`, true);
    } finally {
      hydrationBusy = false;
    }
  }

  async function saveProfile(profile) {
    if (!supabase || !currentUser) return;
    const row = {
      id: currentUser.id,
      full_name: profile.name || '',
      age: profile.age || null,
      gender: profile.gender || null,
      weight: profile.weight || null,
      height: profile.height || null,
      fitness_goal: profile.goal || null,
      activity_level: profile.activity || null,
      schedule: profile.schedule || null,
      equipment: profile.equipment || null,
      cuisine: profile.cuisine || null,
      diet_type: profile.diet_type || null,
      budget: profile.budget || null,
      health_notes: profile.health_notes || '',
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('profiles').upsert(row, {onConflict:'id'});
    if (error) console.error('GAINZ profile sync failed:', error.message);
  }

  async function savePlan(plan) {
    if (!supabase || !currentUser || !plan) return;
    const [workout, diet] = await Promise.all([
      supabase.from('workout_plans').insert({user_id:currentUser.id, plan_data:plan}),
      supabase.from('diet_plans').insert({user_id:currentUser.id, plan_data:plan.dietPlan || {}})
    ]);
    if (workout.error || diet.error) console.error('GAINZ plan sync failed:', workout.error?.message || diet.error?.message);
  }

  async function saveProgress(entry) {
    if (!supabase || !currentUser) return;
    const { error } = await supabase.from('progress').upsert({
      user_id:currentUser.id, recorded_at:entry.date, weight:entry.weight, notes:entry.note || ''
    }, {onConflict:'user_id,recorded_at'});
    if (error) console.error('GAINZ progress sync failed:', error.message);
  }

  async function saveWorkoutCompletion(date, data) {
    if (!supabase || !currentUser) return;
    const { error } = await supabase.from('workout_completions').upsert({
      user_id:currentUser.id, workout_date:date, completed_at:data.completedAt, goal:data.goal || null
    }, {onConflict:'user_id,workout_date'});
    if (error) console.error('GAINZ workout sync failed:', error.message);
  }

  async function saveWater(date, glasses) {
    if (!supabase || !currentUser) {
      console.warn('GAINZ water sync skipped: Supabase session is not ready.');
      return;
    }
    const { error } = await supabase.from('water_tracking').upsert({
      user_id: currentUser.id,
      tracking_date: date,
      glasses: Number(glasses),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,tracking_date' });
    if (error) {
      console.error('GAINZ water sync failed:', error.message);
      throw error;
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    if (!supabase) return;
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    submit.disabled = true;
    submit.textContent = mode === 'signup' ? 'Creating account…' : 'Signing in…';
    showMessage('');
    try {
      if (mode === 'signup') {
        const fullName = nameInput.value.trim();
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { data: { full_name: fullName } }
        });
        if (error) throw error;
        if (data.session) {
          currentUser = data.user;
          await hydrateUser(currentUser);
        } else {
          showMessage('Account created. Check your email to confirm your address, then sign in.');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({email, password});
        if (error) throw error;
        currentUser = data.user;
        await hydrateUser(currentUser);
      }
    } catch (err) {
      showMessage(err.message || 'Authentication failed.', true);
    } finally {
      submit.disabled = false;
      submit.textContent = mode === 'signup' ? 'Create account' : 'Sign in';
    }
  }

  async function resetPassword() {
    if (!supabase) return;
    const email = emailInput.value.trim();
    if (!email) return showMessage('Enter your email address first.', true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`
      });
      if (error) throw error;
      showMessage('Password reset email sent. Check your inbox.');
    } catch (err) { showMessage(err.message, true); }
  }

  async function init() {
    if (!configured || !window.supabase?.createClient) {
      showGate('Add your Supabase Project URL and publishable/anon key in supabase-config.js, then refresh.', true);
      setMode('login');
      return;
    }
    supabase = window.supabase.createClient(config.url, config.anonKey, {
      auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
    });
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      showGate(error.message, true);
      return;
    }
    currentUser = data.session?.user || null;
    if (currentUser) {
      showGate('Loading your GAINZ account…');
      await hydrateUser(currentUser);
    } else {
      sessionStorage.removeItem('gainz_hydrated_user');
      showGate('');
      setMode('login');
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        currentUser = null;
        sessionStorage.removeItem('gainz_hydrated_user');
        sessionStorage.removeItem('gainz_chat_owner');
        ['gainz_profile','gainz_plan','gainz_progress','gainz_workouts','gainz_coach_history'].forEach(k => localStorage.removeItem(k));
        Object.keys(localStorage).filter(k => k.startsWith('gainz_water_')).forEach(k => localStorage.removeItem(k));
        window.location.reload();
      } else if (session?.user && ['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event)) {
        currentUser = session.user;
        if (event === 'SIGNED_IN') await hydrateUser(currentUser);
      }
    });
  }

  form?.addEventListener('submit', handleAuthSubmit);
  toggle?.addEventListener('click', () => setMode(mode === 'login' ? 'signup' : 'login'));
  forgot?.addEventListener('click', resetPassword);
  signOutButton?.addEventListener('click', async () => {
    if (!supabase) return;
    signOutButton.disabled = true;
    const { error } = await supabase.auth.signOut();
    if (error) { showGate(error.message, true); signOutButton.disabled = false; }
  });

  window.GAINZ_AUTH = {
    get user() { return currentUser; },
    saveProfile, savePlan, saveProgress, saveWorkoutCompletion, saveWater
  };
  setMode('login');
  init();
})();