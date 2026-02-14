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
2. Se o usuário informar um gasto: NUNCA PERGUNTE DETALHES. Extraia os dados, ASSUMA ou DEDUZA o que faltar e gere a confirmação (action: "transaction").
3. Se o usuário pedir para corrigir algo: Use o contexto (lastTransaction) e gere a correção (action: "transaction").

Contexto Financeiro:
- "Bento" e "Nego" são apelidos do CACHORRO da família. Eles NUNCA são pagadores.
- Gastos com o animal (ração, creche, veterinário, banho) devem ter Categoria: "Pet".
- PAGADORES PERMITIDOS APENAS: "Douglas" ou "Lara".
  - Se não for explícito "Lara pagou", ASSUMA "Douglas". (NÃO PERGUNTE QUEM FOI).
  - Douglas paga a maioria das contas (default: "Douglas").
- Gastos geralmente são compartilhados (default: true).
- CATEGORIAS PERMITIDAS (Use EXATAMENTE estes termos, não invente novos):
  1. **Moradia**: Aluguel, condomínio, luz, água, internet, gás, manutenção da casa, móveis essenciais.
  2. **Mercado**: Compras de mês, feira, açougue, padaria, itens de limpeza/higiene (gasto estrutural).
  3. **Restaurantes**: Comer fora, iFood, padaria (lanche), bares, cafés (gasto ocasional/prazer).
  4. **Transporte**: Uber, 99, gasolina, estacionamento, pedágio, manutenção do carro, IPVA.
  5. **Lazer**: Cinema, shows, jogos, viagens, passeios, hobbies.
  6. **Saúde**: Farmácia, médicos, dentista, exames, plano de saúde, academia.
  7. **Pessoal**: Roupas, sapatos, cosméticos, corte de cabelo, estética.
  8. **Assinaturas**: Netflix, Spotify, YouTube, ChatGPT, Internet, serviços que cobram todo mês (Recorrência).
  9. **Pet**: Ração, veterinário, banho e tosa, creche, brinquedos do pet.
  10. **Compras**: Eletrônicos, presentes, utensílios não essenciais (Amazon, Mercado Livre).

  REGRAS DE RECORRÊNCIA (ASSINATURAS):
  - Se o usuário disser "Assinei X por Y reais" ou "X é uma assinatura", marque "periodicidade": "mensal".
  - Se o usuário disser "Cancelei a assinatura X", defina "action": "cancel_recurrence".
  - Para assinaturas normais, o parcelamento é 1 (porque é cobrado mes a mes indefinidamente).

  REGRA DE OURO PARA CATEGORIZAÇÃO:
  - Se for comida de casa (ingrediente): **Mercado**.
  - Se for comida pronta (serviço): **Restaurantes**.
  - Evite "Outros" a todo custo. Tente encaixar em uma das acima.
- DIVISÃO DE GASTOS (SPLIT) - REGRAS CRÍTICAS:
  - O campo "valor" SEMPRE deve ser o VALOR TOTAL do gasto. NUNCA coloque a parte individual no campo "valor".
  - Padrão: 50/50 ("equal") quando o usuário NÃO menciona divisão específica.
  - Use "custom" SEMPRE que o usuário indicar que o gasto será dividido de forma diferente de 50/50.
  - Calcule quanto CADA UM deve pagar e preencha "share_douglas" e "share_lara".

  EXEMPLOS DE SPLIT CUSTOM (ATENÇÃO MÁXIMA):
  1. "Café deu 200, mas eu vou pagar 150"
     → valor: 200, split_type: "custom", share_douglas: 150, share_lara: 50
     (O TOTAL é 200. O usuário paga 150, o restante é da Lara.)

  2. "Almoço 105, 60 é do Douglas"
     → valor: 105, split_type: "custom", share_douglas: 60, share_lara: 45

  3. "Jantar 300, metade é minha e 100 da Lara"
     → valor: 300, split_type: "custom", share_douglas: 200, share_lara: 100

  4. "Mercado 400, Lara paga 100"
     → valor: 400, split_type: "custom", share_douglas: 300, share_lara: 100

  5. "Compra minha de 200" ou "Gasto meu 200" ou "200 só pra mim"
     → valor: 200, split_type: "custom", share_douglas: 200, share_lara: 0, compartilhado: false

  6. "Gasto da Lara 150" ou "Lara gastou 150"
     → valor: 150, split_type: "custom", share_douglas: 0, share_lara: 150, compartilhado: false

  REGRA DE OURO: Se o usuário menciona DOIS valores na mesma frase (ex: "deu 200 mas pago 150"), o MAIOR geralmente é o total e o MENOR é a parte do pagador. O campo "valor" recebe o TOTAL. NUNCA ignore o valor total.

