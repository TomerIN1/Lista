/**
 * Product Discovery Assistant — AI Service
 *
 * Contains all AI/LLM functions for the product discovery chat feature:
 * - parseShoppingList: Extracts structured items from raw shopping list text
 * - smartAssistant: Interprets user intent and generates search queries
 * - summarizeResults: Generates context-aware responses based on actual search results
 *
 * Uses OpenAI gpt-4o-mini via the shared OpenAI client.
 */

import OpenAI from 'openai';
import { Language, ParsedShoppingItem, SearchIntent } from '../../types';

const openai = new OpenAI({
  apiKey: process.env.API_KEY,
  dangerouslyAllowBrowser: true,
});

// ─── List Parsing ────────────────────────────────────────────────────────────

/**
 * Parses a raw shopping list text into structured items using AI.
 * Extracts item names, quantities, units, and generates optimized Hebrew search queries.
 *
 * @param text - Raw shopping list text (e.g., "2 חלב 3%, 12 ביצים, גבינה צהובה")
 * @param language - User's language preference
 * @returns Array of parsed items with search queries
 */
export const parseShoppingList = async (
  text: string,
  language: Language
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
 * Interprets user intent (list, search, question, recommendation) and returns
 * a placeholder message + an array of search queries to execute against the product DB.
 *
 * The actual user-facing response is generated later by summarizeResults()
 * after real search results are available — this prevents "here it is" with no products.
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
    const langNote =
      language === 'he'
        ? 'Respond in Hebrew. The product database is in Hebrew.'
        : 'Respond in English.';

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      {
        role: 'system',
        content: `You are a smart shopping assistant for an Israeli grocery app. You help users find products quickly. ${langNote}

Your capabilities:
- Parse shopping lists (multiple items) into individual search queries
- Search for specific products
- Find cheapest/most expensive products (use sort_by: "min_price", sort_order: "asc" or "desc")
- Filter vegan products (use is_vegan: true)
- Answer questions about products or shopping

IMPORTANT SEARCH TIPS:
- Product names in the DB include size, type, and packaging info (e.g., "חלב 3% מהדרין שקית 1 ליטר")
- For specific product types (e.g., "milk in a bag"), generate MULTIPLE search variations to maximize chances. Example: "חלב בשקית" → searches: [{query:"חלב שקית"},{query:"חלב בשקית"}]
- Use broader terms alongside specific ones — the DB search is keyword-based
- When looking for cheapest/specific items, use higher limits (5-10) to get more candidates

For each user message, return a JSON object with:
- "message": A SHORT placeholder message like "מחפש..." or "Searching...". Do NOT say "here it is" or promise results — the actual response will be generated after seeing real search results.
- "searches": Array of search queries to execute. Each search has:
  - "query": Hebrew search string optimized for the product DB
  - "limit": number of results (default 3, use 5-10 for specific/filtered queries)
  - "sort_by": optional "min_price" for price sorting
  - "sort_order": optional "asc" (cheapest first) or "desc" (most expensive first)
  - "is_vegan": optional boolean for vegan filter

Examples:
- "חלב, ביצים, גבינה" → message: "מחפש 3 מוצרים...", searches: [{query:"חלב",limit:3},{query:"ביצים",limit:3},{query:"גבינה צהובה",limit:3}]
- "החלב בשקית הכי זול" → message: "מחפש...", searches: [{query:"חלב שקית",limit:5,sort_by:"min_price",sort_order:"asc"},{query:"חלב בשקית",limit:5,sort_by:"min_price",sort_order:"asc"}]
- "חטיפים טבעוניים" → message: "מחפש...", searches: [{query:"חטיפים",limit:5,is_vegan:true}]
- "תודה" → message: "בשמחה! אפשר לעזור עוד?", searches: []

Return ONLY valid JSON.`,
      },
      ...conversationHistory.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: userMessage },
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from AI');

    const parsed = JSON.parse(content);
    return {
      message: parsed.message || '',
      searches: (parsed.searches || []).map((s: SearchIntent) => ({
        query: s.query || '',
        limit: s.limit || 3,
        sort_by: s.sort_by,
        sort_order: s.sort_order,
        is_vegan: s.is_vegan,
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
 * Generates a context-aware response after seeing actual search results.
 * This is the key to trustworthy responses — the AI sees real product names, prices,
 * and can judge whether they match what the user asked for.
 *
 * - If products were found: references actual names/prices, highlights best match
 * - If NO products found: honestly says so and suggests alternative search terms
 *
 * @param userMessage - What the user originally asked
 * @param productNames - Actual products returned by the search (name, manufacturer, price)
 * @param language - User's language preference
 * @returns Human-friendly response string
 */
export const summarizeResults = async (
  userMessage: string,
  productNames: { name: string; manufacturer: string; price: number }[],
  language: Language
): Promise<string> => {
  try {
    const langNote =
      language === 'he'
        ? 'Respond in Hebrew, concise (1-2 sentences).'
        : 'Respond in English, concise (1-2 sentences).';

    const productList =
      productNames.length > 0
        ? productNames
            .map(
              (p, i) =>
                `${i + 1}. ${p.name} (${p.manufacturer}) - ₪${p.price.toFixed(2)}`
            )
            .join('\n')
        : 'NO PRODUCTS FOUND';

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a shopping assistant. The user asked for something and we searched the product database. ${langNote}

Rules:
- If products were found: Write a brief, helpful response referencing the actual product names/details. Highlight the best match.
- If NO products were found: Be honest! Say you couldn't find what they asked for, and suggest a different search term or broader query. NEVER say "here it is" when there are no results.
- Keep it friendly and concise — 1-2 sentences max.`,
        },
        {
          role: 'user',
          content: `User asked: "${userMessage}"\n\nSearch results:\n${productList}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 150,
    });

    return response.choices[0]?.message?.content?.trim() || '';
  } catch {
    if (productNames.length === 0) {
      return language === 'he'
        ? 'לא מצאתי מוצרים תואמים. נסו חיפוש אחר.'
        : "Couldn't find matching products. Try a different search.";
    }
    return language === 'he' ? 'הנה מה שמצאתי:' : "Here's what I found:";
  }
};
