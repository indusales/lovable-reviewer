import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import cors from "cors";
import axios from "axios";

/* =========================
   Validação de ambiente
========================= */
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!GITHUB_TOKEN) {
  throw new Error("GITHUB_TOKEN não definido");
}

if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY não definido");
}

/* =========================
   App
========================= */
const app = express();
app.use(express.json());
app.use(cors());

/* =========================
   OpenAI
========================= */
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

/* =========================
   CONTEXTO INDUSALES v4.0
   (Documento Mestre - referência para o Arquiteto)
========================= */
const INDUSALES_CONTEXT = `
SISTEMA: INDUSALES SAAS v4.0 - Marketplace B2B de Semi-Jóias (White Label)

HIERARQUIA DE USUÁRIOS:
1. INDUSALES (Admin): Super Admin, Administrador, Atendente, Dev
2. FABRICANTE: Admin, Gerente, Atendente, Financeiro
3. REVENDEDOR: Ativo, Inativo, Bloqueado (auto após 120 dias)
4. CLIENTE FINAL: Cadastrado, Avulso

STACK TECNOLÓGICA OBRIGATÓRIA:
- Frontend: React 18 + TypeScript + Tailwind CSS (apenas!)
- Backend: Supabase (PostgreSQL + Auth + Edge Functions)
- Estado: React Query (TanStack Query) ou Zustand
- UI Components: shadcn/ui (padrão)
- Ícones: Lucide React apenas
- NUNCA use: Material UI, Bootstrap, Styled Components

REGRAS CRÍTICAS DE NEGÓCIO:
- Multi-tenant strict: usuário só vê dados do seu tenant_id
- Preços só visíveis após dupla aprovação (Indusales + Fabricante)
- Isolamento: Fabricante nunca vê revendedores de outros fabricantes
- Reserva de estoque: TTL 1h (Redis/Supabase)
- Fiado: parcela única, prazos 7/15/30 dias, limite por cliente
- 2FA obrigatório para admins (TOTP)

BANCO DE DADOS (Supabase):
- Tabela: profiles (id, user_id, role, tenant_id, status, email, full_name)
- Tabela: products (id, tenant_id, name, sku, price_cost, price_sale, stock_qty, category)
- Tabela: approvals (id, reseller_id, manufacturer_id, status, requested_at, approved_at)
- Tabela: orders (id, reseller_id, items, total_amount, status, payment_type, created_at)
- Tabela: customers (id, reseller_id, name, phone, credit_limit, current_debt, status)
- RLS: Policies strict por tenant_id

CONSTRAINTS VISUAIS:
- Paleta: Primária #0f172a (slate-900), Secundária #1e293b (slate-800), Accent #f59e0b (amber-500)
- Layout: Mobile-first, responsivo, sidebar collapsible
- Fonte: Inter (padrão system-ui)
- Formulários: React Hook Form + Zod validation
- Toast notifications: Sonner (padronizado)

PROIBIDO:
- Criar APIs externas (use Supabase Edge Functions se necessário)
- Adicionar bibliotecas não listadas sem aprovação
- Inventar campos no banco além do escopo
- Criar telas de admin fora do perfil do usuário logado
`;

/* =========================
   Funções Auxiliares - REVISOR (existente)
========================= */

async function performReview(diff, context) {
  if (!diff || diff.trim().length === 0) {
    return { result: "Nenhuma alteração detectada no diff." };
  }

  try {
    const response = await openai.responses.create({
      model: "o3",
      input: [
        {
          role: "system",
          content: `
Você é um engenheiro de software sênior revisando código React/TypeScript.

Critérios de avaliação:
1. Qualidade: Código limpo, semântico, TypeScript strict
2. Segurança: Sanitização de inputs, proteção contra XSS, validação Zod
3. Performance: Evitar re-renders desnecessários, lazy loading quando útil
4. Consistência: Segue padrões INDUSALES (shadcn/ui, Tailwind, React Query)
5. Bugs: Erros óbvios, race conditions, memory leaks

Retorne JSON estrito:
{
  "status": "approved" | "needs_changes" | "rejected",
  "score": 0-10,
  "issues": ["lista de problemas críticos"],
  "suggestions": ["melhorias opcionais"],
  "summary": "resumo executivo em 1 parágrafo"
}
          `
        },
        {
          role: "user",
          content: `CONTEXTO: ${context || "N/A"}\n\nDIFF:\n${diff}`
        }
      ]
    });

    const output = response.output?.[0]?.content?.[0]?.text || "";
    return { result: output };
  } catch (error) {
    console.error("Erro OpenAI Review:", error.message);
    throw new Error("Falha ao gerar review");
  }
}

