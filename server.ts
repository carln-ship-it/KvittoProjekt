import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const app = express();
const port = 3001;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json({ limit: '50mb' })); // Enable JSON body parsing with a generous limit for images

// Basic error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Gemini API initialization
const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error("API_KEY is not defined in the .env file");
}
const ai = new GoogleGenAI({ apiKey });

app.post('/api/process-receipts', async (req, res) => {
  const { imagesBase64, systemInstruction } = req.body;

  if (!imagesBase64 || !Array.isArray(imagesBase64) || imagesBase64.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid imagesBase64 data' });
  }
  if (!systemInstruction) {
    return res.status(400).json({ error: 'Missing systemInstruction' });
  }

  try {
    const imageParts = imagesBase64.map(img => ({
      inlineData: {
        mimeType: 'image/jpeg', // We optimized to JPEG in the frontend
        data: img,
      },
    }));

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: imageParts },
        config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
        }
    });

    const text = response.text;
    res.json({ text });

  } catch (error: any) {
    console.error('Error calling Gemini API:', error);
    // Check for specific Gemini API errors, like quota issues
    if (error.message && error.message.toLowerCase().includes('quota')) {
      return res.status(429).json({ error: 'API quota exceeded. Please check your Google AI Platform billing.' });
    }
    res.status(500).json({ error: 'Failed to process receipts with Gemini API' });
  }
});

app.listen(port, () => {
  console.log(`✅ Backend server listening at http://localhost:${port}`);
});
