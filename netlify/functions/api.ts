import serverless from "serverless-http";
import { createApp } from "../../backend/dist/app.js";

process.env.NETLIFY = "true";

const app = createApp();
export const handler = serverless(app);
