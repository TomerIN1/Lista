import OpenAI from "openai";
import { CategoryGroup, Language, Recipe, RecipeLabel, Item } from "../types";

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.API_KEY,
  dangerouslyAllowBrowser: true // Required for client-side usage
});

// Internal type for the raw API response
interface RawCategoryGroup {
  category: string;
  items: string[];
}

// Internal type for recipe API response
interface RawRecipeItem {
  name: string;
  amount: number;
  unit: string;
  recipeIds: string[]; // Array of recipe names this item belongs to
}

interface RawRecipeGroup {
  category: string;
  items: RawRecipeItem[];
}

// Helper: Generate consistent color for recipe based on ID
const generateRecipeColor = (recipeId: string): string => {
  const colors = [
    '#6366F1', // indigo
    '#10B981', // emerald
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // violet
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#F97316', // orange
  ];
  const hash = recipeId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

// Helper: Combine items with same name+unit, merge recipe labels
const combineItems = (items: Item[]): Item[] => {
  const itemMap = new Map<string, Item>();

  items.forEach(item => {
    const key = `${item.name.toLowerCase().trim()}_${item.unit}`;

    if (itemMap.has(key)) {
      const existing = itemMap.get(key)!;
      existing.amount += item.amount;
      if (item.recipeLabels) {
        existing.recipeLabels = [
          ...(existing.recipeLabels || []),
          ...item.recipeLabels
        ];
      }
    } else {
      itemMap.set(key, { ...item });
    }
  });

  return Array.from(itemMap.values());
};

export const organizeList = async (inputList: string, language: Language, existingCategories: string[] = []): Promise<CategoryGroup[]> => {
  try {
    const contextInstruction = existingCategories.length > 0
      ? `\nPrioritize using these existing category names if they are a good fit: ${existingCategories.join(', ')}.`
      : '';

    const languageInstruction = language === 'he'
      ? "Output the category names and items in Hebrew. Use common Hebrew terminology for categories (e.g., 'פירות וירקות' instead of 'Fruits & Vegetables')."
      : "Output in English.";

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert organizer. Your task is to take a raw list of items (separated by commas, newlines, or spaces) and group them into concise, meaningful categories. ${languageInstruction} Return ONLY valid JSON.`
        },
        {
          role: "user",
          content: `Organize the following list of items into logical, distinct categories.${contextInstruction}

Input list: "${inputList}"

Return a JSON object with a "categories" array where each object has:
- category: string (the category name)
- items: string[] (array of item names)

Example format:
{"categories": [{"category": "Fruits", "items": ["apple", "banana"]}, {"category": "Dairy", "items": ["milk", "cheese"]}]}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse the response
    const parsed = JSON.parse(content);
    let rawData: RawCategoryGroup[];

    if (parsed.categories && Array.isArray(parsed.categories)) {
      rawData = parsed.categories;
    } else if (Array.isArray(parsed)) {
      // Fallback if it returns an array directly
      rawData = parsed;
    } else {
      console.error("Unexpected AI response:", parsed);
      throw new Error("Unexpected response format from AI");
    }

    // Transform raw strings into rich Item objects
    return rawData.map(group => ({
      id: crypto.randomUUID(),
      category: group.category,
      items: group.items.map(itemName => ({
        id: crypto.randomUUID(),
        name: itemName,
        checked: false,
        amount: 1,
        unit: 'pcs'
      }))
    }));

  } catch (error) {
    console.error("Error organizing list:", error);
    throw error;
  }
};

export const generateCategoryImage = async (category: string): Promise<string | null> => {
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: `Create a simple, aesthetic, 3D-style icon for the category "${category}". The icon should be colorful, minimalist, and on a solid white or soft pastel background. High quality, vector art style.`,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      response_format: "url"
    });

    const imageUrl = response.data[0]?.url;
    if (!imageUrl) {
      return null;
    }

    // Return the URL directly (DALL-E URLs are temporary but work for display)
    return imageUrl;
  } catch (error) {
    console.error(`Error generating image for ${category}:`, error);
    return null;
  }
};

