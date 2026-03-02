/* app.js (v5.1)
   For: index_RECIPES_LAYOUT_FIXED.html + styles.css (v5)
   Fixes:
   - Tabs work (Safari-safe, event delegation)
   Includes:
   - Profiles (create/save/delete + summary)
   - Planning (basic totals scaffold)
   - Recipes:
     * LEFT: MealDB import + import filters + import results
     * RIGHT TOP: Local filters
     * RIGHT MID: Add/Edit recipe
     * RIGHT BOTTOM: Local library list
   Notes:
   - MealDB does not include nutrition; imported items start with zeros until USDA autofill is added later.
*/

const LS = {
  profiles: "mp_profiles_v4",
  activeProfile: "mp_active_profile_v4",
  recipes: "mp_recipes_v4",
  plan: "mp_plan_v4",
  usdaKey: "mp_usda_key_v4",
  importCache: "mp_import_cache_v1",
  filters: "mp_filters_v1"
};

/* =============================
   UTIL
============================= */
const $ = (id) => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2);
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
function clampMinMax(minV, maxV){
  let min = Number.isFinite(minV) ? minV : 0;
  let max = Number.isFinite(maxV) ? maxV : 999999;
  if(max < min){ const t=min; min=max; max=t; }
  return { min, max };
}
function hasAnyNutrition(r){
  return [r.cal,r.pro,r.car,r.fat].some(v => Number.isFinite(Number(v)) && Number(v) > 0);
}

/* =============================
   STATE
============================= */
let profiles = load(LS.profiles, []);
let activeProfileId = localStorage.getItem(LS.activeProfile) || null;
let recipes = load(LS.recipes, []);
let plan = load(LS.plan, { breakfast: [], lunch: [], dinner: [] });
let usdaKey = localStorage.getItem(LS.usdaKey) || "";
let importResults = load(LS.importCache, []);

let filters = load(LS.filters, {
  import: { useProfile:true, proMin:0, proMax:999, carMin:0, carMax:999, fatMin:0, fatMax:999 },
  local:  { useProfile:true, mode:"hide", q:"", proMin:0, proMax:999, carMin:0, carMax:999, fatMin:0, fatMax:999 }
});

/* =============================
   INIT
============================= */
function init(){
  ensureProfileExists();

  bindTabs();
  bindBackupHandlers();

  bindProfileHandlers();
  bindUSDAHandlers();

  bindPlanningHandlers();

  bindImportHandlers();
  bindFilterHandlers();
  bindRecipeHandlers();

  // hydrate stored values
  if ($("usdaKey")) $("usdaKey").value = usdaKey;
  hydrateFilterUI();

  // initial renders
  renderProfileSelect();
  loadActiveProfileIntoForm();
  renderProfileSummary();

  renderPlanning();
  renderImportResults();
  renderRecipes();
  updateLocalFilterStatus();
}

// Safari-safe init
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

/* =============================
   TABS (FIXED)
============================= */
function bindTabs(){
  // event delegation is more Safari-proof
  document.addEventListener("click", (evt) => {
    const target = (evt.target && evt.target.nodeType === 1) ? evt.target : evt.target?.parentElement;
    if(!target) return;

    const btn = target.closest(".tab");
    if(!btn) return;

    const tabName = btn.dataset.tab;
    if(!tabName) return;

    setActiveTab(tabName);
  }, true);

  // touchstart helps iOS Safari sometimes
  document.addEventListener("touchstart", (evt) => {
    const target = (evt.target && evt.target.nodeType === 1) ? evt.target : evt.target?.parentElement;
    if(!target) return;

    const btn = target.closest(".tab");
    if(!btn) return;

    const tabName = btn.dataset.tab;
    if(!tabName) return;

    setActiveTab(tabName);
  }, true);
}

function setActiveTab(tabName){
  document.querySelectorAll(".tab").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tabName);
  });

  document.querySelectorAll(".tabPanel").forEach(p => p.classList.remove("active"));
  const panel = document.getElementById(`tab_${tabName}`);
  if(panel) panel.classList.add("active");
}

