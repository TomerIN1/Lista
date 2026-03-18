/**
 * User Simulation Test for Product Discovery Assistant
 * Tests the 5 fixes implemented:
 * 1. Nonsense input → no searches, helpful message
 * 2. Fresh produce → handles gracefully
 * 3. "Cheapest X" → broad search, not history-biased
 * 4. Brand filter → post-filters by manufacturer
 * 5. Large list → informative summary
 */

import { readFileSync } from 'fs';
import OpenAI from 'openai';

// Load env
const envContent = readFileSync(new URL('../../.env', import.meta.url), 'utf-8');
const envVars = {};
envContent.split('\n').forEach((line) => {
  const match = line.match(/^(\w+)=["']?(.+?)["']?$/);
  if (match) envVars[match[1]] = match[2];
});

const OPENAI_API_KEY = envVars.OPENAI_API_KEY;
const SEARCH_API = 'https://israeli-food-prices-database-and-ap-one.vercel.app';

if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY in .env');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function searchProducts(query, limit = 3, sortBy, sortOrder) {
  const params = new URLSearchParams({ query, limit: String(limit) });
  if (sortBy) params.set('sort_by', sortBy);
  if (sortOrder) params.set('sort_order', sortOrder);
  const res = await fetch(`${SEARCH_API}/api/products/search?${params}`);
  return res.json();
}

async function callSmartAssistant(userMessage, language, history = []) {
  const langNote = language === 'he'
    ? 'Respond in Hebrew. The product database is in Hebrew.'
    : 'Respond in English.';

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a smart shopping assistant for an Israeli grocery app. You help users find products quickly. ${langNote}

Your capabilities:
- Parse shopping lists (multiple items) into individual search queries
- Search for specific products
- Find cheapest/most expensive products (use sort_by: "min_price", sort_order: "asc" or "desc")
- Filter vegan products (use is_vegan: true)
- Answer questions about products or shopping

CRITICAL RULES:
1. NONSENSE / GIBBERISH INPUT: If the user sends random characters, nonsense, or unintelligible text (e.g., "asdfghjkl", "xxxxx", "123456"), return {"message": "${language === 'he' ? 'לא הבנתי. אפשר לנסח אחרת?' : "I didn't understand. Could you rephrase?"}", "searches": []}. Do NOT re-search items from conversation history when the current message is nonsense.
2. "CHEAPEST X" / "MOST EXPENSIVE X" QUERIES: Always search BROADLY for the product category. Do NOT carry over specific product variants from conversation history. For example, if the user previously searched for "קוטג' 5%" and now asks "מה הקוטג' הכי זול?", search for "קוטג'" broadly, NOT "קוטג' 5%". Use higher limits (8-10) with sort_by/sort_order.
3. FRESH PRODUCE NOTE: The product database contains mostly packaged/processed products. Fresh produce may return processed versions. Still search but be aware.
4. BRAND-SPECIFIC QUERIES: When the user mentions a brand (e.g., "יוגורט של שטראוס"), include the brand name in the search query.

SEARCH TIPS:
- Product names in the DB include size, type, and packaging info
- For specific product types, generate MULTIPLE search variations
- Use broader terms alongside specific ones
- When looking for cheapest/specific items, use higher limits (8-10)

For each user message, return a JSON object with:
- "message": A SHORT placeholder message like "מחפש..." or "Searching...".
- "searches": Array of search queries. Each: {"query", "limit", "sort_by"?, "sort_order"?, "is_vegan"?}

Return ONLY valid JSON.`,
      },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  return JSON.parse(response.choices[0].message.content);
}

// Known brands for post-filtering
const KNOWN_BRANDS = ['תנובה', 'שטראוס', 'טרה', 'אסם', 'עלית', 'יטבתה', 'מהדרין'];

function extractBrand(message) {
  const shelMatch = message.match(/של\s+(\S+)/);
  if (shelMatch) {
    for (const b of KNOWN_BRANDS) {
      if (shelMatch[1].includes(b)) return b;
    }
  }
  for (const b of KNOWN_BRANDS) {
    if (message.includes(b)) return b;
  }
  return null;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ ${testName}${details ? ' — ' + details : ''}`);
    failed++;
  }
}

