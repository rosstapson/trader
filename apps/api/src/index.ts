import express from "express";
import cors from "cors";
import { loadConfig } from "@trader/config";
import { companiesRouter } from "./routes/companies.js";
import { watchlistsRouter } from "./routes/watchlists.js";
import { alertsRouter } from "./routes/alerts.js";
import { errorHandler } from "./error-handler.js";
import { startAlertChecker } from "./jobs/alert-checker.js";

const config = loadConfig();
const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/companies", companiesRouter);
app.use("/api/watchlists", watchlistsRouter);
app.use("/api/alerts", alertsRouter);

app.use(errorHandler);

startAlertChecker();

app.listen(config.PORT, () => {
  console.log(`API listening on http://localhost:${config.PORT}`);
});
