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
   Funções Auxiliares (lógica interna)
========================= */

// Função interna: Realiza o review com OpenAI
async function performReview(diff, context) {
  if (!diff) {
    throw new Error("diff é obrigatório");
  }

  const response = await openai.responses.create({
    model: "o3",
    input: [
      {
        role: "system",
        content: `
Você é um engenheiro de software sênior e gerente de projeto.

Objetivos:
- Melhorar qualidade do código
- Reduzir complexidade
- Reduzir custo de manutenção
- Preservar intenção original

REGRAS IMPORTANTES:
- Trabalhe APENAS sobre o diff recebido
- NÃO reescreva código fora do diff
- NÃO invente requisitos

RETORNE ESTRITAMENTE NO FORMATO JSON:
{
  "final_diff": "diff final pronto para git apply",
  "observacoes": ["bullet curto"],
  "riscos": ["se houver"]
}
        `
      },
      {
        role: "user",
        content: `
CONTEXTO:
${context || "N/A"}

DIFF:
${diff}
        `
      }
    ]
  });

  const output = response.output?.[0]?.content?.[0]?.text || "";
  return { result: output };
}

// Função interna: Processa o PR completo (diff + comentário)
async function performPRReview(owner, repo, pull_number) {
  if (!owner || !repo || !pull_number) {
    throw new Error("owner, repo e pull_number são obrigatórios");
  }

  // Buscar diff do PR
  const prUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${pull_number}`;

  const prResponse = await axios.get(prUrl, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3.diff"
    }
  });

  const diff = prResponse.data;

  // Chamar review internamente (sem HTTP)
  const reviewResult = await performReview(
    diff, 
    `PR #${pull_number} do repositório ${owner}/${repo}`
  );

  // Postar comentário no PR
  await axios.post(
    `https://api.github.com/repos/${owner}/${repo}/issues/${pull_number}/comments`,
    {
      body: `🤖 **Code Review Automático (OpenAI o3)**

${reviewResult.result || "Sem observações."}`
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json"
      }
    }
  );

  console.log(`✅ Comentário postado no PR #${pull_number} de ${owner}/${repo}`);
  return { ok: true, commented: true };
}

/* =========================
   Routes HTTP (API Externa)
========================= */

// Rota manual (para testes)
app.post("/review", async (req, res) => {
  try {
    const { diff, context } = req.body;
    const result = await performReview(diff, context);
    res.json(result);
  } catch (error) {
    console.error("Erro /review:", error);
    res.status(500).json({ error: "Erro ao processar review", details: error.message });
  }
});

// Rota manual (para testes)
app.post("/review-pr", async (req, res) => {
  try {
    const { owner, repo, pull_number } = req.body;
    const result = await performPRReview(owner, repo, pull_number);
    res.json(result);
  } catch (error) {
    console.error("Erro /review-pr:", error.response?.data || error.message);
    res.status(500).json({ error: "Erro ao revisar PR", details: error.message });
  }
});

// Webhook do GitHub
app.post("/github-webhook", async (req, res) => {
  try {
    const event = req.headers["x-github-event"];

    // Responde imediatamente ao GitHub (não esperar processamento)
    res.status(200).json({ ok: true });

    if (event !== "pull_request") {
      return;
    }

    const action = req.body.action;

    // Só reage a PR aberto ou atualizado
    if (!["opened", "synchronize"].includes(action)) {
      return;
    }

    const pr = req.body.pull_request;
    const owner = pr.base.repo.owner.login;
    const repo = pr.base.repo.name;
    const pull_number = pr.number;

    console.log(`📌 Webhook PR: ${owner}/${repo} #${pull_number} (${action})`);

    // Processar diretamente (sem chamar localhost)
    await performPRReview(owner, repo, pull_number);

  } catch (error) {
    console.error("Erro /github-webhook:", error);
  }
});

/* =========================
   Health Check (para o Render)
========================= */
app.get("/", (req, res) => {
  res.json({ 
    status: "online", 
    service: "lovable-reviewer",
    timestamp: new Date().toISOString()
  });
});

/* =========================
   Start (Correção para Render)
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 API rodando na porta ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/`);
});