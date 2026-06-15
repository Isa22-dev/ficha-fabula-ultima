const db = window.supabaseClient;
const backupKey = "ficha-fabula-ultima-backup";
const themeKey = "ficha-fabula-ultima-theme";

const diceTypes = [4, 6, 8, 10, 12, 20];
const attributes = ["DES", "VIG", "AST", "VON"];
const resources = [
  { key: "pv", label: "PV", tone: "danger" },
  { key: "pm", label: "PM", tone: "mana" },
  { key: "pf", label: "PF", tone: "focus" }
];
const bondTypes = {
  Conexao: "#00c9a7",
  Odio: "#ff4655",
  Instavel: "#f8c14a",
  Aliado: "#9b5de5",
  Neutro: "#8d95b7"
};
const defaultSheet = () => ({
  id: null,
  nome: "",
  classe: "",
  nivel: 1,
  tema: "",
  origem: "",
  retrato: "",
  idade: "",
  altura: "",
  peso: "",
  aparencia: "",
  pecado: "",
  historico: "",
  alerta: "",
  recursos: {
    pv: { atual: 40, maximo: 40 },
    pm: { atual: 30, maximo: 30 },
    pf: { atual: 3, maximo: 3 }
  },
  combate: {
    defesa: 10,
    defesaMagica: 10,
    iniciativa: 0,
    condicoes: ""
  },
  atributos: {
    DES: "d8",
    VIG: "d8",
    AST: "d8",
    VON: "d8"
  },
  memorias: [],
  equipamentos: [],
  lacos: [],
  rolagens: []
});

let state = defaultSheet();
let user = null;
let autosaveTimer = null;
let isDirty = false;
let remoteSaveEnabled = true;
let schemaWarningShown = false;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindNavigation();
  renderStaticControls();
  bindEvents();
  applySavedTheme();
  setLoading(true);
  const { data } = await db.auth.getSession();
  user = data.session?.user || null;
  db.auth.onAuthStateChange((_event, session) => {
    user = session?.user || null;
    refreshAuthState();
  });
  restoreLocalBackup();
  await refreshAuthState();
  hydrateForm();
  renderAll();
  setLoading(false);
}

function bindNavigation() {
  $$(".nav-tab").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      $$(".nav-tab").forEach((item) => item.classList.toggle("active", item === button));
      $$(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === tab));
      $(".sidebar").classList.remove("open");
      if (tab === "visualizacao") renderPreview();
    });
  });
  $("#mobileMenu").addEventListener("click", () => $(".sidebar").classList.toggle("open"));
}

function renderStaticControls() {
  $("#resourceGrid").innerHTML = resources.map((resource) => `
    <article class="resource-card ${resource.tone}">
      <div class="resource-title"><span>${resource.label}</span><strong id="${resource.key}Percent">100%</strong></div>
      <div class="bar"><span id="${resource.key}Bar"></span></div>
      <div class="resource-inputs">
        <label>Atual<input type="number" min="0" data-resource="${resource.key}" data-prop="atual" /></label>
        <label>Maximo<input type="number" min="1" data-resource="${resource.key}" data-prop="maximo" /></label>
      </div>
    </article>
  `).join("");

  $("#attributeGrid").innerHTML = attributes.map((attr) => `
    <article class="attribute-card">
      <strong>${attr}</strong>
      <select data-attribute="${attr}">
        ${diceTypes.map((die) => `<option value="d${die}">d${die}</option>`).join("")}
      </select>
      <button type="button" class="ghost-button mini-roll" data-roll-attribute="${attr}"><i class="ti ti-dice"></i>Rolar</button>
    </article>
  `).join("");

  $("#diceControls").innerHTML = diceTypes.map((die) => `
    <button class="dice-button" type="button" data-die="${die}">
      <span>D${die}</span><small>${diceName(die)}</small>
    </button>
  `).join("");
}

