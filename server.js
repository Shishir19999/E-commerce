import dotenv from "dotenv";
//dotenv file (must run before modules read process.env at import time)
dotenv.config({ quiet: true });

const { default: connectDb } = await import("./config/db.js");
const { default: app } = await import("./app.js");

//Database
connectDb();

//PORT from env file
const PORT = process.env.PORT || 3000;

//run listen
app.listen(PORT, () => {
  console.log(`server is running on ${process.env.DEV_MODE} mode on port ${PORT}`);
});