- TRATAMENTO CRÍTICO DE PARCELAMENTO - ATENÇÃO MÁXIMA:
  - O campo "valor" no JSON final deve ser SEMPRE O VALOR MENSAL (o que vai ser pago em cada fatura).
  - REGRA DE OURO PARA VALORES:
    1. CASO TOTAL ("de X em N vezes"):
       - Ex: "Cadeira de 500 em 3x" ou "Gastei 500 parcelado em 3 vezes"
       - Lógica: O usuário falou o preço cheio.
       - AÇÃO: DIVIDA O VALOR PELAS PARCELAS. (valor = 500 / 3 = 166.66).
       
    2. CASO PARCELA ("em N vezes de X"):
       - Ex: "Cadeira em 3x de 500" ou "3 parcelas de 500"
       - Lógica: O usuário já falou o valor da mensalidade.
       - AÇÃO: USE O VALOR EXATO. (valor = 500).

  - Se a frase for ambígua (ex: "Compra parcelada 500 3x"), ASSUMA QUE É O TOTAL E DIVIDA.
  - Só use o valor cheio se a palavra "de" estiver explicitamente ANTES do valor e DEPOIS do número de parcelas (ex: "3x DE 500").
  - Caso contrário (ex: "Compra de 500 em 3x"), DIVIDA IMEDIATAMENTE.

