/**
 * GAINZ — AI Engine
 * All plan-generation logic lives here.
 * Rule-based planning (formulas + lookup tables); no external API is needed here.
 * The conversational AI coach lives in server.js (Gemini) and is separate from this file.
 */

'use strict';

/* ══════════════════════════════════════════════════════════
   1. CALORIE & MACRO CALCULATOR
   ══════════════════════════════════════════════════════════ */

function calcBMR(weight, height, age, gender) {
  // Mifflin-St Jeor formula
  const base = 10 * weight + 6.25 * height - 5 * age;
  return gender === 'female' ? base - 161 : base + 5;
}

const ACTIVITY_MULTIPLIERS = {
  sedentary:   1.2,
  light:       1.375,
  moderate:    1.55,
  active:      1.725,
  very_active: 1.9
};

const GOAL_ADJUSTMENTS = {
  lose_weight:   -500,
  build_muscle:  +300,
  maintain:       0,
  endurance:    +150,
  flexibility:    0
};

// Safety floor: never prescribe fewer calories than commonly accepted minimums.
const MIN_CALORIES = { female: 1200, male: 1500, other: 1200 };
function minCalories(gender) { return MIN_CALORIES[gender] || 1200; }

function calcTDEE(profile) {
  const bmr = calcBMR(profile.weight, profile.height, profile.age, profile.gender);
  const tdee = bmr * (ACTIVITY_MULTIPLIERS[profile.activity] || 1.55);
  const target = Math.round(tdee + (GOAL_ADJUSTMENTS[profile.goal] || 0));
  return Math.max(target, minCalories(profile.gender));
}

// True when the safety floor raised the calorie target above the raw goal-based value.
function calorieFloorApplied(profile) {
  const bmr = calcBMR(profile.weight, profile.height, profile.age, profile.gender);
  const raw = Math.round(bmr * (ACTIVITY_MULTIPLIERS[profile.activity] || 1.55) + (GOAL_ADJUSTMENTS[profile.goal] || 0));
  return raw < minCalories(profile.gender);
}

function calcMacros(calories, goal) {
  let pct = { protein: 0.30, carbs: 0.45, fat: 0.25 };
  if (goal === 'build_muscle')  pct = { protein: 0.35, carbs: 0.45, fat: 0.20 };
  if (goal === 'lose_weight')   pct = { protein: 0.35, carbs: 0.35, fat: 0.30 };
  if (goal === 'endurance')     pct = { protein: 0.25, carbs: 0.55, fat: 0.20 };
  return {
    protein: Math.round((calories * pct.protein) / 4),
    carbs:   Math.round((calories * pct.carbs)   / 4),
    fat:     Math.round((calories * pct.fat)      / 9)
  };
}

function calcBMI(weight, height) {
  const h = height / 100;
  return (weight / (h * h)).toFixed(1);
}

function getBMICategory(bmi) {
  const b = parseFloat(bmi);
  if (b < 18.5) return { label: 'Underweight', color: '#3a7eff', advice: 'Consider a caloric surplus with nutrient-dense foods to reach a healthy weight.' };
  if (b < 25)   return { label: 'Normal Weight', color: '#00d4aa', advice: 'You\'re in the healthy range! Focus on maintaining your weight through consistent habits.' };
  if (b < 30)   return { label: 'Overweight', color: '#ffd166', advice: 'A moderate caloric deficit with increased activity can help you reach the healthy range.' };
  return         { label: 'Obese', color: '#e5263a', advice: 'Consult a healthcare professional. A structured plan with gradual changes yields the best long-term results.' };
}

function calcIdealWeight(height, gender) {
  // Devine formula (kg)
  const h = height - 152.4;
  const base = gender === 'female' ? 45.5 : 50.0;
  return +(base + 0.906 * (h / 2.54)).toFixed(1);
}

function calcWaterIntake(weight, activity) {
  // Base: 35ml/kg, +200ml for active levels
  const base = Math.round(weight * 35);
  const bonus = { moderate: 200, active: 400, very_active: 600 }[activity] || 0;
  return Math.round((base + bonus) / 100) * 100; // round to nearest 100ml
}

/* ══════════════════════════════════════════════════════════
   2. WORKOUT DATABASE
   ══════════════════════════════════════════════════════════ */

