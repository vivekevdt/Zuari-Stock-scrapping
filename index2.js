import { chromium } from "playwright";
import { getAllLatLongs } from "./services/locationService.js";

async function getStoreIdFromLatLong(browser, lat, long) {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("https://www.zeptonow.com/");

    console.log("Setting location:", lat, long);

    const storeIdPromise = new Promise((resolve) => {
        let isResolved = false;
        page.on("request", (request) => {
            const headers = request.headers();
            if (headers.storeid && !isResolved) {
                console.log("Detected storeid header:", headers.storeid);
                isResolved = true;
                resolve(headers.storeid);
            }
        });

        // Add a timeout in case storeId is not found
        setTimeout(() => {
            if (!isResolved) {
                isResolved = true;
                resolve(null);
            }
        }, 10000);
    });

    // 🔥 Call location API
    await page.evaluate(
        async ({ lat, long }) => {
            await fetch(
                `https://bff-gateway.zepto.com/api/v1/user/customer/address/location?latitude=${lat}&longitude=${long}`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );
        },
        { lat, long }
    );

    await page.waitForTimeout(3000);

    // 🔍 Trigger search (store resolution happens here)
    await page.goto("https://www.zeptonow.com/search?query=milk");

    const storeId = await storeIdPromise;

    console.log("Final Store ID:", storeId);

    // ✅ Check localStorage
    const localStorageData = await page.evaluate(() => {
        return { ...localStorage };
    });
    console.log("LocalStorage keys:", Object.keys(localStorageData));

    // ✅ Check cookies
    const cookies = await context.cookies();
    console.log("Cookies count:", cookies.length);

    await context.close();
    return storeId;
}

(async () => {
    const locations = await getAllLatLongs();
    if (locations.length === 0) {
        console.log("No valid locations found.");
        return;
    }

    const browser = await chromium.launch({ headless: false });
    const results = [];

    for (const loc of locations) {
        console.log(`\n--- Fetching store ID for ${loc.city}, Pincode: ${loc.pincode} ---`);
        try {
            const storeId = await getStoreIdFromLatLong(browser, loc.latitude, loc.longitude);
            results.push({
                city: loc.city,
                pincode: loc.pincode,
                latitude: loc.latitude,
                longitude: loc.longitude,
                storeId: storeId
            });
            console.log(`Successfully obtained store ID: ${storeId} for ${loc.pincode}`);
        } catch (error) {
            console.error(`Error fetching for ${loc.pincode}:`, error);
        }
    }

    console.log("\n--- Final Results ---");
    console.log(results);

    await browser.close();
})();
