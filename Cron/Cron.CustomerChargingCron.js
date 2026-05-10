const cron = require("node-cron");
const clickConfirmButton = require("../Services/Services.portalAutomation");
const { Op } = require("sequelize");
const gameon = require("../Models/models.gameon");

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const DAILY_LIMIT = 300;

let isRunning = false;

cron.schedule("* * * * *", async () => {
  if (isRunning) {
    console.log("⏸️ Cron already running, skipping");
    return;
  }

  isRunning = true;
  console.log("▶️ Charging loop started");

  try {
    // Get all unique origins
    const origins = [
      'http://gameon.trickso.com/subscribe"',
    ];
    for (const origin of origins) {
      console.log(`🚀 Processing ${origin}`);

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const todayChargedCount = await gameon.count({
        where: {
          origin,
          is_chargin: 1,
          updatedAt: {
            [Op.between]: [startOfDay, endOfDay],
          },
        },
      });

      console.log(`📊 Today's charged count: ${todayChargedCount}`);

      // Skip if limit reached
      if (todayChargedCount >= DAILY_LIMIT) {
        console.log(`⛔ Daily limit reached for ${origin}`);
        continue;
      }

      // Remaining allowed today
      const remaining = DAILY_LIMIT - todayChargedCount;

      // Fetch only remaining users
      const customers = await gameon.findAll({
        where: {
          origin,
          is_chargin: 0,
        },
        limit: remaining,
      });

      if (!customers.length) {
        console.log(`⚠️ No customers found for ${origin}`);
        continue;
      }

      let processed = 0;

      for (const customer of customers) {
        try {
          const success = await clickConfirmButton({
            origin: "http://gameon.trickso.com/subscribe",
            msisdn: customer.msisdn,
            client_ip: "103.247.50.175",
          });

          if (success) {
            await customer.update({
              is_chargin: 1,
            });

            processed++;

            console.log(`✅ ${origin} charged: ${customer.msisdn}`);
          } else {
            await customer.update({
              is_chargin: -1,
            });

            console.log(`❌ Failed: ${customer.msisdn}`);
          }
        } catch (err) {
          console.error(`🔥 Error processing ${customer.msisdn}:`, err);

          await customer.update({
            is_chargin: -1,
          });
        }

        await sleep(800);
      }

      console.log(
        `🔒 ${origin} processed today: ${todayChargedCount + processed}/${DAILY_LIMIT}`
      );
    }
  } catch (err) {
    console.error("🔥 Charging error:", err);
  } finally {
    isRunning = false;
    console.log("⏳ Cycle completed, waiting for next tick");
  }
}); 9