const EXERCISES = {
  /* ── Bodyweight ── */
  push_up:          { name: 'Push-Ups',           icon: '🤜', muscle: 'chest/triceps', detail: '3×15 reps',         sets:3, reps:15, equipment: ['none','minimal','home_gym','full_gym'] },
  diamond_push_up:  { name: 'Diamond Push-Ups',   icon: '💎', muscle: 'triceps',       detail: '3×12 reps',         sets:3, reps:12, equipment: ['none','minimal','home_gym','full_gym'] },
  squat:            { name: 'Bodyweight Squats',  icon: '🦵', muscle: 'quads/glutes',  detail: '3×20 reps',         sets:3, reps:20, equipment: ['none','minimal','home_gym','full_gym'] },
  jump_squat:       { name: 'Jump Squats',        icon: '🦘', muscle: 'quads/glutes',  detail: '3×12 reps',         sets:3, reps:12, equipment: ['none','minimal','home_gym','full_gym'] },
  lunge:            { name: 'Walking Lunges',     icon: '🚶', muscle: 'quads/glutes',  detail: '3×12 each leg',     sets:3, reps:12, equipment: ['none','minimal','home_gym','full_gym'] },
  glute_bridge:     { name: 'Glute Bridges',      icon: '🍑', muscle: 'glutes/hamstr', detail: '3×20 reps',         sets:3, reps:20, equipment: ['none','minimal','home_gym','full_gym'] },
  plank:            { name: 'Plank Hold',         icon: '🧱', muscle: 'core',          detail: '3×45 sec',          sets:3, reps:'45s', equipment: ['none','minimal','home_gym','full_gym'] },
  mountain_climber: { name: 'Mountain Climbers',  icon: '⛰️', muscle: 'core/cardio',   detail: '3×30 sec',          sets:3, reps:'30s', equipment: ['none','minimal','home_gym','full_gym'] },
  burpee:           { name: 'Burpees',            icon: '💥', muscle: 'full body',     detail: '3×10 reps',         sets:3, reps:10, equipment: ['none','minimal','home_gym','full_gym'] },
  high_knees:       { name: 'High Knees',         icon: '🏃', muscle: 'cardio/core',   detail: '3×40 sec',          sets:3, reps:'40s', equipment: ['none','minimal','home_gym','full_gym'] },
  dip:              { name: 'Tricep Dips (chair)',icon: '🪑', muscle: 'triceps',       detail: '3×15 reps',         sets:3, reps:15, equipment: ['none','minimal','home_gym','full_gym'] },
  calf_raise:       { name: 'Calf Raises',        icon: '🦶', muscle: 'calves',        detail: '3×25 reps',         sets:3, reps:25, equipment: ['none','minimal','home_gym','full_gym'] },
  superman:         { name: 'Superman Hold',      icon: '🦸', muscle: 'lower back',    detail: '3×15 reps',         sets:3, reps:15, equipment: ['none','minimal','home_gym','full_gym'] },
  bicycle_crunch:   { name: 'Bicycle Crunches',   icon: '🚲', muscle: 'abs',           detail: '3×20 reps',         sets:3, reps:20, equipment: ['none','minimal','home_gym','full_gym'] },
  side_plank:       { name: 'Side Plank',         icon: '⚡', muscle: 'obliques',      detail: '3×30 sec each',     sets:3, reps:'30s', equipment: ['none','minimal','home_gym','full_gym'] },
  inchworm:         { name: 'Inchworm',           icon: '🐛', muscle: 'full body',     detail: '3×10 reps',         sets:3, reps:10, equipment: ['none','minimal','home_gym','full_gym'] },
  hip_thrust_bw:    { name: 'Hip Thrusts (BW)',   icon: '🔥', muscle: 'glutes',        detail: '3×20 reps',         sets:3, reps:20, equipment: ['none','minimal','home_gym','full_gym'] },

  /* ── Resistance Band / Dumbbell ── */
  band_row:         { name: 'Band Rows',          icon: '🎗️', muscle: 'back',          detail: '3×15 reps',         sets:3, reps:15, equipment: ['minimal','home_gym','full_gym'] },
  db_curl:          { name: 'Dumbbell Curls',     icon: '💪', muscle: 'biceps',        detail: '3×12 reps',         sets:3, reps:12, equipment: ['minimal','home_gym','full_gym'] },
  db_shoulder:      { name: 'DB Shoulder Press',  icon: '🏋️', muscle: 'shoulders',    detail: '3×12 reps',         sets:3, reps:12, equipment: ['minimal','home_gym','full_gym'] },
  db_rdl:           { name: 'DB Romanian DL',     icon: '🏗️', muscle: 'hamstrings',   detail: '3×12 reps',         sets:3, reps:12, equipment: ['minimal','home_gym','full_gym'] },
  db_chest:         { name: 'DB Chest Press',     icon: '🛋️', muscle: 'chest',        detail: '3×12 reps',         sets:3, reps:12, equipment: ['minimal','home_gym','full_gym'] },
  db_goblet:        { name: 'Goblet Squat',       icon: '🏆', muscle: 'quads/glutes',  detail: '3×15 reps',         sets:3, reps:15, equipment: ['minimal','home_gym','full_gym'] },
  lateral_raise:    { name: 'Lateral Raises',     icon: '🦅', muscle: 'side delts',    detail: '3×15 reps',         sets:3, reps:15, equipment: ['minimal','home_gym','full_gym'] },

  /* ── Gym machines / barbell ── */
  bench_press:      { name: 'Bench Press',        icon: '🏋️', muscle: 'chest',        detail: '4×8 reps',          sets:4, reps:8,  equipment: ['home_gym','full_gym'] },
  squat_bar:        { name: 'Barbell Squat',      icon: '🦵', muscle: 'quads/glutes',  detail: '4×8 reps',          sets:4, reps:8,  equipment: ['home_gym','full_gym'] },
  deadlift:         { name: 'Deadlift',           icon: '💀', muscle: 'full body',     detail: '4×6 reps',          sets:4, reps:6,  equipment: ['home_gym','full_gym'] },
  lat_pulldown:     { name: 'Lat Pulldown',       icon: '🔽', muscle: 'lats/biceps',   detail: '4×10 reps',         sets:4, reps:10, equipment: ['home_gym','full_gym'] },
  cable_row:        { name: 'Cable Row',          icon: '🔁', muscle: 'mid-back',      detail: '4×10 reps',         sets:4, reps:10, equipment: ['full_gym'] },
  leg_press:        { name: 'Leg Press',          icon: '🦵', muscle: 'quads',         detail: '4×12 reps',         sets:4, reps:12, equipment: ['full_gym'] },
  pull_up:          { name: 'Pull-Ups',           icon: '🧗', muscle: 'back/biceps',   detail: '4×6 reps',          sets:4, reps:6,  equipment: ['home_gym','full_gym'] },
  treadmill:        { name: 'Treadmill Run',      icon: '🏃', muscle: 'cardio',        detail: '30 min steady',     sets:1, reps:'30m',equipment: ['home_gym','full_gym'] },

  /* ── Yoga / Flexibility ── */
  sun_sal:          { name: 'Sun Salutation',     icon: '🌞', muscle: 'full body',     detail: '3 rounds',          sets:3, reps:'flow',equipment: ['none','minimal','home_gym','full_gym'] },
  cat_cow:          { name: 'Cat-Cow Stretch',    icon: '🐱', muscle: 'spine',         detail: '2 min',             sets:1, reps:'2m', equipment: ['none','minimal','home_gym','full_gym'] },
  hip_flexor:       { name: 'Hip Flexor Stretch', icon: '🧘', muscle: 'hip flexors',   detail: '2×60 sec each',     sets:2, reps:'60s',equipment: ['none','minimal','home_gym','full_gym'] },
  downdog:          { name: 'Downward Dog',       icon: '🐕', muscle: 'hamstr/back',   detail: '3×45 sec hold',     sets:3, reps:'45s',equipment: ['none','minimal','home_gym','full_gym'] },
  child_pose:       { name: 'Child\'s Pose',      icon: '🙏', muscle: 'back/hips',     detail: '2×60 sec',          sets:2, reps:'60s',equipment: ['none','minimal','home_gym','full_gym'] },
  pigeon:           { name: 'Pigeon Pose',        icon: '🕊️', muscle: 'hip flexors',  detail: '2×60 sec each',     sets:2, reps:'60s',equipment: ['none','minimal','home_gym','full_gym'] },

  /* ── Cardio ── */
  jump_rope:        { name: 'Jump Rope',          icon: '🪢', muscle: 'cardio',        detail: '5×2 min rounds',    sets:5, reps:'2m', equipment: ['none','minimal','home_gym','full_gym'] },
  sprint:           { name: 'Sprint Intervals',   icon: '⚡', muscle: 'cardio/legs',   detail: '8×30 sec sprints',  sets:8, reps:'30s',equipment: ['none','minimal','home_gym','full_gym'] },
  stair_climb:      { name: 'Stair Climbs',       icon: '🪜', muscle: 'cardio/legs',   detail: '15 min',            sets:1, reps:'15m',equipment: ['none','minimal','home_gym','full_gym'] },
};

