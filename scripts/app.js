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
const defaultSheet = ({ withLocalId = true } = {}) => ({
  id: null,
  localId: withLocalId ? createLocalId() : null,
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

let state = null;
let user = null;
let autosaveTimer = null;
let isDirty = false;
let remoteSaveEnabled = true;
let schemaWarningShown = false;
let isSaving = false;
let pendingSave = false;
let sheetList = [];
let deleteModalOpen = false;

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
  await refreshAuthState();
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
      <div class="attribute-roll-result" id="attrRoll${attr}">
        <div class="mini-die d8"><span>?</span></div>
        <small>Resultado</small>
      </div>
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
    if (!state) return;
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
    if (target.dataset.attribute) {
      state.atributos[target.dataset.attribute] = target.value;
      renderAttributeRollPlaceholder(target.dataset.attribute);
    }
    markDirty();
  });

  $("#authForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await login();
  });
  $("#signupBtn").addEventListener("click", signup);
  $("#logoutBtn").addEventListener("click", logout);
  $("#saveBtn")?.addEventListener("click", () => salvarFicha());
  $("#saveBtnTop").addEventListener("click", () => salvarFicha());
  $("#newSheetBtn").addEventListener("click", novaFicha);
  $("#emptyNewSheetBtn").addEventListener("click", novaFicha);
  $("#newSheetBtnSettings").addEventListener("click", novaFicha);
  $("#loadSelectedBtn").addEventListener("click", () => carregarFichaSupabase($("#sheetSelect").value));
  $("#deleteBtn").addEventListener("click", abrirModalExclusao);
  $("#cancelDeleteBtn").addEventListener("click", () => fecharModalExclusao(true));
  $("#confirmDeleteBtn").addEventListener("click", confirmarExclusao);
  $("#deleteModal").addEventListener("click", (event) => {
    if (event.target.id === "deleteModal") fecharModalExclusao(true);
  });
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
    if (remove && state) removeItem(remove.dataset.remove, Number(remove.dataset.index));
    if (roll && state) rollDie(Number(roll.dataset.die));
    if (attrRoll && state) rolarAtributo(attrRoll.dataset.rollAttribute);
    if (themeOption) {
      setTheme(themeOption.dataset.themeOption);
      closeThemeMenu();
    } else if (!event.target.closest("#themeMenu")) {
      closeThemeMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && deleteModalOpen) {
      fecharModalExclusao(true);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      salvarFicha();
    }
  });
}

function setField(field, value) {
  if (!state) return;
  if (["defesa", "defesaMagica", "iniciativa", "condicoes"].includes(field)) {
    state.combate[field] = field === "condicoes" ? value : Number(value || 0);
    return;
  }
  state[field] = field === "nivel" ? Number(value || 1) : value;
}

function updateWorkspaceState() {
  const hasUser = Boolean(user);
  const hasSheet = Boolean(state);
  const hasSavedSheets = sheetList.length > 0;
  $("#sheetForm").classList.toggle("hidden", !hasUser || !hasSheet);
  $("#emptyState").classList.toggle("hidden", !hasUser || hasSheet);
  $("#emptyStateTitle").textContent = hasSavedSheets ? "Selecione uma ficha salva." : "Nenhuma ficha encontrada.";
  $("#emptyStateMessage").textContent = hasSavedSheets ? "Use a lista de fichas salvas ou clique em Nova Ficha para começar outra." : "Clique em Nova Ficha para começar.";
  $("#saveBtnTop").disabled = !hasUser || !hasSheet;
  $("#loadSelectedBtn").disabled = !hasUser || !$("#sheetSelect").value;
  $("#deleteBtn").disabled = !hasUser || !state?.id;
  $("#exportBtn").disabled = !hasSheet;
  $("#resetBtn").disabled = !hasSheet;
}

function clearActiveSheet() {
  state = null;
  isDirty = false;
  pendingSave = false;
  clearTimeout(autosaveTimer);
  $("#sheetSelect").value = "";
  updateWorkspaceState();
}

