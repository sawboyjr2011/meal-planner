// Meal Plan Builder v3 (Personal) - GitHub Pages friendly
// Recipe import: TheMealDB (free)  https://www.themealdb.com/api.php
// Nutrition: USDA FoodData Central (free) https://fdc.nal.usda.gov/api-guide

const LS = {
  recipes: "mp_recipes_v3",
  targets: "mp_targets_v3",
  exclusions: "mp_exclusions_v3",
  plan: "mp_plan_v3",
  filterMode: "mp_filter_mode_v3",
  usdaKey: "mp_usda_key_v1",
  mealTargets: "mp_meal_targets_v1"
};

const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);
const norm = (s) => (s || "").toString().trim().toLowerCase();
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function loadJSON(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function saveJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
const $ = (id) => document.getElementById(id);

let recipes = loadJSON(LS.recipes, []);
let targets = loadJSON(LS.targets, { cal:"", pro:"", car:"", fat:"", sod:"", fib:"", sat:"", sug:"" });
let exclusions = loadJSON(LS.exclusions, []);
let plan = loadJSON(LS.plan, { breakfast:[], lunch:[], dinner:[], snack:[] });
let mealTargets = loadJSON(LS.mealTargets, { b:"", l:"", d:"", s:"" });
let usdaKey = (localStorage.getItem(LS.usdaKey) || "").trim();

function containsExcluded(recipe) {
  const ex = exclusions.map(norm).filter(Boolean);
  if (!ex.length) return [];
  const hay = (recipe.ingredients || []).map(norm).join("\n");
  return ex.filter(x => x && hay.includes(x));
}

function escapeHTML(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c]));
}

// ---------- GL helpers ----------
function netCarbs(carbs, fiber) {
  const nc = num(carbs) - num(fiber);
  return nc < 0 ? 0 : nc;
}
function glycemicLoad(gi, carbs, fiber) {
  // GL = (GI/100) * net carbs
  const g = num(gi);
  return (g / 100) * netCarbs(carbs, fiber);
}

// ---------- Totals ----------
function calcTotals() {
  const totals = {
    cal:0, pro:0, car:0, fat:0, sod:0, fib:0,
    sug:0, sat:0, pot:0,
    gl:0
  };

  for (const slot of Object.keys(plan)) {
    for (const entry of plan[slot]) {
      const r = recipes.find(x => x.id === entry.recipeId);
      if (!r) continue;
      const s = num(entry.servings);
      totals.cal += num(r.cal) * s;
      totals.pro += num(r.pro) * s;
      totals.car += num(r.car) * s;
      totals.fat += num(r.fat) * s;
      totals.sod += num(r.sod) * s;
      totals.fib += num(r.fib) * s;
      totals.sug += num(r.sug) * s;
      totals.sat += num(r.sat) * s;
      totals.pot += num(r.pot) * s;

      const gi = (r.gi == null || r.gi === "") ? 55 : num(r.gi);
      totals.gl += glycemicLoad(gi, num(r.car) * s, num(r.fib) * s);
    }
  }
  return totals;
}

function calcMealProteinTotals() {
  const out = { b:0, l:0, d:0, s:0 };
  for (const entry of plan.breakfast) out.b += num(getRecipe(entry.recipeId)?.pro) * num(entry.servings);
  for (const entry of plan.lunch) out.l += num(getRecipe(entry.recipeId)?.pro) * num(entry.servings);
  for (const entry of plan.dinner) out.d += num(getRecipe(entry.recipeId)?.pro) * num(entry.servings);
  for (const entry of plan.snack) out.s += num(getRecipe(entry.recipeId)?.pro) * num(entry.servings);
  return out;
}

function getRecipe(id) { return recipes.find(r => r.id === id); }

// ---------- Rendering ----------
function renderTargets() {
  $("t_cal").value = targets.cal ?? "";
  $("t_pro").value = targets.pro ?? "";
  $("t_car").value = targets.car ?? "";
  $("t_fat").value = targets.fat ?? "";
  $("t_sod").value = targets.sod ?? "";
  $("t_fib").value = targets.fib ?? "";
  $("t_sat").value = targets.sat ?? "";
  $("t_sug").value = targets.sug ?? "";

  $("m_pro_b").value = mealTargets.b ?? "";
  $("m_pro_l").value = mealTargets.l ?? "";
  $("m_pro_d").value = mealTargets.d ?? "";
  $("m_pro_s").value = mealTargets.s ?? "";

  $("usdaKey").value = usdaKey;
}

function renderExclusions() {
  const wrap = $("exclusions");
  wrap.innerHTML = "";
  exclusions.forEach((e, idx) => {
    const pill = document.createElement("div");
    pill.className = "pill";
    pill.textContent = e;
    pill.title = "Tap to remove";
    pill.onclick = () => {
      exclusions.splice(idx, 1);
      saveJSON(LS.exclusions, exclusions);
      renderExclusions();
      renderRecipes();
      renderSuggestions();
    };
    wrap.appendChild(pill);
  });
}

