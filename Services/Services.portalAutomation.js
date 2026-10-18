
const { getBrowser } = require("./browsermanager");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const NAVIGATION_TIMEOUT = 60000;
const SELECTOR_TIMEOUT = 10000;
const POST_ACTION_WAIT = 3000;

const CONSENT_URLS = {
    "quizzy.betech.lk":
        "http://consento.hutch.lk/register-service/XQ%3D%3DCg%3D%3Dcg%3D%3DAw%3D%3D",

    "dermascan.betech.lk":
        "http://consento.hutch.lk/register-service/XQ%3D%3DCA%3D%3Deg%3D%3DDQ%3D%3D",

    "lumabond.betech.lk":
        "http://consento.hutch.lk/register-service/VQ%3D%3DDQ%3D%3Ddw%3D%3D",

    "serenai.betech.lk":
        "http://consento.hutch.lk/register-service/VQ%3D%3DDg%3D%3Dew%3D%3D",
};

function getConsentUrl(origin = "") {
    const hostname = new URL(origin).hostname.toLowerCase();

    const matchedHost = Object.keys(CONSENT_URLS).find(
        (host) => hostname === host || hostname.endsWith(`.${host}`)
    );

    if (!matchedHost) {
        throw new Error(`Unsupported origin: ${hostname}`);
    }

    return CONSENT_URLS[matchedHost];
}

async function navigateWithDiagnostics(page, url) {
    console.log("🌐 Navigating to consent page:", url);

    try {
        const response = await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: NAVIGATION_TIMEOUT,
        });

        console.log("🌐 Navigation result:", {
            status: response?.status() ?? "No HTTP response",
            finalUrl: page.url(),
        });

        return response;
    } catch (error) {
        console.error("❌ Navigation failed:", {
            message: error.message,
            currentUrl: page.url(),
        });

        throw error;
    }
}

async function clearCookiesAndCache(page) {
    try {
        // Chromium-based browsers support CDP.
        if (typeof page.target === "function") {
            const client = await page.target().createCDPSession();

            try {
                await client.send("Network.clearBrowserCookies");
                await client.send("Network.clearBrowserCache");

                console.log("🧹 Cookies and cache cleared");
            } finally {
                await client.detach().catch(() => {});
            }
        } else {
            // Fallback for browser implementations exposing page.cookies().
            const cookies = await page.cookies();

            if (cookies.length) {
                await page.deleteCookie(...cookies);
            }

            console.log("🧹 Page cookies cleared");
        }
    } catch (error) {
        console.warn("⚠️ Could not clear browser cookies/cache:", error.message);
    }
}

async function clickConfirmButton({ origin, msisdn, client_ip }) {
    let page;

    try {
        if (!origin || !msisdn) {
            throw new Error("origin and msisdn are required");
        }

        const consentUrl = getConsentUrl(origin);
        const browser = await getBrowser();

        page = await browser.newPage();

        page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);
        page.setDefaultTimeout(SELECTOR_TIMEOUT);

        await page.setViewport({
            width: 1280,
            height: 900,
        });

        await page.setExtraHTTPHeaders({
            MSISDN: String(msisdn),
            ...(client_ip
                ? { "X-Forwarded-For": String(client_ip) }
                : {}),
        });

        console.log("🍪 Cookies at start:", (await page.cookies()).length);
        console.log("📍 Origin:", origin);

        const response = await navigateWithDiagnostics(page, consentUrl);

        if (response && response.status() >= 400) {
            throw new Error(`Consent page returned HTTP ${response.status()}`);
        }

         const controls = await page.evaluate(() => {
            return Array.from(
                document.querySelectorAll("button, input, [role='button']")
            ).map((el) => ({
                tag: el.tagName,
                id: el.id || "",
                name: el.getAttribute("name") || "",
                type: el.getAttribute("type") || "",
                className: el.className || "",
                text: (el.innerText || el.value || "").trim(),
                disabled: !!el.disabled,
                visible: !!(
                    el.offsetWidth ||
                    el.offsetHeight ||
                    el.getClientRects().length
                )
            }));
        });

        console.log("🔎 Consent controls:");
        console.dir(controls, { depth: null });
        const confirmButton = await page.waitForSelector(
            "button.btn.btn-brand.mb-3",
            {
                visible: true,
                timeout: 15000,
            }
        );

        if (!confirmButton) {
            throw new Error("Confirm button not found");
        }

    console.log("✅ Confirm button found — clicking...");

    await confirmButton.click();
        await sleep(6000);
        const cookiesAfter = await page.cookies();
        console.log("🍪 Cookies before clear:", cookiesAfter.length);

        // Navigation and cookie creation do not prove a successful subscription.
        // Verify the actual result through the provider's status API/callback.
        return false;
    } catch (error) {
        console.error("❌ Automation failed:", {
            msisdn: msisdn ? String(msisdn).slice(-4) : "unknown",
            origin,
            message: error.message,
        });

        return false;
    } finally {
        if (page) {
            try {
                await clearCookiesAndCache(page);
            } catch (error) {
                console.warn("Cleanup error:", error.message);
            }

            try {
                if (!page.isClosed()) {
                    await page.close();
                }
            } catch (error) {
                console.warn("Page close error:", error.message);
            }
        }
    }
}

module.exports = clickConfirmButton;