/* ── Workout templates by goal ── */
const WORKOUT_PLANS = {
  lose_weight: {
    label: 'Fat-Loss Circuit',
    focus: 'High-intensity intervals + compound movements',
    split: {
      2: [['burpee','high_knees','mountain_climber','squat','push_up','plank'], ['jump_squat','bicycle_crunch','lunge','glute_bridge','dip','side_plank']],
      3: [['push_up','squat','burpee','mountain_climber','plank'], ['lunge','glute_bridge','high_knees','bicycle_crunch','side_plank'], ['jump_squat','jump_rope','sprint','calf_raise','superman']],
      4: [['push_up','dip','diamond_push_up','lateral_raise'], ['squat','lunge','jump_squat','calf_raise'], ['burpee','high_knees','mountain_climber','jump_rope'], ['plank','bicycle_crunch','side_plank','superman']],
      5: [['push_up','dip','diamond_push_up'], ['squat','lunge','glute_bridge'], ['burpee','high_knees','sprint'], ['plank','bicycle_crunch','mountain_climber'], ['jump_rope','stair_climb','calf_raise']],
      6: [['push_up','dip'], ['squat','lunge'], ['high_knees','jump_rope'], ['plank','bicycle_crunch'], ['glute_bridge','hip_thrust_bw'], ['sprint','stair_climb']],
    }
  },
  build_muscle: {
    label: 'Hypertrophy Split',
    focus: 'Progressive overload + compound + isolation',
    split: {
      2: [['push_up','db_chest','lateral_raise','db_curl'], ['squat','deadlift','db_rdl','pull_up']],
      3: [['bench_press','push_up','db_chest','lateral_raise'], ['squat_bar','db_rdl','deadlift','calf_raise'], ['pull_up','lat_pulldown','db_curl','db_shoulder']],
      4: [['bench_press','push_up','db_chest','dip'], ['squat_bar','leg_press','db_goblet','calf_raise'], ['pull_up','lat_pulldown','band_row','db_curl'], ['db_shoulder','lateral_raise','diamond_push_up','db_rdl']],
      5: [['bench_press','db_chest','push_up'], ['squat_bar','leg_press','calf_raise'], ['pull_up','lat_pulldown','cable_row'], ['db_shoulder','lateral_raise','db_curl'], ['deadlift','db_rdl','glute_bridge']],
      6: [['bench_press','dip'], ['squat_bar','leg_press'], ['pull_up','cable_row'], ['db_shoulder','lateral_raise'], ['deadlift','calf_raise'], ['push_up','db_curl','db_chest']],
    }
  },
  maintain: {
    label: 'Balanced Fitness',
    focus: 'Functional strength + moderate cardio',
    split: {
      2: [['push_up','squat','plank','high_knees'], ['glute_bridge','lunge','bicycle_crunch','calf_raise']],
      3: [['push_up','squat','plank'], ['lunge','glute_bridge','bicycle_crunch'], ['burpee','mountain_climber','calf_raise']],
      4: [['push_up','db_chest','lateral_raise'], ['squat','lunge','calf_raise'], ['plank','bicycle_crunch','side_plank'], ['burpee','high_knees','jump_rope']],
      5: [['push_up','db_chest'], ['squat','lunge'], ['plank','bicycle_crunch'], ['burpee','high_knees'], ['glute_bridge','calf_raise']],
      6: [['push_up'], ['squat'], ['plank','side_plank'], ['lunge'], ['glute_bridge'], ['jump_rope','high_knees']],
    }
  },
  endurance: {
    label: 'Endurance Builder',
    focus: 'Cardio-dominant with functional strength',
    split: {
      2: [['sprint','jump_rope','high_knees','stair_climb'], ['burpee','mountain_climber','squat','push_up']],
      3: [['sprint','jump_rope','high_knees'], ['burpee','mountain_climber','stair_climb'], ['squat','push_up','plank']],
      4: [['sprint','jump_rope'], ['burpee','high_knees','stair_climb'], ['mountain_climber','bicycle_crunch','plank'], ['squat','push_up','lunge']],
      5: [['sprint','jump_rope'], ['burpee','stair_climb'], ['high_knees','mountain_climber'], ['plank','bicycle_crunch'], ['squat','push_up']],
      6: [['sprint'], ['jump_rope','stair_climb'], ['burpee'], ['high_knees'], ['mountain_climber','bicycle_crunch'], ['squat','push_up']],
    }
  },
  flexibility: {
    label: 'Flexibility & Mobility',
    focus: 'Yoga, dynamic stretching & mindful movement',
    split: {
      2: [['sun_sal','cat_cow','hip_flexor','child_pose'], ['downdog','pigeon','side_plank','superman']],
      3: [['sun_sal','cat_cow','hip_flexor'], ['downdog','pigeon','child_pose'], ['inchworm','side_plank','superman']],
      4: [['sun_sal','cat_cow'], ['hip_flexor','downdog'], ['pigeon','child_pose'], ['inchworm','side_plank','superman']],
      5: [['sun_sal'], ['cat_cow','hip_flexor'], ['downdog','pigeon'], ['child_pose','superman'], ['inchworm','side_plank']],
      6: [['sun_sal'], ['cat_cow'], ['hip_flexor','pigeon'], ['downdog'], ['child_pose'], ['inchworm','side_plank']],
    }
  }
};

const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const WORKOUT_LABELS = ['Upper Body Push','Lower Body','Full Body','Core & Cardio','Back & Pull','Shoulders & Arms','Active Recovery'];

/**
 * Generate a weekly workout plan.
 * @param {Object} profile
 * @returns {Object}
 */
function generateWorkoutPlan(profile) {
  const template = WORKOUT_PLANS[profile.goal] || WORKOUT_PLANS.maintain;
  const days     = parseInt(profile.schedule, 10) || 3;
  const split    = template.split[days] || template.split[3];

  const weekPlan = [];
  let workIdx = 0;

  for (let i = 0; i < 7; i++) {
    if (workIdx < days) {
      const exKeys = split[workIdx] || split[0];
      const exercises = exKeys
        .filter(k => EXERCISES[k] && EXERCISES[k].equipment.includes(profile.equipment))
        .map(k => EXERCISES[k]);

      // If equipment filter removes everything, fall back to bodyweight
      const finalExercises = exercises.length > 0
        ? exercises
        : exKeys.map(k => EXERCISES[k]).filter(Boolean).slice(0, 4);

      // Adjust intensity for health notes
      const isLowImpact = profile.health_notes &&
        /knee|back|joint|injury|pain|asthma/i.test(profile.health_notes);

      weekPlan.push({
        day:       DAY_NAMES[i],
        type:      WORKOUT_LABELS[workIdx % WORKOUT_LABELS.length],
        isRest:    false,
        exercises: isLowImpact
          ? finalExercises.filter(e => !/burpee|jump|sprint|deadlift/i.test(e.name.toLowerCase()))
          : finalExercises
      });
      workIdx++;
    } else {
      weekPlan.push({ day: DAY_NAMES[i], type: 'Rest', isRest: true });
    }
  }

  return {
    plan:  weekPlan,
    label: template.label,
    focus: template.focus
  };
}

/* ══════════════════════════════════════════════════════════
   3. DIET / MEAL DATABASE (CULTURAL)
   ══════════════════════════════════════════════════════════ */