export const organizeRecipes = async (
  recipes: Recipe[],
  language: Language,
  existingCategories: string[] = []
): Promise<CategoryGroup[]> => {
  try {
    const contextInstruction = existingCategories.length > 0
      ? `\nPrioritize using these existing category names if they are a good fit: ${existingCategories.join(', ')}.`
      : '';

    const languageInstruction = language === 'he'
      ? "Output the category names and items in Hebrew. Use common Hebrew terminology for categories."
      : "Output in English.";

    // Build recipe text for prompt
    const recipeTexts = recipes.map(r => `Recipe "${r.name}":\n${r.ingredients}`).join('\n\n');

    // Create recipe ID to name mapping for labels
    const recipeMap = new Map<string, Recipe>();
    recipes.forEach(r => recipeMap.set(r.id, r));

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert recipe analyzer and shopping list organizer. Your task is to extract ingredients from multiple recipes, combine duplicate ingredients across recipes, and organize them into shopping categories. ${languageInstruction} Return ONLY valid JSON.`
        },
        {
          role: "user",
          content: `Extract and organize ingredients from the following ${recipes.length} recipe(s) into logical shopping categories.${contextInstruction}

${recipeTexts}

Instructions:
- Extract all ingredients with their quantities and units
- IMPORTANT: Normalize all ingredient names to SINGULAR form (e.g., "onions" → "onion", "tomatoes" → "tomato", "eggs" → "egg")
- IMPORTANT: After normalizing to singular, combine duplicate ingredients across recipes by summing quantities
- IMPORTANT: The amount for each item should be the TOTAL sum across all recipes (e.g., if 3 recipes each use 1 egg, the amount should be 3)
- Convert measurements to consistent units (e.g., use L for >1000ml, kg for >1000g)
- Group ingredients into logical shopping categories

Return a JSON object with a "categories" array where each object has:
- category: string (the category name, e.g., "Produce", "Dairy", "Spices")
- items: array of objects with:
  - name: string (ingredient name in SINGULAR form)
  - amount: number (TOTAL quantity summed across all recipes as decimal, default to 1 per recipe if not specified)
  - unit: string (e.g., "g", "kg", "L", "ml", "pcs")
  - recipeIds: string[] (array of recipe names this ingredient appears in)

Example:
If Recipe A has "2 eggs" and Recipe B has "3 eggs", the result should be:
{"categories": [{"category": "Dairy", "items": [{"name": "egg", "amount": 5, "unit": "pcs", "recipeIds": ["Recipe A", "Recipe B"]}]}]}

If Recipe A has "1 onion" and Recipe B has "2 onions", the result should be:
{"categories": [{"category": "Produce", "items": [{"name": "onion", "amount": 3, "unit": "pcs", "recipeIds": ["Recipe A", "Recipe B"]}]}]}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.5 // Lower temperature for more consistent extraction
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse the response
    const parsed = JSON.parse(content);
    let rawData: RawRecipeGroup[];

    if (parsed.categories && Array.isArray(parsed.categories)) {
      rawData = parsed.categories;
    } else if (Array.isArray(parsed)) {
      rawData = parsed;
    } else {
      console.error("Unexpected AI response:", parsed);
      throw new Error("Unexpected response format from AI");
    }

    // Transform raw data into CategoryGroup with recipe labels
    const allItems: Item[] = [];

    rawData.forEach(group => {
      group.items.forEach(rawItem => {
        // Create recipe labels for this item
        const recipeLabels: RecipeLabel[] = rawItem.recipeIds.map(recipeName => {
          // Find recipe by name
          const recipe = recipes.find(r => r.name === recipeName);
          const recipeId = recipe?.id || crypto.randomUUID();

          return {
            recipeId,
            recipeName,
            color: generateRecipeColor(recipeId)
          };
        });

        // Normalize unit to match existing Unit type
        let unit: Item['unit'] = 'pcs';
        const unitLower = rawItem.unit.toLowerCase();
        if (['pcs', 'g', 'kg', 'l', 'ml'].includes(unitLower)) {
          unit = unitLower as Item['unit'];
        }

        allItems.push({
          id: crypto.randomUUID(),
          name: rawItem.name,
          checked: false,
          amount: rawItem.amount,
          unit,
          recipeLabels
        });
      });
    });

    // Combine duplicate items
    const combinedItems = combineItems(allItems);

    // Re-group combined items by category
    const categoryMap = new Map<string, Item[]>();

    rawData.forEach(group => {
      group.items.forEach(rawItem => {
        const matchingItem = combinedItems.find(
          item => item.name.toLowerCase().trim() === rawItem.name.toLowerCase().trim()
        );

        if (matchingItem) {
          if (!categoryMap.has(group.category)) {
            categoryMap.set(group.category, []);
          }
          // Only add if not already in this category
          const categoryItems = categoryMap.get(group.category)!;
          if (!categoryItems.find(i => i.id === matchingItem.id)) {
            categoryItems.push(matchingItem);
          }
        }
      });
    });

    // Convert map to CategoryGroup array
    return Array.from(categoryMap.entries()).map(([category, items]) => ({
      id: crypto.randomUUID(),
      category,
      items
    }));

  } catch (error) {
    console.error("Error organizing recipes:", error);
    throw error;
  }
};