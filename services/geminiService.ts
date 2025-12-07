import { GoogleGenAI } from "@google/genai";

export const generateGameCommentary = async (score: number): Promise<string> => {
  // MODO 1: Entorno local / Playground
  // Si process.env.API_KEY existe en el cliente (inyectado por vite o el playground), úsalo directamente.
  const localApiKey = process.env.API_KEY;

  if (localApiKey) {
    try {
      const client = new GoogleGenAI({ apiKey: localApiKey });
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
      console.error("Gemini API Error (Client):", error);
      return "System Error: The AI is sleeping.";
    }
  }

  // MODO 2: Producción / Vercel
  // Si no hay key local, llamamos a la función serverless /api/commentary
  try {
    const response = await fetch('/api/commentary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ score }),
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.json();
    return data.commentary || "No data received";
  } catch (error) {
    console.error("Gemini API Error (Server):", error);
    return "System Error: Server unreachable.";
  }
};