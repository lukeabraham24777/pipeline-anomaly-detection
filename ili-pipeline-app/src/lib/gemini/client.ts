import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

let genAI: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI | null {
  if (!API_KEY) {
    console.warn('Gemini API key not configured. Set VITE_GEMINI_API_KEY in .env');
    return null;
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(API_KEY);
  }
  return genAI;
}

export function isGeminiAvailable(): boolean {
  return !!API_KEY;
}

export async function generateContent(prompt: string): Promise<string> {
  const client = getGeminiClient();
  if (!client) {
    throw new Error('Gemini API key not configured');
  }

  const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text();
}
