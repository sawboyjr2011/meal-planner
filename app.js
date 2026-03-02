/* app.js (v4.1)
   Option 1: MealDB + USDA
   Fixes:
   - Tabs now work (event handlers attached after DOM ready)
   - Profile dropdown updates immediately after saving
*/

const LS = {
  profiles: "mp_profiles_v4",
  activeProfile: "mp_active_profile_v4",
  recipes: "mp_recipes_v4",
  plan: "mp_plan_v4",
  usdaKey: "mp_usda_key_v4"
};

/* =============================
   UTIL
============================= */
const $ = (id) => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2);
const num = (v) => Number(v) || 0;
const norm = (s) => (s || "").toLowerCase();

function save(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
function load(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch{
    return fallback;
  }
}

/* =============================
   STATE
============================= */
let profiles = load(LS.profiles, []);
let activeProfileId = localStorage.getItem(LS.activeProfile) || null;
let recipes = load(LS.recipes, []);
let plan = load(LS.plan, { breakfast: [], lunch: [], dinner: [] });
let usdaKey = localStorage.getItem(LS.usdaKey) || "";

/* =============================
   INIT
============================= */

function init(){
  // Ensure there is at least one profile
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

  // Bind UI handlers AFTER DOM exists
  bindTabs();
  bindProfileHandlers();
  bindUSDAHandlers();
  bindRecipeHandlers();
  bindPlanningHandlers();
  bindBackupHandlers();

  // Hydrate fields
  $("usdaKey").value = usdaKey;

  renderProfileSelect();
  loadActiveProfileIntoForm();
  renderProfileSummary();
  renderPlanning();
  renderRecipes();
}

/* =============================
   TABS
============================= */
function bindTabs(){
  const tabButtons = document.querySelectorAll(".tab");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const tabName = btn.dataset.tab; // "profiles" | "planning" | "recipes"
      setActiveTab(tabName);
    });
  });
}

function setActiveTab(tabName){
  // buttons
  document.querySelectorAll(".tab").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tabName);
  });
  // panels
  document.querySelectorAll(".tabPanel").forEach(p => p.classList.remove("active"));
  const panel = $(`tab_${tabName}`);
  if(panel) panel.classList.add("active");
}

