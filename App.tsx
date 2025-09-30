import React, { useState, useCallback, useEffect, useRef } from 'react';
import { FileInput } from './components/FileInput';
import { ProcessedFileCard } from './components/ProcessedFileCard';
import { DatabaseSearch } from './components/DatabaseSearch';
import { Spinner } from './components/Spinner';
import { IconCloudUpload, IconDatabaseSearch, IconPlayerPlay, IconRotateClockwise, IconPlayerPause } from './components/Icons';
import type { ProcessedFile, ExtractedReceiptData } from './types';
import { convertPdfToImagesBase64 } from './services/pdfService';
import { extractReceiptDataFromBatch } from './services/geminiService';
import { saveReceipt } from './services/databaseService';
import { normalizeStoreName } from './utils/normalizationHelper';

type View = 'upload' | 'search';
type ProcessingStatus = 'idle' | 'running' | 'paused';

const CONCURRENT_LIMIT = 2; // Antal PDF-till-bild-konverteringar som körs samtidigt
const BATCH_SIZE = 5; // Antal kvitton som skickas i varje API-anrop

const App: React.FC = () => {
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>('idle');
  const [currentView, setCurrentView] = useState<View>('upload');
  
  const workers = useRef(0);
  const queue = useRef<ProcessedFile[]>([]);
  const isMounted = useRef(true);

  useEffect(() => {
    // Sätter en flagga när komponenten avmonteras för att undvika state-uppdateringar
    isMounted.current = true;
    return () => {
        isMounted.current = false;
    };
  }, []);

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const newFiles: ProcessedFile[] = Array.from(files)
      .filter(file => file.type === 'application/pdf')
      .map(file => ({
        fileName: file.name,
        status: 'queued',
        file: file,
      }));
    
    // Uppdatera både state och kön
    setProcessedFiles(prevFiles => [...prevFiles, ...newFiles]);
    queue.current.push(...newFiles);
    
    // Om vi är idle, starta processen
    if (processingStatus === 'idle') {
      startProcessing();
    }
  };
  
  const startWorker = useCallback(async () => {
    workers.current++;
    
    while (queue.current.length > 0 && processingStatus !== 'paused') {
      const batchToProcess = queue.current.splice(0, BATCH_SIZE);

      if (!isMounted.current) return;
      
      setProcessedFiles(prev => prev.map(f => {
        const isInBatch = batchToProcess.some(b => b.fileName === f.fileName);
        return isInBatch ? { ...f, status: 'processing' } : f;
      }));

      try {
        // Steg 1: Konvertera alla PDF:er till bilder parallellt för batchen
        const imageConversionPromises = batchToProcess.map(file => convertPdfToImagesBase64(file.file));
        const imagesPerFile = await Promise.all(imageConversionPromises);

        // Steg 2: Skicka hela batchen till Gemini
        // Vi antar här att varje PDF bara innehåller ett kvitto och tar första bilden.
        const imageBatchForApi = imagesPerFile.map(images => images[0]).filter(Boolean); // Ta första bilden, filtrera bort tomma
        
        // Hoppa över om batchen blev tom efter konvertering
        if (imageBatchForApi.length === 0) {
            // Markera alla i batchen som fel
             batchToProcess.forEach((file, index) => {
                 if (!isMounted.current) return;
                 setProcessedFiles(prev => prev.map(f => f.fileName === file.fileName ? { ...f, status: 'error', error: "PDF kunde inte konverteras." } : f));
            });
            continue;
        }

        const resultsBatch = await extractReceiptDataFromBatch([imageBatchForApi]);
        const results = resultsBatch[0] || [];

        // Steg 3: Mappa tillbaka resultaten och uppdatera status för varje fil
        for (let i = 0; i < batchToProcess.length; i++) {
          const file = batchToProcess[i];
          const result = results[i] as ExtractedReceiptData; // Få resultatet för denna specifika fil

          if (!isMounted.current) return;

          if (result && !result.error) {
              result.normalizedStoreName = normalizeStoreName(result.storeName);
              await saveReceipt(result, file.fileName);
              setProcessedFiles(prev => prev.map(f => f.fileName === file.fileName ? { ...f, status: 'success', data: result } : f));
          } else {
             const errorMessage = result?.error || "Ett okänt fel inträffade under AI-bearbetning.";
             setProcessedFiles(prev => prev.map(f => f.fileName === file.fileName ? { ...f, status: 'error', error: errorMessage } : f));
             // Om felet är ett kvotfel, pausa hela processen
             if (errorMessage.startsWith('QUOTA_EXCEEDED:')) {
                if (isMounted.current) setProcessingStatus('paused');
             }
          }
        }
      } catch (error) {
         console.error("Ett allvarligt fel inträffade i en worker:", error);
         // Markera alla filer i den aktuella batchen som fel
          batchToProcess.forEach(file => {
               if (!isMounted.current) return;
               setProcessedFiles(prev => prev.map(f => f.fileName === file.fileName ? { ...f, status: 'error', error: error instanceof Error ? error.message : "Okänt worker-fel." } : f));
          });
      }
    }
    
    workers.current--;
    if (workers.current === 0 && queue.current.length === 0) {
      if (isMounted.current) setProcessingStatus('idle');
    }
  }, [processingStatus]);


  const startProcessing = () => {
    if (processingStatus === 'running' || queue.current.length === 0) return;
    
    setProcessingStatus('running');
    
    // Starta initiala workers
    for (let i = 0; i < CONCURRENT_LIMIT; i++) {
      startWorker();
    }
  };
  
  const pauseProcessing = () => {
     setProcessingStatus('paused');
  };
  
  const resumeProcessing = () => {
     startProcessing(); // Anropar startProcessing igen som nu kommer att vara i 'running' state
  };

  const resetQueue = () => {
    setProcessingStatus('idle');
    setProcessedFiles([]);
    queue.current = [];
    workers.current = 0;
  };

  const hasQueueableFiles = processedFiles.some(f => f.status === 'queued');
  const queuedFileCount = queue.current.length;
  
  const isProcessing = processingStatus === 'running';

  return (
    <div className="bg-slate-800 text-slate-100 min-h-screen">
      <div className="container mx-auto p-4 md:p-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-sky-400">Kvitto-Extraktorn</h1>
          <p className="text-slate-400 mt-2">Ladda upp dina PDF-kvitton och låt AI göra jobbet.</p>
        </header>

        <div className="bg-slate-900 rounded-lg p-2 max-w-md mx-auto mb-8 flex space-x-2">
          <button 
            onClick={() => setCurrentView('upload')}
            className={`w-full text-center py-2 px-4 rounded-md font-semibold transition-colors flex items-center justify-center space-x-2 ${currentView === 'upload' ? 'bg-sky-500 text-white' : 'bg-transparent text-slate-300 hover:bg-slate-700'}`}
          >
            <IconCloudUpload className="h-5 w-5"/>
            <span>Bearbeta Kvitton</span>
          </button>
          <button 
            onClick={() => setCurrentView('search')}
            className={`w-full text-center py-2 px-4 rounded-md font-semibold transition-colors flex items-center justify-center space-x-2 ${currentView === 'search' ? 'bg-sky-500 text-white' : 'bg-transparent text-slate-300 hover:bg-slate-700'}`}
          >
            <IconDatabaseSearch className="h-5 w-5"/>
            <span>Sök i Databas</span>
          </button>
        </div>

        {currentView === 'upload' ? (
          <main>
            <div className="max-w-4xl mx-auto">
              <div className="bg-slate-750 p-6 rounded-lg shadow-xl mb-6">
                <h2 className="text-2xl font-semibold text-slate-200 mb-4">Steg 1: Välj en mapp med kvitton</h2>
                <FileInput onFilesSelected={handleFilesSelected} disabled={isProcessing} />
              </div>

              {processedFiles.length > 0 && (
                <div className="bg-slate-750 p-6 rounded-lg shadow-xl">
                  <h2 className="text-2xl font-semibold text-slate-200 mb-4">Steg 2: Starta bearbetning</h2>
                  <div className="flex flex-col sm:flex-row gap-4">
                     {processingStatus !== 'running' ? (
                        <button
                          onClick={processingStatus === 'paused' ? resumeProcessing : startProcessing}
                          disabled={queuedFileCount === 0 && processingStatus !== 'paused'}
                          className="flex-grow w-full bg-sky-500 hover:bg-sky-600 disabled:bg-slate-500 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all flex items-center justify-center space-x-2"
                        >
                          <IconPlayerPlay className="h-6 w-6" />
                          <span>
                            {processingStatus === 'paused' ? `Återuppta (${queuedFileCount} kvar)` : `Bearbeta ${queuedFileCount} nya kvitton`}
                          </span>
                        </button>
                      ) : (
                         <button
                            onClick={pauseProcessing}
                            className="flex-grow w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-6 rounded-lg transition-all flex items-center justify-center space-x-2"
                          >
                            <IconPlayerPause className="h-6 w-6"/>
                            <span>Pausa</span>
                        </button>
                      )}
                       <button
                        onClick={resetQueue}
                        disabled={isProcessing}
                        className="bg-red-600 hover:bg-red-700 disabled:bg-slate-500 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                        title="Rensa listan"
                      >
                        <IconRotateClockwise className="h-6 w-6" />
                      </button>
                  </div>
                 
                  <div className="mt-6 space-y-4">
                    {processedFiles.map((file, index) => (
                      <ProcessedFileCard key={`${file.fileName}-${index}`} processedFile={file} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </main>
        ) : (
          <main>
            <div className="max-w-4xl mx-auto">
                <DatabaseSearch />
            </div>
          </main>
        )}
      </div>
    </div>
  );
};

export default App;
