/* app.js (v4.3) UI stable version - Tabs fixed (Safari safe) - Profile
system stable - Local recipe filtering (macro filters) */

const LS = { profiles: “mp_profiles_v4”, activeProfile:
“mp_active_profile_v4”, recipes: “mp_recipes_v4” };

const $ = (id) => document.getElementById(id); const uid = () =>
Math.random().toString(36).slice(2); const num = (v) => Number(v) || 0;
const norm = (s) => (s || ““).toLowerCase();

function save(key, value){ localStorage.setItem(key,
JSON.stringify(value)); } function load(key, fallback){ try{ const raw =
localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback;
}catch{ return fallback; } }

let profiles = load(LS.profiles, []); let activeProfileId =
localStorage.getItem(LS.activeProfile) || null; let recipes =
load(LS.recipes, []);

function init(){

if(!profiles.length){ const p = { id: uid(), first: ““, targets: {} };
profiles.push(p); activeProfileId = p.id; save(LS.profiles, profiles);
localStorage.setItem(LS.activeProfile, activeProfileId); }

bindTabs(); bindProfileHandlers(); bindRecipeHandlers();

renderProfileSelect(); renderRecipes(); }

if (document.readyState === “loading”) {
document.addEventListener(“DOMContentLoaded”, init); } else { init(); }

function bindTabs(){ document.addEventListener(“click”, function(evt){
const target = evt.target.nodeType === 1 ? evt.target :
evt.target.parentElement; if(!target) return; const btn =
target.closest(“.tab”); if(!btn) return;

    const tabName = btn.dataset.tab;

    document.querySelectorAll(".tab").forEach(b => {
      b.classList.toggle("active", b.dataset.tab === tabName);
    });

    document.querySelectorAll(".tabPanel").forEach(p => p.classList.remove("active"));
    const panel = document.getElementById("tab_" + tabName);
    if(panel) panel.classList.add("active");

}, true); }

function getActiveProfile(){ return profiles.find(p => p.id ===
activeProfileId); }

function renderProfileSelect(){ const sel = $(“profileSelect”); if(!sel)
return; sel.innerHTML = ““; profiles.forEach(p=>{ const opt =
document.createElement(”option”); opt.value = p.id; opt.textContent =
p.first || “Unnamed”; sel.appendChild(opt); }); sel.value =
activeProfileId; }

function bindProfileHandlers(){
$(“btnSaveProfile”)?.addEventListener(“click”, ()=>{ const p =
getActiveProfile(); if(!p) return;

    p.first = $("p_first")?.value || "";
    p.targets.cal = $("p_t_cal")?.value || "";
    p.targets.pro = $("p_t_pro")?.value || "";
    p.targets.car = $("p_t_car")?.value || "";
    p.targets.fat = $("p_t_fat")?.value || "";

    save(LS.profiles, profiles);
    renderProfileSelect();
    alert("Profile saved.");

});

$(“profileSelect”)?.addEventListener(“change”, ()=>{ activeProfileId =
$(“profileSelect”).value; localStorage.setItem(LS.activeProfile,
activeProfileId); }); }

function bindRecipeHandlers(){

$(“btnSaveRecipe”)?.addEventListener(“click”, ()=>{ const recipe = { id:
uid(), name: $("r_name").value,
      cal: num($(“r_cal”).value), pro: num($("r_pro").value),
      car: num($(“r_car”).value), fat: num($(“r_fat”).value) };

    recipes.unshift(recipe);
    save(LS.recipes, recipes);
    renderRecipes();
    alert("Recipe saved.");

});

$(“search”)?.addEventListener(“input”, renderRecipes);
$(“btnApplyLocalFilters”)?.addEventListener(“click”, renderRecipes); }

function recipePassesLocalFilters(r){ const minP =
num($("l_pro_min")?.value);
  const maxP = num($(“l_pro_max”)?.value || 9999); const minC =
num($("l_car_min")?.value);
  const maxC = num($(“l_car_max”)?.value || 9999); const minF =
num($("l_fat_min")?.value);
  const maxF = num($(“l_fat_max”)?.value || 9999);

if(r.pro < minP || r.pro > maxP) return false; if(r.car < minC ||
r.car > maxC) return false; if(r.fat < minF || r.fat > maxF) return
false;

return true; }

function renderRecipes(){ const list = $("recipes");
  if(!list) return;
  const q = norm($(“search”)?.value); list.innerHTML = ““;

recipes .filter(r => !q || norm(r.name).includes(q))
.filter(recipePassesLocalFilters) .forEach(r=>{ const div =
document.createElement(“div”); div.className = “item”; div.innerHTML =
<strong>${r.name}</strong><br>         ${r.cal} cal | ${r.pro}P | ${r.car}C | ${r.fat}F;
list.appendChild(div); }); }