function bindEvents() {
  $("#sheetForm").addEventListener("input", (event) => {
    const target = event.target;
    if (target.dataset.field) setField(target.dataset.field, target.value);
    if (target.dataset.field === "retrato") renderProfilePhoto();
    if (target.dataset.list) {
      state[target.dataset.list][Number(target.dataset.index)][target.dataset.key] = target.value;
      if (target.dataset.list === "lacos" && target.dataset.key === "tipo") renderBonds();
    }
    if (target.dataset.resource) {
      state.recursos[target.dataset.resource][target.dataset.prop] = Number(target.value || 0);
      renderResources();
    }
    if (target.dataset.attribute) state.atributos[target.dataset.attribute] = target.value;
    markDirty();
  });

  $("#authForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await login();
  });
  $("#signupBtn").addEventListener("click", signup);
  $("#logoutBtn").addEventListener("click", logout);
  $("#saveBtn")?.addEventListener("click", salvarFicha);
  $("#saveBtnTop").addEventListener("click", salvarFicha);
  $("#newSheetBtn").addEventListener("click", novaFicha);
  $("#newSheetBtnSettings").addEventListener("click", novaFicha);
  $("#loadSelectedBtn").addEventListener("click", () => carregarFichaSupabase($("#sheetSelect").value));
  $("#deleteBtn").addEventListener("click", excluirFicha);
  $("#resetBtn").addEventListener("click", resetarFicha);
  $("#exportBtn")?.addEventListener("click", exportarJSON);
  $("#importInput")?.addEventListener("change", importarJSON);
  $("#profilePhotoInput").addEventListener("change", importarFotoPerfil);
  $("#removePhotoBtn").addEventListener("click", removerFotoPerfil);
  $("#themeButton").addEventListener("click", toggleThemeMenu);
  $("#sheetSelect").addEventListener("change", () => carregarFicha($("#sheetSelect").value));
  $("#addMemory").addEventListener("click", addMemory);
  $("#addEquipment").addEventListener("click", addEquipment);
  $("#addBond").addEventListener("click", addBond);
  $("#clearRollHistory").addEventListener("click", limparHistoricoDados);

  document.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-remove]");
    const roll = event.target.closest("[data-die]");
    const attrRoll = event.target.closest("[data-roll-attribute]");
    const themeOption = event.target.closest("[data-theme-option]");
    if (remove) removeItem(remove.dataset.remove, Number(remove.dataset.index));
    if (roll) rollDie(Number(roll.dataset.die));
    if (attrRoll) rollDie(Number(state.atributos[attrRoll.dataset.rollAttribute].replace("d", "")), attrRoll.dataset.rollAttribute);
    if (themeOption) {
      setTheme(themeOption.dataset.themeOption);
      closeThemeMenu();
    } else if (!event.target.closest("#themeMenu")) {
      closeThemeMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      salvarFicha();
    }
  });
}

function setField(field, value) {
  if (["defesa", "defesaMagica", "iniciativa", "condicoes"].includes(field)) {
    state.combate[field] = field === "condicoes" ? value : Number(value || 0);
    return;
  }
  state[field] = field === "nivel" ? Number(value || 1) : value;
}

function hydrateForm() {
  $$("[data-field]").forEach((input) => {
    const field = input.dataset.field;
    input.value = state.combate[field] ?? state[field] ?? "";
  });
  $$("[data-resource]").forEach((input) => {
    input.value = state.recursos[input.dataset.resource][input.dataset.prop];
  });
  $$("[data-attribute]").forEach((select) => {
    select.value = state.atributos[select.dataset.attribute];
  });
  renderProfilePhoto();
}

function renderAll() {
  renderResources();
  renderMemories();
  renderEquipment();
  renderBonds();
  renderRollHistory();
  renderProfilePhoto();
  renderPreview();
}

function renderProfilePhoto() {
  const preview = $("#profilePhotoPreview");
  if (!preview) return;
  preview.src = state.retrato || "assets/images/portrait-placeholder.svg";
}