function renderPlan() {
  const pv = $("planView");
  pv.innerHTML = "";

  for (const slot of ["breakfast","lunch","dinner","snack"]) {
    const section = document.createElement("div");
    section.className = "item";
    section.innerHTML = `<h3>${slot[0].toUpperCase()+slot.slice(1)}</h3>`;

    if (!plan[slot].length) {
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.textContent = "No recipes added.";
      section.appendChild(empty);
    } else {
      plan[slot].forEach((entry, idx) => {
        const r = getRecipe(entry.recipeId);
        const row = document.createElement("div");
        row.className = "item";
        row.style.marginTop = "8px";

        const gi = (r?.gi == null || r?.gi === "") ? 55 : num(r.gi);
        const gl = r ? glycemicLoad(gi, num(r.car)*num(entry.servings), num(r.fib)*num(entry.servings)) : 0;

        row.innerHTML = `
          <div><strong>${r ? r.name : "Missing recipe"}</strong> <span class="hint">(${entry.servings} serving${num(entry.servings)===1?"":"s"})</span></div>
          ${r ? `<div class="meta">
            <span>${(num(r.cal)*num(entry.servings)).toFixed(0)} cal</span>
            <span>${(num(r.pro)*num(entry.servings)).toFixed(1)}P</span>
            <span>${(num(r.car)*num(entry.servings)).toFixed(1)}C</span>
            <span>${(num(r.fat)*num(entry.servings)).toFixed(1)}F</span>
            ${num(r.sod) ? `<span>${(num(r.sod)*num(entry.servings)).toFixed(0)} mg sodium</span>` : ``}
            ${num(r.fib) ? `<span>${(num(r.fib)*num(entry.servings)).toFixed(1)} g fiber</span>` : ``}
            <span>GL~ ${gl.toFixed(1)}</span>
          </div>` : ``}
        `;

        const rm = document.createElement("button");
        rm.className = "danger";
        rm.textContent = "Remove";
        rm.onclick = () => {
          plan[slot].splice(idx, 1);
          saveJSON(LS.plan, plan);
          renderPlan();
          renderTotals();
          renderMealProtein();
          renderSuggestions();
        };

        const btnRow = document.createElement("div");
        btnRow.className = "split mt8";
        btnRow.appendChild(rm);
        row.appendChild(btnRow);

        section.appendChild(row);
      });
    }
    pv.appendChild(section);
  }
}

function fmtLine(label, actual, target, unit, tol) {
  const hasT = target !== "" && target != null && Number.isFinite(Number(target));
  const diff = hasT ? (actual - Number(target)) : null;
  let cls = "hint";
  if (hasT) cls = Math.abs(diff) <= tol ? "good" : (diff > 0 ? "warn" : "bad");

  const isIntish = (unit === "mg" || label === "Calories" || label.includes("Potassium"));
  const a = isIntish ? actual.toFixed(0) : actual.toFixed(1);

  return `<div class="${cls}">${label}: ${a}${unit ? unit : ""}${hasT ? ` / ${Number(target)}${unit ? unit : ""} (Δ ${diff>0?"+":""}${(isIntish?diff.toFixed(0):diff.toFixed(1))}${unit?unit:""})` : ""}</div>`;
}

function renderTotals() {
  const totals = calcTotals();
  const t = targets;

  $("totals").innerHTML = `
    ${fmtLine("Calories", totals.cal, t.cal, "", 50)}
    ${fmtLine("Protein", totals.pro, t.pro, "g", 5)}
    ${fmtLine("Carbs", totals.car, t.car, "g", 7)}
    ${fmtLine("Fat", totals.fat, t.fat, "g", 4)}
    ${t.sod ? fmtLine("Sodium", totals.sod, t.sod, "mg", 100) : `<div class="hint">Sodium: ${totals.sod.toFixed(0)}mg</div>`}
    ${t.fib ? fmtLine("Fiber", totals.fib, t.fib, "g", 3) : `<div class="hint">Fiber: ${totals.fib.toFixed(1)}g</div>`}
    ${t.sat ? fmtLine("Sat fat", totals.sat, t.sat, "g", 2) : `<div class="hint">Sat fat: ${totals.sat.toFixed(1)}g</div>`}
    ${t.sug ? fmtLine("Sugar", totals.sug, t.sug, "g", 5) : `<div class="hint">Sugar: ${totals.sug.toFixed(1)}g</div>`}
    <div class="hint">Potassium: ${totals.pot.toFixed(0)}mg</div>
    <div class="hint">Estimated GL (day): ${totals.gl.toFixed(1)} (optional estimate)</div>
  `;
}

