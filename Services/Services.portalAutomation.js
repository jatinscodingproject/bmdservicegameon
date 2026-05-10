const { getBrowser } = require("./browsermanager");

const sleep = (ms) =>
  new Promise((res) => setTimeout(res, ms));

const normalizeOrigin = (origin = "") =>
  origin
    .replace(/^https:\/\//i, "http://")
    .replace(/"/g, "")
    .trim();

async function clearCookiesAndCache(page) {
  try {
    const client =
      await page.target().createCDPSession();

    await client.send(
      "Network.clearBrowserCookies"
    );

    await client.send(
      "Network.clearBrowserCache"
    );

    console.log(
      "🧹 Cookies & cache cleared"
    );
  } catch (err) {
    console.log(
      "⚠️ Cache clear failed:",
      err.message
    );
  }
}

const clickConfirmButton = async ({
  origin,
  msisdn,
  client_ip,
}) => {
  let page;
  let clicked = false;

  try {
    origin = normalizeOrigin(origin);

    console.log("🌍 Opening:", origin);

    const browser = await getBrowser();

    page = await browser.newPage();

    await page.setViewport({
      width: 1366,
      height: 768,
    });

    await page.setBypassCSP(true);

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"
    );

    await page.setExtraHTTPHeaders({
      MSISDN: msisdn,
      "X-Forwarded-For": client_ip,
    });

    console.log(
      "🍪 Cookies at start:",
      (await page.cookies()).length
    );

    // ================= GAMEON =================
    if (
      origin.includes(
        "gameon.trickso.com"
      )
    ) {
      await page.goto(origin, {
        waitUntil: "networkidle2",
        timeout: 60000,
      });

      console.log("✅ Page loaded");

      await sleep(5000);

      // ================= FIND BUTTON =================
      console.log(
        "🔍 Searching subscribe button..."
      );

      await page.waitForSelector(
        "button",
        {
          visible: true,
          timeout: 20000,
        }
      );

      const buttons =
        await page.$$("button");

      console.log(
        `🔘 Total buttons found: ${buttons.length}`
      );

      let button = null;

      for (const btn of buttons) {
        const text =
          await page.evaluate(
            (el) =>
              el.innerText?.trim(),
            btn
          );

        const className =
          await page.evaluate(
            (el) => el.className,
            btn
          );

        console.log(
          "BUTTON TEXT:",
          text
        );

        console.log(
          "BUTTON CLASS:",
          className
        );

        if (
          text &&
          text
            .toLowerCase()
            .includes("subscribe")
        ) {
          button = btn;

          console.log(
            "✅ Subscribe button matched"
          );

          break;
        }
      }

      if (!button) {
        throw new Error(
          "Subscribe button not found"
        );
      }

      // ================= SCROLL =================
      await button.evaluate((el) => {
        el.scrollIntoView({
          block: "center",
          behavior: "smooth",
        });
      });

      await sleep(2000);

      // ================= GET POSITION =================
      const box =
        await button.boundingBox();

      if (!box) {
        throw new Error(
          "Button bounding box not found"
        );
      }

      // ================= MULTIPLE REAL CLICKS =================
      for (let i = 1; i <= 2; i++) {
        console.log(
          `🖱️ Clicking subscribe button ${i}`
        );

        await page.mouse.move(
          box.x + box.width / 2,
          box.y + box.height / 2
        );

        await sleep(300);

        await page.mouse.click(
          box.x + box.width / 2,
          box.y + box.height / 2,
          {
            delay: 150,
          }
        );

        await sleep(2500);
      }

      clicked = true;

      console.log(
        `✅ Subscribe button physically clicked for ${msisdn}`
      );

      await sleep(10000);

      console.log(
        "🌍 Current URL:",
        page.url()
      );
    } else {
      throw new Error(
        "Origin not allowed"
      );
    }

    // ================= SUCCESS CHECK =================
    const cookiesAfter =
      await page.cookies();

    console.log(
      "🍪 Cookies before clear:",
      cookiesAfter.length
    );

    const currentUrl = page.url();

    console.log(
      "🌍 Final URL:",
      currentUrl
    );

    const pageContent =
      await page.content();

    const success =
      clicked ||
      cookiesAfter.length > 0 ||
      currentUrl.includes(
        "success"
      ) ||
      currentUrl.includes(
        "thank"
      ) ||
      currentUrl.includes(
        "register"
      ) ||
      currentUrl.includes(
        "consent"
      ) ||
      currentUrl.includes(
        "subscribe"
      ) ||
      pageContent
        .toLowerCase()
        .includes("success") ||
      pageContent
        .toLowerCase()
        .includes("subscribed") ||
      pageContent
        .toLowerCase()
        .includes("thank you");

    console.log(
      "✅ SUCCESS STATUS:",
      success
    );

    // ================= CLEAR =================
    await clearCookiesAndCache(page);

    await page.close();

    return success;
  } catch (err) {
    console.error(
      "❌ Automation failed:",
      err.message
    );

    if (page) {
      try {
        await page.close();
      } catch {}
    }

    return false;
  }
};

module.exports = clickConfirmButton;