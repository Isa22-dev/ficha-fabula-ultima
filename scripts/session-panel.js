/**
 * Session Panel Module
 * Gerencia o painel flutuante de sessão com anotações e dados 3D
 */

const SessionPanel = (() => {
  const STORAGE_KEYS = {
    NOTES: "rpg_session_notes",
    HISTORY: "diceHistory"
  };

  const SUPABASE_TABLE = "anotacoes_sessao";

  let isOpen = false;
  let notesAutoSaveTimer = null;
  let supabaseEnabled = false;
  let currentUserId = null;
  const diceHistory = [];

  // Elementos do DOM
  const elements = {
    floatBtn: null,
    panel: null,
    closeBtn: null,
    notesInput: null,
    clearNotesBtn: null,
    exportNotesBtn: null,
    tabs: null,
    contents: null,
    historyList: null,
    clearHistoryBtn: null,
    clearHistoryModal: null,
    cancelClearHistoryBtn: null,
    confirmClearHistoryBtn: null,
    diceResult: null,
    diceQuantity: null,
    diceBtns: null
  };

  /**
   * Inicializa o módulo
   */
  function init() {
    cacheDOMElements();
    window.clearDiceHistory = clearDiceHistory;
    bindEvents();
    initSupabase();
    loadNotes();
    loadHistory();
    updateHistoryDisplay();
  }

  /**
   * Inicializa Supabase
   */
  async function initSupabase() {
    if (!window.supabaseClient) return;

    try {
      const db = window.supabaseClient;
      const { data: session } = await db.auth.getSession();

      if (session?.user) {
        supabaseEnabled = true;
        currentUserId = session.user.id;
        await loadNotesFromSupabase();
        console.log("✓ Supabase inicializado para SessionPanel");
      }

      // Monitora mudanças de autenticação
      db.auth.onAuthStateChange((_event, newSession) => {
        if (newSession?.user) {
          supabaseEnabled = true;
          currentUserId = newSession.user.id;
          loadNotesFromSupabase();
        } else {
          supabaseEnabled = false;
          currentUserId = null;
        }
      });
    } catch (error) {
      console.warn("⚠ Supabase não disponível para SessionPanel:", error.message);
    }
  }

  /**
   * Carrega anotações do Supabase
   */
  async function loadNotesFromSupabase() {
    if (!supabaseEnabled || !currentUserId) return;

    try {
      const db = window.supabaseClient;
      const { data, error } = await db
        .from(SUPABASE_TABLE)
        .select("conteudo")
        .eq("user_id", currentUserId)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const savedContent = localStorage.getItem(STORAGE_KEYS.NOTES);
        // Se há conteúdo local mais recente, usa local; senão usa Supabase
        if (!savedContent || savedContent.length === 0) {
          elements.notesInput.value = data[0].conteudo;
          localStorage.setItem(STORAGE_KEYS.NOTES, data[0].conteudo);
        }
      }
    } catch (error) {
      console.warn("⚠ Erro ao carregar anotações do Supabase:", error.message);
    }
  }

  /**
   * Salva anotações no Supabase
   */
  async function saveNotesToSupabase(content) {
    if (!supabaseEnabled || !currentUserId) return;

    try {
      const db = window.supabaseClient;

      // Tenta atualizar
      const { data: existing, error: selectError } = await db
        .from(SUPABASE_TABLE)
        .select("id")
        .eq("user_id", currentUserId)
        .limit(1);

      if (selectError) throw selectError;

      if (existing && existing.length > 0) {
        // Atualiza
        const { error: updateError } = await db
          .from(SUPABASE_TABLE)
          .update({
            conteudo: content,
            updated_at: new Date().toISOString()
          })
          .eq("user_id", currentUserId);

        if (updateError) throw updateError;
      } else {
        // Insere novo
        const { error: insertError } = await db.from(SUPABASE_TABLE).insert({
          user_id: currentUserId,
          conteudo: content,
          updated_at: new Date().toISOString()
        });

        if (insertError) throw insertError;
      }

      console.log("✓ Anotações sincronizadas com Supabase");
    } catch (error) {
      console.warn("⚠ Erro ao sincronizar anotações com Supabase:", error.message);
    }
  }

  /**
   * Cache dos elementos do DOM
   */
  function cacheDOMElements() {
    elements.floatBtn = document.getElementById("sessionFloatBtn");
    elements.panel = document.getElementById("sessionPanel");
    elements.closeBtn = document.getElementById("sessionCloseBtn");
    elements.notesInput = document.getElementById("sessionNotes");
    elements.clearNotesBtn = document.getElementById("clearNotesBtn");
    elements.exportNotesBtn = document.getElementById("exportNotesBtn");
    elements.tabs = document.querySelectorAll(".session-tab");
    elements.contents = document.querySelectorAll(".session-tab-content");
    elements.historyList = document.getElementById("diceHistory");
    elements.clearHistoryBtn = document.getElementById("clearHistoryBtn");
    elements.clearHistoryModal = document.getElementById("clearHistoryModal");
    elements.cancelClearHistoryBtn = document.getElementById("cancelClearHistoryBtn");
    elements.confirmClearHistoryBtn = document.getElementById("confirmClearHistoryBtn");
    elements.diceResult = document.getElementById("sessionDiceResult") || document.getElementById("diceResult");
    elements.diceQuantity = document.getElementById("diceQuantity");
    elements.diceBtns = document.querySelectorAll(".dice-btn");
  }

  /**
   * Vincula os event listeners
   */
  function bindEvents() {
    // Botão flutuante
    elements.floatBtn.addEventListener("click", togglePanel);

    // Fechar painel
    elements.closeBtn.addEventListener("click", closePanel);

    // Abas
    elements.tabs.forEach((tab) => {
      tab.addEventListener("click", handleTabClick);
    });

    // Anotações
    elements.notesInput.addEventListener("input", handleNotesChange);
    elements.clearNotesBtn.addEventListener("click", handleClearNotes);
    elements.exportNotesBtn.addEventListener("click", handleExportNotes);

    // Histórico
    elements.cancelClearHistoryBtn?.addEventListener("click", closeClearHistoryModal);
    elements.confirmClearHistoryBtn?.addEventListener("click", confirmClearHistory);
    elements.clearHistoryModal?.addEventListener("click", (event) => {
      if (event.target === elements.clearHistoryModal) closeClearHistoryModal();
    });

    // Fechar ao clicar fora (opcional)
    document.addEventListener("click", handleOutsideClick);

    // Prevenir fechar ao clicar dentro do painel
    elements.panel.addEventListener("click", (e) => e.stopPropagation());
  }

  /**
   * Alterna a abertura/fechamento do painel
   */
  function togglePanel() {
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }

  /**
   * Abre o painel
   */
  function openPanel() {
    isOpen = true;
    elements.panel.classList.add("open");
    elements.floatBtn.style.opacity = "0.5";
    document.body.style.overflow = "hidden";
  }

  /**
   * Fecha o painel
   */
  function closePanel() {
    isOpen = false;
    elements.panel.classList.remove("open");
    elements.floatBtn.style.opacity = "1";
    document.body.style.overflow = "";
  }

  /**
   * Manipula cliques fora do painel
   */
  function handleOutsideClick(e) {
    if (isOpen && !elements.panel.contains(e.target) && !elements.floatBtn.contains(e.target)) {
      closePanel();
    }
  }

  /**
   * Manipula mudança de abas
   */
  function handleTabClick(e) {
    const tabName = e.currentTarget.dataset.tab;

    // Remove ativa de todos os tabs
    elements.tabs.forEach((tab) => tab.classList.remove("active"));
    elements.contents.forEach((content) => content.classList.remove("active"));

    // Adiciona ativa ao tab clicado
    e.currentTarget.classList.add("active");
    document.querySelector(`.session-tab-content[data-tab="${tabName}"]`).classList.add("active");

    // Inicializa Dice3D se não estiver
    if (tabName === "dice" && window.Dice3D && !window.Dice3D.isInitialized()) {
      setTimeout(() => window.Dice3D.init(), 100);
    }
  }

  /**
   * Manipula mudanças nas anotações
   */
  function handleNotesChange(e) {
    clearTimeout(notesAutoSaveTimer);
    notesAutoSaveTimer = setTimeout(() => {
      const content = e.target.value;
      saveNotes(content);
      // Também tenta salvar no Supabase
      if (supabaseEnabled) {
        saveNotesToSupabase(content);
      }
    }, 500);
  }

  /**
   * Salva as anotações
   */
  function saveNotes(content) {
    localStorage.setItem(STORAGE_KEYS.NOTES, content);
    console.log("✓ Anotações salvas localmente");
  }

  /**
   * Carrega as anotações
   */
  function loadNotes() {
    const saved = localStorage.getItem(STORAGE_KEYS.NOTES);
    if (saved) {
      elements.notesInput.value = saved;
    }
  }

  /**
   * Limpa as anotações
   */
  function handleClearNotes() {
    if (confirm("Tem certeza que deseja limpar todas as anotações?")) {
      elements.notesInput.value = "";
      localStorage.removeItem(STORAGE_KEYS.NOTES);
      toast("Anotações limpas", "info");
    }
  }

  /**
   * Exporta as anotações como TXT
   */
  function handleExportNotes() {
    const content = elements.notesInput.value;
    if (!content.trim()) {
      toast("Não há anotações para exportar", "warning");
      return;
    }

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `anotacoes-sessao-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Anotações exportadas", "success");
  }

  /**
   * Adiciona uma rolagem ao histórico
   */
  function addToHistory(diceType, results, total) {
    const entry = {
      id: Date.now(),
      dice: diceType,
      results,
      total,
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    };

    diceHistory.unshift(entry);

    // Mantém apenas as últimas 50 rolagens
    if (diceHistory.length > 50) {
      diceHistory.pop();
    }

    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(diceHistory));
    updateHistoryDisplay();

    return entry;
  }

  function loadHistory() {
    let savedHistory = [];

    try {
      savedHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || "[]");
    } catch {
      savedHistory = [];
    }

    diceHistory.length = 0;
    diceHistory.push(...savedHistory.map(normalizeHistoryEntry).filter(Boolean));
  }

  function normalizeHistoryEntry(entry) {
    if (!entry) return null;
    if (Array.isArray(entry.results)) return entry;

    return {
      id: entry.id || Date.now(),
      dice: entry.dice || entry.tipo || "d20",
      results: Array.isArray(entry.detalhes) ? entry.detalhes : [Number(entry.resultado || entry.total || 0)],
      total: Number(entry.total || entry.resultado || 0),
      time: entry.time || entry.timestamp || new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    };
  }

  /**
   * Obtém o histórico
   */
  function getHistory() {
    return diceHistory;
  }

  /**
   * Atualiza a exibição do histórico
   */
  function updateHistoryDisplay() {
    if (!elements.historyList) return;

    if (diceHistory.length === 0) {
      elements.historyList.innerHTML = '<div class="history-empty">Nenhuma rolagem registrada.</div>';
      return;
    }

    elements.historyList.innerHTML = diceHistory
      .map(
        (entry) => `
      <div class="history-item ${entry.results.some((r) => r === 20 || r === 1) ? "highlight" : ""}">
        <div>
          <strong>${entry.dice}</strong>
          <span class="history-item-result">${entry.total}</span>
          ${entry.results.length > 1 ? `<span>(${entry.results.join(", ")})</span>` : ""}
        </div>
        <span class="history-item-time">${entry.time}</span>
      </div>
    `
      )
      .join("");
  }

  /**
   * Limpa o histórico
   */
  function openClearHistoryModal() {
    if (elements.clearHistoryModal) {
      elements.clearHistoryModal.classList.remove("hidden", "closing");
      return;
    }

    confirmClearHistory();
  }

  function closeClearHistoryModal() {
    if (!elements.clearHistoryModal) return;
    elements.clearHistoryModal.classList.add("hidden");
  }

  function confirmClearHistory() {
    diceHistory.length = 0;

    if (elements.historyList) {
      elements.historyList.innerHTML = '<div class="history-empty">Nenhuma rolagem registrada.</div>';
    }

    localStorage.removeItem(STORAGE_KEYS.HISTORY);

    if (window.Dice3D && typeof window.Dice3D.clearHistory === "function") {
      window.Dice3D.clearHistory();
    }

    closeClearHistoryModal();
    mostrarToast("Histórico apagado com sucesso.");
  }

  function clearDiceHistory() {
    openClearHistoryModal();
  }

  /**
   * Retorna a função pública para rolar dados
   */
  function rollDice(diceType, quantity = 1) {
    const diceLabel = String(diceType).startsWith("d") ? String(diceType) : `d${diceType}`;

    // Usa Dice3D se disponível
    if (window.Dice3D && window.Dice3D.isInitialized()) {
      window.Dice3D.rollDice(diceLabel, quantity);
    } else {
      // Fallback: simula rolagem sem 3D
      const results = [];
      const diceValue = Number(diceLabel.replace("d", ""));

      for (let i = 0; i < quantity; i++) {
        results.push(Math.floor(Math.random() * diceValue) + 1);
      }

      const total = results.reduce((a, b) => a + b, 0);
      registerRollResult(diceLabel, quantity, results, total);
    }
  }

  /**
   * Registra um resultado de rolagem (chamado por Dice3D)
   */
  function registerRollResult(diceType, quantity, results, total) {
    // Adiciona ao histórico
    const entry = addToHistory(`${quantity}${diceType}`, results, total);

    // Exibe o resultado
    displayResult(diceType, quantity, results, total, entry);

    return { results, total };
  }

  /**
   * Exibe o resultado da rolagem
   */
  function displayResult(diceType, quantity, results, total, entry) {
    if (!elements.diceResult) return;

    if (quantity === 1) {
      elements.diceResult.innerHTML = `Resultado: <strong>${total}</strong>`;
    } else {
      elements.diceResult.innerHTML = `${quantity}${diceType}: ${results.join(", ")} = <strong>${total}</strong>`;
    }

    // Adiciona animação
    elements.diceResult.style.animation = "none";
    setTimeout(() => {
      elements.diceResult.style.animation = "pulse 0.6s ease-out";
    }, 10);
  }

  /**
   * API Pública
   */
  return {
    init,
    openPanel,
    closePanel,
    togglePanel,
    rollDice,
    registerRollResult,
    addToHistory,
    getHistory,
    updateHistoryDisplay,
    saveNotes,
    loadNotes,
    getNotes: () => elements.notesInput.value
  };
})();

window.SessionPanel = SessionPanel;

// Toast helper (se não existir)
function toast(message, type = "info") {
  const toastStack = document.getElementById("toastStack");
  if (!toastStack) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  toastStack.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

// Inicializa quando o DOM estiver pronto
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => SessionPanel.init());
} else {
  SessionPanel.init();
}