function renderMealProtein() {
  const totals = calcMealProteinTotals();
  const targetsM = mealTargets;

  const line = (label, actual, target) => {
    const hasT = target !== "" && target != null && Number.isFinite(Number(target));
    const diff = hasT ? (actual - Number(target)) : null;
    let cls = "hint";
    if (hasT) cls = Math.abs(diff) <= 5 ? "good" : (diff > 0 ? "warn" : "bad");
    return `<div class="${cls}">${label}: ${actual.toFixed(1)}g${hasT ? ` / ${Number(target)}g (Δ ${diff>0?"+":""}${diff.toFixed(1)}g)` : ""}</div>`;
  };

  $("mealProtein").innerHTML = `
    ${line("Breakfast P", totals.b, targetsM.b)}
    ${line("Lunch P", totals.l, targetsM.l)}
    ${line("Dinner P", totals.d, targetsM.d)}
    ${line("Snack P", totals.s, targetsM.s)}
  `;
}

function recipeMatchesSearch(r, q) {
  q = norm(q);
  if (!q) return true;
  const hay = [r.name, (r.tags||[]).join(", "), (r.ingredients||[]).join("\n"), (r.area||"")].join(" ").toLowerCase();
  return hay.includes(q);
}

function renderRecipes() {
  const list = $("recipes");
  list.innerHTML = "";

  const q = $("search").value;
  const filterMode = $("filterMode").value;

  const filtered = recipes
    .filter(r => recipeMatchesSearch(r, q))
    .map(r => ({ r, hits: containsExcluded(r) }))
    .filter(x => filterMode === "hide" ? x.hits.length === 0 : true);

  if (!filtered.length) {
    list.innerHTML = `<div class="hint">No recipes found (try importing a cuisine).</div>`;
    return;
  }

  filtered.forEach(({r, hits}) => {
    const card = document.createElement("div");
    card.className = "item";

    const warn = hits.length ? ` <span class="warn">(contains: ${hits.join(", ")})</span>` : "";
    const gi = (r.gi == null || r.gi === "") ? 55 : num(r.gi);
    const gl = glycemicLoad(gi, r.car, r.fib);

    card.innerHTML = `
      <h3>${r.name}${warn}</h3>
      <div class="meta">
        <span>${num(r.cal).toFixed(0)} cal</span>
        <span>${num(r.pro).toFixed(1)}P</span>
        <span>${num(r.car).toFixed(1)}C</span>
        <span>${num(r.fat).toFixed(1)}F</span>
        ${num(r.sod) ? `<span>${num(r.sod).toFixed(0)} mg Na</span>` : ``}
        ${num(r.fib) ? `<span>${num(r.fib).toFixed(1)} g fiber</span>` : ``}
        <span>GL~ ${gl.toFixed(1)}</span>
      </div>
      ${r.area ? `<div class="hint mt8">Cuisine: ${r.area}${r.category ? ` • ${r.category}` : ""}</div>` : ``}
      <div class="hint mt8">Servings: ${num(r.serv) || 1} • GI: ${gi}</div>
      <div class="hint mt8">Ingredients: ${(r.ingredients||[]).slice(0,8).join(", ")}${(r.ingredients||[]).length>8?"…":""}</div>
    `;

    const btns = document.createElement("div");
    btns.className = "split mt10";

    const add = document.createElement("button");
    add.className = "primary";
    add.textContent = "Add to Day Plan";
    add.onclick = () => {
      const slot = $("mealSlot").value;
      const servings = Number($("mealServings").value) || 1;
      plan[slot].push({ recipeId: r.id, servings });
      saveJSON(LS.plan, plan);
      renderPlan(); renderTotals(); renderMealProtein(); renderSuggestions();
    };

    const edit = document.createElement("button");
    edit.textContent = "Edit";
    edit.onclick = () => fillForm(r);

    const del = document.createElement("button");
    del.className = "danger";
    del.textContent = "Delete";
    del.onclick = () => {
      if (!confirm(`Delete "${r.name}"?`)) return;
      recipes = recipes.filter(x => x.id !== r.id);
      saveJSON(LS.recipes, recipes);
      for (const slot of Object.keys(plan)) {
        plan[slot] = plan[slot].filter(e => e.recipeId !== r.id);
      }
      saveJSON(LS.plan, plan);
      renderRecipes(); renderPlan(); renderTotals(); renderMealProtein(); renderSuggestions();
    };

    btns.appendChild(add);
    btns.appendChild(edit);
    btns.appendChild(del);
    card.appendChild(btns);

    if (r.steps) {
      const details = document.createElement("details");
      details.className = "mt10";
      details.innerHTML = `<summary class="hint">Instructions</summary><div class="hint mt8">${escapeHTML(r.steps).replace(/\n/g,"<br>")}</div>`;
      card.appendChild(details);
    }

    if (Array.isArray(r.nutritionNotes) && r.nutritionNotes.length) {
      const details = document.createElement("details");
      details.className = "mt10";
      details.innerHTML = `<summary class="hint">Auto-fill flags (${r.nutritionNotes.length})</summary><div class="hint mt8">${escapeHTML(r.nutritionNotes.join("\n")).replace(/\n/g,"<br>")}</div>`;
      card.appendChild(details);
    }

    list.appendChild(card);
  });
}