/* =============================
   PROFILES
============================= */
function createEmptyProfile(){
  return {
    id: uid(),
    first: "",
    last: "",
    notes: "",
    targets: {},
    restrictions: [],
    likes: [],
    dislikes: [],
    equipment: []
  };
}

function ensureProfileExists(){
  if(!profiles.length){
    const p = createEmptyProfile();
    profiles.push(p);
    activeProfileId = p.id;
    persistProfiles();
  } else {
    if(!activeProfileId || !profiles.some(p => p.id === activeProfileId)){
      activeProfileId = profiles[0].id;
      persistProfiles();
    }
  }
}

function persistProfiles(){
  save(LS.profiles, profiles);
  localStorage.setItem(LS.activeProfile, activeProfileId || "");
}

function getActiveProfile(){
  return profiles.find(p => p.id === activeProfileId) || null;
}

function renderProfileSelect(){
  const sel = $("profileSelect");
  if(!sel) return;
  sel.innerHTML = "";
  profiles.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.first || "Unnamed"}${p.last ? " " + p.last : ""}`;
    sel.appendChild(opt);
  });
  sel.value = activeProfileId || "";
}

function loadActiveProfileIntoForm(){
  const p = getActiveProfile();
  if(!p) return;

  $("p_first").value = p.first || "";
  $("p_last").value  = p.last || "";
  $("p_notes").value = p.notes || "";

  $("p_t_cal").value = p.targets?.cal || "";
  $("p_t_pro").value = p.targets?.pro || "";
  $("p_t_car").value = p.targets?.car || "";
  $("p_t_fat").value = p.targets?.fat || "";
  $("p_t_sod").value = p.targets?.sod || "";
  $("p_t_fib").value = p.targets?.fib || "";
  $("p_t_sat").value = p.targets?.sat || "";
  $("p_t_sug").value = p.targets?.sug || "";

  $("p_like").value = (p.likes || []).join(", ");
  $("p_dislike").value = (p.dislikes || []).join(", ");

  const restr = new Set(p.restrictions || []);
  $("p_r_dairyfree").checked = restr.has("dairy");
  $("p_r_glutenfree").checked = restr.has("gluten");
  $("p_r_nocheese").checked = restr.has("cheese");
  $("p_r_noonion").checked = restr.has("onion");
  $("p_r_nogarlic").checked = restr.has("garlic");
  $("p_r_nopork").checked = restr.has("pork");

  const common = new Set(["dairy","gluten","cheese","onion","garlic","pork"]);
  const custom = (p.restrictions || []).filter(r => !common.has(r));
  $("p_r_custom").value = custom.join("\n");

  const eq = new Set(p.equipment || []);
  $("p_eq_stove").checked = eq.has("stove");
  $("p_eq_oven").checked = eq.has("oven");
  $("p_eq_airfryer").checked = eq.has("airfryer");
  $("p_eq_microwave").checked = eq.has("microwave");
  $("p_eq_slowcooker").checked = eq.has("slowcooker");
  $("p_eq_blender").checked = eq.has("blender");
}

function bindProfileHandlers(){
  $("profileSelect")?.addEventListener("change", () => {
    activeProfileId = $("profileSelect").value;
    persistProfiles();
    loadActiveProfileIntoForm();
    renderProfileSummary();
    renderPlanning();
    renderImportResults();
    renderRecipes();
  });

  $("btnNewProfile")?.addEventListener("click", () => {
    const p = createEmptyProfile();
    profiles.push(p);
    activeProfileId = p.id;
    persistProfiles();

    renderProfileSelect();
    loadActiveProfileIntoForm();
    renderProfileSummary();
    renderPlanning();
    renderImportResults();
    renderRecipes();
  });

  $("btnDeleteProfile")?.addEventListener("click", () => {
    if(!confirm("Delete profile?")) return;
    profiles = profiles.filter(p => p.id !== activeProfileId);
    activeProfileId = profiles[0]?.id || null;
    persistProfiles();

    renderProfileSelect();
    loadActiveProfileIntoForm();
    renderProfileSummary();
    renderPlanning();
    renderImportResults();
    renderRecipes();
  });

  $("btnSaveProfile")?.addEventListener("click", () => {
    const p = getActiveProfile();
    if(!p) return;

    p.first = $("p_first").value.trim();
    p.last  = $("p_last").value.trim();
    p.notes = $("p_notes").value || "";

    p.targets = {
      cal: $("p_t_cal").value || "",
      pro: $("p_t_pro").value || "",
      car: $("p_t_car").value || "",
      fat: $("p_t_fat").value || "",
      sod: $("p_t_sod").value || "",
      fib: $("p_t_fib").value || "",
      sat: $("p_t_sat").value || "",
      sug: $("p_t_sug").value || ""
    };

    p.likes = ($("p_like").value || "")
      .split(",").map(s=>norm(s)).filter(Boolean);

    p.dislikes = ($("p_dislike").value || "")
      .split(",").map(s=>norm(s)).filter(Boolean);

    const custom = ($("p_r_custom").value || "")
      .split("\n").map(s=>norm(s)).filter(Boolean);

    p.restrictions = [
      $("p_r_dairyfree").checked && "dairy",
      $("p_r_glutenfree").checked && "gluten",
      $("p_r_nocheese").checked && "cheese",
      $("p_r_noonion").checked && "onion",
      $("p_r_nogarlic").checked && "garlic",
      $("p_r_nopork").checked && "pork",
      ...custom
    ].filter(Boolean);

    p.equipment = [
      $("p_eq_stove").checked && "stove",
      $("p_eq_oven").checked && "oven",
      $("p_eq_airfryer").checked && "airfryer",
      $("p_eq_microwave").checked && "microwave",
      $("p_eq_slowcooker").checked && "slowcooker",
      $("p_eq_blender").checked && "blender"
    ].filter(Boolean);

    persistProfiles();
    renderProfileSelect();
    renderProfileSummary();
    renderImportResults();
    renderRecipes();

    alert("Profile saved.");
  });
}

function renderProfileSummary(){
  const p = getActiveProfile();
  if(!p) return;

  const html = `
