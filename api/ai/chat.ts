/**
 * Vercel serverless function — AI gateway for the Product Discovery Assistant.
 *
 * Two modes:
 * - mode: "intent"     → parse user message into search queries (smartAssistant)
 * - mode: "summarize"  → generate Hebrew response after seeing actual results
 *
 * Runs on Gemini 2.0 Flash. The API key lives in GEMINI_API_KEY (Vercel env var).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Content } from '@google/generative-ai';
import {
  LISTA_CATEGORIES,
  FRESH_CATEGORIES,
} from '../../agents_and_ai/product-discovery-assistant/listaCategories';

type Language = 'he' | 'en';
type HistoryMsg = { role: 'user' | 'assistant'; content: string };

interface IntentBody {
  mode: 'intent';
  userMessage: string;
  language: Language;
  conversationHistory?: HistoryMsg[];
}

interface SummarizeBody {
  mode: 'summarize';
  userMessage: string;
  productNames: { name: string; manufacturer: string; price: number }[];
  language: Language;
  meta?: { freshFallbackCategories?: string[]; missingFreshItems?: string[] };
}

interface SuggestAlternativesBody {
  mode: 'suggest_alternatives';
  failedPhrase: string;
  listaCategory?: string;
  language: Language;
}

type Body = IntentBody | SummarizeBody | SuggestAlternativesBody;

const MODEL_ID = 'gemini-2.5-flash';

function getClient(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not configured');
  return new GoogleGenerativeAI(key);
}

// ─── Intent / smartAssistant ─────────────────────────────────────────────────

function buildIntentSystemInstruction(language: Language): string {
  const langNote =
    language === 'he'
      ? 'Respond in Hebrew. The product database is in Hebrew.'
      : 'Respond in English.';
  const categoriesList = LISTA_CATEGORIES.join(' | ');
  const freshCategoriesList = Array.from(FRESH_CATEGORIES).join(', ');
  const nonsenseReply =
    language === 'he'
      ? 'לא הבנתי. אפשר לנסח אחרת?'
      : "I didn't understand. Could you rephrase?";

  return `You are a smart shopping assistant for an Israeli grocery app. You help users find products quickly. ${langNote}

Your capabilities:
- Parse shopping lists (multiple items) into individual search queries
- Search for specific products
- Find cheapest/most expensive products (use sort_by: "min_price", sort_order: "asc" or "desc")
- Filter vegan products (use is_vegan: true)
- Answer questions about products or shopping

LISTA CATEGORIES (you MUST tag every search with exactly one of these Hebrew labels):
${categoriesList}

For each search you generate, add a "listaCategory" field set to the single most appropriate label above. This is how results are grouped in the UI — pick the category the USER would expect the item under, not the DB's raw category.
Examples:
- חלב / יוגורט / גבינה / ביצים → "מוצרי חלב וביצים"
- עגבניות / מלפפונים / בצל / פלפל / תפוחי אדמה → "פירות וירקות"
- עוף / בשר / דגים / נקניק / סלמי → "בשר עוף דגים ומעדניה"
- לחם / לחמנייה / פיתה / קורנפלקס → "לחם מאפים ודגני בוקר"
- שוקולד / במבה / ביסלי / עוגיות → "חטיפים מתוקים ופיצוחים"
- קולה / מים / מיץ → "משקאות"
- פלפל חריף יבש / פפריקה / כמון / מלח → "מזווה בישול ואפייה"
- אבקת כביסה / מרכך כביסה / סבון כלים / נייר טואלט → "ניקיון כביסה וחד פעמי"
- שמפו / משחת שיניים / קרם → "פארם טיפוח אישי ובריאות"
- פיצה קפואה / ירקות קפואים → "קפואים"
- רסק עגבניות / טחינה / חומוס בקופסה / שימורי טונה → "שימורים רטבים וממרחים"
If truly uncertain, use "אחר ולא מסווג".

FRESH-FIRST RULE (very important):
When the user asks for an item that naturally belongs to one of these fresh-oriented categories: ${freshCategoriesList} — you MUST set "preferFresh": true on that search.
For fresh produce items (fruits, vegetables, herbs), you MUST generate BOTH the plural AND singular Hebrew forms as separate searches tagged with the same listaCategory + preferFresh. Examples:
- "עגבניות" → two searches: {query:"עגבניות",...} AND {query:"עגבניה",...}
- "מלפפונים" → {query:"מלפפונים",...} AND {query:"מלפפון",...}
- "פטריות" → {query:"פטריות",...} AND {query:"פטרייה",...}
- "תפוחים" → {query:"תפוחים",...} AND {query:"תפוח",...}
- "גזר" (already singular) → just one search
Why: the DB stores some fresh produce under their singular (weighted) name. Both variants maximize hits.
For non-produce fresh items (יוגורט, לחם, חזה עוף) one query is enough.
Use the plainest Hebrew name as the query — do NOT include words like "חמוץ", "כבוש", "משומר", "קפוא" in these queries.

QUANTITY PARSING:
If the user specifies a quantity (e.g., "2 קרטוני חלב", "תריסר ביצים", "חצי קילו גבינה"), extract it into the "quantity" field (default 1).
- "2 חלב" → quantity: 2
- "תריסר ביצים" → quantity: 12
- "חצי קילו גבינה" → quantity: 0.5, and keep the weight hint in the search query
Keep quantity as a simple positive number. It's how many units/packages the user wants.

CANONICAL SEARCH MAPPINGS (override the generic rules above when these phrases appear):

Israeli produce slang:
- "גמבה" / "גמבות" → bell pepper (פלפל). The catalog stores these as "פלפל אדום", "פלפל צהוב", "פלפל ירוק", "פלפל". Generate TWO queries: {query:"פלפל אדום"} AND {query:"פלפל"}. Same originalText: the user's phrase ("גמבה"). listaCategory: "פירות וירקות". preferFresh: true.
- "עלעלים" / "ירק" (alone) → leafy greens — treat as פירות וירקות with preferFresh.
- "תפוד" / "תפו"א → תפוחי אדמה.

Labne vs. white cream cheese — the letter ת distinguishes them:
- "גבינת לבנה" (gvinat Labne, with ת + space + לבנה) → Labne (a tangy Middle-Eastern yogurt cheese). query="לבנה". listaCategory: "מוצרי חלב וביצים". preferFresh: true. DO NOT confuse with generic white cream cheese.
- "גבינה לבנה" (gvina levana, no ת, just ה) → generic white cream cheese (like Gad, תנובה 5%). query="גבינה לבנה". listaCategory: "מוצרי חלב וביצים". preferFresh: true.
- If the user writes the ambiguous phrase "לבנה" alone, assume Labne and set query="לבנה".

Pickled / canned goods — the user means שימורים, NOT fresh:
- "מלפפון חמוץ" / "מלפפונים חמוצים" / "מלפפון כבוש" / "מלפפונים כבושים" → pickled cucumbers (שימורים). IMPORTANT: the catalog stores these under TWO phrasings: "מלפפון בחומץ" (in vinegar) and "מלפפון במלח" (in brine) — NEVER as "מלפפון חמוץ". Generate exactly TWO queries: {query:"מלפפון בחומץ"} AND {query:"מלפפון במלח"} — both tagged listaCategory: "שימורים רטבים וממרחים", same originalText: "מלפפון חמוץ" so they merge into ONE user-facing item. DO NOT emit "מלפפון חמוץ" or plain "מלפפון" (the latter would surface fresh produce). DO NOT set preferFresh.
- "תירס בשימורים" / "תירס משומר" / "תירס קופסה" / (ambiguous) "תירס" in canned context → canned corn. Generate TWO queries: {query:"תירס"} AND {query:"גרעיני תירס"}. listaCategory: "שימורים רטבים וממרחים". DO NOT set preferFresh. Why: the DB stores the product as "גרעיני תירס מתוק שימורים" — the plain "תירס" search may miss it, so generate both variants.

- "זיתים" / "זיתי קלמטה" / "זיתים שחורים" → canned/jarred olives. listaCategory: "שימורים רטבים וממרחים". DO NOT set preferFresh.
- "טונה" / "סרדינים" → canned fish. listaCategory: "שימורים רטבים וממרחים". DO NOT set preferFresh.
- "חומוס בקופסה" / "גרגירי חומוס" / "פול בקופסה" → canned legumes. listaCategory: "שימורים רטבים וממרחים".

CRITICAL RULES:
1. NONSENSE / GIBBERISH INPUT: If the user sends random characters, nonsense, or unintelligible text (e.g., "asdfghjkl", "xxxxx", "123456"), return {"message": "${nonsenseReply}", "searches": []}. Do NOT re-search items from conversation history when the current message is nonsense.
2. "CHEAPEST X" / "MOST EXPENSIVE X" QUERIES: Always search BROADLY for the product category. Do NOT carry over specific product variants from conversation history. Use higher limits (8-10) with sort_by/sort_order.
3. BRAND-SPECIFIC QUERIES: When the user mentions a brand, include the brand name in the search query.
4. NON-FRESH ITEMS (pantry, cleaning, snacks, pharmacy, canned goods, pickles): do NOT set preferFresh. They're packaged by nature.
5. NEVER collapse two distinct user items into one search. E.g. "גבינה לבנה" and "גבינת לבנה" in the same message are TWO separate items — generate separate searches with different originalText values even if the queries end up similar.

SEARCH TIPS:
- Product names in the DB include size, type, and packaging info (e.g., "חלב 3% מהדרין שקית 1 ליטר")
- For specific product types, generate MULTIPLE search variations. Each variation should still carry listaCategory and (when applicable) preferFresh.
- Use higher limits (8-10) for specific/cheapest queries to get more candidates

For each user message, return a JSON object with:
- "message": A SHORT placeholder like "מחפש..." — do NOT promise results.
- "searches": Array of search queries. Each search has:
  - "query": Hebrew search string optimized for the DB
  - "limit": number of results (default 5, use 8-10 for cheapest/filtered)
  - "listaCategory": REQUIRED — one of the 23 labels above
  - "preferFresh": optional boolean — true for fresh items (see rule above)
  - "sort_by": optional "min_price"
  - "sort_order": optional "asc" | "desc"
  - "is_vegan": optional boolean
  - "quantity": optional number — user-specified quantity (default 1)
  - "originalText": optional string — the user's exact phrase for this item (e.g. "2 קרטוני חלב")

Examples:
- "עגבניות, מלפפונים, יוגורט, לחם אחיד, מרכך כביסה, פלפל חריף" → message: "מחפש 6 מוצרים...", searches: [
    {query:"עגבניות",limit:5,listaCategory:"פירות וירקות",preferFresh:true,originalText:"עגבניות"},
    {query:"מלפפונים",limit:5,listaCategory:"פירות וירקות",preferFresh:true,originalText:"מלפפונים"},
    {query:"יוגורט",limit:5,listaCategory:"מוצרי חלב וביצים",preferFresh:true,originalText:"יוגורט"},
    {query:"לחם אחיד",limit:5,listaCategory:"לחם מאפים ודגני בוקר",preferFresh:true,originalText:"לחם אחיד"},
    {query:"מרכך כביסה",limit:5,listaCategory:"ניקיון כביסה וחד פעמי",originalText:"מרכך כביסה"},
    {query:"פלפל חריף",limit:5,listaCategory:"מזווה בישול ואפייה",originalText:"פלפל חריף"}
  ]
- "2 קרטוני חלב, תריסר ביצים" → searches: [
    {query:"חלב",limit:5,listaCategory:"מוצרי חלב וביצים",preferFresh:true,quantity:2,originalText:"2 קרטוני חלב"},
    {query:"ביצים",limit:5,listaCategory:"מוצרי חלב וביצים",preferFresh:true,quantity:12,originalText:"תריסר ביצים"}
  ]
- "מה הקוטג' הכי זול?" → message: "מחפש...", searches: [{query:"קוטג'",limit:10,sort_by:"min_price",sort_order:"asc",listaCategory:"מוצרי חלב וביצים",preferFresh:true,originalText:"קוטג'"}]
- "חטיפים טבעוניים" → message: "מחפש...", searches: [{query:"חטיפים",limit:8,is_vegan:true,listaCategory:"חטיפים מתוקים ופיצוחים",originalText:"חטיפים טבעוניים"}]
- "asdfghjkl" → message: "${nonsenseReply}", searches: []

Return ONLY valid JSON.`;
}

function toGeminiHistory(history: HistoryMsg[]): Content[] {
  return history.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

async function handleIntent(body: IntentBody): Promise<object> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: buildIntentSystemInstruction(body.language),
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });

  const chat = model.startChat({
    history: toGeminiHistory(body.conversationHistory ?? []),
  });

  const result = await chat.sendMessage(body.userMessage);
  const text = result.response.text();

  try {
    const parsed = JSON.parse(text);
    return {
      message: typeof parsed.message === 'string' ? parsed.message : '',
      searches: Array.isArray(parsed.searches) ? parsed.searches : [],
    };
  } catch {
    return {
      message:
        body.language === 'he'
          ? 'שגיאה בעיבוד התשובה. נסו שוב.'
          : 'Error parsing response. Please try again.',
      searches: [],
    };
  }
}

// ─── Summarize / summarizeResults ────────────────────────────────────────────

function buildSummarySystemInstruction(language: Language): string {
  const langNote =
    language === 'he'
      ? 'Respond in Hebrew, concise (1-2 sentences).'
      : 'Respond in English, concise (1-2 sentences).';

  return `You are a shopping assistant. The user asked for something and we searched the product database. ${langNote}

Rules:
- If products were found: Write a brief, helpful response referencing the actual product names/details. Highlight the best match or cheapest option if relevant.
- If many products were found (10+): Briefly summarize the results and highlight any items that might NOT match what the user asked for (e.g., user asked for "milk" but results include "chocolate milk" or unrelated items). Point out the best matches.
- If some results don't match: Be transparent — mention which items may not be what the user wanted and suggest refining the search.
- If NO products were found: Be honest! Say you couldn't find what they asked for, and suggest a different search term or broader query. NEVER say "here it is" when there are no results.
- For fresh produce (fruits, vegetables, eggs): If results are processed versions (pickled, frozen, chips), note that the database primarily has packaged products and the user may need to add fresh items manually.
- Keep it friendly and concise — 2-3 sentences max for large results, 1-2 for small.`;
}

async function handleSummarize(body: SummarizeBody): Promise<object> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: buildSummarySystemInstruction(body.language),
    generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
  });

  const productList =
    body.productNames.length > 0
      ? body.productNames
          .map((p, i) => `${i + 1}. ${p.name} (${p.manufacturer}) - ₪${p.price.toFixed(2)}`)
          .join('\n')
      : 'NO PRODUCTS FOUND';

  const meta = body.meta;
  const fallbackNote = meta?.freshFallbackCategories?.length
    ? `\n\nNote: For these categories no truly fresh products were in the DB so processed versions are shown as fallback: ${meta.freshFallbackCategories.join(
        ', '
      )}. Mention this briefly.`
    : '';
  const missingNote = meta?.missingFreshItems?.length
    ? `\n\nNote: Could NOT find these fresh items at all: ${meta.missingFreshItems.join(
        ', '
      )}. Suggest the user add them manually.`
    : '';

  const prompt = `User asked: "${body.userMessage}"\n\nSearch results:\n${productList}${fallbackNote}${missingNote}`;

  try {
    const result = await model.generateContent(prompt);
    return { text: result.response.text().trim() };
  } catch {
    const fallback =
      body.productNames.length === 0
        ? body.language === 'he'
          ? 'לא מצאתי מוצרים תואמים. נסו חיפוש אחר.'
          : "Couldn't find matching products. Try a different search."
        : body.language === 'he'
          ? 'הנה מה שמצאתי:'
          : "Here's what I found:";
    return { text: fallback };
  }
}

// ─── Suggest alternatives ────────────────────────────────────────────────────

function buildSuggestSystemInstruction(language: Language): string {
  const langNote =
    language === 'he'
      ? 'Write the "reason" field in Hebrew (one short line).'
      : 'Write the "reason" field in English (one short line).';

  return `You help users find products in an Israeli grocery catalog. A previous search turned up no matches. Given the failed phrase + optional category hint, suggest 2-3 ALTERNATIVE search queries the user could try. ${langNote}

For each suggestion, provide:
- query: a Hebrew search string the catalog is more likely to contain
- reason: a single short sentence explaining why this might work

Strategy — think through these before answering:
1. Spelling / brand variants (e.g. "לורפק" → "לורפאק")
2. Catalog phrasing (e.g. "מלפפון חמוץ" → "מלפפון בחומץ" / "מלפפון במלח")
3. Broader category fallback (e.g. "חמאת לורפק" → "חמאה דנית" → "חמאה 82%")
4. Synonyms / slang (e.g. "גמבה" → "פלפל אדום")
5. Singular/plural (e.g. "פטריות" → "פטרייה")
6. Remove a modifier (e.g. "שמן זית קר" → "שמן זית")

Return JSON: {"suggestions": [{"query": "...", "reason": "..."}, ...]}. Cap at 3 suggestions. Never return more than 3.`;
}

async function handleSuggestAlternatives(body: SuggestAlternativesBody): Promise<object> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: buildSuggestSystemInstruction(body.language),
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.4,
      maxOutputTokens: 2000,
    },
  });

  const prompt = `Failed phrase: "${body.failedPhrase}"${
    body.listaCategory ? `\nExpected category: ${body.listaCategory}` : ''
  }\n\nSuggest 2-3 alternative queries.`;

  try {
    const result = await model.generateContent(prompt);
    let text = result.response.text();
    // Gemini occasionally wraps JSON in ```json fences or prepends stray
    // comments — strip anything outside the outermost {...} before parsing.
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      text = text.slice(firstBrace, lastBrace + 1);
    }
    // Also strip line-comments (// ...) which json_object mode can emit.
    text = text.replace(/\/\/[^\n]*/g, '');
    const parsed = JSON.parse(text);
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    return {
      suggestions: suggestions
        .slice(0, 3)
        .map((s: { query?: string; reason?: string }) => ({
          query: String(s.query || '').trim(),
          reason: String(s.reason || '').trim(),
        }))
        .filter((s: { query: string }) => s.query.length > 0),
    };
  } catch (err) {
    console.error('[suggest_alternatives] failed:', err);
    return { suggestions: [] };
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as Body;
    if (!body || typeof body !== 'object' || !('mode' in body)) {
      return res.status(400).json({ error: 'Missing mode' });
    }

    if (body.mode === 'intent') {
      const out = await handleIntent(body);
      return res.status(200).json(out);
    }
    if (body.mode === 'summarize') {
      const out = await handleSummarize(body);
      return res.status(200).json(out);
    }
    if (body.mode === 'suggest_alternatives') {
      const out = await handleSuggestAlternatives(body);
      return res.status(200).json(out);
    }
    return res.status(400).json({ error: 'Unknown mode' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[api/ai/chat]', message);
    return res.status(500).json({ error: message });
  }
}