function fillForm(r) {
  $("r_id").value = r.id;
  $("r_name").value = r.name || "";
  $("r_serv").value = r.serv ?? 1;
  $("r_gi").value = (r.gi == null || r.gi === "") ? 55 : r.gi;

  $("r_cal").value = r.cal ?? 0;
  $("r_pro").value = r.pro ?? 0;
  $("r_car").value = r.car ?? 0;
  $("r_fat").value = r.fat ?? 0;
  $("r_sod").value = r.sod ?? 0;
  $("r_fib").value = r.fib ?? 0;
  $("r_sug").value = r.sug ?? 0;
  $("r_sat").value = r.sat ?? 0;
  $("r_pot").value = r.pot ?? 0;

  $("r_ing").value = (r.ingredients || []).join("\n");
  $("r_steps").value = r.steps || "";
  $("r_tags").value = (r.tags || []).join(", ");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  $("r_id").value = "";
  ["r_name","r_serv","r_gi","r_cal","r_pro","r_car","r_fat","r_sod","r_fib","r_sug","r_sat","r_pot","r_ing","r_steps","r_tags"]
    .forEach(id => $(id).value = "");
}

// ---------- Suggestions engine ----------
function renderSuggestions() {
  const box = $("suggestions");
  box.innerHTML = "";

  const totals = calcTotals();
  const remaining = {
    cal: (targets.cal !== "" ? (Number(targets.cal) - totals.cal) : null),
    pro: (targets.pro !== "" ? (Number(targets.pro) - totals.pro) : null),
    car: (targets.car !== "" ? (Number(targets.car) - totals.car) : null),
    fat: (targets.fat !== "" ? (Number(targets.fat) - totals.fat) : null),
    sod: (targets.sod !== "" ? (Number(targets.sod) - totals.sod) : null),
    fib: (targets.fib !== "" ? (Number(targets.fib) - totals.fib) : null)
  };

  // If no macro targets set, don’t pretend we can recommend
  if (remaining.pro == null && remaining.car == null && remaining.fat == null && remaining.cal == null) {
    box.innerHTML = `<div class="hint">Set at least one target (calories/macros) to get suggestions.</div>`;
    return;
  }

  const filterMode = $("filterMode").value;
  const candidates = recipes
    .map(r => ({ r, hits: containsExcluded(r) }))
    .filter(x => filterMode === "hide" ? x.hits.length === 0 : true);

  // Score by weighted distance to remaining macros (only where remaining exists)
  function score(r) {
    let s = 0;
    const w = { cal: 0.2, pro: 1.0, car: 0.6, fat: 0.6, sod: 0.0003, fib: -0.15 };

    if (remaining.cal != null) s += w.cal * Math.abs(remaining.cal - num(r.cal));
    if (remaining.pro != null) s += w.pro * Math.abs(remaining.pro - num(r.pro));
    if (remaining.car != null) s += w.car * Math.abs(remaining.car - num(r.car));
    if (remaining.fat != null) s += w.fat * Math.abs(remaining.fat - num(r.fat));

    // sodium: prefer <= remaining if remaining exists
    if (remaining.sod != null) {
      const over = Math.max(0, num(r.sod) - remaining.sod);
      s += w.sod * (over * over);
    }

    // fiber: if you’re under fiber target, prefer higher fiber (negative weight)
    if (remaining.fib != null) {
      const wantFiber = Math.max(0, remaining.fib);
      s += w.fib * Math.min(num(r.fib), wantFiber);
    }

    return s;
  }

  const top = candidates
    .map(x => ({ ...x, sc: score(x.r) }))
    .sort((a,b) => a.sc - b.sc)
    .slice(0, 6);

  if (!top.length) {
    box.innerHTML = `<div class="hint">No suggestions available.</div>`;
    return;
  }

  top.forEach(({r, hits}) => {
    const card = document.createElement("div");
    card.className = "item";
    const warn = hits.length ? ` <span class="warn">(contains: ${hits.join(", ")})</span>` : "";

    card.innerHTML = `
      <h3>${r.name}${warn}</h3>
      <div class="meta">
        <span>${num(r.cal).toFixed(0)} cal</span>
        <span>${num(r.pro).toFixed(1)}P</span>
        <span>${num(r.car).toFixed(1)}C</span>
        <span>${num(r.fat).toFixed(1)}F</span>
        ${num(r.sod) ? `<span>${num(r.sod).toFixed(0)} mg Na</span>` : ``}
        ${num(r.fib) ? `<span>${num(r.fib).toFixed(1)} g fiber</span>` : ``}
      </div>
    `;

    const add = document.createElement("button");
    add.className = "primary";
    add.textContent = "Add (to selected slot)";
    add.onclick = () => {
      const slot = $("mealSlot").value;
      const servings = Number($("mealServings").value) || 1;
      plan[slot].push({ recipeId: r.id, servings });
      saveJSON(LS.plan, plan);
      renderPlan(); renderTotals(); renderMealProtein(); renderSuggestions();
    };

    const btns = document.createElement("div");
    btns.className = "split mt10";
    btns.appendChild(add);
    card.appendChild(btns);

    box.appendChild(card);
  });
}

