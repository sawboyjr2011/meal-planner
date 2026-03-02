/* app.js (UI Recipes v1)
   Matches: index_UPDATED_UI.html
   - Import recipes from MealDB by Area
   - Separate Import filters vs Local filters
   - Save Visible vs Save All imports into Local Library
   - Local Library search + macro-min filters
   Notes:
   - MealDB does NOT include nutrition; macros for imports will be 0 until you add USDA autofill later.
   - "Apply Profile Filters" will use your existing saved profiles if present (mp_profiles_v4 + mp_active_profile_v4).
*/

// -----------------------------
// Storage Keys
// -----------------------------
const LS = {
  recipes: "mp_recipes_v4",
  importCache: "mp_import_cache_simple_v1",
  // optional profile storage (if you already have it from earlier builds)
  profiles: "mp_profiles_v4",
  activeProfile: "mp_active_profile_v4",
};

// -----------------------------
// Utilities
// -----------------------------
const $ = (id) => document.getElementById(id);
const num = (v) => Number(v) || 0;
const norm = (s) => (s || "").toLowerCase().trim();

function save(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
function load(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch{
    return fallback;
  }
}
function escapeHTML(s){
  return (s || "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}
function hasAnyNutrition(r){
  return [r.cal,r.pro,r.car,r.fat].some(v => Number.isFinite(Number(v)) && Number(v) > 0);
}

// -----------------------------
// State
// -----------------------------
let recipes = load(LS.recipes, []);
let importResults = load(LS.importCache, []);

// Local filter state (min-only per your UI)
let localFilters = {
  useProfile: true,
  q: "",
  proMin: 0,
  carMin: 0,
  fatMin: 0,
};

// Import filter state (min-only per your UI)
let importFilters = {
  useProfile: true,
  proMin: 0,
  carMin: 0,
  fatMin: 0,
};

// -----------------------------
// Optional Profile Support
// (uses your existing profile data if it exists)
// -----------------------------
function getActiveProfile(){
  const profiles = load(LS.profiles, []);
  const activeId = localStorage.getItem(LS.activeProfile) || null;
  if(!profiles.length) return null;
  return profiles.find(p => p.id === activeId) || profiles[0] || null;
}

// Hard excludes for restrictions + dislikes.
// Likes are not used to exclude; they just add a soft score (sort).
function evaluateProfileFit(recipe, profile){
  if(!profile) return { ok:true, score:0 };

  const restrictionTerms = (profile.restrictions || []).map(norm).filter(Boolean);
  const dislikeTerms = (profile.dislikes || []).map(norm).filter(Boolean);
  const likeTerms = (profile.likes || []).map(norm).filter(Boolean);

  const hay = (
    (recipe.name || "") + " " +
    (recipe.area || "") + " " +
    (recipe.category || "") + " " +
    (recipe.tags || []).join(" ") + " " +
    (recipe.ingredients || []).join(" ")
  ).toLowerCase();

  const hardTerms = [...new Set([...restrictionTerms, ...dislikeTerms])];
  const hardHit = hardTerms.find(t => t && hay.includes(t));
  if(hardHit) return { ok:false, score:0 };

  let score = 0;
  likeTerms.forEach(t => { if(t && hay.includes(t)) score += 1; });

  return { ok:true, score };
}

// Min-only macros: if recipe has no nutrition, we allow it through (for imports, nutrition is unknown)
function passesMacroMin(recipe, f){
  if(!hasAnyNutrition(recipe)) return true;
  if(num(recipe.pro) < num(f.proMin)) return false;
  if(num(recipe.car) < num(f.carMin)) return false;
  if(num(recipe.fat) < num(f.fatMin)) return false;
  return true;
}

// -----------------------------
// Init
// -----------------------------
function init(){
  bindHandlers();
  hydrateUI();
  renderImportResults();
  renderLocalRecipes();
}

if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", init);
}else{
  init();
}

// -----------------------------
// UI Wiring
// -----------------------------
function bindHandlers(){

  // IMPORT
  $("btnImport")?.addEventListener("click", importMeals);
  $("btnApplyImportFilters")?.addEventListener("click", () => {
    importFilters.useProfile = !!$("importUseProfile")?.checked;
    importFilters.proMin = num($("i_pro_min")?.value);
    importFilters.carMin = num($("i_car_min")?.value);
    importFilters.fatMin = num($("i_fat_min")?.value);
    renderImportResults();
  });

  $("importUseProfile")?.addEventListener("change", () => {
    importFilters.useProfile = !!$("importUseProfile")?.checked;
    renderImportResults();
  });

  $("btnSaveVisibleImports")?.addEventListener("click", () => {
    const visible = getVisibleImports();
    if(!visible.length){
      alert("No visible imports to save.");
      return;
    }
    saveImportsToLibrary(visible);
    alert(`Saved ${visible.length} to local library.`);
  });

  $("btnSaveAllImports")?.addEventListener("click", () => {
    if(!importResults.length){
      alert("No imports to save.");
      return;
    }
    saveImportsToLibrary(importResults);
    alert(`Saved ${importResults.length} to local library.`);
  });

  // LOCAL
  $("search")?.addEventListener("input", () => {
    localFilters.q = $("search").value || "";
    renderLocalRecipes();
  });

  $("btnApplyLocalFilters")?.addEventListener("click", () => {
    localFilters.useProfile = !!$("localUseProfile")?.checked;
    localFilters.proMin = num($("l_pro_min")?.value);
    localFilters.carMin = num($("l_car_min")?.value);
    localFilters.fatMin = num($("l_fat_min")?.value);
    renderLocalRecipes();
  });

  $("btnClearLocalFilters")?.addEventListener("click", () => {
    $("l_pro_min").value = "";
    $("l_car_min").value = "";
    $("l_fat_min").value = "";
    localFilters.proMin = 0;
    localFilters.carMin = 0;
    localFilters.fatMin = 0;
    renderLocalRecipes();
  });

  $("localUseProfile")?.addEventListener("change", () => {
    localFilters.useProfile = !!$("localUseProfile")?.checked;
    renderLocalRecipes();
  });

  // SAVE MANUAL RECIPE
  $("btnSaveRecipe")?.addEventListener("click", () => {
    const name = ($("r_name")?.value || "").trim();
    if(!name){
      alert("Recipe name is required.");
      return;
    }

    const recipe = {
      id: "manual_" + Date.now(),
      source: "manual",
      name,
      area: "",
      category: "",
      tags: [],
      cal: num($("r_cal")?.value),
      pro: num($("r_pro")?.value),
      car: num($("r_car")?.value),
      fat: num($("r_fat")?.value),
      ingredients: ($("r_ing")?.value || "").split("\n").map(s=>s.trim()).filter(Boolean)
    };

    recipes.unshift(recipe);
    save(LS.recipes, recipes);

    // clear inputs
    $("r_name").value = "";
    $("r_cal").value = "";
    $("r_pro").value = "";
    $("r_car").value = "";
    $("r_fat").value = "";
    $("r_ing").value = "";

    renderLocalRecipes();
    alert("Recipe saved to local library.");
  });
}

function hydrateUI(){
  if($("importUseProfile")) $("importUseProfile").checked = true;
  if($("localUseProfile")) $("localUseProfile").checked = true;
}

// -----------------------------
// Import from MealDB
// -----------------------------
async function importMeals(){
  const area = $("importArea")?.value || "American";
  const desired = num($("importCount")?.value) || 25;

  setImportStatus("Importingâ€¦");

  try{
    const listRes = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?a=${encodeURIComponent(area)}`);
    const listJson = await listRes.json();
    const meals = Array.isArray(listJson.meals) ? listJson.meals : [];

    if(!meals.length){
      importResults = [];
      persistImport();
      renderImportResults();
      setImportStatus("No meals found for that cuisine.");
      return;
    }

    // Shuffle so you don't keep getting same first results
    const shuffled = meals.slice().sort(()=>Math.random()-0.5);

    const kept = [];
    const profile = getActiveProfile();

    for(const m of shuffled){
      if(kept.length >= desired) break;

      const detRes = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${encodeURIComponent(m.idMeal)}`);
      const detJson = await detRes.json();
      const meal = detJson.meals?.[0];
      if(!meal) continue;

      const parsed = parseMealDBMeal(meal);

      // Apply import filter early (reduces wasted lookups in practice)
      if(importFilters.useProfile){
        const fit = evaluateProfileFit(parsed, profile);
        if(!fit.ok) continue;
      }
      if(!passesMacroMin(parsed, importFilters)) continue;

      kept.push(parsed);
    }

    importResults = kept;
    persistImport();
    renderImportResults();
    setImportStatus(`Imported ${kept.length} meals (filtered).`);

  }catch(e){
    setImportStatus("Import failed. Check internet connection or MealDB availability.");
  }
}