Name: ${escapeHTML(p.first || "Unnamed")} ${escapeHTML(p.last || "")}

Targets:
- Calories: ${escapeHTML(p.targets?.cal || "-")}
- Protein: ${escapeHTML(p.targets?.pro || "-")} g
- Carbs: ${escapeHTML(p.targets?.car || "-")} g
- Fat: ${escapeHTML(p.targets?.fat || "-")} g
- Sodium: ${escapeHTML(p.targets?.sod || "-")} mg
- Fiber: ${escapeHTML(p.targets?.fib || "-")} g

Restrictions: ${escapeHTML((p.restrictions || []).join(", ") || "None")}
Likes: ${escapeHTML((p.likes || []).join(", ") || "â€”")}
Dislikes: ${escapeHTML((p.dislikes || []).join(", ") || "â€”")}
Equipment: ${escapeHTML((p.equipment || []).join(", ") || "â€”")}
  `.trim().replaceAll("\n", "<br>");

  $("profileSummary").innerHTML = html;
}

/* =============================
   USDA KEY (test only for now)
============================= */
function bindUSDAHandlers(){
  $("saveUsdaKey")?.addEventListener("click", () => {
    usdaKey = $("usdaKey").value.trim();
    localStorage.setItem(LS.usdaKey, usdaKey);
    $("usdaStatus").textContent = "Saved on this device.";
  });

  $("testUsdaKey")?.addEventListener("click", async () => {
    const k = (localStorage.getItem(LS.usdaKey) || "").trim();
    if(!k){ alert("Enter and Save your USDA key first."); return; }

    $("usdaStatus").textContent = "Testingâ€¦";
    try{
      const r = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(k)}`,{
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ query:"chicken", pageSize:1 })
      });
      if(!r.ok) throw new Error();
      $("usdaStatus").textContent = "Key works âœ…";
    }catch{
      $("usdaStatus").textContent = "Key failed âŒ";
    }
  });
}

