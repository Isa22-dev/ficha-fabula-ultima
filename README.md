# Ficha Fabula Ultima - Visual Fusion

Aplicacao HTML, CSS e JavaScript puro para fichas de RPG, com Supabase Auth, banco protegido por Row Level Security e deploy estatico na Vercel.

O visual Fusion ja esta aplicado no projeto: fundo com grid animado, orbes luminosos, scanline, topbar holografica, sidebar animada, cards com brilho, entrada de paineis, barras de recursos animadas, animacao lateral nas listas e impacto na rolagem de dados.

## Estrutura do projeto

```text
/
  index.html
  README.md
  vercel.json
  /styles
    style.css
  /scripts
    app.js
    supabase.js
  /assets
    /images
      portrait-placeholder.svg
  /sql
    supabase.sql
```

## Onde fica cada parte

- `index.html`: HTML da tela, topbar, sidebar, abas, formularios e elementos visuais do Fusion.
- `styles/style.css`: todo o CSS, incluindo animacoes Fusion.
- `scripts/app.js`: eventos da tela, login, cadastro, logout, salvar, carregar, editar, excluir, exportar/importar JSON, toasts e dados.
- `scripts/supabase.js`: URL e ANON KEY do Supabase, criando `window.supabaseClient`.
- `sql/supabase.sql`: tabela `fichas_rpg`, indices, trigger de `updated_at` e politicas RLS.
- `vercel.json`: configuracao para deploy estatico/SPAs na Vercel.

## Onde colar ou editar o visual Fusion

No `index.html`, os elementos visuais ficam logo depois de abrir o `body`:

```html
<div class="fusion-backdrop" aria-hidden="true">
  <div class="fusion-grid"></div>
  <div class="fusion-orb fusion-orb-a"></div>
  <div class="fusion-orb fusion-orb-b"></div>
  <div class="fusion-orb fusion-orb-c"></div>
  <div class="fusion-scanline"></div>
</div>
```

No `styles/style.css`, procure por:

- `.fusion-backdrop`, `.fusion-grid`, `.fusion-orb`, `.fusion-scanline`
- `@keyframes fusionGridMove`
- `@keyframes fusionOrbFloat`
- `@keyframes fusionScan`
- `@keyframes fusionPanelEnter`
- `@keyframes fusionDiceImpact`
- `@keyframes memorySlide`

No `scripts/app.js`, a rolagem de dados fica na funcao:

```js
function rollDie(sides, label = "")
```

Os toasts ficam na funcao:

```js
function toast(message, type = "success")
```

As funcoes de Supabase usadas pelo app ficam em:

```js
login()
signup()
logout()
salvarFicha()
carregarFicha()
excluirFicha()
listarFichas()
```

## Configurar Supabase

1. Acesse `https://supabase.com`.
2. Crie um projeto.
3. Abra `SQL Editor`.
4. Cole e execute o conteudo de `sql/supabase.sql`.
5. Va em `Authentication > Providers`.
6. Ative o provedor `Email`.
7. Para testar com username sem email real, desative a confirmacao de email.
8. Va em `Project Settings > API`.
9. Copie a `Project URL` e a `anon public key`.
10. Abra `scripts/supabase.js` e edite:

```js
const SUPABASE_URL = "COLE_AQUI_SUA_SUPABASE_URL";
const SUPABASE_ANON_KEY = "COLE_AQUI_SUA_SUPABASE_ANON_KEY";
```

Nunca coloque `service_role key` no frontend.

## Testar no VS Code com Live Server

1. Instale a extensao `Live Server`.
2. Clique com o botao direito em `index.html`.
3. Clique em `Open with Live Server`.
4. O navegador deve abrir algo parecido com:

```text
http://127.0.0.1:5500/
```

Teste nesta ordem:

1. A pagina abre com o fundo Fusion.
2. A sidebar troca as abas.
3. Cadastro funciona.
4. Login funciona.
5. Salvar ficha funciona.
6. Carregar ficha funciona.
7. Editar e salvar de novo funciona.
8. Excluir ficha funciona.
9. Exportar JSON baixa um arquivo.
10. Importar JSON preenche a ficha.
11. Dados rolam com animacao e aparecem no historico.

## Subir para GitHub

No terminal do VS Code:

```powershell
git init
git add .
git commit -m "Aplicar visual Fusion"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/NOME_DO_REPOSITORIO.git
git push -u origin main
```

Depois, para novas atualizacoes:

```powershell
git add .
git commit -m "Atualizar projeto"
git push
```

## Conectar na Vercel

1. Acesse `https://vercel.com`.
2. Clique em `Add New Project`.
3. Importe o repositorio do GitHub.
4. Em `Framework Preset`, escolha `Other`.
5. Deixe `Build Command` vazio.
6. Deixe `Output Directory` vazio ou use `.`.
7. Clique em `Deploy`.

O arquivo `vercel.json` ja esta pronto:

```json
{
  "cleanUrls": true,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

## Erros comuns

### Icones nao aparecem

Confira se o CDN do Tabler Icons esta no `index.html`:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" />
```

### CSS nao carrega

Confira se o caminho esta correto:

```html
<link rel="stylesheet" href="./styles/style.css" />
```

### JavaScript nao funciona

Confira se os scripts estao no final do `body` e nesta ordem:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="./scripts/supabase.js"></script>
<script src="./scripts/app.js"></script>
```

Abra pelo Live Server, porque isso evita problemas comuns de caminho local.

### Supabase nao conecta

Confira:

- `SUPABASE_URL` esta correta.
- `SUPABASE_ANON_KEY` esta correta.
- `sql/supabase.sql` foi executado.
- O usuario esta logado antes de salvar.
- O provedor `Email` esta ativado.
- A tabela `fichas_rpg` existe.
- Row Level Security esta ativado com as politicas do arquivo SQL.

### Vercel nao atualiza

Depois de editar localmente, rode:

```powershell
git add .
git commit -m "Atualizar site"
git push
```

Depois abra o painel da Vercel e confira se um novo deploy iniciou na branch `main`.

### Login funciona localmente, mas falha no deploy

No Supabase, abra `Authentication > URL Configuration` e adicione a URL da Vercel, por exemplo:

```text
https://seu-projeto.vercel.app
```

Se usar redirecionamento de email, adicione tambem em `Redirect URLs`.
