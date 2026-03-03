import { chromium } from "playwright";

export async function getStoreIdFromLatLong(browser, lat, long) {
    const context = await browser.newContext();
    const page = await context.newPage();
    let storeId = null;

    try {
        await page.goto("https://www.zeptonow.com/");

        // Start listening BEFORE setting location relying purely on async/await (waitForRequest)
        const requestPromise = page.waitForRequest(
            (request) => {
                const headers = request.headers();
                return headers && headers.storeid;
            },
            { timeout: 15000 }
        );

        console.log(`Setting location for Lat: ${lat}, Long: ${long}...`);

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

        // Trigger any page navigation so the storeid header is used on network requests
        await page.goto("https://www.zeptonow.com/search?query=zuari");

        // Await the intercepted request
        const request = await requestPromise;
        storeId = request.headers().storeid;
        console.log(`✅ Store ID detected:`, storeId);

    } catch (error) {
        console.log(`❌ Could not fetch store ID for ${lat}, ${long}:`, error.message);
    } finally {
        await context.close();
    }

    return storeId;
}

export async function scrapeStores(storeIds) {
    const browser = await chromium.launch({ headless: false });
    const allProducts = [];

    for (const storeId of storeIds) {
        console.log(`\nFetching products for Store ID: ${storeId}`);
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
            // Setup request interception for store_id header
            await page.route("**/user-search-service/api/v3/search", async (route, request) => {
                const headers = { ...request.headers(), storeid: storeId };
                await route.continue({ headers });
            });

            // Cleanly wait for the POST request resolving the API data
            const responsePromise = page.waitForResponse(
                (response) => response.url().includes("user-search-service/api/v3/search") && response.request().method() === "POST",
                { timeout: 12000 }
            );

            await page.goto("https://www.zeptonow.com/search?query=zuari");

            // No need for manually constructed Promise & callback anymore
            const response = await responsePromise;
            const data = await response.json();

            const productWidget = data?.layout?.find(w => w.widgetName?.includes("SEARCHED_PRODUCTS"));
            const items = productWidget?.data?.resolver?.data?.items;

            if (items && Array.isArray(items)) {
                const zuariProducts = items
                    .map(i => i.productResponse)
                    .filter(p => p?.product?.brand?.toLowerCase() === "zuari");

                if (zuariProducts.length === 0) {
                    console.log(`No Zuari products found for store ${storeId}.`);
                } else {
                    console.log(`Found ${zuariProducts.length} Zuari products for store ${storeId}.`);
                    const products = zuariProducts.map(p => ({
                        StoreID: p?.storeId,
                        Brand: p?.product?.brand,
                        ProductId: p?.product?.id,
                        ProductName: p?.product?.name,
                        PackSize: p?.productVariant?.formattedPacksize,
                        Mrp: p?.productVariant?.mrp,
                        unlisted: p?.productVariant?.unlisted,
                        Weight: p?.productVariant?.weightInGms,
                        isActive: p?.productVariant?.isActive,
                        DiscountedSellingPrice: p?.discountedSellingPrice,
                        DiscountPercent: p?.discountPercent,
                        DiscountAmount: p?.discountAmount,
                        AvailableQuantity: p?.availableQuantity,
                        StockoutThresholdQuantity: p?.stockoutThresholdQuantity,
                        OutOfStock: p?.outOfStock
                    }));
                    allProducts.push(...products);
                }
            }
        } catch (e) {
            console.error(`Error or timeout fetching for store ${storeId}:`, e.message);
        } finally {
            await context.close();
        }
    }

    await browser.close();
    return allProducts;
}
