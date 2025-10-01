import React, { useState, useCallback } from 'react';
import { searchReceipts, getAllReceiptsForExport, deleteReceipt } from '../services/databaseService';
import { exportToExcel } from '../utils/excelHelper';
import type { ExtractedReceiptData } from '../types';
import { Spinner } from './Spinner';
import { DatabaseReceiptCard } from './DatabaseReceiptCard';
import { IconFileSpreadsheet } from './Icons';


export const DatabaseSearch: React.FC = () => {
    const [storeNameQuery, setStoreNameQuery] = useState('');
    const [itemDescriptionQuery, setItemDescriptionQuery] = useState('');
    const [results, setResults] = useState<ExtractedReceiptData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const performSearch = useCallback(async () => {
        setIsLoading(true);
        setHasSearched(true);
        try {
            const searchResults = await searchReceipts({
                storeName: storeNameQuery,
                itemDescription: itemDescriptionQuery,
            });
            
            // Filter out duplicate results before displaying
            const seen = new Set<string>();
            const uniqueResults = searchResults.filter(receipt => {
                // Create a key to identify unique receipts.
                const uniqueKey = `${receipt.fileName}-${receipt.date}-${receipt.storeName}-${receipt.totalAmount}`;
                if (seen.has(uniqueKey)) {
                    return false;
                } else {
                    seen.add(uniqueKey);
                    return true;
                }
            });

            setResults(uniqueResults);
        } catch (error) {
            console.error("Search failed:", error);
            alert("Ett fel inträffade vid sökning i databasen.");
        } finally {
            setIsLoading(false);
        }
    }, [storeNameQuery, itemDescriptionQuery]);

    const handleClear = () => {
        setStoreNameQuery('');
        setItemDescriptionQuery('');
        setResults([]);
        setHasSearched(false);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            performSearch();
        }
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const allReceipts = await getAllReceiptsForExport();
            if(allReceipts.length === 0) {
                alert("Det finns ingen data att exportera.");
                return;
            }
            exportToExcel(allReceipts);
        } catch (error) {
            console.error("Export failed:", error);
            alert("Ett fel inträffade vid export till Excel.");
        } finally {
            setIsExporting(false);
        }
    };
    
    const handleDeleteReceipt = async (receiptId: number) => {
        if (window.confirm('Är du säker på att du vill radera detta kvitto permanent?')) {
            try {
                await deleteReceipt(receiptId);
                setResults(prevResults => prevResults.filter(r => r.id !== receiptId));
            } catch (error) {
                console.error('Failed to delete receipt:', error);
                alert('Kunde inte radera kvittot.');
            }
        }
    };


    return (
        <div>
            <div className="bg-slate-700 p-4 rounded-lg mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                        type="text"
                        value={storeNameQuery}
                        onChange={(e) => setStoreNameQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Sök på leverantör (t.ex. Elgiganten)"
                        className="w-full bg-slate-800 text-white placeholder-slate-400 p-3 rounded-md border border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <input
                        type="text"
                        value={itemDescriptionQuery}
                        onChange={(e) => setItemDescriptionQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Sök på artikel (t.ex. kaffe)"
                        className="w-full bg-slate-800 text-white placeholder-slate-400 p-3 rounded-md border border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                </div>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 mt-4">
                    <button
                        onClick={performSearch}
                        disabled={isLoading}
                        className="flex-1 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-500 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                    >
                        {isLoading ? 'Söker...' : 'Sök'}
                    </button>
                    <button
                        onClick={handleClear}
                        className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                    >
                        Rensa
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-500 text-white font-semibold py-2 px-4 rounded-md transition-colors flex items-center justify-center space-x-2"
                    >
                        {isExporting ? <Spinner className="h-5 w-5" /> : <IconFileSpreadsheet className="h-5 w-5" />}
                        <span>{isExporting ? 'Exporterar...' : 'Exportera till Excel'}</span>
                    </button>
                </div>
            </div>

            <div>
                <h2 className="text-2xl font-semibold text-slate-200 border-b border-slate-700 pb-2 mb-4">Sökresultat</h2>
                {isLoading ? (
                    <div className="text-center py-8">
                        <Spinner className="h-10 w-10 mx-auto text-sky-400" />
                        <p className="mt-2 text-slate-300">Hämtar data från databasen...</p>
                    </div>
                ) : hasSearched ? (
                    results.length > 0 ? (
                        <div className="space-y-4">
                            {results.map((receipt) => (
                                <DatabaseReceiptCard 
                                    key={receipt.id} 
                                    receiptData={receipt} 
                                    onDelete={() => handleDeleteReceipt(receipt.id!)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-400">
                            <p>Inga kvitton matchade din sökning.</p>
                        </div>
                    )
                ) : (
                     <div className="text-center py-8 text-slate-400">
                        <p>Ange sökvillkor eller klicka på 'Sök' för att visa alla sparade kvitton.</p>
                    </div>
                )}
            </div>
        </div>
    );
};