// ---------- USDA FoodData Central nutrition autofill ----------
const NUTRIENTS = {
  ENERGY_KCAL: 1008,
  PROTEIN_G: 1003,
  CARB_G: 1005,
  FAT_G: 1004,
  SODIUM_MG: 1093,
  FIBER_G: 1079,
  SUGAR_G: 2000,
  SATFAT_G: 1258,
  POTASSIUM_MG: 1092
};

// Basic unit parsing + grams conversion (v1 pragmatic)
function parseIngredientLine(line) {
  const raw = (line || "").trim();
  const lower = raw.toLowerCase();

  const gInline = lower.match(/^(\d+(\.\d+)?)\s*g\s+(.*)$/);
  if (gInline) return { name: gInline[3].trim(), grams: Number(gInline[1]), raw };

  const m = lower.match(/^(\d+(\.\d+)?|\.\d+)\s*([a-zA-Z]+)?\s*(.*)$/);
  if (!m) return { name: raw, grams: null, raw };

  const qty = Number(m[1]);
  const unit = (m[3] || "").toLowerCase();
  const rest = (m[4] || "").trim() || raw;

  const unitToGrams = {
    g: 1, gram: 1, grams: 1,
    kg: 1000,
    oz: 28.3495,
    lb: 453.592,
    tbsp: 15, tablespoon: 15,
    tsp: 5, teaspoon: 5,
    cup: 240
  };

  if (unit && unitToGrams[unit]) return { name: rest, grams: qty * unitToGrams[unit], raw };
  return { name: rest, grams: null, raw };
}

async function usdaSearchFood(query, apiKey) {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`;
  const body = { query, pageSize: 5 };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("USDA search failed");
  return await res.json();
}

async function usdaGetFoodDetails(fdcId, apiKey) {
  const url = `https://api.nal.usda.gov/fdc/v1/food/${encodeURIComponent(fdcId)}?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("USDA details failed");
  return await res.json();
}

function nutrientsPer100g(food) {
  const out = { kcal:null, pro:null, car:null, fat:null, sod:null, fib:null, sug:null, sat:null, pot:null };
  const arr = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];
  for (const fn of arr) {
    const nid = fn?.nutrient?.id;
    const amt = fn?.amount;
    if (!nid || !Number.isFinite(Number(amt))) continue;
    const a = Number(amt);

    if (nid === NUTRIENTS.ENERGY_KCAL) out.kcal = a;
    if (nid === NUTRIENTS.PROTEIN_G) out.pro = a;
    if (nid === NUTRIENTS.CARB_G) out.car = a;
    if (nid === NUTRIENTS.FAT_G) out.fat = a;
    if (nid === NUTRIENTS.SODIUM_MG) out.sod = a;
    if (nid === NUTRIENTS.FIBER_G) out.fib = a;
    if (nid === NUTRIENTS.SUGAR_G) out.sug = a;
    if (nid === NUTRIENTS.SATFAT_G) out.sat = a;
    if (nid === NUTRIENTS.POTASSIUM_MG) out.pot = a;
  }
  return out;
}

function scale(n, grams) { return grams == null ? null : n * (grams / 100); }

async function estimateRecipeTotalsFromIngredients(ingredients, apiKey) {
  const totals = { kcal:0, pro:0, car:0, fat:0, sod:0, fib:0, sug:0, sat:0, pot:0 };
  const issues = [];

  for (const line of ingredients) {
    const parsed = parseIngredientLine(line);
    const q = parsed.name;
    const grams = parsed.grams;

    try {
      const search = await usdaSearchFood(q, apiKey);
      const foods = (search && search.foods) ? search.foods : [];
      if (!foods.length) { issues.push(`No USDA match: "${line}"`); continue; }

      const best = foods[0];
      const details = await usdaGetFoodDetails(best.fdcId, apiKey);
      const per100 = nutrientsPer100g(details);

      if (grams == null) {
        issues.push(`Needs quantity (assumed 100g): "${line}" → "${best.description}"`);
        totals.kcal += per100.kcal || 0;
        totals.pro += per100.pro || 0;
        totals.car += per100.car || 0;
        totals.fat += per100.fat || 0;
        totals.sod += per100.sod || 0;
        totals.fib += per100.fib || 0;
        totals.sug += per100.sug || 0;
        totals.sat += per100.sat || 0;
        totals.pot += per100.pot || 0;
      } else {
        totals.kcal += scale(per100.kcal || 0, grams);
        totals.pro += scale(per100.pro || 0, grams);
        totals.car += scale(per100.car || 0, grams);
        totals.fat += scale(per100.fat || 0, grams);
        totals.sod += scale(per100.sod || 0, grams);
        totals.fib += scale(per100.fib || 0, grams);
        totals.sug += scale(per100.sug || 0, grams);
        totals.sat += scale(per100.sat || 0, grams);
        totals.pot += scale(per100.pot || 0, grams);
      }
    } catch {
      issues.push(`USDA error: "${line}"`);
    }
  }

  return { totals, issues };
}

