import express from "express";
import dotenv from "dotenv";
import { chromium } from "playwright";
import { scrapeStores, getStoreIdFromLatLong } from "./scraper.js";
import { generateCSV } from "./csvGenerator.js";
import { sendEmailWithAttachment } from "./mailer.js";
import { getAllLatLongs } from "./services/locationService.js";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

app.get("/api/test", async (req, res) => {
    let browser;
    try {
        console.log("-----------------------------------------");
        console.log("Received request to /api/test - mapping locations...");

        // 1. Fetch all Valid Latitude & Longitude pairs from data.json via service
        const allLocations = await getAllLatLongs();

        if (!allLocations || allLocations.length === 0) {
            return res.status(404).json({ message: "No valid locations generated from pincodes." });
        }

        // For testing, only take the first two pincode locations
        const locations = allLocations.slice(0, 2);

        console.log(`Discovered ${allLocations.length} valid coordinates.`);

        // 2. Load Unique Store IDs from store_results.json
        const storeIdSet = new Set();
        try {
            const storeData = JSON.parse(fs.readFileSync('store_results.json', 'utf-8'));
            storeData.forEach(item => {
                if (item.store_ids && Array.isArray(item.store_ids)) {
                    item.store_ids.forEach(id => storeIdSet.add(id));
                }
            });
        } catch (err) {
            console.error("Could not read store_results.json:", err);
            return res.status(500).json({ message: "Could not read store_results.json." });
        }

        // Convert the set to an array of unique store ideas
        const storeIdsToProcess = Array.from(storeIdSet);

        console.log("\n--- Unique Store IDs Discovered ---");
        console.log(storeIdsToProcess);

        if (storeIdsToProcess.length === 0) {
            console.log("No store IDs resolved from the store_results.json.");
            return res.status(404).json({ message: "No store IDs resolved." });
        }

        console.log(`\nInitiating stock scraping for ${storeIdsToProcess.length} distinct store(s)...`);

        // 3. Scrape stores
        const products = await scrapeStores(storeIdsToProcess);

        if (!products || products.length === 0) {
            console.log("No stock data found across these stores.");
            return res.status(404).json({ message: "No stock data found." });
        }

        console.log(`Successfully scraped ${products.length} products. Generating CSV...`);

        // 4. Generate CSV string
        const csvData = generateCSV(products);

        if (!csvData) {
            console.error("Failed to generate CSV data.");
            return res.status(500).json({ message: "Failed to generate CSV." });
        }

        // 5. Fire off email 
        console.log("Sending email to talha.parkar@adventz.com...");
        await sendEmailWithAttachment(csvData);

        console.log("Process completed successfully!");
        console.log("-----------------------------------------");

        return res.status(200).json({
            message: "Scraping completed and email sent successfully.",
            uniqueStoresFound: storeIdsToProcess.length,
            itemsScraped: products.length
        });
    } catch (error) {
        console.error("An error occurred during /api/test endpoint:", error);

        if (browser) await browser.close().catch(console.error);

        return res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log(`Trigger the process by calling: http://localhost:${PORT}/api/test`);
});