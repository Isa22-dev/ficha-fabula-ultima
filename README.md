# Ficha Fabula Ultima

Aplicacao web completa para fichas digitais de RPG Fabula Ultima, com visual cyberpunk roxo, sidebar lateral, abas editaveis, rolagem animada de dados RPG e persistencia online via Supabase.

O projeto usa HTML, CSS e JavaScript puro. Nao usa React, Vue ou Angular.

## Tecnologias usadas

- HTML5
- CSS3
- JavaScript puro
- Supabase Auth
- Supabase Database
- Row Level Security
- Tabler Icons via CDN
- Supabase JS v2 via CDN
- Vercel
- GitHub

## Estrutura

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

## Funcionalidades

- Tela de autenticação no estilo cyberpunk
- Cadastro com username ou email e senha
- Login e logout com Supabase Auth
- Cada usuario acessa apenas suas proprias fichas
- Identidade, recursos, atributos, habilidades, equipamentos, lacos, dados, visualizacao e configuracoes
- Salvamento principal no Supabase
- Backup temporario local apenas como apoio
- Exportar e importar JSON
- Autosave e Ctrl + S
- Toasts, loading e skeletons
- Dados D4, D6, D8, D10, D12 e D20 com formatos visuais diferentes
- Animacao 3D, resultado final, critico, falha e historico de rolagens

## Configurar Supabase

1. Crie um projeto em `https://supabase.com`.
2. Abra `SQL Editor`.
3. Execute o arquivo [`sql/supabase.sql`](sql/supabase.sql).
4. Em `Authentication > Providers`, mantenha `Email` ativado. Para username sem confirmacao, desative a confirmacao de email; para email real, voce pode manter a confirmacao se preferir.
5. Copie a `Project URL` e a `anon public key` em `Project Settings > API`.
6. Abra [`scripts/supabase.js`](scripts/supabase.js) e configure:

```js
const SUPABASE_URL = "COLE_AQUI_SUA_SUPABASE_URL";
const SUPABASE_ANON_KEY = "COLE_AQUI_SUA_SUPABASE_ANON_KEY";
```

## Tabela Supabase

O arquivo [`sql/supabase.sql`](sql/supabase.sql) cria a tabela `fichas_rpg`:

```sql
id uuid primary key default gen_random_uuid()
user_id uuid
nome text
classe text
nivel integer
tema text
origem text
personagem jsonb
retrato text
created_at timestamptz default now()
updated_at timestamptz default now()
```

Tambem ativa Row Level Security e cria politicas para `SELECT`, `INSERT`, `UPDATE` e `DELETE`, garantindo que cada usuario autenticado veja e altere apenas suas proprias fichas.

## Rodar localmente

Por ser um projeto estatico, voce pode abrir o arquivo `index.html` no navegador.

Para simular melhor o ambiente de deploy, rode um servidor estatico no diretorio do projeto:

```bash
npx serve .
```

## Subir para GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/ficha-fabula-ultima.git
git push -u origin main
```

## Deploy na Vercel

1. Acesse `https://vercel.com`.
2. Clique em `Add New Project`.
3. Importe o repositorio do GitHub.
4. Framework preset: `Other`.
5. Build command: deixe vazio.
6. Output directory: deixe vazio ou use `.`.
7. Clique em `Deploy`.

O arquivo [`vercel.json`](vercel.json) esta pronto para SPA:

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

Depois que o GitHub estiver conectado a Vercel, todo push para a branch `main` gera deploy automatico.

## Checklist final

- Executar [`sql/supabase.sql`](sql/supabase.sql) no Supabase
- Configurar URL e ANON KEY em [`scripts/supabase.js`](scripts/supabase.js)
- Criar repositorio no GitHub
- Fazer push para `main`
- Conectar o repositorio na Vercel
- Testar cadastro, login, salvar ficha, carregar ficha e logout