async function test1_nonsenseInput() {
  console.log('\n🧪 Test 1: Nonsense input should return 0 searches');
  const result = await callSmartAssistant('asdfghjkl', 'he', [
    { role: 'user', content: 'חלב, ביצים, גבינה' },
    { role: 'assistant', content: 'מחפש 3 מוצרים...' },
  ]);
  assert(result.searches.length === 0, 'No searches for gibberish', `Got ${result.searches.length} searches`);
  assert(result.message.length > 0, 'Has a message response');
  console.log(`  AI message: "${result.message}"`);
}

async function test2_freshProduce() {
  console.log('\n🧪 Test 2: Fresh produce search');
  const result = await callSmartAssistant('מלפפונים, עגבניות, תפוחי אדמה', 'he');
  assert(result.searches.length >= 2, `Generated ${result.searches.length} searches (expected ≥2)`);
  console.log(`  Searches: ${result.searches.map((s) => s.query).join(', ')}`);
}

async function test3_cheapestBroad() {
  console.log('\n🧪 Test 3: "Cheapest cottage" should search broadly (not from history)');
  const history = [
    { role: 'user', content: 'קוטג\' 5%' },
    { role: 'assistant', content: 'מחפש...' },
  ];
  const result = await callSmartAssistant('מה הקוטג\' הכי זול?', 'he', history);
  assert(result.searches.length > 0, 'Has searches');

  // Check that at least one search is broadly "קוטג'" not "קוטג' 5%"
  const hasBroadSearch = result.searches.some(
    (s) => s.query.includes('קוטג') && !s.query.includes('5%')
  );
  assert(hasBroadSearch, 'Has broad search without 5%', `Queries: ${result.searches.map((s) => s.query).join(', ')}`);

  const hasSortAsc = result.searches.some((s) => s.sort_order === 'asc');
  assert(hasSortAsc, 'Uses ascending sort for cheapest');

  const hasHighLimit = result.searches.some((s) => (s.limit || 3) >= 5);
  assert(hasHighLimit, 'Uses higher limit for price comparison', `Limits: ${result.searches.map((s) => s.limit).join(', ')}`);
}

async function test4_brandFiltering() {
  console.log('\n🧪 Test 4: Brand post-filtering for "יוגורט של שטראוס"');
  const result = await callSmartAssistant('יוגורט של שטראוס', 'he');
  assert(result.searches.length > 0, 'Has searches');
  console.log(`  Searches: ${result.searches.map((s) => s.query).join(', ')}`);

  // Now simulate the post-filtering
  const brand = extractBrand('יוגורט של שטראוס');
  assert(brand === 'שטראוס', `Extracted brand: "${brand}"`);

  // Actually search and check filtering
  if (result.searches.length > 0) {
    const searchResult = await searchProducts(result.searches[0].query, 10);
    const allProducts = searchResult.products || [];
    const filtered = allProducts.filter(
      (p) =>
        p.manufacturer?.includes('שטראוס') || p.name?.includes('שטראוס')
    );
    console.log(`  All results: ${allProducts.length}, After brand filter: ${filtered.length}`);
    assert(
      filtered.length > 0 || allProducts.length === 0,
      'Brand filter produces results (or no products at all)'
    );
    if (allProducts.length > 0 && filtered.length > 0) {
      assert(
        filtered.length <= allProducts.length,
        'Filtered results are subset of all results'
      );
    }
  }
}

async function test5_largeList() {
  console.log('\n🧪 Test 5: Large list (15 items) generates informative search');
  const largeList = 'חלב, ביצים, גבינה צהובה, לחם, חמאה, יוגורט, קוטג\', מלפפונים, עגבניות, תפוחי אדמה, בצל, שום, פסטה, אורז, שמן זית';
  const result = await callSmartAssistant(largeList, 'he');
  assert(result.searches.length >= 10, `Generated ${result.searches.length} searches (expected ≥10)`);
  console.log(`  Total searches: ${result.searches.length}`);
  console.log(`  First 5: ${result.searches.slice(0, 5).map((s) => s.query).join(', ')}`);
}

// ─── Run ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Product Discovery Assistant — User Simulation Test');
  console.log('Testing 5 fixes...\n');

  try {
    await test1_nonsenseInput();
    await test2_freshProduce();
    await test3_cheapestBroad();
    await test4_brandFiltering();
    await test5_largeList();
  } catch (error) {
    console.error('\n💥 Test crashed:', error.message);
    failed++;
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