/* =============================
   PROFILE LOGIC
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

function getActiveProfile(){
  return profiles.find(p => p.id === activeProfileId) || null;
}

function persistProfiles(){
  save(LS.profiles, profiles);
  localStorage.setItem(LS.activeProfile, activeProfileId || "");
}

function bindProfileHandlers(){
  $("btnNewProfile").addEventListener("click", () => {
    const p = createEmptyProfile();
    profiles.push(p);
    activeProfileId = p.id;
    persistProfiles();
    renderProfileSelect();
    loadActiveProfileIntoForm();
    renderProfileSummary();
    renderPlanning();
  });

  $("btnDeleteProfile").addEventListener("click", () => {
    if(!confirm("Delete profile?")) return;
    profiles = profiles.filter(p => p.id !== activeProfileId);
    activeProfileId = profiles[0]?.id || null;
    persistProfiles();
    renderProfileSelect();
    loadActiveProfileIntoForm();
    renderProfileSummary();
    renderPlanning();
  });

  $("btnSaveProfile").addEventListener("click", () => {
    const p = getActiveProfile();
    if(!p) return;

    p.first = $("p_first").value.trim();
    p.last = $("p_last").value.trim();
    p.notes = $("p_notes").value || "";

    p.targets = {
      cal: $("p_t_cal").value,
      pro: $("p_t_pro").value,
      car: $("p_t_car").value,
      fat: $("p_t_fat").value,
      sod: $("p_t_sod").value,
      fib: $("p_t_fib").value,
      sat: $("p_t_sat").value,
      sug: $("p_t_sug").value
    };

    p.likes = ($("p_like").value || "")
      .split(",").map(s=>norm(s.trim())).filter(Boolean);

    p.dislikes = ($("p_dislike").value || "")
      .split(",").map(s=>norm(s.trim())).filter(Boolean);

    const custom = ($("p_r_custom").value || "")
      .split("\n").map(s=>norm(s.trim())).filter(Boolean);

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

    // ✅ This fixes your “active profile name doesn’t update”
    renderProfileSelect();
    renderProfileSummary();
    renderPlanning();

    alert("Profile saved.");
  });

  $("profileSelect").addEventListener("change", () => {
    activeProfileId = $("profileSelect").value;
    persistProfiles();
    loadActiveProfileIntoForm();
    renderProfileSummary();
    renderPlanning();
  });
}

function renderProfileSelect(){
  const sel = $("profileSelect");
  sel.innerHTML = "";
  profiles.forEach(p=>{
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
  $("p_last").value = p.last || "";
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

  // Reset checkboxes
  const restr = new Set(p.restrictions || []);
  $("p_r_dairyfree").checked = restr.has("dairy");
  $("p_r_glutenfree").checked = restr.has("gluten");
  $("p_r_nocheese").checked = restr.has("cheese");
  $("p_r_noonion").checked = restr.has("onion");
  $("p_r_nogarlic").checked = restr.has("garlic");
  $("p_r_nopork").checked = restr.has("pork");

  // Put non-common restrictions into custom box
  const common = new Set(["dairy","gluten","cheese","onion","garlic","pork"]);
  const custom = (p.restrictions || []).filter(r => !common.has(r));
  $("p_r_custom").value = custom.join("\n");

  // Equipment
  const eq = new Set(p.equipment || []);
  $("p_eq_stove").checked = eq.has("stove");
  $("p_eq_oven").checked = eq.has("oven");
  $("p_eq_airfryer").checked = eq.has("airfryer");
  $("p_eq_microwave").checked = eq.has("microwave");
  $("p_eq_slowcooker").checked = eq.has("slowcooker");
  $("p_eq_blender").checked = eq.has("blender");
}

function renderProfileSummary(){
  const p = getActiveProfile();
  if(!p) return;
  $("profileSummary").innerHTML = `
Name: ${p.first || "Unnamed"} ${p.last || ""}

Targets:
- Calories: ${p.targets?.cal || "-"}
- Protein: ${p.targets?.pro || "-"} g
- Carbs: ${p.targets?.car || "-"} g
- Fat: ${p.targets?.fat || "-"} g
- Sodium: ${p.targets?.sod || "-"} mg
- Fiber: ${p.targets?.fib || "-"} g

Restrictions: ${(p.restrictions || []).join(", ") || "None"}
Likes: ${(p.likes || []).join(", ") || "—"}
Dislikes: ${(p.dislikes || []).join(", ") || "—"}
Equipment: ${(p.equipment || []).join(", ") || "—"}
  `.trim().replaceAll("\n", "<br>");
}

/* =============================
   USDA (key only for now)
============================= */
function bindUSDAHandlers(){
  $("saveUsdaKey").addEventListener("click", () => {
    usdaKey = $("usdaKey").value.trim();
    localStorage.setItem(LS.usdaKey, usdaKey);
    $("usdaStatus").textContent = "Saved on this device.";
  });

  $("testUsdaKey").addEventListener("click", async () => {
    const k = (localStorage.getItem(LS.usdaKey) || "").trim();
    if(!k){ alert("Enter and Save your USDA key first."); return; }

    $("usdaStatus").textContent = "Testing…";
    try{
      const r = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(k)}`,{
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ query:"chicken", pageSize:1 })
      });
      if(!r.ok) throw new Error();
      $("usdaStatus").textContent = "Key works ✅";
    }catch{
      $("usdaStatus").textContent = "Key failed ❌";
    }
  });
}

/* =============================
   RECIPES (basic list for now)
============================= */
function bindRecipeHandlers(){
  $("btnSaveRecipe").addEventListener("click", () => {
    const id = $("r_id").value || uid();
    const recipe = {
      id,
      name: $("r_name").value.trim(),
      category: $("r_category").value,
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
      tags: ($("r_tags").value || "").split(",").map(s=>norm(s.trim())).filter(Boolean)
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
    alert("Recipe saved.");
  });

  $("btnResetRecipe").addEventListener("click", () => {
    resetRecipeForm();
  });

  $("btnWipeRecipes").addEventListener("click", () => {
    if(!confirm("Delete ALL recipes?")) return;
    recipes = [];
    save(LS.recipes, recipes);
    renderRecipes();
    renderPlanning();
  });

  // Placeholder: Auto-calc button will be wired later (USDA per-ingredient)
  $("btnAutoCalcRecipe").addEventListener("click", () => {
    alert("Auto-calc nutrition is coming next (USDA ingredient analysis). UI is stable now.");
  });
}

function resetRecipeForm(){
  $("r_id").value = "";
  $("r_name").value = "";
  $("r_category").value = "breakfast";
  $("r_serv").value = 1;

  $("r_cal").value = 0;
  $("r_pro").value = 0;
  $("r_car").value = 0;
  $("r_fat").value = 0;
  $("r_sod").value = 0;
  $("r_fib").value = 0;
  $("r_sug").value = 0;
  $("r_sat").value = 0;
  $("r_pot").value = 0;

  $("r_ing").value = "";
  $("r_steps").value = "";
  $("r_tags").value = "";
  $("recipeCalcStatus").textContent = "";
}

function renderRecipes(){
  const list = $("recipes");
  list.innerHTML = "";

  if(!recipes.length){
    list.innerHTML = `<div class="hint">No recipes yet. Add a manual recipe or import later.</div>`;
    return;
  }

  recipes.forEach(r=>{
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <h3>${escapeHTML(r.name)}</h3>
      <div class="meta">
        <span>${num(r.cal).toFixed(0)} cal</span>
        <span>${num(r.pro).toFixed(1)}P</span>
        <span>${num(r.car).toFixed(1)}C</span>
        <span>${num(r.fat).toFixed(1)}F</span>
      </div>
    `;
    list.appendChild(div);
  });
}