function parseMealDBMeal(meal){
  const ingredients = [];
  for(let i=1;i<=20;i++){
    const ing = (meal[`strIngredient${i}`] || "").trim();
    const meas = (meal[`strMeasure${i}`] || "").trim();
    if(!ing) continue;
    ingredients.push(meas ? `${meas} ${ing}`.trim() : ing);
  }

  const tags = (meal.strTags || "")
    .split(",").map(s=>norm(s.trim())).filter(Boolean);

  return {
    id: `mealdb_${meal.idMeal}`,
    source: "mealdb",
    name: meal.strMeal || "Imported Meal",
    area: meal.strArea || "",
    category: meal.strCategory || "",
    tags,
    ingredients,
    // nutrition unknown until USDA autofill
    cal: 0, pro: 0, car: 0, fat: 0
  };
}

function persistImport(){
  save(LS.importCache, importResults);
}

function setImportStatus(msg){
  if($("importStatus")) $("importStatus").textContent = msg;
}

// Visible = passes current import filters
function getVisibleImports(){
  const profile = getActiveProfile();
  return importResults.filter(r => {
    if(importFilters.useProfile){
      const fit = evaluateProfileFit(r, profile);
      if(!fit.ok) return false;
    }
    if(!passesMacroMin(r, importFilters)) return false;
    return true;
  });
}

