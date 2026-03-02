import { chromium } from "playwright";

export async function scrapeStores(storeIds) {
    const browser = await chromium.launch({ headless: false });
    const allProducts = [];

    for (const storeId of storeIds) {
        console.log(`\nFetching products for Store ID: ${storeId}`);
        const context = await browser.newContext();
        const page = await context.newPage();

        let resolvedProducts = [];

        const responsePromise = new Promise((resolve) => {
            const onResponse = async (response) => {
                if (
                    response.url().includes("user-search-service/api/v3/search") &&
                    response.request().method() === "POST"
                ) {
                    try {
                        const data = await response.json();
                        const productWidget = data?.layout?.find(w => w.widgetName?.includes("SEARCHED_PRODUCTS"));
                        const items = productWidget?.data?.resolver?.data?.items;

                        if (items && Array.isArray(items)) {
                            const zuariProducts = items
                                .map(i => i.productResponse)
                                .filter(p => p?.product?.brand?.toLowerCase() === "zuari");

                            if (zuariProducts.length === 0) {
                                console.log(`No Zuari products found for store ${storeId}.`);
                                resolve([]);
                            } else {
                                console.log(`Found ${zuariProducts.length} Zuari products for store ${storeId}.`);
                                const products = zuariProducts.map(p => ({
                                    StoreID: storeId,
                                    Brand: p?.product?.brand,
                                    ProductName: p?.product?.name,
                                    PackSize: p?.productVariant?.formattedPacksize,
                                    AvailableQuantity: p?.availableQuantity,
                                    OutOfStock: p?.outOfStock
                                }));
                                resolve(products);
                            }
                        }
                    } catch (err) {
                        console.error(`Invalid JSON response for store ${storeId}`);
                    }
                }
            };

            page.on("response", onResponse);
        });

        await page.route("**/user-search-service/api/v3/search", async (route, request) => {
            const headers = { ...request.headers(), storeid: storeId };
            await route.continue({ headers });
        });

        try {
            await page.goto("https://www.zeptonow.com/search?query=zuari");

            let timeoutId;
            const timeoutPromise = new Promise((resolve) => {
                timeoutId = setTimeout(() => {
                    console.log(`Timeout waiting for product response for store ${storeId}`);
                    resolve([]);
                }, 12000);
            });

            resolvedProducts = await Promise.race([responsePromise, timeoutPromise]);
            clearTimeout(timeoutId);

            if (resolvedProducts && resolvedProducts.length > 0) {
                allProducts.push(...resolvedProducts);
            }
        } catch (e) {
            console.error(`Error navigating for store ${storeId}:`, e.message);
        } finally {
            await context.close();
        }
    }

    await browser.close();
    return allProducts;
}