/* =============================
   PROFILE FILTER EVAL
============================= */
function evaluateProfileFit(recipe, profile){
  if(!profile) return { ok:true, warn:false, hits:[], score:0 };

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
  if(hardHit){
    return { ok:false, warn:false, hits:[hardHit], score:0 };
  }

  let score = 0;
  likeTerms.forEach(t=>{
    if(t && hay.includes(t)) score += 1;
  });

  const warn = !hasAnyNutrition(recipe);
  return { ok:true, warn, hits:[], score };
}

function passesMacroFilter(recipe, macroFilter){
  if(!hasAnyNutrition(recipe)) return true;

  const { min: pMin, max: pMax } = clampMinMax(num(macroFilter.proMin), num(macroFilter.proMax));
  const { min: cMin, max: cMax } = clampMinMax(num(macroFilter.carMin), num(macroFilter.carMax));
  const { min: fMin, max: fMax } = clampMinMax(num(macroFilter.fatMin), num(macroFilter.fatMax));

  const pro = num(recipe.pro);
  const car = num(recipe.car);
  const fat = num(recipe.fat);

  if(pro < pMin || pro > pMax) return false;
  if(car < cMin || car > cMax) return false;
  if(fat < fMin || fat > fMax) return false;

  return true;
}

/* =============================
   FILTER UI
============================= */
function persistFilters(){ save(LS.filters, filters); }

function hydrateFilterUI(){
  // Import
  if ($("importUseProfile")) $("importUseProfile").checked = !!filters.import.useProfile;
  $("i_pro_min").value = filters.import.proMin ?? 0;
  $("i_pro_max").value = filters.import.proMax ?? 999;
  $("i_car_min").value = filters.import.carMin ?? 0;
  $("i_car_max").value = filters.import.carMax ?? 999;
  $("i_fat_min").value = filters.import.fatMin ?? 0;
  $("i_fat_max").value = filters.import.fatMax ?? 999;

  // Local
  if ($("localUseProfile")) $("localUseProfile").checked = !!filters.local.useProfile;
  if ($("filterMode")) $("filterMode").value = filters.local.mode || "hide";
  if ($("search")) $("search").value = filters.local.q || "";

  $("l_pro_min").value = filters.local.proMin ?? 0;
  $("l_pro_max").value = filters.local.proMax ?? 999;
  $("l_car_min").value = filters.local.carMin ?? 0;
  $("l_car_max").value = filters.local.carMax ?? 999;
  $("l_fat_min").value = filters.local.fatMin ?? 0;
  $("l_fat_max").value = filters.local.fatMax ?? 999;
}

function bindFilterHandlers(){
  $("importUseProfile")?.addEventListener("change", () => {
    filters.import.useProfile = $("importUseProfile").checked;
    persistFilters();
    renderImportResults();
  });

  $("btnApplyImportFilters")?.addEventListener("click", () => {
    filters.import.proMin = num($("i_pro_min").value);
    filters.import.proMax = num($("i_pro_max").value);
    filters.import.carMin = num($("i_car_min").value);
    filters.import.carMax = num($("i_car_max").value);
    filters.import.fatMin = num($("i_fat_min").value);
    filters.import.fatMax = num($("i_fat_max").value);
    persistFilters();
    renderImportResults();
  });

  $("localUseProfile")?.addEventListener("change", () => {
    filters.local.useProfile = $("localUseProfile").checked;
    persistFilters();
    renderRecipes();
  });

  $("filterMode")?.addEventListener("change", () => {
    filters.local.mode = $("filterMode").value;
    persistFilters();
    renderRecipes();
  });

  $("search")?.addEventListener("input", () => {
    filters.local.q = $("search").value || "";
    persistFilters();
    renderRecipes();
  });

  $("btnApplyLocalFilters")?.addEventListener("click", () => {
    filters.local.proMin = num($("l_pro_min").value);
    filters.local.proMax = num($("l_pro_max").value);
    filters.local.carMin = num($("l_car_min").value);
    filters.local.carMax = num($("l_car_max").value);
    filters.local.fatMin = num($("l_fat_min").value);
    filters.local.fatMax = num($("l_fat_max").value);
    persistFilters();
    renderRecipes();
  });

  $("btnClearLocalFilters")?.addEventListener("click", () => {
    filters.local.proMin = 0; filters.local.proMax = 999;
    filters.local.carMin = 0; filters.local.carMax = 999;
    filters.local.fatMin = 0; filters.local.fatMax = 999;
    hydrateFilterUI();
    persistFilters();
    renderRecipes();
  });
}