function renderResources() {
  resources.forEach(({ key }) => {
    const resource = state.recursos[key];
    const percent = Math.max(0, Math.min(100, Math.round((resource.atual / Math.max(resource.maximo, 1)) * 100)));
    $(`#${key}Bar`).style.width = `${percent}%`;
    $(`#${key}Percent`).textContent = `${percent}%`;
  });
}

function renderMemories() {
  $("#memoryList").innerHTML = state.memorias.map((item, index) => `
    <article class="edit-card">
      <button type="button" class="icon-button remove-card" data-remove="memorias" data-index="${index}" title="Excluir"><i class="ti ti-x"></i></button>
      <label>Codigo<input value="${escapeHtml(item.codigo)}" data-list="memorias" data-index="${index}" data-key="codigo" /></label>
      <label>Titulo<input value="${escapeHtml(item.titulo)}" data-list="memorias" data-index="${index}" data-key="titulo" /></label>
      <label>Habilidade<input value="${escapeHtml(item.habilidade)}" data-list="memorias" data-index="${index}" data-key="habilidade" /></label>
      <label>Custo<input value="${escapeHtml(item.custo)}" data-list="memorias" data-index="${index}" data-key="custo" /></label>
      <label>Descricao<textarea data-list="memorias" data-index="${index}" data-key="descricao">${escapeHtml(item.descricao)}</textarea></label>
    </article>
  `).join("") || skeleton("Nenhuma habilidade registrada.");
}

function renderEquipment() {
  $("#equipmentList").innerHTML = state.equipamentos.map((item, index) => `
    <article class="edit-card">
      <button type="button" class="icon-button remove-card" data-remove="equipamentos" data-index="${index}" title="Remover"><i class="ti ti-x"></i></button>
      <label>Nome<input value="${escapeHtml(item.nome)}" data-list="equipamentos" data-index="${index}" data-key="nome" /></label>
      <label>Bonus<input value="${escapeHtml(item.bonus)}" data-list="equipamentos" data-index="${index}" data-key="bonus" /></label>
      <label>Descricao<textarea data-list="equipamentos" data-index="${index}" data-key="descricao">${escapeHtml(item.descricao)}</textarea></label>
    </article>
  `).join("") || skeleton("Nenhum equipamento cadastrado.");
}

function renderBonds() {
  $("#bondList").innerHTML = state.lacos.map((item, index) => `
    <article class="edit-card bond-card" style="--bond:${bondTypes[item.tipo] || bondTypes.Neutro}">
      <button type="button" class="icon-button remove-card" data-remove="lacos" data-index="${index}" title="Remover"><i class="ti ti-x"></i></button>
      <label>Nome<input value="${escapeHtml(item.nome)}" data-list="lacos" data-index="${index}" data-key="nome" /></label>
      <label>Tipo<select data-list="lacos" data-index="${index}" data-key="tipo">
        ${Object.keys(bondTypes).map((type) => `<option ${item.tipo === type ? "selected" : ""}>${type}</option>`).join("")}
      </select></label>
      <label>Notas<textarea data-list="lacos" data-index="${index}" data-key="notas">${escapeHtml(item.notas)}</textarea></label>
    </article>
  `).join("") || skeleton("Nenhum laco definido.");
}

function addMemory() {
  state.memorias.push({ codigo: "M-00", titulo: "", habilidade: "", descricao: "", custo: "" });
  renderMemories();
  markDirty();
}

function addEquipment() {
  state.equipamentos.push({ nome: "", descricao: "", bonus: "" });
  renderEquipment();
  markDirty();
}

function addBond() {
  state.lacos.push({ nome: "", tipo: "Conexao", notas: "" });
  renderBonds();
  markDirty();
}

function removeItem(list, index) {
  if (!confirm("Excluir este item?")) return;
  state[list].splice(index, 1);
  renderAll();
  markDirty();
}

