/**
 * Dice Module - Sistema de Dados Simples e Leve
 * Rolagem de dados pura em JavaScript (sem dependências externas)
 */

const Dice3D = (() => {
  let isRolling = false;
  let isInitialized = false;

  const DICE_CONFIGS = {
    d4: { faces: 4, label: "d4" },
    d6: { faces: 6, label: "d6" },
    d8: { faces: 8, label: "d8" },
    d10: { faces: 10, label: "d10" },
    d12: { faces: 12, label: "d12" },
    d20: { faces: 20, label: "d20" }
  };

  /**
   * Inicializa o módulo
   */
  function init() {
    try {
      bindDiceButtons();
      isInitialized = true;
      console.log("✓ Dice Module inicializado com sucesso");
    } catch (error) {
      console.error("✗ Erro ao inicializar Dice Module:", error);
    }
  }

  /**
   * Vincula os botões de dados
   */
  function bindDiceButtons() {
    const diceBtns = document.querySelectorAll(".dice-btn");
    diceBtns.forEach((btn) => {
      btn.addEventListener("click", handleDiceClick);
    });
  }

  /**
   * Manipula o clique em um botão de dado
   */
  function handleDiceClick(e) {
    if (!isInitialized || isRolling) return;

    const diceType = e.currentTarget.dataset.dice;
    const quantity = parseInt(document.getElementById("diceQuantity")?.value || 1);

    rollDice(diceType, quantity);
  }

  /**
   * Rola dados com animação simples
   */
  function rollDice(diceType, quantity = 1) {
    if (isRolling) return;

    isRolling = true;
    const config = DICE_CONFIGS[diceType];
    const resultDisplay = document.getElementById("diceResult");
    if (!resultDisplay) return;

    // Limpa resultado anterior
    resultDisplay.textContent = "Rolando...";
    resultDisplay.style.opacity = "0.5";

    // Anima o giro rápido
    let frame = 0;
    const animationFrames = 20;

    function showAnimationFrame() {
      frame++;
      const randomNum = Math.floor(Math.random() * config.faces) + 1;
      resultDisplay.textContent = randomNum;

      if (frame < animationFrames) {
        setTimeout(showAnimationFrame, 50);
      } else {
        // Resultado final
        finalizeRoll(diceType, quantity, config);
      }
    }

    showAnimationFrame();
  }

  /**
   * Finaliza a rolagem e calcula o resultado
   */
  function finalizeRoll(diceType, quantity, config) {
    const results = [];

    // Gera resultados para cada dado
    for (let i = 0; i < quantity; i++) {
      results.push(Math.floor(Math.random() * config.faces) + 1);
    }

    const total = results.reduce((a, b) => a + b, 0);
    const resultDisplay = document.getElementById("diceResult");

    // Exibe resultado
    if (quantity === 1) {
      resultDisplay.textContent = `${diceType}: ${results[0]}`;
    } else {
      resultDisplay.textContent = `${quantity}${diceType}: ${results.join(" + ")} = ${total}`;
    }

    resultDisplay.style.opacity = "1";

    // Registra no histórico
    if (window.SessionPanel) {
      window.SessionPanel.registerRollResult(diceType, quantity, results, total);
    }

    isRolling = false;
  }

  /**
   * Função auxiliar: rolar um único dado
   */
  function rolarDado(lados) {
    return Math.floor(Math.random() * lados) + 1;
  }

  /**
   * Função auxiliar: rolar múltiplos dados
   */
  function rolarMultiplosDados(lados, quantidade) {
    const results = [];
    for (let i = 0; i < quantidade; i++) {
      results.push(Math.floor(Math.random() * lados) + 1);
    }
    return {
      results: results,
      total: results.reduce((a, b) => a + b, 0)
    };
  }

  /**
   * Função auxiliar: atualizar histórico
   */
  function atualizarHistorico(tipo, resultados, total) {
    if (window.SessionPanel) {
      window.SessionPanel.registerRollResult(tipo, resultados.length, resultados, total);
    }
  }

  return {
    init: init,
    isInitialized: () => isInitialized,
    rollDice: rollDice,
    rolarDado: rolarDado,
    rolarMultiplosDados: rolarMultiplosDados,
    atualizarHistorico: atualizarHistorico
  };
})();

// Inicializa quando o DOM estiver pronto
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => Dice3D.init(), 500);
  });
} else {
  setTimeout(() => Dice3D.init(), 500);
}