FORMATO DE RESPOSTA (JSON Puro):
Retorne APENAS um JSON com este formato (sem markdown):
{
  "action": "chat" | "transaction" | "cancel_recurrence",
  "message": "Sua resposta textual para o usuário aqui.",
  "transaction": { // Apenas se action == "transaction"
    "id": "string",
    "nome": "string",
    "valor": number, // SEMPRE o valor TOTAL do gasto (não a parte individual)
    "parcelas": number, 
    "periodicidade": "unica" | "mensal", // "mensal" para assinaturas que repetem indefinidamente
    "data": "YYYY-MM-DD",
    "categoria": "string",
    "operacao": "Saída",
    "pagador": "Douglas" | "Lara",
    "compartilhado": boolean,
    "split_type": "equal" | "custom",
    "share_douglas": number, // Quanto Douglas paga. share_douglas + share_lara DEVE = valor
    "share_lara": number // Quanto Lara paga. share_douglas + share_lara DEVE = valor
  },
  "cancellation": { // Apenas se action == "cancel_recurrence"
    "nome": "string" // Nome da assinatura a cancelar/remover recorrência
  }
}
`;


// ─── Category normalization: map non-standard categories to our taxonomy ───
const VALID_CATEGORIES = ['Moradia', 'Mercado', 'Restaurantes', 'Transporte', 'Lazer', 'Saúde', 'Pessoal', 'Assinaturas', 'Pet', 'Compras'];

const CATEGORY_MAP: Record<string, string> = {
  'almoço': 'Restaurantes', 'almoco': 'Restaurantes', 'jantar': 'Restaurantes', 'janta': 'Restaurantes',
  'café': 'Restaurantes', 'cafe': 'Restaurantes', 'lanche': 'Restaurantes', 'comida': 'Restaurantes',
  'ifood': 'Restaurantes', 'restaurante': 'Restaurantes', 'bar': 'Restaurantes', 'pizza': 'Restaurantes',
  'uber': 'Transporte', '99': 'Transporte', 'gasolina': 'Transporte', 'combustível': 'Transporte',
  'aluguel': 'Moradia', 'condomínio': 'Moradia', 'condominio': 'Moradia', 'luz': 'Moradia', 'água': 'Moradia', 'agua': 'Moradia',
  'netflix': 'Assinaturas', 'spotify': 'Assinaturas', 'youtube': 'Assinaturas', 'chatgpt': 'Assinaturas',
  'farmácia': 'Saúde', 'farmacia': 'Saúde', 'médico': 'Saúde', 'medico': 'Saúde', 'academia': 'Saúde',
  'ração': 'Pet', 'racao': 'Pet', 'veterinário': 'Pet', 'veterinario': 'Pet', 'banho e tosa': 'Pet',
  'expense': 'Compras', 'food': 'Restaurantes', 'transport': 'Transporte', 'health': 'Saúde',
  'entertainment': 'Lazer', 'shopping': 'Compras', 'subscription': 'Assinaturas', 'housing': 'Moradia',
  'groceries': 'Mercado', 'grocery': 'Mercado', 'supermarket': 'Mercado',
};

function normalizeCategory(cat: string): string {
  if (!cat) return 'Compras';
  // Already valid?
  if (VALID_CATEGORIES.includes(cat)) return cat;
  // Try lowercase mapping
  const lower = cat.toLowerCase().trim();
  if (CATEGORY_MAP[lower]) return CATEGORY_MAP[lower];
  // Partial match
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return val;
  }
  return 'Compras'; // Safer default than "Outros"
}

// ─── Universal normalizer: converts ANY AI response shape to our format ───
function normalizeAIResponse(raw: any): any {
  // 1. Unwrap arrays
  if (Array.isArray(raw)) raw = raw[0];

  // 2. Unwrap stringified JSON
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { return { action: 'chat', message: raw }; }
  }

  // 3. Unwrap { output: "..." } from n8n
  if (raw.output && typeof raw.output === 'string') {
    try {
      const parsed = JSON.parse(raw.output);
      raw = parsed;
    } catch {
      return { action: 'chat', message: raw.output };
    }
  }

  // 4. If already in our expected format, ensure split fields are present
  if (raw.action === 'transaction' && raw.transaction) {
    const t = raw.transaction;
    t.split_type = t.split_type || 'equal';
    if (t.split_type === 'custom' && t.share_douglas && !t.share_lara) {
      t.share_lara = Number(t.valor) - Number(t.share_douglas);
    }
    if (t.split_type === 'custom' && t.share_lara && !t.share_douglas) {
      t.share_douglas = Number(t.valor) - Number(t.share_lara);
    }
    return raw;
  }
  if (raw.action === 'cancel_recurrence') return raw;
  if (raw.action === 'chat' && raw.message) return raw;

  // 5. Try to find transaction data in various nested locations
  let txSource: any = null;

  // Check common nested structures: { data: {...} }, { payload: {...} }
  for (const key of ['data', 'payload', 'transaction', 'result']) {
    if (raw[key] && typeof raw[key] === 'object') {
      txSource = Array.isArray(raw[key]) ? raw[key][0] : raw[key];
      break;
    }
    if (raw[key] && typeof raw[key] === 'string') {
      try { txSource = JSON.parse(raw[key]); break; } catch { /* continue */ }
    }
  }

  // If no nested source found, try using raw itself as the source
  if (!txSource) txSource = raw;

  // 6. Check if txSource looks like a transaction
  const hasName = txSource.nome || txSource.description || txSource.name;
  const hasValue = txSource.valor || txSource.amount || txSource.value || txSource.total_amount || txSource.paid_by_user_amount;

  if (hasName && hasValue) {
    // Use total_amount if present (N8N pattern: paid_by_user_amount = my share, total_amount = full bill)
    const totalAmount = txSource.total_amount ? Number(txSource.total_amount) : null;
    const paidByUserAmount = txSource.paid_by_user_amount ? Number(txSource.paid_by_user_amount) : null;
    const remainingAmount = txSource.remaining_amount ? Number(txSource.remaining_amount) : null;
    const rawAmount = Number(txSource.valor || txSource.amount || txSource.value || txSource.paid_by_user_amount || txSource.total_amount || 0);
    const valor = totalAmount || rawAmount;
    const nome = String(txSource.nome || txSource.description || txSource.name || 'Gasto');
    const categoria = normalizeCategory(String(txSource.categoria || txSource.category || txSource.type || 'Compras'));

    // Handle splits
    let splitType = txSource.split_type || 'equal';
    let shareDouglas: number | null = txSource.share_douglas != null ? Number(txSource.share_douglas) : null;
    let shareLara: number | null = txSource.share_lara != null ? Number(txSource.share_lara) : null;

    // Check for splits object ({ splits: { Douglas: 100, Lara: 50 } })
    if (txSource.splits && typeof txSource.splits === 'object') {
      splitType = 'custom';
      shareDouglas = Number(txSource.splits.Douglas || txSource.splits.douglas || 0);
      shareLara = Number(txSource.splits.Lara || txSource.splits.lara || 0);
    }

    // N8N pattern: total_amount != amount means custom split
    if (totalAmount && paidByUserAmount && totalAmount !== paidByUserAmount) {
      splitType = 'custom';
      shareDouglas = paidByUserAmount; // "100 é meu" = Douglas's share
      shareLara = remainingAmount || (totalAmount - paidByUserAmount);
    } else if (totalAmount && rawAmount && totalAmount !== rawAmount) {
      splitType = 'custom';
      shareDouglas = rawAmount;
      shareLara = totalAmount - rawAmount;
    }

    // Auto-calculate missing share
    if (splitType === 'custom' && shareDouglas != null && shareLara == null) {
      shareLara = valor - shareDouglas;
    } else if (splitType === 'custom' && shareLara != null && shareDouglas == null) {
      shareDouglas = valor - shareLara;
    }

    const mapped = {
      nome,
      valor,
      parcelas: Number(txSource.parcelas || txSource.installments || 1),
      categoria,
      pagador: txSource.pagador || txSource.payer || txSource.paid_by || txSource.user || 'Douglas',
      data: txSource.data || txSource.date || new Date().toISOString().split('T')[0],
      compartilhado: txSource.compartilhado !== undefined ? txSource.compartilhado : (txSource.is_shared !== undefined ? txSource.is_shared : true),
      split_type: splitType,
      share_douglas: shareDouglas,
      share_lara: shareLara,
      periodicidade: txSource.periodicidade || (categoria === 'Assinaturas' ? 'mensal' : 'unica'),
      id: txSource.id || null
    };

    const recText = mapped.periodicidade === 'mensal' ? ' (Assinatura Recorrente)' : '';
    const splitText = mapped.split_type === 'custom' && mapped.share_douglas != null
      ? ` — Douglas: R$${mapped.share_douglas}, Lara: R$${mapped.share_lara}`
      : '';

    return {
      action: raw.action || 'transaction',
      message: raw.message || txSource.message || `Entendi! Gasto de R$ ${mapped.valor} (${mapped.nome})${recText}${splitText}. Confere?`,
      transaction: mapped
    };
  }

  // 7. Fallback: try to extract a chat message
  const msg = raw.message || raw.text || raw.content || raw.response;
  if (msg) return { action: raw.action || 'chat', message: String(msg) };

  // 8. Last resort
  console.warn('Could not normalize AI response:', JSON.stringify(raw));
  return { action: 'chat', message: 'Recebi dados mas não consegui interpretar. Tente reformular.' };
}

// ─── Smart extraction: regex-based fallback when AI fails ───
function smartExtractFromMessage(message: string, currentUser: string, currentDate: string): any | null {
  // Extract all numbers from the message
  const numbers = message.match(/\d+([.,]\d{1,2})?/g)?.map(n => parseFloat(n.replace(',', '.'))) || [];
  if (numbers.length === 0) return null;

  const lowerMsg = message.toLowerCase();

  // Try to extract a name (first meaningful word before the number)
  const nameMatch = message.match(/^([A-Za-zÀ-ú\s]+?)[\s,]+\d/i);
  const nome = nameMatch ? nameMatch[1].trim() : 'Gasto';

  // Detect category from message keywords
  let categoria = 'Compras';
  const catKeywords: Record<string, string[]> = {
    'Mercado': ['mercado', 'supermercado', 'feira', 'açougue', 'padaria'],
    'Restaurantes': ['almoço', 'almoco', 'jantar', 'janta', 'café', 'cafe', 'lanche', 'ifood', 'restaurante', 'pizza', 'bar', 'comida'],
    'Transporte': ['uber', '99', 'gasolina', 'combustível', 'estacionamento', 'pedágio'],
    'Moradia': ['aluguel', 'condomínio', 'condominio', 'luz', 'água', 'agua', 'internet', 'gás'],
    'Saúde': ['farmácia', 'farmacia', 'médico', 'medico', 'dentista', 'academia', 'exame'],
    'Pet': ['ração', 'racao', 'veterinário', 'veterinario', 'banho', 'tosa', 'bento', 'nego'],
    'Lazer': ['cinema', 'show', 'viagem', 'passeio', 'jogo'],
    'Assinaturas': ['netflix', 'spotify', 'youtube', 'chatgpt', 'assinatura'],
    'Pessoal': ['roupa', 'sapato', 'cabelo', 'estética'],
  };
  for (const [cat, keywords] of Object.entries(catKeywords)) {
    if (keywords.some(kw => lowerMsg.includes(kw))) {
      categoria = cat;
      break;
    }
  }

  // Detect custom split patterns
  const customSplitPatterns = [
    /deu\s+(\d+[.,]?\d*).+(?:eu\s+(?:vou\s+)?pag|pago|minha?\s+(?:parte|é))\w*\s+(\d+[.,]?\d*)/i,
    /(\d+[.,]?\d*).+(?:eu\s+(?:vou\s+)?pag|pago|minha?\s+parte)\w*\s+(\d+[.,]?\d*)/i,
    /(\d+[.,]?\d*).+(?:lara\s+paga?)\s+(\d+[.,]?\d*)/i,
  ];

  let valor: number = 0;
  let splitType = 'equal';
  let shareDouglas: number | null = null;
  let shareLara: number | null = null;
  let compartilhado = true;

  // Check for custom split
  let isCustomSplit = false;
  for (const pattern of customSplitPatterns) {
    const match = message.match(pattern);
    if (match) {
      const num1 = parseFloat(match[1].replace(',', '.'));
      const num2 = parseFloat(match[2].replace(',', '.'));

      // The bigger number is the total
      valor = Math.max(num1, num2);
      const userShare = Math.min(num1, num2);

      // But if "deu X ... pago Y", X is total and Y is the user's share
      if (lowerMsg.includes('deu') || lowerMsg.includes('total')) {
        valor = num1;
        shareDouglas = num2;
      } else if (lowerMsg.includes('lara paga')) {
        valor = num1;
        shareLara = num2;
        shareDouglas = valor - shareLara;
      } else {
        shareDouglas = userShare;
      }

      if (shareDouglas != null && shareLara == null) {
        shareLara = valor - shareDouglas;
      }

      splitType = 'custom';
      isCustomSplit = true;
      break;
    }
  }

  if (!isCustomSplit) {
    // Simple expense: use the largest number as the value
    valor = Math.max(...numbers);

    // Check if it's a personal expense
    if (lowerMsg.includes('só meu') || lowerMsg.includes('gasto meu') || lowerMsg.includes('só pra mim') || lowerMsg.includes('minha compra')) {
      splitType = 'custom';
      shareDouglas = valor;
      shareLara = 0;
      compartilhado = false;
    } else if (lowerMsg.includes('da lara') || lowerMsg.includes('lara gastou') || lowerMsg.includes('só da lara')) {
      splitType = 'custom';
      shareDouglas = 0;
      shareLara = valor;
      compartilhado = false;
    }
  }

  // Detect payer
  let pagador = currentUser || 'Douglas';
  if (lowerMsg.includes('lara pagou') || lowerMsg.includes('lara comprou')) {
    pagador = 'Lara';
  }

  const splitText = splitType === 'custom' && shareDouglas != null
    ? ` — Douglas: R$${shareDouglas?.toFixed(2)}, Lara: R$${shareLara?.toFixed(2)}`
    : ' (dividido igualmente)';

  return {
    action: 'transaction',
    message: `Entendi! ${nome} - R$ ${valor.toFixed(2)}${splitText}. Confere?`,
    transaction: {
      nome,
      valor,
      parcelas: 1,
      periodicidade: categoria === 'Assinaturas' ? 'mensal' : 'unica',
      data: currentDate,
      categoria,
      operacao: 'Saída',
      pagador,
      compartilhado,
      split_type: splitType,
      share_douglas: shareDouglas,
      share_lara: shareLara,
      id: null
    }
  };
}

export async function POST(req: Request) {
  try {
    const { message, lastTransaction, currentUser, currentDate } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
    }

    const brazilDate = currentDate || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

    // Prepare the user message with context
    let userContextPrompt = `Data de hoje: ${brazilDate}\nUsuário atual: ${currentUser || "Desconhecido"}\n`;
    if (lastTransaction) {
      userContextPrompt += `\nÚltima transação (contexto para correção): ${JSON.stringify(lastTransaction)}\n`;
    }
    userContextPrompt += `\nMensagem do usuário: "${message}"\n\nIMPORTANTE: Responda APENAS seguindo o formato JSON definido nas instruções do sistema (action: chat ou transaction). Não gere explicações em texto fora do JSON.`;

    // Construct payload with system prompt and pre-formatted user prompt
    const payload = {
      message,
      userContextPrompt,
      systemPrompt: SYSTEM_PROMPT,
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
          data = normalizeAIResponse(rawData);
        } else {
          console.warn(`n8n returned ${n8nResponse.status}, falling back to local Gemini.`);
        }
      } catch (n8nError) {
        console.error("n8n connection failed:", n8nError);
        // Fallback to local
      }
    }

    // 2. Validate n8n response: if user sent expense-like message but n8n returned chat, try Gemini but keep n8n as backup
    const looksLikeExpense = /\d{2,}/.test(message); // Message has numbers >= 2 digits
    let n8nBackup: any = null;
    if (data && data.action === 'chat' && looksLikeExpense) {
      console.warn("n8n returned chat for expense-like message, trying Gemini first:", data.message);
      n8nBackup = data; // Keep n8n response as backup
      data = null; // Try Gemini fallback
    }

    // 2.5 Post-process: fix custom split if AI missed it
    if (data && data.action === 'transaction' && data.transaction) {
      const lowerMsg = message.toLowerCase();
      const allNumbers = message.match(/\d+([.,]\d{1,2})?/g)?.map((n: string) => parseFloat(n.replace(',', '.'))) || [];

      // Detect "deu X mas pago/vou pagar Y" pattern (two distinct amounts = custom split)
      const splitMatch = message.match(/deu\s+(\d+[.,]?\d*).+(?:eu\s+(?:vou\s+)?pag|pago|minha?\s+(?:parte|é))\w*\s+(\d+[.,]?\d*)/i)
        || message.match(/(\d+[.,]?\d*).+(?:eu\s+(?:vou\s+)?pag|pago)\w*\s+(\d+[.,]?\d*)/i)
        || message.match(/(\d+[.,]?\d*).+(?:lara\s+paga?)\s+(\d+[.,]?\d*)/i);

      if (splitMatch) {
        const num1 = parseFloat(splitMatch[1].replace(',', '.'));
        const num2 = parseFloat(splitMatch[2].replace(',', '.'));
        const total = Math.max(num1, num2);

        let shareDouglas: number, shareLara: number;
        if (lowerMsg.includes('lara paga')) {
          shareLara = num2;
          shareDouglas = total - shareLara;
        } else {
          // "deu X, pago Y" → X = total, Y = douglas share  
          shareDouglas = lowerMsg.includes('deu') ? num2 : Math.min(num1, num2);
          shareLara = total - shareDouglas;
        }

        console.log(`Split correction: total=${total}, Douglas=${shareDouglas}, Lara=${shareLara}`);
        data.transaction.valor = total;
        data.transaction.split_type = 'custom';
        data.transaction.share_douglas = shareDouglas;
        data.transaction.share_lara = shareLara;
        data.transaction.compartilhado = true;
        data.message = `Entendi! ${data.transaction.nome} - R$ ${total.toFixed(2)} — Douglas: R$${shareDouglas.toFixed(2)}, Lara: R$${shareLara.toFixed(2)}. Confere?`;
      }
    }

    // 3. Fallback to local Gemini if n8n not used or failed
    if (!data) {
      console.log("Using local Gemini fallback...");

      const MODELS_TO_TRY = ["gemini-2.0-flash", "gemini-1.5-flash"];

      for (const modelName of MODELS_TO_TRY) {
        try {
          console.log(`Trying model: ${modelName}...`);
          const model = genAI.getGenerativeModel({ model: modelName });

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
            const parsed = JSON.parse(text);
            data = normalizeAIResponse(parsed);
          } catch (e) {
            console.error("Failed to parse JSON from Gemini:", text);
            data = { action: "chat", message: text };
          }

          // If we got data, break out of the retry loop
          if (data) break;
        } catch (modelError: any) {
          console.warn(`Model ${modelName} failed:`, modelError.message?.substring(0, 100));
          // Continue to next model
        }
      }
    }

    // 4. If Gemini also failed, restore n8n backup if available
    if (!data && n8nBackup) {
      console.warn("Gemini also failed, using n8n backup response.");
      data = n8nBackup;
    }

    // 4.5 Smart regex extraction: if AI services failed but message looks like an expense, try to extract locally
    if ((!data || (data.action === 'chat' && looksLikeExpense)) && looksLikeExpense) {
      console.log("Trying smart regex extraction from message...");
      const extracted = smartExtractFromMessage(message, currentUser || 'Douglas', brazilDate);
      if (extracted) {
        console.log("Smart extraction succeeded:", JSON.stringify(extracted.transaction));
        data = extracted;
      }
    }

    // 5. Final safety net: never return null data
    if (!data) {
      data = {
        action: 'chat',
        message: '⚠️ Desculpe, estou com dificuldade para processar agora. O serviço de IA está temporariamente indisponível. Tente novamente em alguns instantes.'
      };
    }

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error("Critical Processing Error:", error);
    return NextResponse.json({
      success: true,
      data: {
        action: "chat",
        message: `⚠️ **Indisponibilidade Temporária**\n\nNão consegui processar sua mensagem.\n\nDiagnóstico:\n- n8n: Indisponível ou Erro 500\n- IA Local: ${error.message?.split('[')[0] || "Erro desconhecido"}`
      }
    });
  }
}