const MEALS = {
  south_asian: {
    breakfast: [
      { name:'Masala Oats', desc:'Rolled oats tempered with cumin, veggies & chilli', cal:320, p:12, c:52, f:7, budget:'low',  tags:['vegetarian','vegan','gluten_free'] },
      { name:'Moong Dal Chilla', desc:'Protein-rich green moong crepes with mint chutney', cal:280, p:18, c:36, f:6, budget:'low',  tags:['vegetarian','vegan','gluten_free'] },
      { name:'Poha with Peas', desc:'Flattened rice with mustard seeds, turmeric & peas', cal:310, p:8,  c:58, f:5, budget:'low',  tags:['vegetarian','vegan','gluten_free'] },
      { name:'Egg Paratha', desc:'Whole-wheat flatbread stuffed with spiced egg', cal:420, p:22, c:46, f:14, budget:'low', tags:['halal'] },
      { name:'Paneer Bhurji + Roti', desc:'Scrambled cottage cheese with bell peppers', cal:390, p:24, c:38, f:16, budget:'medium', tags:['vegetarian'] },
    ],
    lunch: [
      { name:'Dal Tadka + Brown Rice', desc:'Yellow lentils with turmeric, cumin & rice', cal:520, p:22, c:82, f:8,  budget:'low',  tags:['vegetarian','vegan','gluten_free'] },
      { name:'Chicken Curry + Roti', desc:'Lean chicken in tomato-onion gravy with 2 rotis', cal:620, p:45, c:48, f:18, budget:'medium', tags:['halal'] },
      { name:'Rajma Rice', desc:'Kidney bean curry with steamed rice', cal:560, p:20, c:88, f:8, budget:'low', tags:['vegetarian','vegan','gluten_free'] },
      { name:'Tofu Palak', desc:'Spinach & tofu curry with millet roti', cal:410, p:26, c:34, f:16, budget:'medium', tags:['vegetarian','vegan','gluten_free'] },
    ],
    dinner: [
      { name:'Grilled Tandoori Chicken', desc:'Yoghurt-marinated grilled chicken with salad', cal:480, p:52, c:12, f:22, budget:'medium', tags:['halal','gluten_free'] },
      { name:'Lentil Soup + Chapati', desc:'Mixed dal soup with 2 whole-wheat chapatis', cal:440, p:21, c:66, f:9,  budget:'low',  tags:['vegetarian','vegan'] },
      { name:'Baingan Bharta + Quinoa', desc:'Smoked eggplant stir-fry with quinoa', cal:380, p:14, c:56, f:10, budget:'low', tags:['vegetarian','vegan','gluten_free'] },
      { name:'Fish Curry + Rice', desc:'Light coconut fish curry with steamed rice', cal:510, p:38, c:54, f:14, budget:'medium', tags:['halal','gluten_free'] },
    ],
    snack: [
      { name:'Roasted Chana', desc:'Spiced roasted chickpeas — 1 small bowl', cal:140, p:8,  c:20, f:3, budget:'low', tags:['vegetarian','vegan','gluten_free'] },
      { name:'Fruit Chaat', desc:'Seasonal fruit with chaat masala & lemon', cal:120, p:2,  c:28, f:1, budget:'low', tags:['vegetarian','vegan','gluten_free'] },
      { name:'Lassi (low-fat)', desc:'Blended yoghurt drink — unsweetened', cal:130, p:7,  c:14, f:3, budget:'low', tags:['vegetarian'] },
    ]
  },

  east_asian: {
    breakfast: [
      { name:'Congee with Egg', desc:'Rice porridge with soft-boiled egg & sesame', cal:290, p:14, c:48, f:5, budget:'low', tags:['gluten_free'] },
      { name:'Miso Soup + Tofu', desc:'Light miso broth with silken tofu & seaweed', cal:180, p:12, c:14, f:5, budget:'low', tags:['vegetarian','vegan'] },
      { name:'Kimchi Fried Rice', desc:'Brown rice stir-fried with kimchi & egg', cal:380, p:16, c:58, f:10, budget:'low', tags:['vegetarian'] },
    ],
    lunch: [
      { name:'Soba Noodle Bowl', desc:'Buckwheat noodles with edamame, cucumber & sesame', cal:430, p:18, c:68, f:8, budget:'low', tags:['vegetarian','vegan'] },
      { name:'Teriyaki Chicken Rice', desc:'Grilled chicken thigh with steamed rice & broccolini', cal:560, p:42, c:62, f:12, budget:'medium', tags:['gluten_free'] },
      { name:'Tofu Stir-Fry', desc:'Firm tofu with bok choy, mushrooms & brown rice', cal:420, p:24, c:54, f:10, budget:'low', tags:['vegetarian','vegan','gluten_free'] },
    ],
    dinner: [
      { name:'Salmon Miso Bowl', desc:'Baked salmon, steamed rice, miso-glazed veg', cal:540, p:44, c:52, f:16, budget:'high', tags:['gluten_free'] },
      { name:'Bibimbap (lean beef)', desc:'Mixed rice bowl with veggies, beef & gochujang', cal:580, p:38, c:70, f:12, budget:'medium', tags:[] },
      { name:'Vegetable Gyoza Bowl', desc:'Pan-fried dumplings over brown rice & edamame', cal:450, p:16, c:68, f:12, budget:'medium', tags:['vegetarian'] },
    ],
    snack: [
      { name:'Edamame', desc:'Steamed salted edamame — 1 cup', cal:120, p:11, c:10, f:5, budget:'low', tags:['vegetarian','vegan','gluten_free'] },
      { name:'Rice Cakes + PB', desc:'2 rice cakes with a tbsp peanut butter', cal:160, p:5,  c:22, f:6, budget:'low', tags:['vegetarian','vegan','gluten_free'] },
    ]
  },

  middle_eastern: {
    breakfast: [
      { name:'Ful Medames', desc:'Stewed fava beans with olive oil, lemon & cumin', cal:320, p:16, c:44, f:8, budget:'low', tags:['vegetarian','vegan','gluten_free','halal'] },
      { name:'Shakshuka', desc:'Eggs poached in spiced tomato-pepper sauce', cal:350, p:20, c:22, f:18, budget:'low', tags:['vegetarian','halal','gluten_free'] },
      { name:'Labneh + Whole-wheat Pita', desc:'Strained yoghurt with olive oil & za\'atar', cal:290, p:14, c:34, f:10, budget:'low', tags:['vegetarian','halal'] },
    ],
    lunch: [
      { name:'Grilled Chicken Shawarma Bowl', desc:'Marinated chicken, tabbouleh & hummus over rice', cal:610, p:48, c:58, f:18, budget:'medium', tags:['halal','gluten_free'] },
      { name:'Lentil & Spinach Soup', desc:'Hearty red-lentil soup with lemon & cumin', cal:380, p:20, c:54, f:6, budget:'low', tags:['vegetarian','vegan','halal','gluten_free'] },
      { name:'Falafel Plate', desc:'Baked falafel, cucumber salad, tahini & pita', cal:520, p:18, c:66, f:18, budget:'low', tags:['vegetarian','vegan','halal'] },
    ],
    dinner: [
      { name:'Grilled Fish + Fattoush', desc:'Lemon-herb grilled fish with bread salad', cal:490, p:42, c:40, f:16, budget:'medium', tags:['halal','gluten_free'] },
      { name:'Lamb Kebab + Rice', desc:'Lean minced lamb kebab with saffron rice', cal:620, p:44, c:58, f:20, budget:'medium', tags:['halal','gluten_free'] },
      { name:'Chickpea Stew (Hummus Ful)', desc:'Warm chickpea stew with cumin & coriander', cal:430, p:18, c:62, f:10, budget:'low', tags:['vegetarian','vegan','halal','gluten_free'] },
    ],
    snack: [
      { name:'Hummus + Veggies', desc:'2 tbsp hummus with carrot & cucumber sticks', cal:110, p:5, c:14, f:4, budget:'low', tags:['vegetarian','vegan','halal','gluten_free'] },
      { name:'Dates + Almonds', desc:'3 medjool dates with 10 almonds', cal:180, p:4, c:32, f:8, budget:'low', tags:['vegetarian','vegan','halal','gluten_free'] },
    ]
  },

  african: {
    breakfast: [
      { name:'Akamu (Pap) + Egg', desc:'Fermented corn porridge with a boiled egg', cal:300, p:14, c:48, f:6, budget:'low', tags:['gluten_free'] },
      { name:'Plantain & Bean Fritters', desc:'Mashed ripe plantain & black-eyed pea patties', cal:340, p:10, c:58, f:8, budget:'low', tags:['vegetarian','vegan','gluten_free'] },
    ],
    lunch: [
      { name:'Jollof Rice + Grilled Chicken', desc:'Spiced tomato rice with herb-grilled chicken', cal:580, p:42, c:64, f:14, budget:'low', tags:['gluten_free'] },
      { name:'Black-Eye Bean Stew + Rice', desc:'Cowpea stew with palm-tomato sauce', cal:490, p:22, c:76, f:8, budget:'low', tags:['vegetarian','vegan','gluten_free'] },
    ],
    dinner: [
      { name:'Egusi Soup + Fufu', desc:'Melon-seed protein soup with cassava fufu', cal:620, p:28, c:74, f:26, budget:'low', tags:['gluten_free'] },
      { name:'Grilled Tilapia + Greens', desc:'Whole grilled fish with sautéed collard greens', cal:440, p:44, c:16, f:20, budget:'medium', tags:['gluten_free'] },
    ],
    snack: [
      { name:'Groundnut (Peanut) Mix', desc:'Roasted peanuts with dried fruits — small handful', cal:160, p:7, c:14, f:10, budget:'low', tags:['vegetarian','vegan','gluten_free'] },
    ]
  },

  latin: {
    breakfast: [
      { name:'Huevos Rancheros', desc:'Eggs on corn tortillas with tomato-chile salsa', cal:390, p:22, c:36, f:18, budget:'low', tags:['vegetarian','gluten_free'] },
      { name:'Avocado Toast + Egg', desc:'Whole-grain toast, mashed avo, poached egg', cal:380, p:18, c:36, f:20, budget:'medium', tags:['vegetarian'] },
      { name:'Smoothie Bowl', desc:'Blended banana, mango, berries + granola topping', cal:340, p:8,  c:62, f:7, budget:'medium', tags:['vegetarian','vegan'] },
    ],
    lunch: [
      { name:'Black Bean Rice Bowl', desc:'Seasoned black beans, brown rice & pico de gallo', cal:520, p:22, c:84, f:8, budget:'low', tags:['vegetarian','vegan','gluten_free'] },
      { name:'Chicken Burrito Bowl', desc:'Grilled chicken, rice, beans, salsa & Greek yoghurt', cal:620, p:48, c:66, f:14, budget:'medium', tags:['gluten_free'] },
    ],
    dinner: [
      { name:'Carne Asada + Salad', desc:'Lean grilled beef with lime, veggies & salsa', cal:490, p:46, c:14, f:24, budget:'medium', tags:['gluten_free'] },
      { name:'Lentil Pozole (Vegan)', desc:'Red lentil hominy stew with oregano & radish', cal:420, p:18, c:64, f:6, budget:'low', tags:['vegetarian','vegan','gluten_free'] },
    ],
    snack: [
      { name:'Guac + Veggies', desc:'Homemade guacamole with bell pepper strips', cal:140, p:2, c:10, f:12, budget:'low', tags:['vegetarian','vegan','gluten_free'] },
      { name:'Protein Licuado', desc:'Blended milk, banana & natural peanut butter', cal:280, p:14, c:36, f:10, budget:'low', tags:['vegetarian'] },
    ]
  },

  western: {
    breakfast: [
      { name:'Greek Yoghurt Parfait', desc:'Low-fat Greek yoghurt, berries & oats', cal:310, p:20, c:42, f:6, budget:'medium', tags:['vegetarian','gluten_free'] },
      { name:'Omelette + Whole-grain Toast', desc:'3-egg omelette with spinach, tomato & toast', cal:380, p:26, c:32, f:16, budget:'medium', tags:['vegetarian'] },
      { name:'Overnight Oats', desc:'Oats soaked in almond milk, chia, banana', cal:350, p:12, c:56, f:8, budget:'low', tags:['vegetarian','vegan'] },
    ],
    lunch: [
      { name:'Grilled Chicken Salad', desc:'Mixed greens, grilled chicken, avocado, olive oil', cal:450, p:42, c:14, f:24, budget:'medium', tags:['gluten_free'] },
      { name:'Turkey & Veggie Wrap', desc:'Whole-wheat wrap with turkey, hummus & veggies', cal:480, p:36, c:48, f:14, budget:'medium', tags:[] },
      { name:'Lentil Soup + Bread', desc:'Hearty lentil soup with a slice of sourdough', cal:410, p:20, c:62, f:6, budget:'low', tags:['vegetarian'] },
    ],
    dinner: [
      { name:'Baked Salmon + Quinoa', desc:'Herb-crusted salmon with roasted veg & quinoa', cal:560, p:46, c:40, f:22, budget:'high', tags:['gluten_free'] },
      { name:'Chicken & Sweet Potato', desc:'Oven-roasted chicken breast with sweet potato mash', cal:520, p:48, c:42, f:14, budget:'medium', tags:['gluten_free'] },
      { name:'Bean Chilli', desc:'Three-bean chilli with brown rice & sour cream', cal:490, p:24, c:72, f:10, budget:'low', tags:['vegetarian','vegan','gluten_free'] },
    ],
    snack: [
      { name:'Apple + Almond Butter', desc:'1 medium apple with 1 tbsp almond butter', cal:170, p:4, c:28, f:8, budget:'low', tags:['vegetarian','vegan','gluten_free'] },
      { name:'Protein Bar (homemade)', desc:'Oat, honey, peanut butter & chocolate chip bar', cal:200, p:10, c:26, f:8, budget:'low', tags:['vegetarian'] },
    ]
  },

  mediterranean: {
    breakfast: [
      { name:'Avocado + Poached Eggs', desc:'Sourdough toast, avo, 2 poached eggs & feta', cal:420, p:22, c:34, f:22, budget:'medium', tags:['vegetarian'] },
      { name:'Greek Yoghurt + Honey + Walnuts', desc:'Full-fat Greek yoghurt, walnuts, drizzle of honey', cal:300, p:18, c:24, f:14, budget:'medium', tags:['vegetarian','gluten_free'] },
      { name:'Frittata (veggie)', desc:'Baked egg frittata with spinach, peppers & feta', cal:340, p:24, c:12, f:22, budget:'medium', tags:['vegetarian','gluten_free'] },
    ],
    lunch: [
      { name:'Tuna Nicoise Salad', desc:'Tuna, green beans, egg, olives & Dijon vinaigrette', cal:480, p:44, c:22, f:22, budget:'medium', tags:['gluten_free'] },
      { name:'Falafel Wrap', desc:'Baked falafel, tzatziki, tomato & cucumber in pita', cal:510, p:18, c:64, f:18, budget:'low', tags:['vegetarian','vegan'] },
      { name:'Greek Chicken Bowl', desc:'Lemon-herb chicken, tabbouleh, hummus & olives', cal:580, p:46, c:46, f:20, budget:'medium', tags:['gluten_free'] },
    ],
    dinner: [
      { name:'Baked Sea Bass + Ratatouille', desc:'Lemon-caper sea bass with Provençal vegetables', cal:480, p:44, c:18, f:22, budget:'high', tags:['gluten_free'] },
      { name:'Lamb Souvlaki + Pita', desc:'Grilled lamb skewer with tzatziki & Greek salad', cal:560, p:42, c:44, f:20, budget:'medium', tags:[] },
      { name:'Pasta e Fagioli', desc:'Whole-wheat pasta & cannellini bean soup', cal:500, p:22, c:74, f:10, budget:'low', tags:['vegetarian','vegan'] },
    ],
    snack: [
      { name:'Olives + Cheese', desc:'10 olives with a small wedge of feta', cal:120, p:4, c:2, f:11, budget:'low', tags:['vegetarian','gluten_free'] },
      { name:'Tzatziki + Pita Bread', desc:'2 tbsp tzatziki with a small pitta', cal:150, p:6, c:22, f:4, budget:'low', tags:['vegetarian'] },
    ]
  },

  mixed: {
    breakfast: [
      { name:'Protein Oatmeal', desc:'Rolled oats, protein powder, banana & nut butter', cal:380, p:28, c:52, f:10, budget:'medium', tags:['vegetarian'] },
      { name:'Veggie Scramble', desc:'3 eggs scrambled with bell peppers, onion & spinach', cal:320, p:24, c:14, f:18, budget:'low', tags:['vegetarian','gluten_free'] },
      { name:'Smoothie + Toast', desc:'Banana-berry smoothie with 2 slices whole-grain toast', cal:350, p:10, c:62, f:6, budget:'medium', tags:['vegetarian','vegan'] },
    ],
    lunch: [
      { name:'Chicken & Veggie Bowl', desc:'Grilled chicken, quinoa, roasted veggies & lemon dressing', cal:540, p:44, c:52, f:14, budget:'medium', tags:['gluten_free'] },
      { name:'Bean & Grain Bowl', desc:'Black beans, farro, roasted sweet potato & tahini', cal:490, p:20, c:72, f:12, budget:'low', tags:['vegetarian','vegan'] },
    ],
    dinner: [
      { name:'Baked Chicken + Veggies', desc:'Herb-roasted chicken breast with broccoli & brown rice', cal:510, p:46, c:46, f:12, budget:'medium', tags:['gluten_free'] },
      { name:'Tofu Stir-Fry + Noodles', desc:'Crispy tofu, mixed veg & soba noodles in ginger sauce', cal:460, p:22, c:60, f:14, budget:'low', tags:['vegetarian','vegan'] },
    ],
    snack: [
      { name:'Mixed Nuts + Fruit', desc:'Small handful of mixed nuts with an orange', cal:190, p:5, c:24, f:10, budget:'low', tags:['vegetarian','vegan','gluten_free'] },
      { name:'Cottage Cheese + Pineapple', desc:'½ cup cottage cheese with fresh pineapple chunks', cal:150, p:14, c:16, f:3, budget:'medium', tags:['vegetarian','gluten_free'] },
    ]
  }
};

