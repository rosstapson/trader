import express from "express";
import cors from "cors";
import { loadConfig } from "@trader/config";
import { companiesRouter } from "./routes/companies.js";
import { errorHandler } from "./error-handler.js";

const config = loadConfig();
const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/companies", companiesRouter);

app.use(errorHandler);

app.listen(config.PORT, () => {
  console.log(`API listening on http://localhost:${config.PORT}`);
});
