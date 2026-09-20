require("dotenv").config();

const { startBot } = require("./bot");

startBot().catch((error) => {
  console.error("DIANA V12 startup error:", error);
  process.exit(1);
});
