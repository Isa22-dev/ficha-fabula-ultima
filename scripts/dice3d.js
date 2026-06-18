/**
 * Dice System - Simples e Direto
 * Sem dependências externas - JavaScript puro
 */

let rollHistory = [];

function getSessionDiceResult() {
  return document.getElementById('sessionDiceResult') || document.getElementById('diceResult');
}

/**
 * Rola um dado
 * @param {number} lados - Número de lados do dado
 */
function rollDice(lados) {
  const resultado = Math.floor(Math.random() * lados) + 1;
  const tipo = `d${lados}`;
  const timestamp = new Date().toLocaleTimeString('pt-BR');

  // Atualiza o display do resultado
  getSessionDiceResult().textContent = `Resultado: ${resultado}`;
  document.getElementById('diceBox').textContent = resultado;

  // Registra no painel de sessão se disponível
  if (window.SessionPanel && typeof window.SessionPanel.registerRollResult === 'function') {
    window.SessionPanel.registerRollResult(tipo, 1, [resultado], resultado);
  } else {
    addLocalRoll({
      tipo: tipo,
      resultado: resultado,
      timestamp: timestamp
    });
  }
}

/**
 * Rola múltiplos dados
 * @param {number} lados - Número de lados
 * @param {number} quantidade - Quantos dados rolar
 */
function rollMultipleDice(lados, quantidade) {
  const resultados = [];
  for (let i = 0; i < quantidade; i++) {
    resultados.push(Math.floor(Math.random() * lados) + 1);
  }
  const total = resultados.reduce((a, b) => a + b, 0);
  const tipo = `${quantidade}d${lados}`;
  const timestamp = new Date().toLocaleTimeString('pt-BR');

  // Atualiza o display
  const detalhe = resultados.join(' + ');
  getSessionDiceResult().textContent = `${tipo}: ${detalhe} = ${total}`;

  // Registra no painel de sessão se disponível
  if (window.SessionPanel && typeof window.SessionPanel.registerRollResult === 'function') {
    window.SessionPanel.registerRollResult(tipo, quantidade, resultados, total);
  } else {
    addLocalRoll({
      tipo: tipo,
      resultado: total,
      timestamp: timestamp,
      detalhes: resultados
    });
  }
}

function addLocalRoll(roll) {
  rollHistory.push(roll);

  // Limita a 50 itens
  if (rollHistory.length > 50) {
    rollHistory.shift();
  }

  updateHistoryDisplay();
}

/**
 * Atualiza a exibição do histórico
 */
function updateHistoryDisplay() {
  const historyContainer = document.getElementById('diceHistory');
  if (!historyContainer) return;

  if (rollHistory.length === 0) {
    historyContainer.innerHTML = '<p class="empty-history">Nenhuma rolagem realizada</p>';
    return;
  }

  // Mostra os últimos 10 itens
  const recentRolls = rollHistory.slice(-10).reverse();
  historyContainer.innerHTML = recentRolls
    .map(
      (roll) => `
        <div class="history-item">
          <span class="history-time">${roll.timestamp}</span>
          <span class="history-type">${roll.tipo}</span>
          <span class="history-result">${roll.resultado}</span>
        </div>
      `
    )
    .join('');
}

/**
 * Limpa o histórico
 */
function clearHistory() {
  if (confirm('Tem certeza que quer limpar o histórico?')) {
    clearLocalHistory();
    getSessionDiceResult().textContent = 'Resultado: —';
  }
}

function clearLocalHistory() {
  rollHistory = [];
  updateHistoryDisplay();
}

/**
 * Exporta o histórico como texto
 */
function exportHistory() {
  if (rollHistory.length === 0) {
    alert('Nenhuma rolagem para exportar');
    return;
  }

  let texto = 'Histórico de Rolagens de Dados\n';
  texto += '================================\n\n';

  rollHistory.forEach((roll) => {
    texto += `${roll.timestamp} | ${roll.tipo} | ${roll.resultado}\n`;
  });

  // Cria o arquivo
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(texto));
  element.setAttribute('download', `historico-dados-${new Date().toISOString().split('T')[0]}.txt`);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

/**
 * API para compatibilidade com código antigo
 */
const Dice3D = {
  init: () => {
    console.log('✓ Dice System inicializado');
  },
  isInitialized: () => true,
  rollDice: (tipo, quantidade = 1) => {
    const lados = parseInt(tipo.replace('d', ''));
    if (quantidade === 1) {
      rollDice(lados);
    } else {
      rollMultipleDice(lados, quantidade);
    }
  },
  rolarDado: (lados) => Math.floor(Math.random() * lados) + 1,
  rolarMultiplosDados: (lados, quantidade) => {
    const results = [];
    for (let i = 0; i < quantidade; i++) {
      results.push(Math.floor(Math.random() * lados) + 1);
    }
    return {
      results: results,
      total: results.reduce((a, b) => a + b, 0)
    };
  },
  atualizarHistorico: (tipo, resultados, total) => {
    // Função auxiliar
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    rollHistory.push({
      tipo: tipo,
      resultado: total,
      timestamp: timestamp,
      detalhes: resultados
    });
    updateHistoryDisplay();
  },
  clearHistory: () => {
    rollHistory = [];
  }
};

window.Dice3D = Dice3D;

// Inicializa automaticamente
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    Dice3D.init();
  });
} else {
  Dice3D.init();
}
