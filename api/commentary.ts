import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { score } = req.body;
  
  // En Vercel, la API Key debe estar definida en las variables de entorno del proyecto
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Server Configuration Error: API_KEY missing' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a sarcastic, witty 1980s arcade machine AI. The player just finished a game of Snake.
      
      The player's score was: ${score}.
      
      Provide a very short (max 2 sentences) commentary on their performance.
      If the score is low (under 5), be roasting and sarcastic.
      If the score is medium (5-15), be mildly impressed but demanding.
      If the score is high (over 15), be praising but warn them not to get cocky.
      
      Do not use emojis. Keep it cyberpunk/retro style.`,
    });

    return res.status(200).json({ commentary: response.text });
  } catch (error) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({ error: 'AI processing failed' });
  }
}