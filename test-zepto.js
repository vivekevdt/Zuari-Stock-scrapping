import fs from "fs";
// =====================================================
// ZEPTO API CONFIG
// =====================================================

const BASE_URL = "https://bff-gateway.zepto.com/lms/api/v2/get_page";

const headers = {
    "accept": "application/json, text/plain, */*",
    "origin": "https://www.zepto.com",
    "referer": "https://www.zepto.com/",
    "platform": "WEB",
    "app_version": "14.23.1",
    "app_sub_platform": "WEB",

    "user-agent":
        "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/145.0.0.0 Mobile Safari/537.36",

    // ---- NETWORK TAB VALUES ----
    "request-signature":
        "0a0f76f5315b3ae04448112fe2f0671a2ba3bf0a8a9724e3c820d4f1ad446e70",

    "x-csrf-secret": "x8DNH1dQLHM",

    "x-xsrf-token":
        "js0OzopIbRO4iOph-nYYJ:pQ8rfsn7b815zpjOGgABhnqPxmo.6lIZzlazvMUFiAGBy6oU5nEwX83ljOd//JyKqTuIq2o",

    "cookie": "session_id=b59a97fe-16e8-4de9-91d2-36d4dd2ff521; device_id=08b5a96a-c76f-4967-892d-61456b7ee9d5"
};

// =====================================================
// FUNCTION → EXTRACT STORE IDS ANYWHERE IN JSON
// =====================================================

function extractStoreIds(obj) {
    let found = [];

    if (Array.isArray(obj)) {
        for (const item of obj) {
            found = found.concat(extractStoreIds(item));
        }
    } else if (obj !== null && typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) {
            if (["store_id", "store_ids", "storeid"].includes(k.toLowerCase())) {
                found.push(v);
            } else {
                found = found.concat(extractStoreIds(v));
            }
        }
    }

    return found;
}

// Utility function to introduce a delay
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    // =====================================================
    // READ LAT LONG FILE
    // =====================================================

    const locations = [];

    try {
        const fileContent = fs.readFileSync("lat_long.txt", "utf-8");
        const lines = fileContent.split(/\r?\n/);

        for (const line of lines) {
            const match = line.match(/Latitude:\s*([\d.]+)\s*\|\s*Longitude:\s*([\d.]+)/);
            if (match) {
                const lat = match[1];
                const lon = match[2];

                if (lat !== "0" && lon !== "0") {
                    locations.push({ lat, lon });
                }
            }
        }
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.log("❌ File lat_long.txt not found! Please make sure it exists.");
            return;
        } else {
            console.error("Error reading lat_long.txt:", err);
            return;
        }
    }

    console.log(`\n✅ Total Locations Loaded: ${locations.length}`);


    // =====================================================
    // API LOOP
    // =====================================================

    const results = [];

    for (let index = 0; index < locations.length; index++) {
        const { lat, lon } = locations[index];

        const params = new URLSearchParams({
            "latitude": lat,
            "longitude": lon,
            "page_type": "HOME",
            "version": "v2",
            "show_new_eta_banner": "true",
            "page_size": 3,
            "enforce_platform_type": "WEB"
        });

        const url = `${BASE_URL}?${params.toString()}`;

        try {
            // Set 20 second timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);

            const response = await fetch(url, {
                method: 'GET',
                headers: headers,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            console.log(
                `${index + 1}/${locations.length} ` +
                `→ ${lat},${lon} | Status: ${response.status}`
            );

            if (response.status === 200) {
                const data = await response.json();

                const storeIds = extractStoreIds(data);

                // remove duplicates and empty/falsy values
                const cleanIds = [...new Set(storeIds.filter(id => Boolean(id)))];

                if (cleanIds.length === 0) {
                    console.log("   ❌ No Zepto Store");
                }

                results.push({
                    "latitude": lat,
                    "longitude": lon,
                    "store_ids": cleanIds
                });

            } else {
                console.log("   ⚠ Failed Request");
                // Attempt to read error text if any
                const errorText = await response.text();
                // console.log(`      Details: ${errorText}`);
            }

            // Avoid CloudFront blocking
            await wait(1000);

        } catch (e) {
            if (e.name === 'AbortError') {
                console.log("Error: Request timed out");
            } else {
                console.log("Error:", e.message);
            }
        }
    }


    // =====================================================
    // SAVE OUTPUT
    // =====================================================

    fs.writeFileSync("store_results.json", JSON.stringify(results, null, 2), "utf-8");

    console.log("\n✅ EXTRACTION COMPLETE");
    console.log("📁 Saved → store_results.json");
}

main();
