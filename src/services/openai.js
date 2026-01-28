import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateLovablePrompt(feature, fase, contexto, inventario) {
  const contextoTxt = inventario?.paginas?.length ? 
    `Contexto: Projeto tem ${inventario.paginas.length} páginas. Último commit: ${inventario.ultimo_commit?.mensagem?.substring(0,50)}` : '';
    
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `Você é um gerador de comandos para Lovable. Regras: 1) Máx 80 palavras 2) Formato: "Crie [feature]. Componentes: [shadcn]. Dados: [supabase]. NÃO: [regras]." 3) Foco em ${fase}. 4) Sem explicações.`
      },
      {
        role: "user",
        content: `${contextoTxt}\nFeature: ${feature}\nFase: ${fase}\nExtra: ${contexto || 'nenhum'}`
      }
    ],
    max_tokens: 200,
    temperature: 0
  });

  return response.choices[0].message.content.trim();
}