/* =============================
   RECIPES (LOCAL)
============================= */
function bindRecipeHandlers(){
  $("btnSaveRecipe")?.addEventListener("click", () => {
    const id = $("r_id").value || uid();
    const recipe = {
      id,
      source: "manual",
      name: $("r_name").value.trim(),
      category: $("r_category").value,
      area: "",
      serv: num($("r_serv").value) || 1,
      cal: num($("r_cal").value),
      pro: num($("r_pro").value),
      car: num($("r_car").value),
      fat: num($("r_fat").value),
      sod: num($("r_sod").value),
      fib: num($("r_fib").value),
      sug: num($("r_sug").value),
      sat: num($("r_sat").value),
      pot: num($("r_pot").value),
      ingredients: ($("r_ing").value || "").split("\n").map(s=>s.trim()).filter(Boolean),
      steps: $("r_steps").value || "",
      tags: ($("r_tags").value || "").split(",").map(s=>norm(s)).filter(Boolean)
    };

    if(!recipe.name){
      alert("Recipe name is required.");
      return;
    }

    const idx = recipes.findIndex(r=>r.id===id);
    if(idx>=0) recipes[idx]=recipe;
    else recipes.unshift(recipe);

    save(LS.recipes, recipes);
    renderRecipes();
    renderPlanning();

    $("r_id").value = "";
    alert("Recipe saved.");
  });

  $("btnResetRecipe")?.addEventListener("click", () => {
    $("r_id").value = "";
    $("r_name").value = "";
    $("r_category").value = "breakfast";
    $("r_serv").value = 1;

    ["r_cal","r_pro","r_car","r_fat","r_sod","r_fib","r_sug","r_sat","r_pot"].forEach(id=>{
      const el = $(id); if(el) el.value = 0;
    });

    $("r_ing").value = "";
    $("r_steps").value = "";
    $("r_tags").value = "";
    $("recipeCalcStatus").textContent = "";
  });

  $("btnWipeRecipes")?.addEventListener("click", () => {
    if(!confirm("Delete ALL recipes?")) return;
    recipes = [];
    save(LS.recipes, recipes);
    renderRecipes();
    renderPlanning();
  });

  $("btnAutoCalcRecipe")?.addEventListener("click", () => {
    alert("Next step: USDA auto-fill for manual + imported recipes.");
  });
}

