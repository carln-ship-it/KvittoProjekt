const storeNameMap: { [key: string]: string } = {
    'elgiganten': 'Elgiganten',
    'elgig': 'Elgiganten',
    'hjertmans': 'Hjertmans Båttillbehör',
    'systembolaget': 'Systembolaget',
    'ica': 'ICA',
    'coop': 'Coop',
    'willys': 'Willy:s',
    'lidl': 'Lidl',
    'hemköp': 'Hemköp',
    'carrfour': 'Carrefour', // Correcting common typo
    'carrefour': 'Carrefour',
    'jack & jones': 'Jack & Jones',
    'jack and jones': 'Jack & Jones',
    'scorett': 'Scorett',
    'samsung': 'Samsung',
    'ikea': 'IKEA',
};

export const normalizeStoreName = (storeName: string | null): string | null => {
    if (!storeName) return null;

    const lowerCaseName = storeName.toLowerCase();

    // Find a key in the map that is a substring of the lowercased store name
    for (const key in storeNameMap) {
        if (lowerCaseName.includes(key)) {
            return storeNameMap[key];
        }
    }

    // If no match, return the original name, but perhaps capitalized
    return storeName.charAt(0).toUpperCase() + storeName.slice(1);
};