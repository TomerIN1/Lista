/**
 * Product Discovery Assistant — AI Service
 *
 * Thin client that calls the server-side AI gateway at /api/ai/chat (Gemini
 * 2.0 Flash, see api/ai/chat.ts). No API keys live in the browser bundle
 * anymore for these flows.
 *
 * parseShoppingList is a legacy batch-mode helper (not used by the chat UI)
 * and still uses the client-side OpenAI path — kept as-is so nothing breaks.
 */

import OpenAI from 'openai';
import { Language, ParsedShoppingItem, SearchIntent } from '../../types';

const openai = new OpenAI({
  apiKey: process.env.API_KEY,
  dangerouslyAllowBrowser: true,
});

const AI_ENDPOINT = '/api/ai/chat';

async function postToAI<T>(payload: object): Promise<T> {
  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`AI gateway ${res.status}: ${err || res.statusText}`);
  }
  return (await res.json()) as T;
}

// ─── List Parsing (legacy batch mode — unused by chat UI) ────────────────────

/**
 * Parses a raw shopping list text into structured items using AI.
 * Still on OpenAI — only referenced from buildSmartList which isn't wired
 * into the current chat UI. Kept for backwards compatibility.
 */
export const parseShoppingList = async (
  text: string,
  _language: Language
): Promise<ParsedShoppingItem[]> => {
  try {
    if (!text.trim()) return [];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a shopping list parser for an Israeli grocery product database. Your task is to extract individual grocery items from raw text and generate optimized Hebrew search queries for each.

Rules:
- Split the input into individual grocery items
- Extract quantity (default 1) — always output quantity as an integer count of product units to buy (e.g., "500 גרם פסטה" → quantity: 1, meaning 1 package)
- Keep weight/volume/size info in the product name and search query (e.g., "חלב 3%" or "פסטה 500 גרם") since DB products include size in their names
- Unit is always "pcs" (product units to purchase)
- Generate a searchQuery optimized for the Hebrew product database — use common product naming conventions
- Handle both Hebrew and English input
- Return a JSON object with an "items" array`,
        },
        {
          role: 'user',
          content: `Parse this shopping list into individual items:\n\n"${text}"\n\nReturn JSON: {"items": [{"originalText": "raw text segment", "name": "normalized name", "searchQuery": "optimized Hebrew search query", "quantity": 1, "unit": "pcs"}]}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from AI');

    const parsed = JSON.parse(content);
    const items = parsed.items || [];

    return items.map(
      (item: {
        originalText?: string;
        name?: string;
        searchQuery?: string;
        quantity?: number;
        unit?: string;
      }) => ({
        id: crypto.randomUUID(),
        originalText: item.originalText || '',
        name: item.name || '',
        searchQuery: item.searchQuery || item.name || '',
        quantity: item.quantity || 1,
        unit: 'pcs' as const,
      })
    );
  } catch (error) {
    console.error('Error parsing shopping list:', error);
    throw error;
  }
};

// ─── Conversational Assistant ────────────────────────────────────────────────

/**
 * Conversational AI assistant for product discovery.
 * Calls the server-side /api/ai/chat endpoint in "intent" mode. The server
 * uses Gemini 2.0 Flash — no API key in the client bundle.
 *
 * @param userMessage - The user's chat input
 * @param language - User's language preference
 * @param conversationHistory - Previous messages for context
 * @returns Placeholder message + search intents
 */
export const smartAssistant = async (
  userMessage: string,
  language: Language,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []
): Promise<{ message: string; searches: SearchIntent[] }> => {
  try {
    const parsed = await postToAI<{ message?: string; searches?: SearchIntent[] }>({
      mode: 'intent',
      userMessage,
      language,
      conversationHistory,
    });

    return {
      message: parsed.message || '',
      searches: (parsed.searches || []).map((s) => ({
        query: s.query || '',
        limit: s.limit || 5,
        sort_by: s.sort_by,
        sort_order: s.sort_order,
        is_vegan: s.is_vegan,
        listaCategory: s.listaCategory,
        preferFresh: s.preferFresh,
        quantity: s.quantity,
        originalText: s.originalText,
      })),
    };
  } catch (error) {
    console.error('Error in smart assistant:', error);
    return {
      message: language === 'he' ? 'שגיאה. נסו שוב.' : 'Error. Please try again.',
      searches: [],
    };
  }
};

// ─── Result Summarization ────────────────────────────────────────────────────

/**
 * Generates a context-aware Hebrew/English summary after real search results
 * are available. Calls /api/ai/chat in "summarize" mode.
 *
 * @param userMessage - What the user originally asked
 * @param productNames - Actual products returned by the search (name, manufacturer, price)
 * @param language - User's language preference
 * @param meta - Optional metadata about fresh fallbacks / missing items
 */
// ─── Alternative-query Suggestions ───────────────────────────────────────────

/**
 * When an item couldn't be found in the catalog, ask Gemini for 2-3
 * alternative Hebrew queries the user could try, each with a short reason.
 * Used to render inline chips on missing-item cards.
 */
export interface AlternativeSuggestion {
  query: string;
  reason: string;
}

export const suggestAlternatives = async (
  failedPhrase: string,
  listaCategory: string | undefined,
  language: Language
): Promise<AlternativeSuggestion[]> => {
  try {
    const parsed = await postToAI<{ suggestions?: AlternativeSuggestion[] }>({
      mode: 'suggest_alternatives',
      failedPhrase,
      listaCategory,
      language,
    });
    return parsed.suggestions ?? [];
  } catch {
    return [];
  }
};

export const summarizeResults = async (
  userMessage: string,
  productNames: { name: string; manufacturer: string; price: number }[],
  language: Language,
  meta?: { freshFallbackCategories?: string[]; missingFreshItems?: string[] }
): Promise<string> => {
  try {
    const parsed = await postToAI<{ text?: string }>({
      mode: 'summarize',
      userMessage,
      productNames,
      language,
      meta,
    });
    return (parsed.text || '').trim();
  } catch {
    if (productNames.length === 0) {
      return language === 'he'
        ? 'לא מצאתי מוצרים תואמים. נסו חיפוש אחר.'
        : "Couldn't find matching products. Try a different search.";
    }
    return language === 'he' ? 'הנה מה שמצאתי:' : "Here's what I found:";
  }
};
