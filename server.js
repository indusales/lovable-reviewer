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
4. Consistência: Segue padrões INDUSALES (shadcn