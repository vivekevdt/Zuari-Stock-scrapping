import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pincode from 'pincode-lat-long';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function getAllLatLongs() {
    const validLocations = [];
    try {
        const dataPath = path.join(__dirname, '../data.json');
        const fileContent = await fs.readFile(dataPath, 'utf-8');
        const data = JSON.parse(fileContent);

        for (const [city, pincodes] of Object.entries(data)) {
            for (const pin of pincodes) {
                // The pincode-lat-long library expects a number as the argument
                const location = pincode.getlatlong(Number(pin));

                if (location && location.lat !== undefined && location.long !== undefined) {
                    validLocations.push({
                        city,
                        pincode: pin,
                        latitude: location.lat,
                        longitude: location.long
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error reading data.json or processing pincodes:', error);
    }

    return validLocations;
}

// Retain print function if ran directly, just in case
export async function printLatLongs() {
    const locations = await getAllLatLongs();
    for (const loc of locations) {
        console.log(`City: ${loc.city} | Pincode: ${loc.pincode} | Latitude: ${loc.latitude} | Longitude: ${loc.longitude}`);
    }
}

if (process.argv[1].endsWith('locationService.js')) {
    printLatLongs();
}