async function login() {
  try {
    setLoading(true);
    const { error, data } = await db.auth.signInWithPassword({
      email: $("#authEmail").value.trim(),
      password: $("#authPassword").value
    });
    if (error) return toast(authErrorMessage(error), "danger");
    user = data.user;
    await refreshAuthState();
    toast("Login realizado.");
  } catch (error) {
    toast(authErrorMessage(error), "danger");
  } finally {
    setLoading(false);
  }
}

async function signup() {
  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value;
  if (password.length < 6) {
    toast("A senha precisa ter pelo menos 6 caracteres.", "danger");
    return;
  }

  try {
    setLoading(true);
    const { error, data } = await db.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin
      }
    });
    if (error) return toast(authErrorMessage(error), "danger");
    if (data.session) {
      user = data.user;
      await refreshAuthState();
      toast("Cadastro criado e login realizado.");
      return;
    }
    toast("Cadastro criado. Confirme seu email antes de entrar.");
  } catch (error) {
    toast(authErrorMessage(error), "danger");
  } finally {
    setLoading(false);
  }
}

async function cadastrarUsuario() {
  return signup();
}

async function loginUsuario() {
  return login();
}

async function logoutUsuario() {
  return logout();
}

async function logout() {
  await db.auth.signOut();
  user = null;
  state = defaultSheet();
  await refreshAuthState();
  hydrateForm();
  renderAll();
  toast("Sessao encerrada.");
}

async function refreshAuthState() {
  $("#authPanel").classList.toggle("hidden", Boolean(user));
  $("#sheetForm").classList.toggle("blurred", !user);
  await listarFichas();
}

async function salvarFicha() {
  if (!user) return toast("Entre para salvar online.", "danger");
  remoteSaveEnabled = true;
  setLoading(true);
  const payload = toPayload();
  const request = state.id
    ? db.from("fichas_rpg").update(payload).eq("id", state.id).select().single()
    : db.from("fichas_rpg").insert(payload).select().single();
  const { data, error } = await request;
  setLoading(false);
  if (error) return handleSupabaseError(error);
  state.id = data.id;
  isDirty = false;
  await listarFichas();
  $("#sheetSelect").value = state.id;
  toast("Ficha salva.");
}

async function salvarFichaSupabase() {
  return salvarFicha();
}

async function carregarFicha(id) {
  if (!id) return;
  setLoading(true);
  const { data, error } = await db.from("fichas_rpg").select("*").eq("id", id).single();
  setLoading(false);
  if (error) return handleSupabaseError(error);
  state = fromRow(data);
  hydrateForm();
  renderAll();
  toast("Ficha carregada.");
}

async function carregarFichaSupabase(id) {
  return carregarFicha(id);
}

async function atualizarFicha() {
  return salvarFicha();
}

async function atualizarFichaSupabase(id = state.id) {
  if (id && id !== state.id) state.id = id;
  return atualizarFicha();
}

async function excluirFicha() {
  if (!state.id) return toast("Nenhuma ficha salva para excluir.", "danger");
  if (!confirm("Excluir esta ficha permanentemente?")) return;
  setLoading(true);
  const { error } = await db.from("fichas_rpg").delete().eq("id", state.id);
  setLoading(false);
  if (error) return handleSupabaseError(error);
  state = defaultSheet();
  hydrateForm();
  renderAll();
  await listarFichas();
  toast("Ficha excluida.");
}

async function excluirFichaSupabase(id = state.id) {
  if (id && id !== state.id) state.id = id;
  return excluirFicha();
}

async function listarFichas() {
  const select = $("#sheetSelect");
  select.innerHTML = `<option value="">Fichas salvas</option>`;
  if (!user) return;
  const { data, error } = await db.from("fichas_rpg").select("id,nome,classe,nivel").order("updated_at", { ascending: false });
  if (error) return handleSupabaseError(error, false);
  select.innerHTML += data.map((sheet) => `<option value="${sheet.id}">${escapeHtml(sheet.nome || "Sem nome")} - Nv ${sheet.nivel || 1}</option>`).join("");
}