const GROCERY_DB = {
  south_asian:    { Proteins:['Chicken breast','Eggs','Moong dal','Paneer / Tofu','Lentils (mixed)'], Grains:['Brown rice','Whole-wheat flour (atta)','Rolled oats','Poha (flattened rice)'], Produce:['Spinach','Tomatoes','Onions','Ginger','Garlic','Eggplant','Bell peppers'], Dairy:['Low-fat yoghurt','Low-fat milk'], Pantry:['Cumin seeds','Turmeric','Coriander powder','Mustard seeds','Olive oil'] },
  east_asian:     { Proteins:['Salmon (frozen)','Chicken thighs','Firm tofu','Edamame (frozen)','Eggs'], Grains:['Short-grain rice','Soba noodles','Rice cakes'], Produce:['Bok choy','Shiitake mushrooms','Cucumber','Carrots','Scallions'], Dairy:['Miso paste'], Pantry:['Low-sodium soy sauce','Sesame oil','Rice vinegar','Gochujang'] },
  middle_eastern: { Proteins:['Chicken breast','Lamb mince','Canned chickpeas','Fava beans','Eggs'], Grains:['Pita bread (whole wheat)','Bulgur wheat','Basmati rice'], Produce:['Tomatoes','Cucumber','Parsley','Mint','Lemon','Eggplant'], Dairy:['Greek yoghurt (Labneh)','Feta'], Pantry:['Tahini','Olive oil','Cumin','Za\'atar','Canned tomatoes'] },
  african:        { Proteins:['Tilapia / any white fish','Chicken legs','Canned black-eyed peas','Eggs'], Grains:['Jollof rice (parboiled)','Cassava / yam','Corn meal'], Produce:['Plantains','Tomatoes','Onions','Collard greens','Scotch bonnet peppers'], Dairy:['Evaporated milk (occasional)'], Pantry:['Palm oil (small)','Egusi seeds','Crayfish','Groundnut paste','Canned tomatoes'] },
  latin:          { Proteins:['Chicken breast','Lean beef','Canned black beans','Eggs'], Grains:['Brown rice','Corn tortillas','Whole-grain bread'], Produce:['Avocado','Bell peppers','Tomatoes','Jalapeño','Lime','Sweet potato'], Dairy:['Greek yoghurt','Low-fat cheese'], Pantry:['Olive oil','Cumin','Chilli powder','Salsa (jar)','Apple cider vinegar'] },
  western:        { Proteins:['Chicken breast','Canned tuna','Greek yoghurt','Eggs','Turkey deli'], Grains:['Oats','Whole-grain bread','Quinoa'], Produce:['Mixed greens','Broccoli','Cherry tomatoes','Berries (frozen)','Banana'], Dairy:['Low-fat milk','Greek yoghurt','Cottage cheese'], Pantry:['Olive oil','Dijon mustard','Canned beans','Nut butter'] },
  mediterranean:  { Proteins:['Salmon','Chicken thighs','Canned tuna','Feta','Eggs'], Grains:['Sourdough bread','Whole-wheat pasta','Quinoa'], Produce:['Tomatoes','Cucumber','Olives','Spinach','Eggplant','Lemon'], Dairy:['Greek yoghurt','Feta cheese'], Pantry:['Olive oil (extra virgin)','Tahini','Capers','Harissa','Canned chickpeas'] },
  mixed:          { Proteins:['Chicken breast','Eggs','Tofu','Cottage cheese','Canned beans'], Grains:['Brown rice','Oats','Whole-grain bread','Quinoa'], Produce:['Broccoli','Sweet potato','Spinach','Banana','Berries','Tomatoes'], Dairy:['Greek yoghurt','Low-fat milk'], Pantry:['Olive oil','Soy sauce','Nut butter','Canned tomatoes','Spice blend'] }
};

