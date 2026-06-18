# 📝 Painel Flutuante de Sessão - Documentação

## Visão Geral

O Painel Flutuante de Sessão é um componente que fornece um espaço dedicado para gerenciar anotações rápidas e rolar dados 3D durante sessões de RPG. O painel funciona em qualquer tela do sistema sem perder dados.

---

## 🎯 Funcionalidades

### 1. **Botão Flutuante**
- Posicionado no canto inferior direito
- Ícone: 📝 (notes)
- Rótulo: "Sessão" (visível em mobile)
- Animação: Hover com efeito de escala e glow

### 2. **Painel Flutuante**
- Abre/fecha com animação slide da direita para esquerda
- Desktop: 450px de largura
- Mobile: 100% de largura
- 100% de altura (viewport)
- Fade in/out com backdrop

### 3. **Anotações**
#### Funcionalidades:
- ✅ Salva automaticamente no localStorage (500ms debounce)
- ✅ Persistência entre telas
- ✅ Persistência após refresh
- ✅ Suporte a texto longo com rolagem interna
- ✅ Sincronização opcional com Supabase

#### Botões:
- **Limpar**: Remove todas as anotações (com confirmação)
- **Exportar TXT**: Baixa as anotações em formato texto

### 4. **Dados 3D**
#### Tecnologias:
- **Three.js**: Renderização 3D
- **Cannon-es**: Motor de física

#### Dados Suportados:
- d4 (Tetraedro) - 4 faces
- d6 (Cubo) - 6 faces
- d8 (Octaedro) - 8 faces
- d10 (Trapezoedro Pentagonal) - 10 faces
- d12 (Dodecaedro) - 12 faces
- d20 (Icosaedro) - 20 faces

#### Características:
- ✅ Renderização 3D real com geometrias apropriadas
- ✅ Física e colisão com a bandeja
- ✅ Rotação aleatória e velocidade
- ✅ Sombras dinâmicas
- ✅ Iluminação ambiente e direcional
- ✅ Cores degradê com tema roxo/ciano

#### Controles:
- **Botões de Dados**: Rolam um dado do tipo selecionado
- **Seletor de Quantidade**: 1, 2, 3, 4, 5 ou 10 dados
- **Resultado**: Exibe total e detalhes da rolagem

### 5. **Histórico de Rolagens**
- ✅ Registra até 50 rolagens
- ✅ Mostra tipo de dado, resultado total e horário
- ✅ Destaca naturais (1 e faces máximas)
- ✅ Possibilidade de limpar histórico

---

## 📁 Arquivos

### Novos Arquivos Criados:

1. **scripts/session-panel.js**
   - Gerencia a abertura/fechamento do painel
   - Controla anotações com localStorage/Supabase
   - Gerencia histórico de rolagens
   - API para integração com Dice3D

2. **scripts/dice3d.js**
   - Renderização 3D com Three.js
   - Sistema de física com Cannon-es
   - Cálculo de resultado baseado em rotação
   - Interface com SessionPanel

### Arquivos Modificados:

1. **index.html**
   - Adicionado HTML do painel flutuante
   - Importação de Three.js e Cannon-es via CDN
   - Scripts session-panel.js e dice3d.js

2. **styles/style.css**
   - Estilos do botão flutuante
   - Estilos do painel flutuante
   - Estilos das abas
   - Estilos dos controles de dados
   - Estilos do histórico
   - Responsividade (desktop e mobile)

3. **sql/supabase.sql**
   - Tabela `anotacoes_sessao` com RLS
   - Triggers para updated_at automático
   - Policies para acesso restrito ao usuário

---

## 🚀 Uso

### Abrir/Fechar Painel
```javascript
// Abrir
SessionPanel.openPanel();

// Fechar
SessionPanel.closePanel();

// Alternar
SessionPanel.togglePanel();
```

### Anotações
```javascript
// Obter conteúdo das anotações
const notes = SessionPanel.getNotes();

// Salvar manualmente
SessionPanel.saveNotes("Novo conteúdo");

// Carregar do localStorage
SessionPanel.loadNotes();
```

### Dados 3D
```javascript
// Rolar um d20
Dice3D.rollDice("d20", 1);

// Rolar 3 d6
Dice3D.rollDice("d6", 3);
```

### Histórico
```javascript
// Obter histórico
const history = SessionPanel.getHistory();

// Limpar histórico
localStorage.removeItem("rpg_session_history");
SessionPanel.updateHistoryDisplay();
```

---

## 💾 Persistência

### localStorage
- **rpg_session_notes**: Anotações do usuário
- **rpg_session_history**: Histórico de rolagens (últimas 50)

### Supabase (Opcional)
Tabela: `anotacoes_sessao`

Campos:
- `id`: UUID (chave primária)
- `user_id`: UUID (usuário autenticado)
- `conteudo`: Texto das anotações
- `created_at`: Timestamp de criação
- `updated_at`: Timestamp de atualização

---

## 🎨 Tema Visual

### Cores:
- **Roxo**: #9b5de5 (cor primária)
- **Ciano**: #00c9a7 (cor secundária)
- **Dourado**: #d8b56d (acentuação)
- **Vermelho**: #ff4655 (alertas)
- **Fundo**: #0d0d18 (escuro profundo)

### Efeitos:
- Glow suave nos botões
- Hover com animação de escala
- Fade in/out no painel
- Sombras elegantes

---

## 📱 Responsividade

### Desktop (> 768px)
- Painel: 450px
- Abas com ícone + texto
- Dados em grid 3x2
- Histórico com altura máxima

### Tablet (480px - 768px)
- Painel: 100vw
- Abas com ícone + texto
- Dados em grid 2x3

### Mobile (< 480px)
- Painel: 100vw
- Abas com ícone apenas
- Dados em grid 2x3
- Viewport 3D: 180px de altura

---

## 🔌 Integração

O painel funciona de forma completamente independente, mas se integra com:

1. **Autenticação**: Detecta automaticamente sessão de usuário
2. **Supabase**: Sincroniza anotações quando autenticado
3. **Tema**: Respeita o tema escolhido do sistema

---

## 🐛 Troubleshooting

### Dados não aparecem
- Verificar se Three.js e Cannon-es carregaram
- Verificar console para erros de WebGL

### Anotações não salvam
- Verificar se localStorage está habilitado
- Para Supabase, verificar se está autenticado

### Histórico vazio
- Histórico começa vazio e é preenchido com rolagens
- Limite de 50 itens (mais antigos são removidos)

---

## 📝 Notas Técnicas

### Three.js
- Câmera perspectiva com FOV 75°
- Renderização com anti-aliasing ativado
- Shadow mapping para sombras dinâmicas
- Suporte a WebGL 2.0

### Cannon-es
- Gravidade: -15 m/s²
- Fricção: 0.3
- Restitução: 0.6
- Atualização: 60 FPS

### Performance
- Máximo de 50 itens no histórico
- Dados removidos automaticamente após rolagem
- Renderização otimizada com requestAnimationFrame
- Debounce de 500ms para salvar anotações

---

## 🔮 Possíveis Melhorias

- [ ] Som ao rolar dados
- [ ] Efeito de partículas ao rolar
- [ ] Compartilhamento de histórico entre jogadores
- [ ] Templates de anotações
- [ ] Exportação de histórico em JSON
- [ ] Integração com calendário para cronometragem
- [ ] Atalhos de teclado (ESC para fechar, etc)

---

**Versão**: 1.0.0  
**Última Atualização**: 18 de junho de 2026  
**Mantido por**: GitHub Copilot