function renderRecipes(){
  const list = $("recipes");
  if(!list) return;

  const q = norm(filters.local.q || "");
  const p = getActiveProfile();
  const useProfile = !!filters.local.useProfile;
  const mode = filters.local.mode || "hide";

  list.innerHTML = "";

  let candidates = recipes.slice();

  if(q){
    candidates = candidates.filter(r => {
      const hay = (r.name || "").toLowerCase() + " " +
        (r.tags || []).join(" ").toLowerCase() + " " +
        (r.ingredients || []).join(" ").toLowerCase() + " " +
        (r.area || "").toLowerCase();
      return hay.includes(q);
    });
  }

  const rendered = [];
  for(const r of candidates){
    let fit = { ok:true, warn:false, score:0 };
    if(useProfile) fit = evaluateProfileFit(r, p);

    if(!fit.ok){
      if(mode === "warn"){
        fit.warn = true;
      } else {
        continue;
      }
    }

    if(!passesMacroFilter(r, filters.local)) continue;

    rendered.push({ r, fit });
  }

  rendered.sort((a,b)=>{
    if((b.fit.score||0) !== (a.fit.score||0)) return (b.fit.score||0) - (a.fit.score||0);
    return (a.r.name || "").localeCompare(b.r.name || "");
  });

  if(!rendered.length){
    list.innerHTML = `<div class="hint">No recipes yet (or hidden by filters).</div>`;
    updateLocalFilterStatus(0, recipes.length);
    return;
  }

  rendered.forEach(({r, fit})=>{
    const div = document.createElement("div");
    div.className = "item";

    const warnText = fit.warn ? ` <span class="warn">(check profile / missing nutrition)</span>` : "";
    div.innerHTML = `
      <h3>${escapeHTML(r.name)}${warnText}</h3>
      <div class="meta">
        <span>${num(r.cal).toFixed(0)} cal</span>
        <span>${num(r.pro).toFixed(1)}P</span>
        <span>${num(r.car).toFixed(1)}C</span>
        <span>${num(r.fat).toFixed(1)}F</span>
      </div>
      <div class="hint mt8">Source: ${escapeHTML(r.source || "manual")} â€¢ Tags: ${escapeHTML((r.tags||[]).join(", ") || "â€”")}</div>
    `;
    list.appendChild(div);
  });

  updateLocalFilterStatus(rendered.length, recipes.length);
}

function updateLocalFilterStatus(matchCount, totalCount){
  const el = $("localFilterStatus");
  if(!el) return;

  const total = Number.isFinite(totalCount) ? totalCount : recipes.length;
  const match = Number.isFinite(matchCount) ? matchCount : null;

  const parts = [];
  parts.push(`Local: ${match !== null ? match : "â€”"} of ${total} recipes shown.`);
  if(filters.local.useProfile) parts.push("Profile filter: ON");
  if(hasLocalMacrosSet()) parts.push("Macro filters: ON");
  if((filters.local.q || "").trim()) parts.push("Search: ON");
  el.textContent = parts.join(" â€¢ ");
}

function hasLocalMacrosSet(){
  const f = filters.local;
  return (
    num(f.proMin) > 0 || num(f.carMin) > 0 || num(f.fatMin) > 0 ||
    num(f.proMax) < 999 || num(f.carMax) < 999 || num(f.fatMax) < 999
  );
}

/* =============================
   IMPORT (MealDB)
============================= */
function persistImport(){ save(LS.importCache, importResults); }

function bindImportHandlers(){
  $("btnImport")?.addEventListener("click", importMeals);
  $("btnClearImportResults")?.addEventListener("click", () => {
    importResults = [];
    persistImport();
    renderImportResults();
    if($("importStatus")) $("importStatus").textContent = "Cleared.";
  });

  $("btnSaveVisibleImports")?.addEventListener("click", () => {
    const visible = getVisibleImportResults();
    if(!visible.length){ alert("No visible imports to save."); return; }
    saveImportsToLibrary(visible);
    alert(`Saved ${visible.length} recipes to library.`);
  });

  $("btnSaveAllImports")?.addEventListener("click", () => {
    if(!importResults.length){ alert("No imports to save."); return; }
    saveImportsToLibrary(importResults);
    alert(`Saved ${importResults.length} recipes to library.`);
  });
}

