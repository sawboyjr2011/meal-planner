/* app.js (v4)
   Option 1: MealDB + USDA
   Everything stored locally in browser (GitHub Pages compatible)
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
let plan = load(LS.plan, {
  breakfast: [],
  lunch: [],
  dinner: []
});

let usdaKey = localStorage.getItem(LS.usdaKey) || "";

/* =============================
   INIT
============================= */

function init(){
  if(!profiles.length){
    const p = createEmptyProfile();
    profiles.push(p);
    activeProfileId = p.id;
    persistProfiles();
  }

  renderProfileSelect();
  loadActiveProfileIntoForm();
  renderProfileSummary();
  renderPlanning();
  renderRecipes();
}

document.addEventListener("DOMContentLoaded", init);

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
  return profiles.find(p => p.id === activeProfileId);
}

function persistProfiles(){
  save(LS.profiles, profiles);
  localStorage.setItem(LS.activeProfile, activeProfileId);
}

function renderProfileSelect(){
  const sel = $("profileSelect");
  sel.innerHTML = "";
  profiles.forEach(p=>{
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.first || "Unnamed"} ${p.last || ""}`;
    sel.appendChild(opt);
  });
  sel.value = activeProfileId;
  sel.onchange = ()=>{
    activeProfileId = sel.value;
    persistProfiles();
    loadActiveProfileIntoForm();
    renderProfileSummary();
    renderPlanning();
  };
}

$("btnNewProfile").onclick = ()=>{
  const p = createEmptyProfile();
  profiles.push(p);
  activeProfileId = p.id;
  persistProfiles();
  renderProfileSelect();
  loadActiveProfileIntoForm();
};

$("btnDeleteProfile").onclick = ()=>{
  if(!confirm("Delete profile?")) return;
  profiles = profiles.filter(p=>p.id !== activeProfileId);
  activeProfileId = profiles[0]?.id || null;
  persistProfiles();
  renderProfileSelect();
  loadActiveProfileIntoForm();
};

$("btnSaveProfile").onclick = ()=>{
  const p = getActiveProfile();
  p.first = $("p_first").value;
  p.last = $("p_last").value;
  p.notes = $("p_notes").value;

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

  p.likes = $("p_like").value.split(",").map(s=>norm(s.trim())).filter(Boolean);
  p.dislikes = $("p_dislike").value.split(",").map(s=>norm(s.trim())).filter(Boolean);

  p.restrictions = [
    $("p_r_dairyfree").checked && "dairy",
    $("p_r_glutenfree").checked && "gluten",
    $("p_r_nocheese").checked && "cheese",
    $("p_r_noonion").checked && "onion",
    $("p_r_nogarlic").checked && "garlic",
    $("p_r_nopork").checked && "pork",
    ...$("p_r_custom").value.split("\n").map(s=>norm(s.trim()))
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
  renderProfileSummary();
  alert("Profile saved.");
};

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

  $("p_r_custom").value = "";
}

function renderProfileSummary(){
  const p = getActiveProfile();
  if(!p) return;
  $("profileSummary").innerHTML = `
    Name: ${p.first} ${p.last}<br>
    Calories: ${p.targets?.cal || "-"}<br>
    Protein: ${p.targets?.pro || "-"}g<br>
    Carbs: ${p.targets?.car || "-"}g<br>
    Fat: ${p.targets?.fat || "-"}g<br>
    Restrictions: ${(p.restrictions||[]).join(", ") || "None"}
  `;
}

/* =============================
   USDA
============================= */

$("saveUsdaKey").onclick = ()=>{
  usdaKey = $("usdaKey").value.trim();
  localStorage.setItem(LS.usdaKey, usdaKey);
  $("usdaStatus").textContent = "Saved.";
};

$("testUsdaKey").onclick = async ()=>{
  if(!usdaKey){ alert("Enter key first."); return; }
  try{
    const r = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${usdaKey}`,{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ query:"chicken", pageSize:1 })
    });
    if(!r.ok) throw new Error();
    $("usdaStatus").textContent = "Key works.";
  }catch{
    $("usdaStatus").textContent = "Key failed.";
  }
};

/* =============================
   RECIPES
============================= */

$("btnSaveRecipe").onclick = ()=>{
  const id = $("r_id").value || uid();
  const recipe = {
    id,
    name: $("r_name").value,
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
    ingredients: $("r_ing").value.split("\n").map(s=>s.trim()).filter(Boolean),
    steps: $("r_steps").value,
    tags: $("r_tags").value.split(",").map(s=>norm(s.trim())).filter(Boolean)
  };

  const idx = recipes.findIndex(r=>r.id===id);
  if(idx>=0) recipes[idx]=recipe;
  else recipes.unshift(recipe);

  save(LS.recipes, recipes);
  renderRecipes();
  renderPlanning();
  alert("Saved.");
};

$("btnWipeRecipes").onclick = ()=>{
  if(!confirm("Delete ALL recipes?")) return;
  recipes=[];
  save(LS.recipes,recipes);
  renderRecipes();
  renderPlanning();
};

function renderRecipes(){
  const list = $("recipes");
  list.innerHTML="";
  recipes.forEach(r=>{
    const div=document.createElement("div");
    div.className="item";
    div.innerHTML=`
      <strong>${r.name}</strong><br>
      ${r.cal} cal | ${r.pro}P | ${r.car}C | ${r.fat}F
    `;
    list.appendChild(div);
  });
}

/* =============================
   MEAL PLANNING
============================= */

function renderPlanning(){
  const p = getActiveProfile();
  if(!p) return;

  $("planningTargets").innerHTML = `
    Calories: ${p.targets?.cal || "-"}<br>
    Protein: ${p.targets?.pro || "-"}g<br>
    Carbs: ${p.targets?.car || "-"}g<br>
    Fat: ${p.targets?.fat || "-"}g
  `;

  const totals = { cal:0, pro:0, car:0, fat:0 };

  ["breakfast","lunch","dinner"].forEach(cat=>{
    plan[cat].forEach(id=>{
      const r = recipes.find(x=>x.id===id);
      if(r){
        totals.cal += r.cal;
        totals.pro += r.pro;
        totals.car += r.car;
        totals.fat += r.fat;
      }
    });
  });

  $("planningTotals").innerHTML = `
    Calories: ${totals.cal}<br>
    Protein: ${totals.pro}g<br>
    Carbs: ${totals.car}g<br>
    Fat: ${totals.fat}g
  `;
}

$("btnClearPlan").onclick = ()=>{
  plan={ breakfast:[], lunch:[], dinner:[] };
  save(LS.plan,plan);
  renderPlanning();
};
