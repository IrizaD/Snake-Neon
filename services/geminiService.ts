import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY not found in environment");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateGameCommentary = async (score: number): Promise<string> => {
  const client = getClient();
  if (!client) return "AI Offline: Insert Coin (API Key Missing)";

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a sarcastic, witty 1980s arcade machine AI. The player just finished a game of Snake.
      
      The player's score was: ${score}.
      
      Provide a very short (max 2 sentences) commentary on their performance.
      If the score is low (under 5), be roasting and sarcastic.
      If the score is medium (5-15), be mildly impressed but demanding.
      If the score is high (over 15), be praising but warn them not to get cocky.
      
      Do not use emojis. Keep it cyberpunk/retro style.`,
    });

    return response.text || "Connection terminated...";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "System Error: The AI is sleeping.";
  }
};