import * as pdfjsLib from 'pdfjs-dist';
// Use the vite-specific '?url' import to get the path to the worker script.
// The .js version is used instead of .min.js for compatibility with the installed pdfjs-dist version.
import worker from 'pdfjs-dist/build/pdf.worker.js?url';

// Set the worker source once
pdfjsLib.GlobalWorkerOptions.workerSrc = worker;

export const convertPdfToImagesBase64 = async (file: File): Promise<string[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const imagesBase64: string[] = [];
  const numPages = pdfDocument.numPages;

  // Limit pages to avoid excessive processing for very large PDFs
  const MAX_PAGES_TO_PROCESS = 10; 
  const pagesToProcess = Math.min(numPages, MAX_PAGES_TO_PROCESS);


  for (let i = 1; i <= pagesToProcess; i++) {
    const page = await pdfDocument.getPage(i);
    // Scale slightly reduced for performance. 1.4 is a good balance.
    const viewport = page.getViewport({ scale: 1.4 }); 
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get canvas context');
    }
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // The type definitions for this version of pdfjs-dist might require passing the canvas context differently.
    // The object passed to render() is a RenderParameters object.
    // FIX: The type definitions for this version of pdfjs-dist require the 'canvas' property.
    await page.render({ canvasContext: context, viewport: viewport, canvas }).promise;
    
    // OPTIMIZATION: Convert canvas to JPEG. It's much smaller for scanned documents.
    // 0.8 represents 80% quality, a great balance for size vs readability for the AI.
    const imageData = canvas.toDataURL('image/jpeg', 0.8); 
    imagesBase64.push(imageData.split(',')[1]); // Remove the "data:image/jpeg;base64," prefix
    
    page.cleanup(); // Important for memory management
  }
  
  if (numPages > MAX_PAGES_TO_PROCESS) {
    console.warn(`PDF has ${numPages} pages. Processed only the first ${MAX_PAGES_TO_PROCESS} pages.`);
  }

  return imagesBase64;
};