const DIET_RESTRICTION_LABELS = {
  none: 'No Restriction', vegetarian: 'Vegetarian', vegan: 'Vegan',
  halal: 'Halal', gluten_free: 'Gluten-Free', lactose_free: 'Lactose-Free'
};

/**
 * Generate a daily meal plan.
 */
function generateDietPlan(profile, targetCalories, macros) {
  const db = MEALS[profile.cuisine] || MEALS.mixed;
  const dietType = profile.diet_type;
  const budgetLevel = profile.budget;

  // Meals are matched on their text because only some are explicitly tagged.
  const NON_HALAL   = /\b(pork|bacon|ham|sausage|salami|pepperoni|lard|gelatin|wine|beer|rum|sake|mirin)\b/i;
  const DAIRY       = /\b(milk|yoghurt|yogurt|cheese|paneer|feta|cottage|ghee|butter|labneh|tzatziki|cream|curd|raita|lassi|kefir|whey|halloumi|mozzarella|parmesan|ricotta|custard)\b/i;
  const PLANT_MILK  = /\b(coconut|almond|soy|oat|rice)\s+(milk|yoghurt|yogurt|cream)\b/i;

  function matchesDiet(m) {
    if (!dietType || dietType === 'none') return true;
    const text = `${m.name} ${m.desc}`;
    if (dietType === 'halal')       return m.tags.includes('halal') || !NON_HALAL.test(text);
    if (dietType === 'lactose_free') return m.tags.includes('vegan') || !DAIRY.test(text.replace(PLANT_MILK, ''));
    return m.tags.includes(dietType);              // vegetarian, vegan, gluten_free
  }

  const warnings = [];

  function filterMeals(arr) {
    return arr.filter(m => matchesDiet(m) && !(budgetLevel === 'low' && m.budget === 'high'));
  }

  function pick(arr, slot) {
    const filtered = filterMeals(arr);
    if (filtered.length) return filtered[Math.floor(Math.random() * filtered.length)];
    // Budget is a soft preference: relax it first, but never relax the dietary restriction silently.
    const dietOnly = arr.filter(matchesDiet);
    if (dietOnly.length) return dietOnly[Math.floor(Math.random() * dietOnly.length)];
    warnings.push(`No ${slot} option in this cuisine fully matches your "${DIET_RESTRICTION_LABELS[dietType] || dietType}" preference — please check the ingredients or try the Mixed cuisine.`);
    return arr[Math.floor(Math.random() * arr.length)];
  }

  const breakfast = pick(db.breakfast, 'breakfast');
  const lunch     = pick(db.lunch,     'lunch');
  const dinner    = pick(db.dinner,    'dinner');
  const snack     = pick(db.snack,     'snack');

  const totalCal = breakfast.cal + lunch.cal + dinner.cal + snack.cal;
  const gap      = targetCalories - totalCal;

  return {
    meals: [
      { time: '7:30 AM',  label: 'Breakfast', ...breakfast },
      { time: '12:30 PM', label: 'Lunch',     ...lunch     },
      { time: '4:00 PM',  label: 'Snack',     ...snack     },
      { time: '7:30 PM',  label: 'Dinner',    ...dinner    },
    ],
    totalCal,
    targetCalories,
    gap,
    macros,
    warnings,
    grocery: GROCERY_DB[profile.cuisine] || GROCERY_DB.mixed
  };
}