// ---------- TheMealDB import ----------
async function importFromMealDB(area, count) {
  $("importStatus").textContent = "Fetching recipes…";

  // Uses TheMealDB public endpoint format
  const listRes = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?a=${encodeURIComponent(area)}`);
  const listJson = await listRes.json();
  const meals = (listJson && listJson.meals) ? listJson.meals : [];

  if (!meals.length) {
    $("importStatus").textContent = `No recipes found for ${area}. Try another cuisine.`;
    return;
  }

  const shuffled = meals.slice().sort(() => Math.random() - 0.5).slice(0, count);

  let imported = 0;
  for (let i = 0; i < shuffled.length; i++) {
    const m = shuffled[i];
    $("importStatus").textContent = `Importing ${i+1}/${shuffled.length}…`;

    const detailRes = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${encodeURIComponent(m.idMeal)}`);
    const detailJson = await detailRes.json();
    const meal = detailJson && detailJson.meals && detailJson.meals[0];
    if (!meal) continue;

    const exists = recipes.some(r => r.source === "themealdb" && r.sourceId === meal.idMeal);
    if (exists) continue;

    const ingredients = [];
    for (let k = 1; k <= 20; k++) {
      const ing = (meal[`strIngredient${k}`] || "").trim();
      const meas = (meal[`strMeasure${k}`] || "").trim();
      if (!ing) continue;
      ingredients.push(meas ? `${meas} ${ing}`.trim() : ing);
    }

    recipes.unshift({
      id: uid(),
      name: (meal.strMeal || "Imported recipe").trim(),
      serv: 2, // default yield guess; edit as needed
      gi: 55,
      cal: 0, pro: 0, car: 0, fat: 0, sod: 0, fib: 0, sug: 0, sat: 0, pot: 0,
      ingredients,
      steps: (meal.strInstructions || "").trim(),
      tags: ["imported", norm(area)].filter(Boolean),
      area: meal.strArea || area,
      category: meal.strCategory || "",
      source: "themealdb",
      sourceId: meal.idMeal
    });

    imported++;
  }

  saveJSON(LS.recipes, recipes);
  $("importStatus").textContent = `Imported ${imported} recipe(s) from ${area}.`;
  renderRecipes();
  renderSuggestions();
}

