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
   CONTEXTO INDUSALES RESUMIDO (Enxuto para timeout)
========================= */
const CONTEXT = `INDUSALES: Marketplace B2B semi-jóias. Hierarquia: Admin→Fabricante→Revendedor→Cliente. Stack: React+TypeScript+Tailwind+Supabase. 
Regras: Multi-tenant strict, preços só após aprovação dupla, mobile-first, shadcn/ui apenas, isolamento total de dados. 
Tecnologias permitidas: React Query/Zustand, Lucide icons, Sonner toast, React Hook Form+Zod. 
Proibido: Material UI, Bootstrap, Axios, Styled Components.`;

/* =========================
   Funções Auxiliares - REVISOR
========================= */

async function performReview(diff, context) {
  if (!diff || diff.trim().length === 0) {
    return { result: "Nenhuma alteração detectada no diff." };
  }

  try {
    const response = await openai.responses.create({
      model: "gpt-4o",  // Mais rápido e barato
      input: [
        {
          role: "system",
          content: `Revise código React/TS. Avalie: qualidade, segurança, performance, consistência INDUSALES (Tailwind, shadcn). 
Retorne JSON: {status: "approved"|"needs_changes", score: 0-10, issues: [], suggestions: [], summary: ""}`
        },
        {
          role: "user",
          content: `Contexto: ${context || "N/A"}\n\nDiff:\n${diff}`
        }
      ]
    });

    const output = response.output?.[0]?.content?.[0]?.text || "";
    return { result: output };
  } catch (error) {
    console.error("Erro Review:", error.message);
    return { result: "Erro ao revisar: " + error.message };
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
    { body: `🤖 **Code Review Automático**\n\n${reviewResult.result}` },
    { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json" }}
  );

  console.log(`✅ Review PR #${pull_number}`);
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
      { body: `🤖 **Code Review**\n\n${reviewResult.result}` },
      { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json" }}
    );

    console.log(`✅ Review commit ${commitSha.substring(0, 7)}`);
    return { ok: true, commented: true };
  } catch (error) {
    console.error("Erro push review:", error.message);
    throw error;
  }
}

/* =========================
   ARQUITETO BLUEPRINT (Otimizado para não dar timeout)
========================= */

async function generateBlueprint(feature, fase, constraints = []) {
  console.log(`[1/4] Iniciando blueprint: ${feature}`);
  
  try {
    // Prompt enxuto para resposta rápida (<10 segundos)
    const response = await openai.responses.create({
      model: "gpt-4o",  // Mais rápido que o3
      input: [
        {
          role: "system",
          content: `${CONTEXT}

Você é o Arquiteto. Gere especificação técnica JSON para Lovable:
{
  "blueprint": {
    "feature_name": "nome técnico",
    "description": "resumo",
    "prompt_optimized": "TEXTO ÚNICO para colar no Lovable: especifique componentes shadcn (Button, Input, Card...), cores hex #0f172a/#1e293b/#f59e0b, layout mobile-first, integração Supabase Auth, TypeScript interfaces, React Hook Form+Zod validação. Seja técnico e específico.",
    "sql_supabase": ["CREATE TABLE...", "RLS policy..."],
    "components": ["NomeComponente"],
    "hooks": ["useAuth"],
    "lovable_constraints": ["Use shadcn/ui", "Tailwind only", "No Material UI"]
  }
}`
        },
        {
          role: "user",
          content: `Feature: ${feature}\nFase: ${fase}\nConstraints: ${constraints.join(", ") || "Nenhuma"}`
        }
      ]
    });

    console.log(`[2/4] OpenAI respondeu`);
    const output = response.output?.[0]?.content?.[0]?.text || "{}";
    console.log(`[3/4] Output recebido (${output.length} chars)`);

    // Extrair JSON
    try {
      const jsonMatch = output.match(/```json\n([\s\S]*?)\n```/) || output.match(/{[\s\S]*}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : output;
      const parsed = JSON.parse(jsonStr);
      
      // Garantir estrutura mínima
      if (!parsed.blueprint) {
        parsed.blueprint = {};
      }
      
      console.log(`[4/4] Blueprint gerado com sucesso`);
      return parsed;
    } catch (e) {
      console.error(`[ERRO] Parse JSON falhou: ${e.message}`);
      return { 
        error: "Parse falhou", 
        raw_output: output.substring(0, 500),
        blueprint: {
          feature_name: feature,
          prompt_optimized: "Implemente: " + feature + ". Use React+TypeScript+Tailwind+shadcn/ui. Mobile-first. Cores: slate-900 primary, slate-800 secondary, amber-500 accent.",
          sql_supabase: []
        }
      };
    }
  } catch (error) {
    console.error(`[ERRO CRÍTICO] ${error.message}`);
    // Fallback para não quebrar a API
    return {
      error: error.message,
      blueprint: {
        feature_name: feature,
        prompt_optimized: `Implemente ${feature} usando React+TypeScript+Tailwind+shadhn/ui. Mobile-first. Supabase para backend. shadcn components: Button, Input, Card. Cores: bg-slate-900, text-slate-100, accent-amber-500.`,
        sql_supabase: []
      }
    };
  }
}

/* =========================
   Routes HTTP
========================= */

app.get("/", (req, res) => {
  res.json({ 
    status: "online", 
    service: "indusales-reviewer",
    version: "2.1.0",
    features: ["automated_review", "blueprint_generator"],
    timestamp: new Date().toISOString()
  });
});

// ARQUITETO
app.post("/architect", async (req, res) => {
  try {
    const { feature, fase = "1.1", constraints = [] } = req.body;
    
    if (!feature) {
      return res.status(400).json({ 
        error: "feature é obrigatório", 
        example: "Tela de login com 3 perfis" 
      });
    }

    console.log(`🏗️ Architect: ${feature}`);
    
    const blueprint = await generateBlueprint(feature, fase, constraints);
    
    res.json({
      success: !blueprint.error,
      blueprint: blueprint.blueprint || blueprint,
      instructions: {
        step_1: "Copie o campo 'blueprint.prompt_optimized'",
        step_2: "Cole no Lovable (quando tiver créditos)",
        step_3: "Execute SQL no Supabase",
        step_4: "Aguarde commit automático",
        step_5: "Veja review automático no GitHub"
      }
    });

  } catch (error) {
    console.error("Erro /architect:", error);
    res.status(500).json({ 
      error: "Erro interno", 
      message: error.message 
    });
  }
});

// WEBHOOK GITHUB
app.post("/github-webhook", async (req, res) => {
  try {
    const event = req.headers["x-github-event"];
    res.status(200).json({ ok: true });
    
    console.log(`📥 Evento: ${event}`);

    if (event === "pull_request") {
      const action = req.body.action;
      if (!["opened", "synchronize", "reopened"].includes(action)) return;
      
      const pr = req.body.pull_request;
      await performPRReview(pr.base.repo.owner.login, pr.base.repo.name, pr.number);
    } else if (event === "push") {
      const ref = req.body.ref;
      if (!ref.includes('main') && !ref.includes('master')) return;
      
      const commits = req.body.commits;
      if (!commits?.length) return;
      
      await performPushReview(
        req.body.repository.owner.login,
        req.body.repository.name,
        commits[commits.length - 1].id
      );
    }
  } catch (error) {
    console.error("❌ Webhook erro:", error.message);
  }
});

// Testes manuais
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
  console.log(`🏗️ Architect: http://localhost:${PORT}/architect`);
});