import type { ExtractedReceiptData } from '../types';
import { GEMINI_SYSTEM_INSTRUCTION } from '../constants';


// Denna funktion anropar vår nya, säkra backend-server.
// API-nyckeln hanteras helt på servern och exponeras aldrig i webbläsaren.
export const extractReceiptDataFromBatch = async (
  batchesOfImages: string[][]
): Promise<ExtractedReceiptData[][]> => {
  const allResults: ExtractedReceiptData[][] = [];

  for (const imageBatch of batchesOfImages) {
    try {
      // Anropa vår lokala backend-server
      const response = await fetch('http://localhost:3001/api/process-receipts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          imagesBase64: imageBatch,
          systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || `Backend returned status ${response.status}`;
        // Kontrollera för kvotfel från servern
        if (errorMessage.toLowerCase().includes('quota')) {
           throw new Error(`QUOTA_EXCEEDED: ${errorMessage}`);
        }
        throw new Error(errorMessage);
      }

      const backendResponse = await response.json();
      const textResponse = backendResponse.text;

      if (!textResponse) {
        throw new Error("Backend returned an empty response text.");
      }

      // Rensa och parsea JSON-svaret precis som förut
      const cleanedJson = textResponse.trim().replace(/^```json\s*|```$/g, '');
      const parsedData = JSON.parse(cleanedJson);

      if (!Array.isArray(parsedData)) {
        throw new Error("The data from the backend is not in the expected array format.");
      }
      
      // Validera att vi fick ett resultat för varje bild i batchen
      if (parsedData.length !== imageBatch.length) {
          console.warn(`Mismatch in batch results. Sent ${imageBatch.length}, received ${parsedData.length}. Padding with error objects.`);
           // Fyll på med felobjekt för att matcha längden
          while(parsedData.length < imageBatch.length) {
              parsedData.push({ error: "Missing result from AI for this item in the batch." });
          }
      }

      allResults.push(parsedData as ExtractedReceiptData[]);

    } catch (error) {
      console.error("Error communicating with the backend or processing its response:", error);
      let errorMessage = "An unknown error occurred while communicating with the backend.";
       if (error instanceof SyntaxError) {
          errorMessage = `Failed to parse JSON response from backend. The response was not valid JSON.`;
      } else if (error instanceof Error) {
          // Bevara det specifika felmeddelandet (t.ex. QUOTA_EXCEEDED)
          errorMessage = error.message;
      }
      // Om ett helt batch-anrop misslyckas, skapa felobjekt för varje fil i batchen.
      const errorBatch = imageBatch.map(() => ({
        date: null, storeName: null, items: [], totalAmount: null, currency: null, vatAmount: null, error: errorMessage
      }));
       // FIX: Corrected a type error where `errorBatch` (an array) was being incorrectly cast to a single `ExtractedReceiptData` object due to the `as ExtractedReceiptData[][0]` syntax. The `allResults.push` method expects an array (`ExtractedReceiptData[]`), so the faulty cast is removed.
       allResults.push(errorBatch);
    }
  }

  return allResults;
};