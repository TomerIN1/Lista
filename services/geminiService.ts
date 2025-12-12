import OpenAI from "openai";
import { CategoryGroup, Language } from "../types";

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