function hydrateForm() {
  if (!state) return;
  $$("[data-field]").forEach((input) => {
    const field = input.dataset.field;
    input.value = state.combate[field] ?? state[field] ?? "";
  });
  $$("[data-resource]").forEach((input) => {
    input.value = state.recursos[input.dataset.resource][input.dataset.prop];
  });
  $$("[data-attribute]").forEach((select) => {
    select.value = state.atributos[select.dataset.attribute];
    renderAttributeRollPlaceholder(select.dataset.attribute);
  });
  renderProfilePhoto();
}

function renderAll() {
  if (!state) {
    updateWorkspaceState();
    return;
  }
  renderResources();
  renderMemories();
  renderEquipment();
  renderBonds();
  renderRollHistory();
  renderProfilePhoto();
  renderPreview();
  updateWorkspaceState();
}

function renderAttributeRollPlaceholder(attr) {
  if (!state) return;
  const target = $(`#attrRoll${attr}`);
  if (!target) return;
  const sides = Number(state.atributos[attr].replace("d", ""));
  target.innerHTML = `<div class="mini-die d${sides}"><span>?</span></div><small>D${sides}</small>`;
}

function renderProfilePhoto() {
  const preview = $("#profilePhotoPreview");
  if (!preview || !state) return;
  preview.src = state.retrato || "assets/images/portrait-placeholder.svg";
}

function renderResources() {
  if (!state) return;
  resources.forEach(({ key }) => {
    const resource = state.recursos[key];
    const percent = Math.max(0, Math.min(100, Math.round((resource.atual / Math.max(resource.maximo, 1)) * 100)));
    $(`#${key}Bar`).style.width = `${percent}%`;
    $(`#${key}Percent`).textContent = `${percent}%`;
  });
}

function renderMemories() {
  if (!state) return;
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
  if (!state) return;
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
  if (!state) return;
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
  if (!state) return;
  state.memorias.push({ codigo: "M-00", titulo: "", habilidade: "", descricao: "", custo: "" });
  renderMemories();
  markDirty();
}

function addEquipment() {
  if (!state) return;
  state.equipamentos.push({ nome: "", descricao: "", bonus: "" });
  renderEquipment();
  markDirty();
}

function addBond() {
  if (!state) return;
  state.lacos.push({ nome: "", tipo: "Conexao", notas: "" });
  renderBonds();
  markDirty();
}

function removeItem(list, index) {
  if (!state) return;
  if (!confirm("Excluir este item?")) return;
  state[list].splice(index, 1);
  renderAll();
  markDirty();
}