async function listarFichasSupabase() {
  return listarFichas();
}

function novaFicha() {
  state = defaultSheet();
  hydrateForm();
  renderAll();
  $("#sheetSelect").value = "";
  toast("Nova ficha pronta.");
}

function resetarFicha() {
  if (!confirm("Resetar os campos da ficha atual?")) return;
  const id = state.id;
  state = defaultSheet();
  state.id = id;
  hydrateForm();
  renderAll();
  markDirty();
}

function toPayload() {
  return {
    nome: state.nome,
    classe: state.classe,
    nivel: state.nivel,
    tema: state.tema,
    origem: state.origem,
    retrato: state.retrato,
    personagem: {
      identidade: {
        nome: state.nome,
        classe: state.classe,
        nivel: state.nivel,
        tema: state.tema,
        origem: state.origem,
        idade: state.idade,
        altura: state.altura,
        peso: state.peso,
        aparencia: state.aparencia,
        pecado: state.pecado,
        historico: state.historico,
        alerta: state.alerta,
        retrato: state.retrato
      },
      idade: state.idade,
      altura: state.altura,
      peso: state.peso,
      aparencia: state.aparencia,
      pecado: state.pecado,
      historico: state.historico,
      alerta: state.alerta,
      recursos: state.recursos,
      combate: state.combate,
      atributos: state.atributos,
      memorias: state.memorias,
      equipamentos: state.equipamentos,
      lacos: state.lacos,
      condicoes: state.combate.condicoes,
      anotacoes: {
        historico: state.historico,
        alerta: state.alerta
      },
      rolagens: state.rolagens
    }
  };
}

function fromRow(row) {
  const sheet = defaultSheet();
  const personagem = row.personagem || {};
  return {
    ...sheet,
    ...personagem,
    id: row.id,
    nome: row.nome || "",
    classe: row.classe || "",
    nivel: row.nivel || 1,
    tema: row.tema || "",
    origem: row.origem || "",
    retrato: row.retrato || "",
    recursos: { ...sheet.recursos, ...(personagem.recursos || {}) },
    combate: { ...sheet.combate, ...(personagem.combate || {}) },
    atributos: { ...sheet.atributos, ...(personagem.atributos || {}) },
    memorias: personagem.memorias || [],
    equipamentos: personagem.equipamentos || [],
    lacos: personagem.lacos || [],
    rolagens: personagem.rolagens || []
  };
}

function rollDie(sides, label = "") {
  const die = $("#dieVisual");
  const number = $("#dieNumber");
  const result = $("#diceResult");
  const detail = $("#diceDetail");
  die.className = `die d${sides} rolling`;
  result.textContent = `Rolando ${label ? `${label} ` : ""}D${sides}`;
  detail.textContent = diceName(sides);

  let ticks = 0;
  const interval = setInterval(() => {
    number.textContent = Math.ceil(Math.random() * sides);
    ticks += 1;
    if (ticks > 18) {
      clearInterval(interval);
      const final = Math.ceil(Math.random() * sides);
      const status = final === sides ? "critico" : final === 1 ? "falha" : "normal";
      number.textContent = final;
      die.classList.remove("rolling");
      die.classList.toggle("critical", status === "critico");
      die.classList.toggle("failure", status === "falha");
      result.textContent = `${label ? `${label}: ` : ""}${final}`;
      detail.textContent = status === "critico" ? "Critico luminoso." : status === "falha" ? "Falha detectada." : `Resultado D${sides}.`;
      state.rolagens.unshift({ dado: `D${sides}`, label, resultado: final, status, horario: new Date().toLocaleTimeString("pt-BR") });
      state.rolagens = state.rolagens.slice(0, 20);
      renderRollHistory();
      markDirty();
    }
  }, 70);
}