async function performPRReview(owner, repo, pull_number) {
  const prUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${pull_number}`;
  const prResponse = await axios.get(prUrl, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3.diff"
    }
  });

  const diff = prResponse.data;
  if (!diff) return { ok: true, commented: false };

  const reviewResult = await performReview(diff, `PR #${pull_number}`);
  
  await axios.post(
    `https://api.github.com/repos/${owner}/${repo}/issues/${pull_number}/comments`,
    { body: `🤖 **Code Review Automático (OpenAI o3)**\n\n${reviewResult.result}` },
    { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json" }}
  );

  console.log(`✅ Review postado no PR #${pull_number}`);
  return { ok: true, commented: true };
}

async function performPushReview(owner, repo, commitSha) {
  try {
    const commitUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${commitSha}`;
    const commitResponse = await axios.get(commitUrl, {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3.diff"
      }
    });

    const diff = commitResponse.data;
    if (!diff) return { ok: true };

    const reviewResult = await performReview(diff, `Commit ${commitSha.substring(0, 7)}`);
    
    await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/commits/${commitSha}/comments`,
      { body: `🤖 **Code Review Automático (OpenAI o3)** - Commit direto\n\n${reviewResult.result}` },
      { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json" }}
    );

    console.log(`✅ Review postado no commit ${commitSha.substring(0, 7)}`);
    return { ok: true, commented: true };
  } catch (error) {
    console.error("Erro push review:", error.message);
    throw error;
  }
}

/* =========================
   NOVO: Função Arquiteto (Blueprint Generator)
========================= */

async function generateBlueprint(feature, fase, constraints = []) {
  const constraintsText = constraints.length > 0 
    ? `CONSTRAINTS ESPECÍFICAS: ${constraints.join(", ")}` 
    : "";

  const response = await openai.responses.create({
    model: "o3",
    input: [
      {
        role: "system",
        content: `Você é o Arquiteto de Software Sênior do INDUSALES SAAS v4.0.
Sua missão: Gerar especificações técnicas ultra-precisas para o Lovable.dev executar SEM ALUCINAÇÕES.

CONTEXTO DO SISTEMA:
${INDUSALES_CONTEXT}

REGRAS DE OURO:
1. NUNCA sugira bibliotecas fora da stack (sem Material UI, sem Bootstrap, sem Axios)
2. SEMPRE use shadcn/ui para componentes base (Button, Input, Card, Dialog, etc.)
3. SQL deve ser compatível com Supabase (PostgreSQL) com RLS policies
4. Nomeie componentes em inglês (PascalCase): AuthLayout, ProfileSelector, OrderList
5. Estrutura de pastas: src/components/, src/pages/, src/hooks/, src/lib/
6. TypeScript: interfaces explícitas, tipos strict, unknown > any
7. Cores: use apenas da paleta INDUSALES (slate-900, slate-800, amber-500)

FORMATO DE SAÍDA OBRIGATÓRIO (JSON válido):
{
  "blueprint": {
    "feature_name": "nome técnico em inglês",
    "fase": "1.1",
    "description": "descrição curta do que será implementado",
    "prompt_optimized": "texto ÚNICO e COMPLETO para colar no Lovable (detalhado, técnico, com constraints visuais e de comportamento)",
    "supabase_sql": ["array de comandos SQL para criar tabelas/policies"],
    "components": ["Lista", "De", "Componentes", "React", "Necessários"],
    "hooks_custom": ["useAuth", "useProfile", etc],
    "api_endpoints": ["/auth/login", "/profile/select"],
    "acceptance_criteria": ["Critério 1", "Critério 2"],
    "lovable_constraints": ["Use shadcn/ui Button", "Tailwind apenas", "Mobile-first"],
    "estimated_tokens": número (estimativa de tokens do Lovable, 1-50),
    "next_steps": "instruções claras para o desenvolvedor após gerar no Lovable"
  }
}

IMPORTANTE: O prompt_optimized deve ser um texto corrido, técnico, que o Lovable entenda imediatamente sem perguntas. Inclua todas as especificações visuais (cores hex), comportamentais (loading states, erros), e de dados (integração Supabase).
`
      },
      {
        role: "user",
        content: `FEATURE REQUERIDA: ${feature}\nFASE: ${fase}\n${constraintsText}\n\nGere o blueprint completo no formato JSON especificado.`
      }
    ]
  });

  const output = response.output?.[0]?.content?.[0]?.text || "{}";
  
  // Tentar extrair JSON da resposta (em caso de markdown ```json)
  try {
    const jsonMatch = output.match(/```json\n([\s\S]*?)\n```/) || output.match(/{[\s\S]*}/);
    const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : output;
    return JSON.parse(jsonStr);
  } catch (e) {
    return { 
      error: "Falha ao parsear JSON", 
      raw_output: output,
      suggestion: "Tente novamente com descrição mais específica"
    };
  }
}

/* =========================
   Routes HTTP
========================= */

// Health check
app.get("/", (req, res) => {
  res.json({ 
    status: "online", 
    service: "lovable-reviewer",
    version: "2.0.0",
    features: ["automated_review", "blueprint_generator"],
    timestamp: new Date().toISOString()
  });
});

// NOVO: Endpoint Arquiteto (Blueprint Generator)
app.post("/architect", async (req, res) => {
  try {
    const { feature, fase = "1.1", constraints = [] } = req.body;
    
    if (!feature) {
      return res.status(400).json({ 
        error: "feature é obrigatório", 
        example: "Tela de login com seletor de perfil (Admin/Fabricante/Revendedor)" 
      });
    }

    console.log(`🏗️ Gerando blueprint para: ${feature} (Fase ${fase})`);
    
    const blueprint = await generateBlueprint(feature, fase, constraints);
    
    res.json({
      success: true,
      blueprint,
      instructions: {
        step_1: "Copie o campo 'blueprint.prompt_optimized'",
        step_2: "Cole no prompt do Lovable (lovable.dev)",
        step_3: "Execute o SQL no Supabase SQL Editor",
        step_4: "Aguarde o Lovable gerar e fazer commit",
        step_5: "Verifique o review automático do bot no GitHub"
      }
    });

  } catch (error) {
    console.error("Erro no /architect:", error);
    res.status(500).json({ 
      error: "Erro ao gerar blueprint", 
      details: error.message 
    });
  }
});

// Webhook GitHub (existente)
app.post("/github-webhook", async (req, res) => {
  try {
    const event = req.headers["x-github-event"];
    res.status(200).json({ ok: true, received: event });
    
    console.log(`📥 Evento: ${event}`);

    if (event === "pull_request") {
      const action = req.body.action;
      if (!["opened", "synchronize", "reopened"].includes(action)) return;
      
      const pr = req.body.pull_request;
      await performPRReview(
        pr.base.repo.owner.login,
        pr.base.repo.name,
        pr.number
      );
    } else if (event === "push") {
      const ref = req.body.ref;
      if (!ref.includes('main') && !ref.includes('master')) return;
      
      const commits = req.body.commits;
      if (!commits?.length) return;
      
      const lastCommit = commits[commits.length - 1];
      await performPushReview(
        req.body.repository.owner.login,
        req.body.repository.name,
        lastCommit.id
      );
    }
  } catch (error) {
    console.error("❌ Erro webhook:", error);
  }
});

// Rotas manuais (testes)
app.post("/review", async (req, res) => {
  try {
    const { diff, context } = req.body;
    if (!diff) return res.status(400).json({ error: "diff obrigatório" });
    const result = await performReview(diff, context);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/review-pr", async (req, res) => {
  try {
    const { owner, repo, pull_number } = req.body;
    const result = await performPRReview(owner, repo, pull_number);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* =========================
   Start
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 API rodando na porta ${PORT}`);
  console.log(`🏗️ Blueprint Generator: http://localhost:${PORT}/architect`);
  console.log(`📍 Health Check: http://localhost:${PORT}/`);
});