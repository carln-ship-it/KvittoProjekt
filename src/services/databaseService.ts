import { openDB, IDBPDatabase } from 'idb';
import type { ExtractedReceiptData, ReceiptItem } from '../types';

const DB_NAME = 'ReceiptDB';
const DB_VERSION = 1;
const RECEIPTS_STORE = 'receipts';
const ITEMS_STORE = 'receiptItems';

let dbPromise: Promise<IDBPDatabase> | null = null;

const initDB = (): Promise<IDBPDatabase> => {
    if (dbPromise) return dbPromise;

    dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(RECEIPTS_STORE)) {
                const receiptsStore = db.createObjectStore(RECEIPTS_STORE, {
                    keyPath: 'id',
                    autoIncrement: true,
                });
                receiptsStore.createIndex('normalizedStoreName', 'normalizedStoreName', { unique: false });
                receiptsStore.createIndex('date', 'date', { unique: false });
            }
            if (!db.objectStoreNames.contains(ITEMS_STORE)) {
                const itemsStore = db.createObjectStore(ITEMS_STORE, {
                    keyPath: 'id',
                    autoIncrement: true,
                });
                itemsStore.createIndex('receiptId', 'receiptId', { unique: false });
                itemsStore.createIndex('description', 'description', { unique: false });
            }
        },
    });
    return dbPromise;
};

export const saveReceipt = async (receiptData: ExtractedReceiptData, fileName: string): Promise<void> => {
    const db = await initDB();
    const tx = db.transaction([RECEIPTS_STORE, ITEMS_STORE], 'readwrite');
    const receiptsStore = tx.objectStore(RECEIPTS_STORE);
    const itemsStore = tx.objectStore(ITEMS_STORE);

    const receiptToSave = {
        fileName: fileName,
        date: receiptData.date,
        storeName: receiptData.storeName,
        // Store the normalized name in lowercase for case-insensitive searching
        normalizedStoreName: receiptData.normalizedStoreName?.toLowerCase() || null,
        totalAmount: receiptData.totalAmount,
        currency: receiptData.currency,
        vatAmount: receiptData.vatAmount,
    };

    const receiptId = await receiptsStore.add(receiptToSave);

    // FIX: Ensure receiptData.items is an array before mapping. Gemini can sometimes return null.
    const itemsToSave = Array.isArray(receiptData.items) ? receiptData.items : [];
    const itemPromises = itemsToSave.map(item =>
        itemsStore.add({ ...item, receiptId })
    );

    await Promise.all([...itemPromises, tx.done]);
};

export const deleteReceipt = async (receiptId: number): Promise<void> => {
    const db = await initDB();
    const tx = db.transaction([RECEIPTS_STORE, ITEMS_STORE], 'readwrite');
    const receiptsStore = tx.objectStore(RECEIPTS_STORE);
    const itemsStore = tx.objectStore(ITEMS_STORE);
    const itemsIndex = itemsStore.index('receiptId');

    // Delete the receipt itself
    const deleteReceiptPromise = receiptsStore.delete(receiptId);

    // Find and delete all associated items
    const itemKeysToDelete = await itemsIndex.getAllKeys(receiptId);
    const deleteItemsPromises = itemKeysToDelete.map(key => itemsStore.delete(key));
    
    await Promise.all([deleteReceiptPromise, ...deleteItemsPromises, tx.done]);
};


export const searchReceipts = async (
    { storeName, itemDescription }: { storeName?: string; itemDescription?: string }
): Promise<ExtractedReceiptData[]> => {
    const db = await initDB();
    
    // Fallback if no filters, get all receipts.
    if (!storeName && !itemDescription) {
        return getAllReceiptsForExport(db);
    }
    
    const tx = db.transaction([RECEIPTS_STORE, ITEMS_STORE], 'readonly');
    const receiptsStore = tx.objectStore(RECEIPTS_STORE);
    const itemsStore = tx.objectStore(ITEMS_STORE);

    const normalizedStoreName = storeName?.trim().toLowerCase();
    const normalizedItemDescription = itemDescription?.trim().toLowerCase();
    
    let storeFilteredIds: Set<number> | null = null;
    if (normalizedStoreName) {
        storeFilteredIds = new Set();
        // Use a cursor to iterate all receipts for a 'contains' search, as indexes don't support it directly.
        let cursor = await receiptsStore.openCursor();
        while (cursor) {
            if (cursor.value.normalizedStoreName?.includes(normalizedStoreName)) {
                storeFilteredIds.add(cursor.primaryKey as number);
            }
            cursor = await cursor.continue();
        }
    }

    let itemFilteredIds: Set<number> | null = null;
    if (normalizedItemDescription) {
        itemFilteredIds = new Set();
        const descriptionIndex = itemsStore.index('description');
        let cursor = await descriptionIndex.openCursor(); // Iterate all items for a 'contains' search
        while (cursor) {
            if (cursor.value.description?.toLowerCase().includes(normalizedItemDescription)) {
                itemFilteredIds.add(cursor.value.receiptId);
            }
            cursor = await cursor.continue();
        }
    }
    
    let finalIds: Set<number>;

    if (storeFilteredIds && itemFilteredIds) {
        // Intersection: receipts that are in both sets
        finalIds = new Set([...storeFilteredIds].filter(id => itemFilteredIds!.has(id)));
    } else if (storeFilteredIds) {
        finalIds = storeFilteredIds;
    } else if (itemFilteredIds) {
        finalIds = itemFilteredIds;
    } else {
        // This case should be handled by the initial check, but as a fallback.
        return []; 
    }

    const receipts: ExtractedReceiptData[] = [];
    for (const id of finalIds) {
        const receipt = await receiptsStore.get(id);
        if (receipt) {
            receipt.items = await itemsStore.index('receiptId').getAll(receipt.id);
            receipts.push(receipt);
        }
    }
    
    return receipts.sort((a, b) => (a.date && b.date) ? b.date.localeCompare(a.date) : 0);
};

export const getAllReceiptsForExport = async (dbInstance?: IDBPDatabase): Promise<ExtractedReceiptData[]> => {
    const db = dbInstance || await initDB();
    const allReceipts = await db.getAll(RECEIPTS_STORE);
    const itemsStore = db.transaction(ITEMS_STORE, 'readonly').objectStore(ITEMS_STORE);
    for (const receipt of allReceipts) {
        receipt.items = await itemsStore.index('receiptId').getAll(receipt.id);
    }
    return allReceipts.sort((a,b) => (a.date && b.date) ? b.date.localeCompare(a.date) : 0);
};