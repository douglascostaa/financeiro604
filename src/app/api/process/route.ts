import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEM_PROMPT = `
Você é uma assistente financeira pessoal e inteligente para um casal (Douglas e Lara).
Sua persona é como uma secretária executiva eficiente, amigável e levemente informal.
Seu objetivo é conversar com os usuários e, quando detectar gastos, extrair dados estruturados.

REGRAS DE INTERAÇÃO:
1. Se o usuário mandar "Oi", "Tudo bem?", ou conversas gerais: Responda educadamente e de forma breve (action: "chat").
2. Se o usuário informar um gasto: Extraia os dados e gere uma confirmação (action: "transaction").
3. Se o usuário pedir para corrigir algo: Use o contexto (lastTransaction) e gere a correção (action: "transaction").

Contexto Financeiro:
- "Bento" e "Nego" são apelidos do CACHORRO da família. Eles NUNCA são pagadores.
- Gastos com o animal (ração, creche, veterinário, banho) devem ter Categoria: "Pet".
- PAGADORES PERMITIDOS APENAS: "Douglas" ou "Lara". Se não for explícito "Lara pagou", assuma "Douglas".
- Douglas paga a maioria das contas (default: "Douglas").
- Gastos geralmente são compartilhados (default: true).
- Categorias comuns: Alimentação, Mercado, Transporte, Moradia, Lazer, Saúde, Compras, Assinaturas, Pet.

FORMATO DE RESPOSTA (JSON Puro):
Retorne APENAS um JSON com este formato (sem markdown):
{
  "action": "chat" | "transaction",
  "message": "Sua resposta textual para o usuário aqui. Se for transação, diga algo como 'Entendi, vou registrar X...'",
  "transaction": { // Apenas se action == "transaction"
    "id": "string" (se for correção, mantenha o ID; senão null),
    "nome": "string",
    "valor": number,
    "data": "YYYY-MM-DD",
    "categoria": "string",
    "operacao": "Saída",
    "pagador": "Douglas" | "Lara",
    "compartilhado": boolean
  }
}
`;

