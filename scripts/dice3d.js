/**
 * Dice 3D Module (Versão Canvas 2D)
 * Sistema de rolagem de dados com animação em Canvas 2D
 */

const Dice3D = (() => {
  let canvas = null;
  let ctx = null;
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
   * Inicializa o sistema 2D
   */
  function init() {
    const viewport = document.getElementById("diceViewport");
    if (!viewport) return;

    try {
      // Cria canvas
      canvas = document.createElement("canvas");
      canvas.width = viewport.clientWidth;
      canvas.height = viewport.clientHeight;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      viewport.innerHTML = "";
      viewport.appendChild(canvas);

      ctx = canvas.getContext("2d");

      bindDiceButtons();
      animate();
      isInitialized = true;
      console.log("✓ Dice2D inicializado com sucesso");
    } catch (error) {
      console.error("✗ Erro ao inicializar Dice2D:", error);
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
    if (!isInitialized) {
      console.warn("⚠ Dice2D não está inicializado");
      return;
    }
    if (isRolling) return;

    const diceType = e.currentTarget.dataset.dice;
    const quantity = parseInt(document.getElementById("diceQuantity").value);

    rollDice(diceType, quantity);
  }

  /**
   * Desenha um dado no canvas
   */
  function drawDice(x, y, size, number, color = "#9b5de5") {
    // Fundo do dado
    ctx.fillStyle = color;
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 8;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);

    // Borda
    ctx.strokeStyle = "#00c9a7";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - size / 2, y - size / 2, size, size);

    // Número
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${size * 0.5}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(number, x, y);
  }

  /**
   * Anima a cena
   */
  function animate() {
    if (!isInitialized) return;

    // Desenha fundo
    ctx.fillStyle = "rgba(13, 13, 24, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Gradiente de fundo
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "rgba(155, 93, 229, 0.1)");
    gradient.addColorStop(1, "rgba(0, 201, 167, 0.05)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    requestAnimationFrame(animate);
  }

  /**
   * Rola dados
   */
  function rollDice(diceType, quantity = 1) {
    if (!isInitialized || isRolling) return;

    isRolling = true;
    const config = DICE_CONFIGS[diceType];
    const results = [];

    // Gera resultados
    for (let i = 0; i < quantity; i++) {
      results.push(Math.floor(Math.random() * config.faces) + 1);
    }

    const total = results.reduce((a, b) => a + b, 0);

    // Anima os dados caindo
    animateRoll(diceType, quantity, results, () => {
      // Após a animação, registra o resultado
      if (window.SessionPanel) {
        window.SessionPanel.registerRollResult(diceType, quantity, results, total);
      }
      isRolling = false;
    });
  }

  /**
   * Anima a rolagem
   */
  function animateRoll(diceType, quantity, results, callback) {
    const colors = ["#9b5de5", "#00c9a7", "#d8b56d", "#ff4655"];
    const dices = results.map((result, i) => ({
      x: canvas.width / (quantity + 1) * (i + 1),
      y: -50,
      vx: (Math.random() - 0.5) * 4,
      vy: 0,
      size: 40,
      number: result,
      color: colors[i % colors.length],
      rotation: Math.random() * Math.PI * 2,
      angularVelocity: Math.random() * 0.2 - 0.1
    }));

    let frame = 0;
    const duration = 60; // frames

    function frame_animation() {
      frame++;

      // Desenha fundo
      ctx.fillStyle = "rgba(13, 13, 24, 0.7)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Atualiza e desenha cada dado
      dices.forEach((dice) => {
        // Física
        dice.vy += 0.2; // gravidade
        dice.y += dice.vy;
        dice.x += dice.vx;
        dice.rotation += dice.angularVelocity;

        // Colisão com o chão
        if (dice.y + dice.size / 2 > canvas.height) {
          dice.y = canvas.height - dice.size / 2;
          dice.vy *= -0.6; // rebote
          dice.vx *= 0.9; // fricção
        }

        // Colisão com as laterais
        if (dice.x - dice.size / 2 < 0) {
          dice.x = dice.size / 2;
          dice.vx *= -0.6;
        }
        if (dice.x + dice.size / 2 > canvas.width) {
          dice.x = canvas.width - dice.size / 2;
          dice.vx *= -0.6;
        }

        // Desenha com rotação
        ctx.save();
        ctx.translate(dice.x, dice.y);
        ctx.rotate(dice.rotation);
        drawDice(0, 0, dice.size, dice.number, dice.color);
        ctx.restore();
      });

      if (frame < duration) {
        requestAnimationFrame(frame_animation);
      } else {
        // Desenha resultado final
        ctx.fillStyle = "rgba(13, 13, 24, 0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        dices.forEach((dice) => {
          ctx.save();
          ctx.translate(dice.x, dice.y);
          drawDice(0, 0, dice.size, dice.number, dice.color);
          ctx.restore();
        });

        setTimeout(callback, 500);
      }
    }

    frame_animation();
  }

  /**
   * API Pública
   */
  return {
    init,
    rollDice,
    isAvailable: () => hasThreeJS && hasCannon,
    isInitialized: () => isInitialized
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
