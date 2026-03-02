import express from "express";
import dotenv from "dotenv";
import { scrapeStores } from "./scraper.js";
import { generateCSV } from "./csvGenerator.js";
import { sendEmailWithAttachment } from "./mailer.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from 'public' directory
app.use(express.static('public'));

// The requested store IDs
const STORE_IDS = [
    "b8aed0f4-59e0-4387-825d-406800150b71", // Original
    "5ee3f39d-3d7b-44b2-bbeb-b17e8457dc4e"  // Newly requested
];

app.get("/api/test", async (req, res) => {
    try {
        console.log("-----------------------------------------");
        console.log("Received request to /api/test - starting scraping...");

        // We send a 202 Accepted status first if you prefer not waiting. 
        // Here we will wait and send the response once completed, which works fine as long as scraping finishes within browser timeout limits.
        const products = await scrapeStores(STORE_IDS);

        if (!products || products.length === 0) {
            console.log("No products found across any stores.");
            return res.status(404).json({ message: "No stock data found." });
        }

        console.log(`Successfully scraped ${products.length} products. Generating CSV...`);
        const csvData = generateCSV(products);

        if (!csvData) {
            console.error("Failed to generate CSV data.");
            return res.status(500).json({ message: "Failed to generate CSV data." });
        }

        console.log("Sending email to talha.parkar@adventz.com...");
        await sendEmailWithAttachment(csvData);

        console.log("Process completed successfully!");
        console.log("-----------------------------------------");

        return res.status(200).json({
            message: "Scraping completed and email sent successfully.",
            itemsScraped: products.length
        });
    } catch (error) {
        console.error("An error occurred during /api/test endpoint:", error);
        return res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log(`Trigger the process by calling: http://localhost:${PORT}/api/test`);
});