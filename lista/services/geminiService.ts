import { GoogleGenAI, Type } from "@google/genai";
import { CategoryGroup, Language } from "../types";

// Initialize the client. API_KEY is guaranteed to be in process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Organize the following list of items into logical, distinct categories.${contextInstruction} \nInput list: "${inputList}"`,
      config: {
        systemInstruction: `You are an expert organizer. Your task is to take a raw list of items (separated by commas, newlines, or spaces) and group them into concise, meaningful categories. ${languageInstruction} Return ONLY the JSON structure.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: {
                type: Type.STRING,
                description: "The name of the category",
              },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING,
                  description: "The item name",
                },
                description: "List of items belonging to this category",
              },
            },
            required: ["category", "items"],
          },
        },
      },
    });

    if (!response.text) {
      throw new Error("No response from AI");
    }

    const rawData = JSON.parse(response.text) as RawCategoryGroup[];

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
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `Create a simple, aesthetic, 3D-style icon for the category "${category}". The icon should be colorful, minimalist, and on a solid white or soft pastel background. High quality, vector art style.`,
          },
        ],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error(`Error generating image for ${category}:`, error);
    return null;
  }
};