async function importMeals(){
  const area = $("importArea")?.value || "American";
  const desired = num($("importCount")?.value) || 25;

  if($("importStatus")) $("importStatus").textContent = "Importingâ€¦";

  try{
    const listRes = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?a=${encodeURIComponent(area)}`);
    const listJson = await listRes.json();
    const meals = Array.isArray(listJson.meals) ? listJson.meals : [];

    if(!meals.length){
      importResults = [];
      persistImport();
      renderImportResults();
      if($("importStatus")) $("importStatus").textContent = "No meals found for that area.";
      return;
    }

    const shuffled = meals.slice().sort(()=>Math.random()-0.5);
    const kept = [];
    const p = getActiveProfile();

    for(const m of shuffled){
      if(kept.length >= desired) break;

      const detRes = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${encodeURIComponent(m.idMeal)}`);
      const detJson = await detRes.json();
      const meal = detJson.meals?.[0];
      if(!meal) continue;

      const parsed = parseMealDBMeal(meal);

      if(filters.import.useProfile){
        const fit = evaluateProfileFit(parsed, p);
        if(!fit.ok) continue;
      }
      if(!passesMacroFilter(parsed, filters.import)) continue;

      kept.push(parsed);
    }

    importResults = kept;
    persistImport();
    renderImportResults();
    if($("importStatus")) $("importStatus").textContent = `Imported ${kept.length} meals (filtered).`;
  }catch{
    if($("importStatus")) $("importStatus").textContent = "Import failed. Check network or MealDB availability.";
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
    .split(",").map(s=>norm(s)).filter(Boolean);

  return {
    id: `mealdb_${meal.idMeal}`,
    source: "mealdb",
    mealdbId: meal.idMeal,
    name: meal.strMeal || "Imported Meal",
    category: (meal.strCategory || "").toLowerCase(),
    area: meal.strArea || "",
    tags,
    ingredients,
    steps: meal.strInstructions || "",
    thumb: meal.strMealThumb || "",
    serv: 1,
    // nutrition unknown until USDA autofill
    cal: 0, pro: 0, car: 0, fat: 0,
    sod: 0, fib: 0, sug: 0, sat: 0, pot: 0
  };
}

function getVisibleImportResults(){
  const p = getActiveProfile();
  return importResults.filter(r=>{
    if(filters.import.useProfile){
      const fit = evaluateProfileFit(r, p);
      if(!fit.ok) return false;
    }
    if(!passesMacroFilter(r, filters.import)) return false;
    return true;
  });
}

function renderImportResults(){
  const list = $("importResults");
  if(!list) return;

  list.innerHTML = "";

  if(!importResults.length){
    list.innerHTML = `<div class="hint">No import results yet. Choose a cuisine and click Import.</div>`;
    return;
  }

  const p = getActiveProfile();
  const visible = [];

  importResults.forEach(r=>{
    let fit = { ok:true, warn:false, score:0 };
    if(filters.import.useProfile) fit = evaluateProfileFit(r, p);
    if(!fit.ok) return;

    if(!passesMacroFilter(r, filters.import)) return;

    visible.push({ r, fit });
  });

  visible.sort((a,b)=>{
    if((b.fit.score||0) !== (a.fit.score||0)) return (b.fit.score||0) - (a.fit.score||0);
    return (a.r.name || "").localeCompare(b.r.name || "");
  });

  if(!visible.length){
    list.innerHTML = `<div class="hint">No imported meals match your import filters.</div>`;
    return;
  }

  visible.forEach(({r, fit})=>{
    const div = document.createElement("div");
    div.className = "item";
    const warnText = fit.warn ? ` <span class="warn">(missing nutrition)</span>` : "";

    div.innerHTML = `
      <h3>${escapeHTML(r.name)}${warnText}</h3>
      <div class="hint">Area: ${escapeHTML(r.area || "-")} â€¢ Category: ${escapeHTML(r.category || "-")}</div>
      <div class="meta mt8">
        <span>${num(r.cal).toFixed(0)} cal</span>
        <span>${num(r.pro).toFixed(1)}P</span>
        <span>${num(r.car).toFixed(1)}C</span>
        <span>${num(r.fat).toFixed(1)}F</span>
      </div>
      <div class="hint mt8">Ingredients: ${escapeHTML((r.ingredients || []).slice(0,6).join(", "))}${(r.ingredients||[]).length>6 ? "â€¦" : ""}</div>
    `;
    list.appendChild(div);
  });
}

function saveImportsToLibrary(importItems){
  const existing = new Map(recipes.map(r=>[r.id,r]));
  for(const it of importItems){
    existing.set(it.id, it);
  }
  recipes = Array.from(existing.values());
  save(LS.recipes, recipes);
  renderRecipes();
}