function renderRollHistory() {
  $("#rollHistory").innerHTML = state.rolagens.map((roll) => `
    <div class="roll-item ${roll.status}">
      <strong>${roll.label || roll.dado} = ${roll.resultado}</strong>
      <span>${roll.dado} - ${roll.horario}</span>
    </div>
  `).join("") || skeleton("Sem rolagens ainda.");
}

function limparHistoricoDados() {
  if (!state.rolagens.length) {
    toast("Historico de dados ja esta vazio.");
    return;
  }
  if (!confirm("Limpar todo o historico de rolagens?")) return;
  state.rolagens = [];
  renderRollHistory();
  markDirty();
  toast("Historico de dados limpo.");
}

function renderPreview() {
  const portrait = state.retrato || "assets/images/portrait-placeholder.svg";
  $("#previewSheet").innerHTML = `
    <div class="preview-hero">
      <img src="${escapeHtml(portrait)}" alt="Retrato do personagem" onerror="this.src='assets/images/portrait-placeholder.svg'" />
      <div>
        <p class="eyebrow">Nivel ${state.nivel || 1}</p>
        <h2>${escapeHtml(state.nome || "Personagem sem nome")}</h2>
        <p>${escapeHtml(state.classe || "Classe indefinida")} - ${escapeHtml(state.tema || "Tema")} - ${escapeHtml(state.origem || "Origem")}</p>
      </div>
    </div>
    <div class="preview-grid">
      ${resources.map(({ key, label }) => `<div><span>${label}</span><strong>${state.recursos[key].atual}/${state.recursos[key].maximo}</strong></div>`).join("")}
      ${attributes.map((attr) => `<div><span>${attr}</span><strong>${state.atributos[attr]}</strong></div>`).join("")}
    </div>
    <div class="preview-columns">
      <section><h3>Habilidades</h3>${state.memorias.map((m) => `<p><strong>${escapeHtml(m.codigo)} ${escapeHtml(m.titulo)}</strong><br>${escapeHtml(m.descricao)}</p>`).join("") || "<p>Nenhuma habilidade.</p>"}</section>
      <section><h3>Equipamentos</h3>${state.equipamentos.map((e) => `<p><strong>${escapeHtml(e.nome)}</strong><br>${escapeHtml(e.descricao)} ${escapeHtml(e.bonus)}</p>`).join("") || "<p>Nenhum equipamento.</p>"}</section>
      <section><h3>Lacos</h3>${state.lacos.map((l) => `<p><strong>${escapeHtml(l.nome)}</strong> - ${escapeHtml(l.tipo)}<br>${escapeHtml(l.notas)}</p>`).join("") || "<p>Nenhum laco.</p>"}</section>
    </div>
  `;
}

function exportarJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.nome || "ficha-fabula-ultima"}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importarJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state = { ...defaultSheet(), ...JSON.parse(reader.result) };
    hydrateForm();
    renderAll();
    markDirty();
    toast("JSON importado.");
  };
  reader.readAsText(file);
}

function importarFotoPerfil(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    toast("Escolha um arquivo de imagem.", "danger");
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    toast("Use uma imagem de ate 2 MB.", "danger");
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    state.retrato = reader.result;
    const input = document.querySelector('[data-field="retrato"]');
    if (input) input.value = state.retrato;
    renderProfilePhoto();
    markDirty();
    toast("Foto adicionada ao perfil.");
  };
  reader.readAsDataURL(file);
}

function removerFotoPerfil() {
  state.retrato = "";
  const input = document.querySelector('[data-field="retrato"]');
  if (input) input.value = "";
  $("#profilePhotoInput").value = "";
  renderProfilePhoto();
  markDirty();
  toast("Foto removida.");
}

function markDirty() {
  isDirty = true;
  saveLocalBackup();
  renderPreview();
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    if (isDirty && user && remoteSaveEnabled) salvarFicha();
  }, 2200);
}

function saveLocalBackup() {
  localStorage.setItem(backupKey, JSON.stringify(state));
}