async function login() {
  const loginId = getAuthLoginId();
  if (!loginId) return;
  try {
    setLoading(true);
    const { error, data } = await db.auth.signInWithPassword({
      email: loginId.email,
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
  const loginId = getAuthLoginId();
  if (!loginId) return;
  const password = $("#authPassword").value;
  if (password.length < 6) {
    toast("A senha precisa ter pelo menos 6 caracteres.", "danger");
    return;
  }

  try {
    setLoading(true);
    const { error, data } = await db.auth.signUp({
      email: loginId.email,
      password,
      options: {
        data: { username: loginId.username, loginType: loginId.type },
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
    toast("Cadastro criado. Desative confirmacao de email no Supabase para entrar sem email.", "danger");
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
  state = null;
  sheetList = [];
  await refreshAuthState();
  toast("Sessao encerrada.");
}

async function refreshAuthState() {
  $("#authPanel").classList.toggle("hidden", Boolean(user));
  if (!user) {
    clearActiveSheet();
    $("#sheetSelect").innerHTML = `<option value="">Fichas salvas</option>`;
    updateWorkspaceState();
    return;
  }
  await listarFichas();
  updateWorkspaceState();
}

async function salvarFicha(options = {}) {
  const silent = options.silent === true;
  if (!state) {
    if (!silent) toast("Clique em Nova Ficha para começar.", "danger");
    return;
  }
  if (!user) {
    if (!silent) toast("Entre para salvar online.", "danger");
    return;
  }
  if (!fichaTemConteudo(state)) {
    if (!silent) toast("Preencha a ficha antes de salvar.", "danger");
    return;
  }
  if (isSaving) {
    pendingSave = true;
    return;
  }
  isSaving = true;
  remoteSaveEnabled = true;
  if (!silent) setLoading(true);

  try {
    const payload = toPayload();
    const isUpdate = Boolean(state.id);
    const request = state.id
      ? db.from("fichas_rpg").update(payload).eq("id", state.id).select("id").single()
      : db.from("fichas_rpg").insert(payload).select("id").single();
    const { data, error } = await request;
    if (error) return handleSupabaseError(error, !silent);
    state.id = data.id;
    isDirty = false;
    if (!silent) {
      await listarFichas();
      $("#sheetSelect").value = state.id;
      updateWorkspaceState();
      toast(isUpdate ? "Ficha atualizada com sucesso." : "Ficha salva com sucesso.");
    }
  } catch (error) {
    if (!silent) toast("Nao foi possivel salvar agora.", "danger");
  } finally {
    if (!silent) setLoading(false);
    isSaving = false;
    pendingSave = false;
  }
}

async function salvarFichaSupabase() {
  return salvarFicha();
}

async function encontrarFichaExistente() {
  if (!state) return null;
  if (!state.localId) state.localId = createLocalId();
  const { data, error } = await db
    .from("fichas_rpg")
    .select("id")
    .eq("personagem->>localId", state.localId)
    .maybeSingle();
  if (error) return null;
  return data?.id || null;
}

async function carregarFicha(id) {
  if (!id) return;
  setLoading(true);
  const { data, error } = await db.from("fichas_rpg").select("*").eq("id", id).single();
  setLoading(false);
  if (error) return handleSupabaseError(error);
  state = fromRow(data);
  isDirty = false;
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

async function atualizarFichaSupabase(id = state?.id) {
  if (!state) return;
  if (id && id !== state.id) state.id = id;
  return atualizarFicha();
}

function abrirModalExclusao() {
  if (!state?.id) return toast("Nenhuma ficha salva para excluir.", "danger");
  deleteModalOpen = true;
  const modal = $("#deleteModal");
  modal.classList.remove("hidden", "closing");
  $("#cancelDeleteBtn").focus();
}

function fecharModalExclusao(showToast = false) {
  if (!deleteModalOpen) return;
  deleteModalOpen = false;
  const modal = $("#deleteModal");
  modal.classList.add("closing");
  setTimeout(() => {
    modal.classList.add("hidden");
    modal.classList.remove("closing");
  }, 180);
  if (showToast) toast("Exclusão cancelada.");
}

async function confirmarExclusao() {
  fecharModalExclusao(false);
  await excluirFicha();
}

async function excluirFicha() {
  if (!state?.id) return toast("Nenhuma ficha salva para excluir.", "danger");
  setLoading(true);
  const { error } = await db.from("fichas_rpg").delete().eq("id", state.id);
  setLoading(false);
  if (error) return handleSupabaseError(error);
  state = null;
  isDirty = false;
  await listarFichas();
  updateWorkspaceState();
  toast("Ficha excluída com sucesso.");
}

async function excluirFichaSupabase(id = state?.id) {
  if (!state) return;
  if (id && id !== state.id) state.id = id;
  return abrirModalExclusao();
}

async function listarFichas() {
  const select = $("#sheetSelect");
  select.innerHTML = `<option value="">Fichas salvas</option>`;
  sheetList = [];
  if (!user) return [];
  const { data, error } = await db
    .from("fichas_rpg")
    .select("id,nome,classe,nivel,tema,origem,retrato,personagem,updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  if (error) return handleSupabaseError(error, false);
  sheetList = filtrarFichasPersistidas(data || []);
  if (!sheetList.length) {
    select.innerHTML = `<option value="">Nenhuma ficha encontrada</option>`;
    if (!state?.id) clearActiveSheet();
    return sheetList;
  }
  select.innerHTML += sheetList.map((sheet) => `<option value="${sheet.id}">${escapeHtml(sheet.nome || "Sem nome")} - Nv ${sheet.nivel || 1}</option>`).join("");
  if (state?.id && sheetList.some((sheet) => sheet.id === state.id)) {
    select.value = state.id;
  } else if (!state?.id) {
    select.value = "";
  }
  updateWorkspaceState();
  return sheetList;
}

async function listarFichasSupabase() {
  return listarFichas();
}

function filtrarFichasPersistidas(fichas) {
  const vistos = new Set();
  return fichas.filter((ficha) => {
    const personagem = ficha?.personagem || {};
    const chave = personagem.localId || ficha?.id;
    if (!ficha?.id || !chave || vistos.has(chave)) return false;
    vistos.add(chave);
    return fichaTemConteudo(ficha);
  });
}

function fichaTemConteudo(ficha) {
  const personagem = ficha.personagem || ficha || {};
  const identidade = personagem.identidade || {};
  const camposVisiveis = [
    ficha.nome,
    ficha.classe,
    ficha.tema,
    ficha.origem,
    ficha.retrato,
    ficha.idade,
    ficha.altura,
    ficha.peso,
    ficha.aparencia,
    ficha.pecado,
    ficha.historico,
    ficha.alerta,
    identidade.nome,
    identidade.classe,
    identidade.tema,
    identidade.origem,
    identidade.idade,
    identidade.altura,
    identidade.peso,
    identidade.aparencia,
    identidade.pecado,
    identidade.historico,
    identidade.alerta,
    personagem.aparencia,
    personagem.pecado,
    personagem.historico,
    personagem.alerta,
    personagem.condicoes
  ];
  const listas = [personagem.memorias, personagem.equipamentos, personagem.lacos, personagem.rolagens, ficha.memorias, ficha.equipamentos, ficha.lacos, ficha.rolagens];
  return camposVisiveis.some((valor) => String(valor || "").trim()) || listas.some((lista) => Array.isArray(lista) && lista.length > 0);
}

function novaFicha() {
  state = defaultSheet();
  isDirty = false;
  hydrateForm();
  renderAll();
  $("#sheetSelect").value = "";
  toast("Nova ficha pronta.");
}

function resetarFicha() {
  if (!state) return toast("Clique em Nova Ficha para começar.", "danger");
  if (!confirm("Resetar os campos da ficha atual?")) return;
  const id = state.id;
  const localId = state.localId;
  state = defaultSheet();
  state.id = id;
  state.localId = localId;
  hydrateForm();
  renderAll();
  markDirty();
}

function toPayload() {
  if (!state) return null;
  return {
    nome: state.nome,
    classe: state.classe,
    nivel: state.nivel,
    tema: state.tema,
    origem: state.origem,
    retrato: state.retrato,
    personagem: {
      localId: state.localId,
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
  const sheet = defaultSheet({ withLocalId: false });
  const personagem = row.personagem || {};
  return {
    ...sheet,
    ...personagem,
    id: row.id,
    localId: personagem.localId || null,
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
  if (!state) return Promise.resolve(null);
  return new Promise((resolve) => {
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
        die.classList.remove("dice-impact");
        void die.offsetWidth;
        die.classList.add("dice-impact");
        result.textContent = `${label ? `${label}: ` : ""}${final}`;
        result.classList.remove("dice-impact");
        void result.offsetWidth;
        result.classList.add("dice-impact");
        detail.textContent = status === "critico" ? "Critico luminoso." : status === "falha" ? "Falha detectada." : `Resultado D${sides}.`;
        state.rolagens.unshift({ dado: `D${sides}`, label, resultado: final, status, horario: new Date().toLocaleTimeString("pt-BR") });
        state.rolagens = state.rolagens.slice(0, 20);
        renderRollHistory();
        markDirty();
        resolve({ sides, final, status, label });
      }
    }, 70);
  });
}

async function rolarAtributo(attr) {
  if (!state) return;
  const sides = Number(state.atributos[attr].replace("d", ""));
  const target = $(`#attrRoll${attr}`);
  target.innerHTML = `<div class="mini-die d${sides} rolling"><span>?</span></div><small>Rolando D${sides}</small>`;
  const roll = await rollDie(sides, attr);
  target.innerHTML = `
    <div class="mini-die d${sides} ${roll.status}"><span>${roll.final}</span></div>
    <small>${roll.status === "critico" ? "Critico" : roll.status === "falha" ? "Falha" : `D${sides}`}</small>
  `;
}

function renderRollHistory() {
  if (!state) return;
  $("#rollHistory").innerHTML = state.rolagens.map((roll) => `
    <div class="roll-item ${roll.status}">
      <strong>${roll.label || roll.dado} = ${roll.resultado}</strong>
      <span>${roll.dado} - ${roll.horario}</span>
    </div>
  `).join("") || skeleton("Sem rolagens ainda.");
}

function limparHistoricoDados() {
  if (!state) return;
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
  if (!state) {
    $("#previewSheet").innerHTML = "";
    return;
  }
  const portrait = state.retrato || "assets/images/portrait-placeholder.svg";
  $("#previewSheet").innerHTML = `
    <div class="preview-hero">
      <img src="${escapeHtml(portrait)}" alt="Retrato do personagem" onerror="this.src='assets/images/portrait-placeholder.svg'" />
      <div class="preview-identity">
        <p class="eyebrow">Nivel ${state.nivel || 1}</p>
        <h2>${escapeHtml(state.nome || "Personagem sem nome")}</h2>
        <p>${escapeHtml(state.classe || "Classe indefinida")}</p>
        <div class="preview-tags">
          <span>${escapeHtml(state.tema || "Tema")}</span>
          <span>${escapeHtml(state.origem || "Origem")}</span>
          <span>${escapeHtml(state.pecado || "Pecado")}</span>
        </div>
      </div>
    </div>
    <div class="preview-body">
      <section class="preview-panel">
        <h3>Recursos</h3>
        <div class="preview-stat-grid">
          ${resources.map(({ key, label }) => `<div><span>${label}</span><strong>${state.recursos[key].atual}/${state.recursos[key].maximo}</strong></div>`).join("")}
        </div>
      </section>
      <section class="preview-panel">
        <h3>Atributos</h3>
        <div class="preview-attribute-row">
          ${attributes.map((attr) => `<div><strong>${attr}</strong><span>${state.atributos[attr]}</span></div>`).join("")}
        </div>
      </section>
      <section class="preview-panel">
        <h3>Combate</h3>
        <div class="preview-stat-grid">
          <div><span>Defesa</span><strong>${state.combate.defesa}</strong></div>
          <div><span>Def. Magica</span><strong>${state.combate.defesaMagica}</strong></div>
          <div><span>Iniciativa</span><strong>${state.combate.iniciativa}</strong></div>
        </div>
        <p class="preview-note">${escapeHtml(state.combate.condicoes || "Sem condicoes ativas.")}</p>
      </section>
      <section class="preview-panel wide">
        <h3>Habilidades</h3>
        <div class="preview-list">${state.memorias.map((m) => `
          <article>
            <header><strong>${escapeHtml(m.codigo || "HAB")}</strong><span>${escapeHtml(m.custo || "Sem custo")}</span></header>
            <h4>${escapeHtml(m.titulo || "Habilidade sem titulo")}</h4>
            <p>${escapeHtml(m.habilidade || "")}</p>
            <small>${escapeHtml(m.descricao || "Sem descricao.")}</small>
          </article>
        `).join("") || "<p>Nenhuma habilidade.</p>"}</div>
      </section>
      <section class="preview-panel">
        <h3>Equipamentos</h3>
        <div class="preview-list compact">${state.equipamentos.map((e) => `
          <article>
            <header><strong>${escapeHtml(e.nome || "Item")}</strong><span>${escapeHtml(e.bonus || "")}</span></header>
            <small>${escapeHtml(e.descricao || "Sem descricao.")}</small>
          </article>
        `).join("") || "<p>Nenhum equipamento.</p>"}</div>
      </section>
      <section class="preview-panel">
        <h3>Lacos</h3>
        <div class="preview-list compact">${state.lacos.map((l) => `
          <article class="preview-bond" style="--bond:${bondTypes[l.tipo] || bondTypes.Neutro}">
            <header><strong>${escapeHtml(l.nome || "Laco")}</strong><span>${escapeHtml(l.tipo || "Neutro")}</span></header>
            <small>${escapeHtml(l.notas || "Sem notas.")}</small>
          </article>
        `).join("") || "<p>Nenhum laco.</p>"}</div>
      </section>
      <section class="preview-panel wide">
        <h3>Notas do personagem</h3>
        <div class="preview-notes">
          <p><strong>Aparencia</strong>${escapeHtml(state.aparencia || "Nao definida.")}</p>
          <p><strong>Historico</strong>${escapeHtml(state.historico || "Nao definido.")}</p>
          <p><strong>Alerta</strong>${escapeHtml(state.alerta || "Nenhum alerta.")}</p>
        </div>
      </section>
    </div>
  `;
}

function exportarJSON() {
  if (!state) return toast("Nenhuma ficha selecionada para exportar.", "danger");
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
    state = { ...defaultSheet(), ...JSON.parse(reader.result), id: null };
    if (!state.localId) state.localId = createLocalId();
    isDirty = true;
    hydrateForm();
    renderAll();
    toast("JSON importado.");
  };
  reader.readAsText(file);
}

function importarFotoPerfil(event) {
  if (!state) return toast("Clique em Nova Ficha para começar.", "danger");
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    toast("Escolha um arquivo de imagem.", "danger");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    toast("Use uma imagem de ate 5 MB.", "danger");
    event.target.value = "";
    return;
  }
  comprimirFotoPerfil(file).then((dataUrl) => {
    state.retrato = dataUrl;
    const input = document.querySelector('[data-field="retrato"]');
    if (input) input.value = state.retrato;
    renderProfilePhoto();
    markDirty();
    toast("Foto adicionada ao perfil.");
  }).catch(() => toast("Nao foi possivel processar a imagem.", "danger"));
}

function comprimirFotoPerfil(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const maxSide = 1200;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function removerFotoPerfil() {
  if (!state) return;
  state.retrato = "";
  const input = document.querySelector('[data-field="retrato"]');
  if (input) input.value = "";
  $("#profilePhotoInput").value = "";
  renderProfilePhoto();
  markDirty();
  toast("Foto removida.");
}

function markDirty() {
  if (!state) return;
  isDirty = true;
  saveLocalBackup();
  renderPreview();
  clearTimeout(autosaveTimer);
}

function saveLocalBackup() {
  if (!state) return;
  localStorage.setItem(backupKey, JSON.stringify(state));
}

function createLocalId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function setLoading(active) {
  $("#loadingScreen").classList.toggle("hidden", !active);
}

function toast(message, type = "success") {
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.textContent = message;
  $("#toastStack").appendChild(item);
  setTimeout(() => {
    item.classList.add("leaving");
    setTimeout(() => item.remove(), 220);
  }, 3600);
}

function getAuthLoginId() {
  const value = $("#authLogin").value.trim().toLowerCase();
  if (isEmail(value)) {
    return {
      email: value,
      type: "email",
      username: value.split("@")[0].replace(/[^a-z0-9._-]/g, "").slice(0, 32) || "usuario"
    };
  }
  if (!/^[a-z0-9._-]{3,32}$/.test(value)) {
    toast("Use um username com 3 a 32 caracteres ou um email valido.", "danger");
    return null;
  }
  return {
    email: usernameToAuthEmail(value),
    type: "username",
    username: value
  };
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function usernameToAuthEmail(username) {
  return `${username}@ficha-fabula.local`;
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
  if (normalized.includes("email logins are disabled")) return "Ative o provedor Email no Supabase e desative apenas a confirmacao de email.";
  if (normalized.includes("email not confirmed")) return "Confirme o email ou desative a confirmacao no Supabase.";
  if (normalized.includes("invalid login credentials")) return "Username/email ou senha incorretos.";
  if (normalized.includes("password")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (normalized.includes("already registered") || normalized.includes("already exists")) return "Este acesso ja esta cadastrado. Use Entrar.";
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
window.excluirFicha = abrirModalExclusao;
window.listarFichas = listarFichas;
window.cadastrarUsuario = cadastrarUsuario;
window.loginUsuario = loginUsuario;
window.logoutUsuario = logoutUsuario;
window.salvarFichaSupabase = salvarFichaSupabase;
window.carregarFichaSupabase = carregarFichaSupabase;
window.atualizarFichaSupabase = atualizarFichaSupabase;
window.excluirFichaSupabase = excluirFichaSupabase;
window.listarFichasSupabase = listarFichasSupabase;