function escapeHTML(s){
  return (s || "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

/* =============================
   MEAL PLANNING (basic totals)
============================= */
function bindPlanningHandlers(){
  $("btnClearPlan").addEventListener("click", () => {
    plan = { breakfast: [], lunch: [], dinner: [] };
    save(LS.plan, plan);
    renderPlanning();
  });

  $("btnCopyPlan").addEventListener("click", async () => {
    const text = buildPlanText();
    try{
      await navigator.clipboard.writeText(text);
      alert("Plan copied.");
    }catch{
      alert("Copy failed. (iOS sometimes blocks clipboard.)");
    }
  });

  // Pick-one toggle exists in UI; full logic comes after pools are implemented
  $("togglePickOne").addEventListener("change", () => {
    renderPlanning();
  });
}

function renderPlanning(){
  const p = getActiveProfile();
  if(!p) return;

  $("planningTargets").innerHTML = `
Calories: ${p.targets?.cal || "-"}<br>
Protein: ${p.targets?.pro || "-"} g<br>
Carbs: ${p.targets?.car || "-"} g<br>
Fat: ${p.targets?.fat || "-"} g
  `.trim();

  // For now: totals are based on IDs stored in plan (later we’ll do pools/averages)
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

  $("planningTotals").innerHTML = `
Calories: ${totals.cal.toFixed(0)}<br>
Protein: ${totals.pro.toFixed(1)} g<br>
Carbs: ${totals.car.toFixed(1)} g<br>
Fat: ${totals.fat.toFixed(1)} g
  `.trim();
}

function buildPlanText(){
  const lines = [];
  const p = getActiveProfile();
  lines.push(`Meal Plan — ${p?.first || "Client"} ${p?.last || ""}`.trim());
  lines.push("");

  ["breakfast","lunch","dinner"].forEach(cat=>{
    lines.push(cat.toUpperCase());
    const ids = plan[cat] || [];
    if(!ids.length){
      lines.push("  (none)");
    }else{
      ids.forEach(id=>{
        const r = recipes.find(x=>x.id===id);
        if(r) lines.push(`  - ${r.name} (${r.cal} cal, ${r.pro}P/${r.car}C/${r.fat}F)`);
      });
    }
    lines.push("");
  });

  return lines.join("\n");
}

/* =============================
   BACKUP / RESTORE
============================= */
function bindBackupHandlers(){
  $("btnBackup").addEventListener("click", () => {
    const payload = {
      version: "v4.1",
      exportedAt: new Date().toISOString(),
      profiles,
      activeProfileId,
      recipes,
      plan
      // USDA key intentionally excluded
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

  $("fileImport").addEventListener("change", (e) => {
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

        persistProfiles();
        save(LS.recipes, recipes);
        save(LS.plan, plan);

        renderProfileSelect();
        loadActiveProfileIntoForm();
        renderProfileSummary();
        renderPlanning();
        renderRecipes();

        alert("Imported backup.");
      }catch{
        alert("Import failed.");
      }
    };
    reader.readAsText(file);

    // reset input so you can re-import same file if needed
    e.target.value = "";
  });
   
// Safari-safe init (works even if DOMContentLoaded already fired)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