// ---------- Backup / Restore ----------
function exportAllData() {
  const payload = {
    version: 3,
    exportedAt: new Date().toISOString(),
    recipes,
    targets,
    exclusions,
    plan,
    filterMode: $("filterMode").value,
    mealTargets
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `meal-planner-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importAllData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      recipes = Array.isArray(data.recipes) ? data.recipes : [];
      targets = data.targets || { cal:"", pro:"", car:"", fat:"", sod:"", fib:"", sat:"", sug:"" };
      exclusions = Array.isArray(data.exclusions) ? data.exclusions : [];
      plan = data.plan || { breakfast:[], lunch:[], dinner:[], snack:[] };
      mealTargets = data.mealTargets || { b:"", l:"", d:"", s:"" };

      saveJSON(LS.recipes, recipes);
      saveJSON(LS.targets, targets);
      saveJSON(LS.exclusions, exclusions);
      saveJSON(LS.plan, plan);
      saveJSON(LS.mealTargets, mealTargets);

      const fm = data.filterMode || localStorage.getItem(LS.filterMode) || "hide";
      $("filterMode").value = fm;
      localStorage.setItem(LS.filterMode, fm);

      renderTargets();
      renderExclusions();
      renderPlan();
      renderTotals();
      renderMealProtein();
      renderRecipes();
      renderSuggestions();
      $("importStatus").textContent = "Imported backup successfully.";
    } catch {
      alert("Could not import that file.");
    }
  };
  reader.readAsText(file);
}

// ---------- Presets ----------
function applyPreset(p) {
  if (p === "HTN") {
    targets = { cal:"", pro:"", car:"", fat:"", sod:"1500", fib:"", sat:"", sug:"" };
    exclusions = Array.from(new Set([...exclusions, "soy sauce", "salt", "ramen seasoning"]));
  }
  if (p === "T2D") {
    targets = { cal:"", pro:"", car:"130", fat:"", sod:"", fib:"30", sat:"", sug:"" };
    exclusions = Array.from(new Set([...exclusions, "soda", "juice"]));
  }
  if (p === "LIPIDS") {
    targets = { cal:"", pro:"", car:"", fat:"", sod:"", fib:"30", sat:"13", sug:"25" };
    exclusions = Array.from(new Set([...exclusions, "butter", "cream", "fried"]));
  }
  if (p === "GERD") {
    // Starter triggers (not universal)
    exclusions = Array.from(new Set([...exclusions, "onion", "garlic", "tomato", "chili", "pepper", "citrus"]));
  }

  saveJSON(LS.targets, targets);
  saveJSON(LS.exclusions, exclusions);
  renderTargets();
  renderExclusions();
  renderTotals();
  renderRecipes();
  renderSuggestions();
}

// ---------- Events ----------
$("saveTargets").onclick = () => {
  targets = {
    cal: $("t_cal").value,
    pro: $("t_pro").value,
    car: $("t_car").value,
    fat: $("t_fat").value,
    sod: $("t_sod").value,
    fib: $("t_fib").value,
    sat: $("t_sat").value,
    sug: $("t_sug").value
  };
  saveJSON(LS.targets, targets);

  mealTargets = {
    b: $("m_pro_b").value,
    l: $("m_pro_l").value,
    d: $("m_pro_d").value,
    s: $("m_pro_s").value
  };
  saveJSON(LS.mealTargets, mealTargets);

  renderTotals();
  renderMealProtein();
  renderSuggestions();
  alert("Targets saved.");
};

$("addExclusion").onclick = () => {
  const v = norm($("ex_add").value);
  if (!v) return;
  if (!exclusions.includes(v)) exclusions.push(v);
  $("ex_add").value = "";
  saveJSON(LS.exclusions, exclusions);
  renderExclusions();
  renderRecipes();
  renderSuggestions();
};

$("clearExclusions").onclick = () => {
  if (!confirm("Clear all exclusions?")) return;
  exclusions = [];
  saveJSON(LS.exclusions, exclusions);
  renderExclusions();
  renderRecipes();
  renderSuggestions();
};

$("saveUsdaKey").onclick = () => {
  usdaKey = $("usdaKey").value.trim();
  localStorage.setItem(LS.usdaKey, usdaKey);
  alert("USDA key saved on this device.");
};

$("saveRecipe").onclick = () => {
  const id = $("r_id").value || uid();
  const name = $("r_name").value.trim();
  if (!name) return alert("Recipe name is required.");

  const recipe = {
    id,
    name,
    serv: Number($("r_serv").value) || 1,
    gi: ($("r_gi").value === "" ? 55 : Number($("r_gi").value) || 55),

    cal: Number($("r_cal").value) || 0,
    pro: Number($("r_pro").value) || 0,
    car: Number($("r_car").value) || 0,
    fat: Number($("r_fat").value) || 0,
    sod: Number($("r_sod").value) || 0,
    fib: Number($("r_fib").value) || 0,
    sug: Number($("r_sug").value) || 0,
    sat: Number($("r_sat").value) || 0,
    pot: Number($("r_pot").value) || 0,

    ingredients: $("r_ing").value.split("\n").map(s=>s.trim()).filter(Boolean),
    steps: $("r_steps").value.trim(),
    tags: $("r_tags").value.split(",").map(s=>s.trim()).filter(Boolean),

    // optional: if imported, keep fields
    source: getRecipe(id)?.source,
    sourceId: getRecipe(id)?.sourceId,
    area: getRecipe(id)?.area,
    category: getRecipe(id)?.category
  };

  const idx = recipes.findIndex(x => x.id === id);
  if (idx >= 0) recipes[idx] = { ...recipes[idx], ...recipe }; else recipes.unshift(recipe);

  saveJSON(LS.recipes, recipes);
  resetForm();
  renderRecipes();
  renderTotals();
  renderMealProtein();
  renderSuggestions();
  alert("Recipe saved.");
};

$("resetForm").onclick = resetForm;

$("clearPlan").onclick = () => {
  if (!confirm("Clear your entire day plan?")) return;
  plan = { breakfast:[], lunch:[], dinner:[], snack:[] };
  saveJSON(LS.plan, plan);
  renderPlan();
  renderTotals();
  renderMealProtein();
  renderSuggestions();
};

$("exportPlan").onclick = async () => {
  const totals = calcTotals();
  const lines = [];

  const slotLines = (slot) => {
    lines.push(slot.toUpperCase());
    if (!plan[slot].length) lines.push("  - (none)");
    for (const e of plan[slot]) {
      const r = getRecipe(e.recipeId);
      if (r) lines.push(`  - ${r.name} (${e.servings} servings)`);
    }
    lines.push("");
  };

  ["breakfast","lunch","dinner","snack"].forEach(slotLines);

  lines.push("TOTALS");
  lines.push(`  Calories: ${totals.cal.toFixed(0)}`);
  lines.push(`  Protein: ${totals.pro.toFixed(1)}g`);
  lines.push(`  Carbs: ${totals.car.toFixed(1)}g`);
  lines.push(`  Fat: ${totals.fat.toFixed(1)}g`);
  lines.push(`  Sodium: ${totals.sod.toFixed(0)}mg`);
  lines.push(`  Fiber: ${totals.fib.toFixed(1)}g`);
  lines.push(`  Sugar: ${totals.sug.toFixed(1)}g`);
  lines.push(`  Sat fat: ${totals.sat.toFixed(1)}g`);
  lines.push(`  Potassium: ${totals.pot.toFixed(0)}mg`);
  lines.push(`  Est GL: ${totals.gl.toFixed(1)}`);

  const text = lines.join("\n");
  try { await navigator.clipboard.writeText(text); alert("Copied plan to clipboard."); }
  catch { prompt("Copy your plan:", text); }
};

$("wipeRecipes").onclick = () => {
  if (!confirm("Delete ALL recipes? This cannot be undone.")) return;
  recipes = [];
  saveJSON(LS.recipes, recipes);
  plan = { breakfast:[], lunch:[], dinner:[], snack:[] };
  saveJSON(LS.plan, plan);
  renderRecipes();
  renderPlan();
  renderTotals();
  renderMealProtein();
  renderSuggestions();
};

$("search").oninput = () => renderRecipes();

$("filterMode").onchange = (e) => {
  localStorage.setItem(LS.filterMode, e.target.value);
  renderRecipes();
  renderSuggestions();
};

$("btnImport").onclick = async () => {
  const area = $("importArea").value;
  const count = Number($("importCount").value) || 25;
  $("btnImport").disabled = true;
  try { await importFromMealDB(area, count); }
  catch { $("importStatus").textContent = "Import failed. Try again."; }
  finally { $("btnImport").disabled = false; }
};

$("btnAutoFill").onclick = async () => {
  const apiKey = (localStorage.getItem(LS.usdaKey) || "").trim();
  if (!apiKey) { alert("Paste your USDA API key first, then Save Key."); return; }

  const imported = recipes.filter(r => r.source === "themealdb");
  if (!imported.length) { $("autoFillStatus").textContent = "No imported recipes found. Import a cuisine first."; return; }

  $("btnAutoFill").disabled = true;
  $("autoFillStatus").textContent = `Autofilling nutrition for ${imported.length} imported recipes…`;

  let updated = 0;
  let totalIssues = 0;

  for (let i = 0; i < imported.length; i++) {
    const r = imported[i];
    $("autoFillStatus").textContent = `Autofilling ${i + 1}/${imported.length}: ${r.name}`;

    // If already filled, skip (your manual edits win)
    const alreadyFilled = (num(r.cal) + num(r.pro) + num(r.car) + num(r.fat)) > 0;
    if (alreadyFilled) continue;

    const { totals, issues } = await estimateRecipeTotalsFromIngredients(r.ingredients || [], apiKey);

    const serv = num(r.serv) || 1;
    const per = {
      cal: Math.round(totals.kcal / serv),
      pro: Math.round((totals.pro / serv) * 10) / 10,
      car: Math.round((totals.car / serv) * 10) / 10,
      fat: Math.round((totals.fat / serv) * 10) / 10,
      sod: Math.round(totals.sod / serv),
      fib: Math.round((totals.fib / serv) * 10) / 10,
      sug: Math.round((totals.sug / serv) * 10) / 10,
      sat: Math.round((totals.sat / serv) * 10) / 10,
      pot: Math.round(totals.pot / serv),
      nutritionAuto: true,
      nutritionNotes: issues.slice(0, 12)
    };

    const idx = recipes.findIndex(x => x.id === r.id);
    if (idx >= 0) {
      recipes[idx] = { ...recipes[idx], ...per };
      updated++;
      totalIssues += issues.length;
    }
  }

  saveJSON(LS.recipes, recipes);
  renderRecipes();
  renderTotals();
  renderMealProtein();
  renderSuggestions();

  $("autoFillStatus").textContent = `Done. Updated ${updated} recipes. Flags: ${totalIssues} ingredient issue(s).`;
  $("btnAutoFill").disabled = false;
};

$("btnBackup").onclick = exportAllData;
$("fileImport").onchange = (e) => {
  const f = e.target.files && e.target.files[0];
  if (f) importAllData(f);
  e.target.value = "";
};

$("presetHTN").onclick = () => applyPreset("HTN");
$("presetT2D").onclick = () => applyPreset("T2D");
$("presetLipids").onclick = () => applyPreset("LIPIDS");
$("presetGERD").onclick = () => applyPreset("GERD");

// ---------- Init ----------
(function init(){
  renderTargets();
  renderExclusions();

  const fm = localStorage.getItem(LS.filterMode) || "hide";
  $("filterMode").value = fm;

  renderPlan();
  renderTotals();
  renderMealProtein();
  renderRecipes();
  renderSuggestions();
})();
