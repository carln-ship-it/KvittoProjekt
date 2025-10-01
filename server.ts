import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const app = express();
const port = 3001;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json({ limit: '50mb' })); // Enable JSON body parsing with a generous limit for images

// Basic error handling
// FIX: Explicitly use imported express types to avoid potential global type conflicts.
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Gemini API initialization
const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error("API_KEY is not defined in the .env file");
}
const ai = new GoogleGenAI({ apiKey });

// Helper function to wait for a specified time
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retries a function with exponential backoff for specific transient errors.
 * @param fn The async function to retry.
 * @param maxRetries Maximum number of retries.
 * @param initialDelay The initial delay in milliseconds.
 * @returns The result of the function if successful.
 */
const retryWithExponentialBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      // Check if it's a retryable error (model overloaded, quota exceeded)
      const isRetryable = error.status === 503 || error.status === 429;
      
      if (isRetryable && attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        console.log(
          `API call failed with status ${error.status}. Retrying in ${delay.toFixed(0)}ms... (Attempt ${attempt}/${maxRetries})`
        );
        await sleep(delay);
      } else {
        // If it's not a retryable error or we've run out of retries, throw the last error
        console.error(`API call failed on final attempt (${attempt}/${maxRetries}) or with non-retryable error.`);
        throw error;
      }
    }
  }
  // This line is unreachable due to the loop structure but required for TypeScript's control flow analysis.
  throw new Error('Exited retry loop unexpectedly.');
};


app.post('/api/process-receipts', async (req: Request, res: Response) => {
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

    // Wrap the API call with our retry logic
    const response = await retryWithExponentialBackoff(async () => {
        return ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: imageParts },
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
            }
        });
    });

    const text = response.text;
    res.json({ text });

  } catch (error: any) {
    console.error('Error calling Gemini API after retries:', error);
    // After all retries, if it still fails, send an appropriate error response.
    if (error.status === 429) {
      return res.status(429).json({ error: 'API quota exceeded. Please check your Google AI Platform billing.' });
    }
    if (error.status === 503) {
      return res.status(503).json({ error: 'The model is currently overloaded. Please try again later.' });
    }
    res.status(500).json({ error: 'Failed to process receipts with Gemini API after multiple attempts.' });
  }
});

app.listen(port, () => {
  console.log(`✅ Backend server listening at http://localhost:${port}`);
});