/* ══════════════════════════════════════════════════════════
   4. TIPS ENGINE
   ══════════════════════════════════════════════════════════ */

function generateTips(profile, calories) {
  const tips = [];

  if (profile.goal === 'lose_weight')  tips.push({ icon:'💧', title:'Stay Hydrated',      text:'Drink 2–3 L water daily. A glass before meals reduces caloric intake by ~13%.' });
  if (profile.goal === 'build_muscle') tips.push({ icon:'😴', title:'Sleep for Gains',     text:'Muscle synthesis peaks during deep sleep. Aim for 8 hours per night.' });
  if (profile.goal === 'endurance')    tips.push({ icon:'🩺', title:'Zone-2 Cardio',       text:'Keep 60–70% of your max heart rate for long steady-state sessions for the best endurance base.' });
  if (profile.goal === 'flexibility')  tips.push({ icon:'🌡️', title:'Warm Before Stretch', text:'Static stretching on cold muscles increases injury risk. Always warm up for 5–10 min first.' });

  if (calorieFloorApplied(profile)) tips.push({ icon:'⚠️', title:'Calorie Floor Applied', text:`Your goal would need fewer than ${minCalories(profile.gender)} kcal/day, which is below a safe minimum, so your target was raised to ${calories} kcal. Lose weight gradually and speak to a doctor or dietitian.` });

  if (profile.budget === 'low')    tips.push({ icon:'🛒', title:'Budget Protein Hacks',  text:'Eggs, lentils, canned chickpeas & frozen fish are the cheapest complete proteins — buy in bulk.' });
  if (profile.equipment === 'none') tips.push({ icon:'🏠', title:'Home is Your Gym',      text:'A chair, wall, and your bodyweight is enough to build real strength. Consistency beats equipment.' });

  tips.push({ icon:'🥗', title:'Prep on Sundays',     text:'Meal prepping one day a week saves money, time and calories — you\'re 3× less likely to eat junk.' });
  tips.push({ icon:'📱', title:'Track Your Progress', text:'Use the Progress tab to log your weight weekly. Seeing the trend is highly motivating.' });
  tips.push({ icon:'⏱️', title:'Rest 60–90 Seconds',  text:'Short rest between sets keeps heart rate elevated. For strength, rest 2–3 min between heavy sets.' });

  if (profile.health_notes && /stress|anxiety|mental/i.test(profile.health_notes)) {
    tips.push({ icon:'🧘', title:'Exercise & Mental Health', text:'Even a 20-min walk raises endorphins and reduces cortisol. Prioritise movement for stress relief.' });
  }

  tips.sort((a, b) => (b.title === 'Calorie Floor Applied') - (a.title === 'Calorie Floor Applied'));
  return tips.slice(0, 6);
}

