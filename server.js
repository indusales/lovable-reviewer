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
   Funções Auxiliares
========================= */

// Review genérico com OpenAI
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
- Seja objetivo e técnico

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
  } catch (error) {
    console.error("Erro OpenAI:", error.message);
    throw new Error("Falha ao gerar review com OpenAI");
  }
}

// Review de Pull Request
async function performPRReview(owner, repo, pull_number) {
  if (!owner || !repo || !pull_number) {
    throw new Error("owner, repo e pull_number são obrigatórios");
  }

  const prUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${pull_number}`;

  const prResponse = await axios.get(prUrl, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3.diff"
    }
  });

  const diff = prResponse.data;

  if (!diff) {
    console.log("ℹ️ Nenhum diff no PR");
    return { ok: true, commented: false, reason: "no_diff" };
  }

  const reviewResult = await performReview(
    diff, 
    `PR #${pull_number} do repositório ${owner}/${repo}`
  );

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

  console.log(`✅ Comentário postado no PR #${pull_number}`);
  return { ok: true, commented: true };
}

// NOVO: Review de Commit Direto (Push)
async function performPushReview(owner, repo, commitSha) {
  if (!owner || !repo || !commitSha) {
    throw new Error("owner, repo e commitSha são obrigatórios");
  }

  try {
    // Buscar diff do commit específico
    const commitUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${commitSha}`;
    
    const commitResponse = await axios.get(commitUrl, {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3.diff"
      }
    });

    const diff = commitResponse.data;

    if (!diff || diff.trim().length === 0) {
      console.log(`ℹ️ Commit ${commitSha.substring(0, 7)} sem alterações de código`);
      return { ok: true, commented: false };
    }

    const reviewResult = await performReview(
      diff, 
      `Commit ${commitSha.substring(0, 7)} em ${owner}/${repo}`
    );

    // Comentar diretamente no commit
    await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/commits/${commitSha}/comments`,
      {
        body: `🤖 **Code Review Automático (OpenAI o3)** - Commit direto

${reviewResult.result || "Sem observações."}`
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json"
        }
      }
    );

    console.log(`✅ Comentário postado no commit ${commitSha.substring(0, 7)}`);
    return { ok: true, commented: true };

  } catch (error) {
    console.error(`❌ Erro ao revisar commit ${commitSha}:`, error.response?.data || error.message);
    throw error;
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
    timestamp: new Date().toISOString(),
    version: "2.0.0"
  });
});

// Webhook principal do GitHub
app.post("/github-webhook", async (req, res) => {
  try {
    const event = req.headers["x-github-event"];
    
    // Responde imediatamente ao GitHub (não bloquear)
    res.status(200).json({ ok: true, received: event });
    
    console.log(`📥 Evento recebido: ${event}`);

    // PROCESSAR PULL REQUEST
    if (event === "pull_request") {
      const action = req.body.action;
      
      if (!["opened", "synchronize", "reopened"].includes(action)) {
        console.log(`⏩ Ignorando ação de PR: ${action}`);
        return;
      }

      const pr = req.body.pull_request;
      const owner = pr.base.repo.owner.login;
      const repo = pr.base.repo.name;
      const pull_number = pr.number;

      console.log(`📌 Processando PR: ${owner}/${repo} #${pull_number} (${action})`);
      
      try {
        await performPRReview(owner, repo, pull_number);
      } catch (error) {
        console.error("❌ Erro ao processar PR:", error.message);
      }
    }
    
    // PROCESSAR PUSH (Commit direto)
    else if (event === "push") {
      const ref = req.body.ref;
      const owner = req.body.repository.owner.login;
      const repo = req.body.repository.name;
      
      // Só processa push na main ou master (ignore branches de feature/PR)
      if (!ref.includes('main') && !ref.includes('master')) {
        console.log(`⏩ Ignorando push para branch: ${ref}`);
        return;
      }

      const commits = req.body.commits;
      
      if (!commits || commits.length === 0) {
        console.log("ℹ️ Push sem commits (possivelmente merge)");
        return;
      }

      // Pega o último commit do push para revisar
      const lastCommit = commits[commits.length - 1];
      const commitSha = lastCommit.id;
      
      console.log(`📌 Processando Push: ${owner}/${repo} - ${commitSha.substring(0, 7)}`);
      
      try {
        await performPushReview(owner, repo, commitSha);
      } catch (error) {
        console.error("❌ Erro ao processar Push:", error.message);
      }
    }
    
    else {
      console.log(`⏩ Evento ignorado: ${event}`);
    }

  } catch (error) {
    console.error("❌ Erro no webhook:", error);
  }
});

// Rotas manuais (para testes)
app.post("/review", async (req, res) => {
  try {
    const { diff, context } = req.body;
    if (!diff) {
      return res.status(400).json({ error: "diff é obrigatório" });
    }
    const result = await performReview(diff, context);
    res.json(result);
  } catch (error) {
    console.error("Erro /review:", error);
    res.status(500).json({ error: "Erro ao processar review", details: error.message });
  }
});

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

/* =========================
   Start
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 API rodando na porta ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/`);
  console.log(`🔗 Webhook endpoint: http://localhost:${PORT}/github-webhook`);
});