/* =============================
   PLANNING (minimal scaffold)
============================= */
function bindPlanningHandlers(){
  $("btnClearPlan")?.addEventListener("click", () => {
    plan = { breakfast: [], lunch: [], dinner: [] };
    save(LS.plan, plan);
    renderPlanning();
  });

  $("btnCopyPlan")?.addEventListener("click", async () => {
    const text = buildPlanText();
    try{
      await navigator.clipboard.writeText(text);
      alert("Plan copied.");
    }catch{
      alert("Copy failed (Safari/iOS can block clipboard).");
    }
  });

  $("togglePickOne")?.addEventListener("change", () => renderPlanning());

  $("btnAddBreakfast")?.addEventListener("click", () => alert("Next: add from library into pools."));
  $("btnAddLunch")?.addEventListener("click", () => alert("Next: add from library into pools."));
  $("btnAddDinner")?.addEventListener("click", () => alert("Next: add from library into pools."));
}

function renderPlanning(){
  const p = getActiveProfile();
  if(!p) return;

  if($("planningTargets")){
    $("planningTargets").innerHTML = `
Calories: ${escapeHTML(p.targets?.cal || "-")}<br>
Protein: ${escapeHTML(p.targets?.pro || "-")} g<br>
Carbs: ${escapeHTML(p.targets?.car || "-")} g<br>
Fat: ${escapeHTML(p.targets?.fat || "-")} g
    `.trim();
  }

  const totals = { cal:0, pro:0, car:0, fat:0 };
  ["breakfast","lunch","dinner"].forEach(cat=>{
    (plan[cat] || []).forEach(id=>{
      const r = recipes.find(x=>x.id===id);
      if(r){
        totals.cal += num(r.cal);
        totals.pro += num(r.pro);
        totals.car += num(r.car);
        totals.fat += num(r.fat);
      }
    });
  });

  if($("planningTotals")){
    $("planningTotals").innerHTML = `
Calories: ${totals.cal.toFixed(0)}<br>
Protein: ${totals.pro.toFixed(1)} g<br>
Carbs: ${totals.car.toFixed(1)} g<br>
Fat: ${totals.fat.toFixed(1)} g
    `.trim();
  }
}

function buildPlanText(){
  const lines = [];
  const p = getActiveProfile();
  lines.push(`Meal Plan â€” ${p?.first || "Client"} ${p?.last || ""}`.trim());
  lines.push("");
  ["breakfast","lunch","dinner"].forEach(cat=>{
    lines.push(cat.toUpperCase());
    const ids = plan[cat] || [];
    if(!ids.length) lines.push("  (none)");
    else ids.forEach(id=>{
      const r = recipes.find(x=>x.id===id);
      if(r) lines.push(`  - ${r.name} (${r.cal} cal, ${r.pro}P/${r.car}C/${r.fat}F)`);
    });
    lines.push("");
  });
  return lines.join("\n");
}

/* =============================
   BACKUP / RESTORE
============================= */
function bindBackupHandlers(){
  $("btnBackup")?.addEventListener("click", () => {
    const payload = {
      version: "v5.1",
      exportedAt: new Date().toISOString(),
      profiles,
      activeProfileId,
      recipes,
      plan,
      importResults,
      filters
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `meal-planner-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  });

  $("fileImport")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if(!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try{
        const data = JSON.parse(reader.result);

        profiles = Array.isArray(data.profiles) ? data.profiles : [];
        activeProfileId = data.activeProfileId || profiles[0]?.id || null;
        recipes = Array.isArray(data.recipes) ? data.recipes : [];
        plan = data.plan || { breakfast:[], lunch:[], dinner:[] };
        importResults = Array.isArray(data.importResults) ? data.importResults : [];
        filters = data.filters || filters;

        persistProfiles();
        save(LS.recipes, recipes);
        save(LS.plan, plan);
        save(LS.importCache, importResults);
        save(LS.filters, filters);

        hydrateFilterUI();
        renderProfileSelect();
        loadActiveProfileIntoForm();
        renderProfileSummary();
        renderPlanning();
        renderImportResults();
        renderRecipes();
        updateLocalFilterStatus();

        alert("Imported backup.");
      }catch{
        alert("Import failed.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });
}
