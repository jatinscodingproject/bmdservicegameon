const { getBrowser } = require("./browsermanager");

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const normalizeOrigin = (origin = "") =>
  origin.replace(/^https:\/\//i, "http://");

async function clearCookiesAndCache(page) {
  const client = await page.target().createCDPSession();
  await client.send("Network.clearBrowserCookies");
  await client.send("Network.clearBrowserCache");
  console.log("🧹 Cookies & cache cleared");
}

const clickConfirmButton = async ({ origin, msisdn, client_ip }) => {
  let page;

  try {
    origin = normalizeOrigin(origin);

    const browser = await getBrowser();
    page = await browser.newPage();

    await page.setViewport({ width: 1280, height: 900 });
    await page.setBypassCSP(true);

    await page.setExtraHTTPHeaders({
      MSISDN: msisdn,
      "X-Forwarded-For": client_ip,
    });

    console.log("🍪 Cookies at start:", (await page.cookies()).length);

    if (origin.includes("gameon.trickso.com")) {
      await page.goto(origin, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      await sleep(3000);

      // Click "Subscribe Now" button
      await page.waitForSelector("button", {
        timeout: 10000,
      });

      const buttons = await page.$$("button");

      let clicked = false;

      for (const button of buttons) {
        const text = await page.evaluate(
          (el) => el.innerText,
          button
        );

        if (text.includes("Subscribe Now")) {
          await button.click();

          clicked = true;

          console.log(`✅ Subscribe button clicked for ${msisdn}`);

          break;
        }
      }

      if (!clicked) {
        throw new Error("Subscribe button not found");
      }

      await sleep(5000);
    }


    else {
      throw new Error("Origin not allowed");
    }

    // ================= CONFIRM =================
    let confirmed = false;
    try {
      await page.waitForSelector("button.confirm", { timeout: 8000 });
      await page.click("button.confirm");
      confirmed = true;
      console.log(`✅ Confirm clicked for ${msisdn}`);
    } catch {
      console.log("⏱️ Confirm button not present");
    }

    await sleep(6000);

    const cookiesAfter = await page.cookies();
    console.log("🍪 Cookies before clear:", cookiesAfter.length);

    const success =
      confirmed ||
      cookiesAfter.length > 0 ||
      page.url().includes("success") ||
      page.url().includes("register");

    // 🔥 CLEAR COOKIES FOR NEXT USER
    await clearCookiesAndCache(page);

    await page.close();

    return success;
  } catch (err) {
    console.error("❌ Automation failed:", err.message);
    if (page) await page.close();
    return false;
  }
};

module.exports = clickConfirmButton;
