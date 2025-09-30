import type { ExtractedReceiptData } from '../types';
import * as XLSX from 'xlsx';

export const exportToExcel = (receipts: ExtractedReceiptData[]): void => {
    if (typeof XLSX === 'undefined') {
        console.error("XLSX library is not loaded. Make sure SheetJS is included in your HTML.");
        alert("Kunde inte generera Excel-fil. Bibliotek saknas.");
        return;
    }

    // 1. Prepare data for two separate sheets
    const receiptsSheetData = receipts.map(receipt => ({
        'Kvitto-ID': receipt.id,
        'Datum': receipt.date,
        'Butik (Normaliserad)': receipt.normalizedStoreName,
        'Butik (Original)': receipt.storeName,
        'Totalbelopp': receipt.totalAmount,
        'Valuta': receipt.currency,
        'Momsbelopp': receipt.vatAmount,
        'Filnamn': receipt.fileName,
    }));

    const itemsSheetData: any[] = [];
    receipts.forEach(receipt => {
        if (receipt.items && receipt.items.length > 0) {
            receipt.items.forEach(item => {
                itemsSheetData.push({
                    'Artikel-ID': item.id,
                    'Kvitto-ID': receipt.id, // Foreign key to link back to receipts
                    'Beskrivning': item.description,
                    'Antal': item.quantity,
                    'Pris': item.price,
                });
            });
        }
    });

    // 2. Create worksheets
    const receiptsWorksheet = XLSX.utils.json_to_sheet(receiptsSheetData);
    const itemsWorksheet = XLSX.utils.json_to_sheet(itemsSheetData);

    // Optional: Adjust column widths
    const receiptCols = [
        { wch: 10 }, // Kvitto-ID
        { wch: 12 }, // Datum
        { wch: 25 }, // Butik (Normaliserad)
        { wch: 25 }, // Butik (Original)
        { wch: 15 }, // Totalbelopp
        { wch: 10 }, // Valuta
        { wch: 15 }, // Momsbelopp
        { wch: 40 }, // Filnamn
    ];
    receiptsWorksheet['!cols'] = receiptCols;
    
    const itemCols = [
        { wch: 10 }, // Artikel-ID
        { wch: 10 }, // Kvitto-ID
        { wch: 50 }, // Beskrivning
        { wch: 10 }, // Antal
        { wch: 15 }, // Pris
    ];
    itemsWorksheet['!cols'] = itemCols;


    // 3. Create a new workbook
    const workbook = XLSX.utils.book_new();

    // 4. Append worksheets to the workbook
    XLSX.utils.book_append_sheet(workbook, receiptsWorksheet, "Kvitton");
    XLSX.utils.book_append_sheet(workbook, itemsWorksheet, "Artiklar");

    // 5. Generate and trigger download
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `KvittoExport_${today}.xlsx`);
};