function renderImportResults(){
  const list = $("importResults");
  if(!list) return;

  const profile = getActiveProfile();
  const visible = [];

  importResults.forEach(r => {
    let score = 0;
    if(importFilters.useProfile){
      const fit = evaluateProfileFit(r, profile);
      if(!fit.ok) return;
      score = fit.score || 0;
    }
    if(!passesMacroMin(r, importFilters)) return;
    visible.push({ r, score });
  });

  visible.sort((a,b)=>{
    if(b.score !== a.score) return b.score - a.score;
    return (a.r.name || "").localeCompare(b.r.name || "");
  });

  if(!visible.length){
    list.innerHTML = `<div class="hint">No import results (or none match filters yet).</div>`;
    return;
  }

  list.innerHTML = visible.map(({r}) => {
    const ingPreview = (r.ingredients || []).slice(0,6).join(", ");
    return `
      <div class="item">
        <div><strong>${escapeHTML(r.name)}</strong></div>
        <div class="hint">Area: ${escapeHTML(r.area || "-")} â€¢ Category: ${escapeHTML(r.category || "-")}</div>
        <div class="meta">
          <span>${num(r.cal).toFixed(0)} cal</span>
          <span>${num(r.pro).toFixed(1)}P</span>
          <span>${num(r.car).toFixed(1)}C</span>
          <span>${num(r.fat).toFixed(1)}F</span>
          <span class="warn">${hasAnyNutrition(r) ? "" : "nutrition pending"}</span>
        </div>
        <div class="hint">Ingredients: ${escapeHTML(ingPreview)}${(r.ingredients||[]).length>6 ? "â€¦" : ""}</div>
      </div>
    `;
  }).join("");
}

// -----------------------------
// Local Library
// -----------------------------
function saveImportsToLibrary(importItems){
  const map = new Map(recipes.map(r => [r.id, r]));
  importItems.forEach(it => map.set(it.id, it));
  recipes = Array.from(map.values());
  save(LS.recipes, recipes);
  renderLocalRecipes();
}

function renderLocalRecipes(){
  const list = $("recipes");
  if(!list) return;

  const q = norm(localFilters.q || "");
  const profile = getActiveProfile();

  const shown = [];

  recipes.forEach(r => {
    // search
    if(q){
      const hay = (
        (r.name || "") + " " +
        (r.area || "") + " " +
        (r.category || "") + " " +
        (r.tags || []).join(" ") + " " +
        (r.ingredients || []).join(" ")
      ).toLowerCase();
      if(!hay.includes(q)) return;
    }

    // profile filter
    let score = 0;
    if(localFilters.useProfile){
      const fit = evaluateProfileFit(r, profile);
      if(!fit.ok) return;
      score = fit.score || 0;
    }

    // macro min filters
    if(!passesMacroMin(r, localFilters)) return;

    shown.push({ r, score });
  });

  shown.sort((a,b)=>{
    if(b.score !== a.score) return b.score - a.score;
    return (a.r.name || "").localeCompare(b.r.name || "");
  });

  if(!shown.length){
    list.innerHTML = `<div class="hint">No local recipes match filters.</div>`;
    return;
  }

  list.innerHTML = shown.map(({r}) => `
    <div class="item">
      <div><strong>${escapeHTML(r.name)}</strong> <span class="hint">${escapeHTML(r.source || "")}</span></div>
      <div class="meta">
        <span>${num(r.cal).toFixed(0)} cal</span>
        <span>${num(r.pro).toFixed(1)}P</span>
        <span>${num(r.car).toFixed(1)}C</span>
        <span>${num(r.fat).toFixed(1)}F</span>
      </div>
    </div>
  `).join("");
}