export async function POST(req: Request) {
  try {
    const { message, lastTransaction, currentUser, currentDate } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
    }

    const brazilDate = currentDate || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

    // Prepare the user message with context just like we do for local fallback
    let userContextPrompt = `Data de hoje: ${brazilDate}\nUsuário atual: ${currentUser || "Desconhecido"}\n`;
    if (lastTransaction) {
      userContextPrompt += `\nÚltima transação (contexto para correção): ${JSON.stringify(lastTransaction)}\n`;
    }
    userContextPrompt += `\nMensagem do usuário: "${message}"\n\nIMPORTANTE: Responda APENAS seguindo o formato JSON definido nas instruções do sistema (action: chat ou transaction). Não gere explicações em texto fora do JSON.`;

    // Construct payload with system prompt and pre-formatted user prompt
    const payload = {
      message, // Raw message if needed
      userContextPrompt, // Message + Context (bind this to User Message in n8n)
      systemPrompt: SYSTEM_PROMPT, // The Brain (bind this to System Message in n8n)
      lastTransaction,
      currentUser,
      currentDate: brazilDate
    };

    const n8nUrl = process.env.N8N_WEBHOOK_URL;
    let data;

    // 1. Try n8n first if configured
    if (n8nUrl && !n8nUrl.includes("seu-n8n.com")) {
      try {
        console.log("Sending to n8n...");
        const n8nResponse = await fetch(n8nUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (n8nResponse.ok) {
          const rawData = await n8nResponse.json();
          console.log("n8n raw response:", JSON.stringify(rawData));

          // Normalize n8n response which might be an array or different structure
          let normalizedData = Array.isArray(rawData) ? rawData[0] : rawData;

          // Handle case where n8n returns a stringified JSON inside a property (common in n8n)
          if (typeof normalizedData === 'string') {
            try { normalizedData = JSON.parse(normalizedData); } catch (e) {
              // It's just a text string
              normalizedData = { action: "chat", message: normalizedData };
            }
          } else if (normalizedData.output && typeof normalizedData.output === 'string') {
            // Handle { output: "text" } format
            normalizedData = { action: "chat", message: normalizedData.output };
          }

          // Specific fix for n8n returning { action, data } OR { action, payload } structure
          if (normalizedData.data || normalizedData.payload) {
            let dataContent = normalizedData.data || normalizedData.payload;

            // Handle n8n array wrapping
            if (Array.isArray(dataContent)) dataContent = dataContent[0];

            // Handle stringified JSON inside data/payload
            if (typeof dataContent === 'string') {
              try { dataContent = JSON.parse(dataContent); } catch (e) {
                // If parse fails, assume it's just a text message
                if (normalizedData.action !== 'transaction') {
                  normalizedData.message = dataContent;
                }
              }
            }

            if (normalizedData.action === 'transaction' && typeof dataContent === 'object') {

              // Map n8n fields (english) to our internal format (portuguese) strictly
              const mappedTransaction = {
                nome: dataContent.nome || dataContent.description || dataContent.name || 'Gasto',
                valor: dataContent.valor || dataContent.amount || dataContent.value || 0,
                categoria: dataContent.categoria || dataContent.category || dataContent.type || 'Outros',
                pagador: dataContent.pagador || dataContent.payer || dataContent.user || 'Douglas',
                data: dataContent.data || dataContent.date || new Date().toISOString().split('T')[0],
                compartilhado: dataContent.compartilhado !== undefined ? dataContent.compartilhado : true,
                id: dataContent.id || null
              };

              normalizedData.transaction = mappedTransaction;

              // If no explicit message provided, let the frontend show just the card (or a simple text)
              if (!normalizedData.message) {
                normalizedData.message = `Entendi! Encontrei um gasto de R$ ${mappedTransaction.valor} (${mappedTransaction.nome}). Confere?`;
              }
            } else if (typeof dataContent === 'string' && !normalizedData.message) {
              normalizedData.message = dataContent;
            }
          }

          // Enhanced normalization for other common AI response fields
          if (!normalizedData.message) {
            if (normalizedData.text) normalizedData.message = normalizedData.text;
            else if (normalizedData.content) normalizedData.message = normalizedData.content;
            else if (normalizedData.response) normalizedData.message = normalizedData.response;
            else if (normalizedData.output) normalizedData.message = String(normalizedData.output);
            else if (normalizedData.raw) normalizedData.message = typeof normalizedData.raw === 'string' ? normalizedData.raw : JSON.stringify(normalizedData.raw);
            else if (normalizedData.error) normalizedData.message = "Erro do n8n: " + (typeof normalizedData.error === 'string' ? normalizedData.error : JSON.stringify(normalizedData.error));
          }

          // If still no message and no transaction, try to salvage meaningful text
          if (!normalizedData.message && !normalizedData.transaction && !normalizedData.nome) {
            // Fallback: Dump keys to help debug without crashing UI
            normalizedData.action = "chat";
            normalizedData.message = "Recebi dos dados do n8n mas não entendi o formato: " + Object.keys(normalizedData).join(", ");
          }

          // Check if it's a direct transaction object without the wrapper
          if (normalizedData.nome && normalizedData.valor && !normalizedData.transaction) {
            normalizedData = {
              action: "transaction",
              message: `Entendi! Registrando ${normalizedData.nome} (R$ ${normalizedData.valor}).`,
              transaction: normalizedData
            };
          }

          data = normalizedData;
        } else {
          console.warn(`n8n returned ${n8nResponse.status}, falling back to local Gemini.`);
        }
      } catch (n8nError) {
        console.error("n8n connection failed:", n8nError);
        // Fallback to local
      }
    }

    // 2. Fallback to local Gemini if n8n not used or failed
    if (!data) {
      console.log("Using local Gemini fallback...");
      // Use standard consistent model name
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      let fullPrompt = `${SYSTEM_PROMPT}\n\nData de hoje: ${brazilDate}\nUsuário atual: ${currentUser || "Desconhecido"}\n`;

      if (lastTransaction) {
        fullPrompt += `\nÚltima transação (contexto para correção): ${JSON.stringify(lastTransaction)}\n`;
      }

      fullPrompt += `\nMensagem do usuário: "${message}"`;

      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      let text = response.text();

      // Clean up markdown code blocks if present
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();

      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Failed to parse JSON form Gemini:", text);
        data = { action: "chat", message: text };
      }
    }

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error("Critical Processing Error:", error);
    // Fail verify gracefully in the chat UI instead of 500
    return NextResponse.json({
      success: true,
      data: {
        action: "chat",
        message: `⚠️ **Indisponibilidade Temporária**\n\nNão consegui processar sua mensagem.\n\nDiagnóstico:\n- n8n: Indisponível ou Erro 500\n- IA Local: ${error.message?.split('[')[0] || "Erro desconhecido"}`
      }
    });
  }
}