/* ══════════════════════════════════════════════════════════
   5. INSIGHTS GENERATOR
   ══════════════════════════════════════════════════════════ */

function generateInsights(profile, calories, macros, bmi) {
  const bmiCat    = getBMICategory(bmi);
  const water     = calcWaterIntake(profile.weight, profile.activity);
  const ideal     = calcIdealWeight(profile.height, profile.gender);
  const weightDiff = +(profile.weight - ideal).toFixed(1);
  const bmr       = Math.round(calcBMR(profile.weight, profile.height, profile.age, profile.gender));

  const GOAL_DESC = {
    lose_weight:  'Your plan is set to a 500 kcal daily deficit — safe, sustainable fat loss of ~0.5 kg/week.',
    build_muscle: 'Your plan has a 300 kcal surplus with high protein to maximise muscle protein synthesis.',
    maintain:     'Your calories are set at maintenance to support an active, balanced lifestyle.',
    endurance:    'Your plan is carb-heavy to fuel long aerobic sessions and replenish glycogen stores.',
    flexibility:  'Calories are at maintenance; focus is on recovery, mobility and stress management.'
  };

  const insights = {
    bmi, bmiCat, water, ideal, weightDiff, bmr, calories, macros,
    goalDesc: GOAL_DESC[profile.goal] || '',
    macroBreakdown: [
      { label: 'Protein', grams: macros.protein, cal: macros.protein * 4, pct: Math.round((macros.protein * 4 / calories) * 100), color: '#00d4aa' },
      { label: 'Carbs',   grams: macros.carbs,   cal: macros.carbs * 4,   pct: Math.round((macros.carbs * 4 / calories) * 100),   color: '#ffd166' },
      { label: 'Fat',     grams: macros.fat,      cal: macros.fat * 9,     pct: Math.round((macros.fat * 9 / calories) * 100),     color: '#ff8e8e' },
    ],
    aiCards: buildInsightCards(profile, calories, macros, bmi, water, ideal, weightDiff)
  };
  return insights;
}

function buildInsightCards(profile, calories, macros, bmi, water, ideal, weightDiff) {
  const cards = [];
  const b = parseFloat(bmi);

  // BMI card
  cards.push({
    icon: b < 18.5 ? '📉' : b < 25 ? '✅' : b < 30 ? '⚠️' : '🚨',
    title: 'BMI Analysis',
    text: `Your BMI of ${bmi} falls in the <strong>${getBMICategory(bmi).label}</strong> range. ${getBMICategory(bmi).advice}`,
    accent: getBMICategory(bmi).color
  });

  // Ideal weight card
  if (Math.abs(weightDiff) > 2) {
    cards.push({
      icon: weightDiff > 0 ? '⬇️' : '⬆️',
      title: 'Ideal Weight Target',
      text: `Your estimated ideal weight (Devine formula) is <strong>${ideal} kg</strong>. You are ${Math.abs(weightDiff)} kg ${weightDiff > 0 ? 'above' : 'below'} that target.`,
      accent: '#3a7eff'
    });
  }

  // Water intake card
  cards.push({
    icon: '💧',
    title: 'Daily Water Goal',
    text: `Based on your weight and activity level, you should drink at least <strong>${(water/1000).toFixed(1)} L</strong> of water per day to stay optimally hydrated.`,
    accent: '#3a7eff'
  });

  // Calorie breakdown card
  cards.push({
    icon: '🔥',
    title: 'Your Energy Budget',
    text: `Your Basal Metabolic Rate (BMR) is ~<strong>${Math.round(calcBMR(profile.weight, profile.height, profile.age, profile.gender))} kcal</strong>. Your daily target of <strong>${calories} kcal</strong> accounts for your activity and goal adjustment.`,
    accent: '#ffd166'
  });

  // Protein timing card
  cards.push({
    icon: '🥩',
    title: 'Protein Target',
    text: `You need <strong>${macros.protein}g of protein daily</strong> (~${Math.round(macros.protein / profile.weight * 10) / 10}g per kg of body weight). Spread this across 3–4 meals for best absorption.`,
    accent: '#00d4aa'
  });

  // Goal-specific card
  if (profile.goal === 'lose_weight') {
    cards.push({
      icon: '📅',
      title: 'Expected Timeline',
      text: `At a 500 kcal/day deficit you can expect to lose ~<strong>0.5 kg per week</strong>. Losing ${Math.abs(weightDiff)} kg would take approximately ${Math.ceil(Math.abs(weightDiff) / 0.5)} weeks.`,
      accent: '#e5263a'
    });
  }

  if (profile.goal === 'build_muscle') {
    cards.push({
      icon: '💪',
      title: 'Muscle Growth Rate',
      text: `Natural muscle gain averages <strong>0.5–1 kg/month</strong> for beginners. Progressive overload (adding weight/reps weekly) is the key driver. Track your lifts in the Progress tab.`,
      accent: '#3a7eff'
    });
  }

  if (profile.equipment === 'none') {
    cards.push({
      icon: '🏠',
      title: 'No Equipment? No Problem',
      text: `Bodyweight training can build significant muscle and endurance. Focus on progressive variations: push-up → diamond → archer. Aim for failure on each set.`,
      accent: '#ffd166'
    });
  }

  // Sleep card
  cards.push({
    icon: '😴',
    title: 'Recovery & Sleep',
    text: `Aim for <strong>7–9 hours of sleep</strong> nightly. Growth hormone peaks during the first 90 min of deep sleep — poor sleep directly reduces strength gains and fat loss.`,
    accent: '#7c5cd8'
  });

  return cards.slice(0, 6);
}

/* ══════════════════════════════════════════════════════════
   6. MASTER GENERATE FUNCTION
   ══════════════════════════════════════════════════════════ */

function generateFullPlan(profile) {
  const calories    = calcTDEE(profile);
  const macros      = calcMacros(calories, profile.goal);
  const bmi         = calcBMI(profile.weight, profile.height);
  const workoutPlan = generateWorkoutPlan(profile);
  const dietPlan    = generateDietPlan(profile, calories, macros);
  const tips        = generateTips(profile, calories);
  const insights    = generateInsights(profile, calories, macros, bmi);

  return {
    profile,
    calories,
    macros,
    bmi,
    workoutPlan,
    dietPlan,
    tips,
    insights
  };
}