function restoreLocalBackup() {
  const backup = localStorage.getItem(backupKey);
  if (!backup || user) return;
  try {
    state = { ...defaultSheet(), ...JSON.parse(backup) };
  } catch {
    localStorage.removeItem(backupKey);
  }
}

function setLoading(active) {
  $("#loadingScreen").classList.toggle("hidden", !active);
}

function toast(message, type = "success") {
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.textContent = message;
  $("#toastStack").appendChild(item);
  setTimeout(() => item.remove(), 3600);
}

function handleSupabaseError(error, showToast = true) {
  setLoading(false);
  const message = supabaseErrorMessage(error);
  if (isMissingTableError(error)) {
    remoteSaveEnabled = false;
    const select = $("#sheetSelect");
    if (select) select.innerHTML = `<option value="">Execute o SQL do Supabase</option>`;
    if (!schemaWarningShown && showToast) {
      schemaWarningShown = true;
      toast(message, "danger");
    }
    return;
  }
  if (showToast) toast(message, "danger");
}

function isMissingTableError(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.code || ""}`.toLowerCase();
  return message.includes("fichas_rpg") && (message.includes("schema cache") || message.includes("could not find") || message.includes("pgrst205"));
}

function supabaseErrorMessage(error) {
  if (isMissingTableError(error)) {
    return "Tabela fichas_rpg nao encontrada. Execute sql/supabase.sql no SQL Editor do Supabase.";
  }
  return error?.message || "Erro ao acessar o Supabase.";
}

function authErrorMessage(error) {
  const message = error?.message || String(error || "Erro desconhecido.");
  const normalized = message.toLowerCase();
  if (normalized.includes("email not confirmed")) return "Confirme seu email antes de entrar.";
  if (normalized.includes("invalid login credentials")) return "Email ou senha incorretos.";
  if (normalized.includes("password")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (normalized.includes("already registered") || normalized.includes("already exists")) return "Este email ja esta cadastrado. Use Entrar.";
  if (normalized.includes("failed to fetch") || normalized.includes("network")) return "Nao foi possivel conectar ao Supabase agora.";
  return message;
}

function applySavedTheme() {
  const savedTheme = localStorage.getItem(themeKey);
  setTheme(savedTheme === "light" ? "light-purple" : savedTheme || "purple", false);
}

function setTheme(theme, persist = true) {
  document.body.dataset.theme = theme;
  $$("[data-theme-option]").forEach((button) => {
    button.classList.toggle("active", button.dataset.themeOption === theme);
  });
  if (persist) localStorage.setItem(themeKey, theme);
}

function toggleThemeMenu() {
  const menu = $("#themeMenu");
  const isOpen = menu.classList.toggle("open");
  $("#themeButton").setAttribute("aria-expanded", String(isOpen));
}

function closeThemeMenu() {
  $("#themeMenu").classList.remove("open");
  $("#themeButton").setAttribute("aria-expanded", "false");
}

function skeleton(text) {
  return `<div class="skeleton"><span></span><p>${text}</p></div>`;
}

function diceName(sides) {
  return {
    4: "Tetraedro",
    6: "Cubo",
    8: "Octaedro",
    10: "Trapezoedro Pentagonal",
    12: "Dodecaedro",
    20: "Icosaedro"
  }[sides];
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.salvarFicha = salvarFicha;
window.carregarFicha = carregarFicha;
window.atualizarFicha = atualizarFicha;
window.excluirFicha = excluirFicha;
window.listarFichas = listarFichas;
window.cadastrarUsuario = cadastrarUsuario;
window.loginUsuario = loginUsuario;
window.logoutUsuario = logoutUsuario;
window.salvarFichaSupabase = salvarFichaSupabase;
window.carregarFichaSupabase = carregarFichaSupabase;
window.atualizarFichaSupabase = atualizarFichaSupabase;
window.excluirFichaSupabase = excluirFichaSupabase;
window.listarFichasSupabase = listarFichasSupabase;
