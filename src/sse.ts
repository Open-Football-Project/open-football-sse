import express from "express";
import cors from "cors";
import { registerChannel } from "./channel-manager/channel-manager";

const app = express();
app.use(cors());

const PORT = 5005;
const API_HOST = process.env.API_HOST ?? "http://localhost:8080";

const EVENTS_REFRESH = process.env.EVENTS_REFRESH ? Number(process.env.EVENTS_REFRESH) : 40000;
const CHARTS_REFRESH = process.env.CHARTS_REFRESH ? Number(process.env.CHARTS_REFRESH) : 180000;

registerChannel(app, "/events", `${API_HOST}/api/live/events`, EVENTS_REFRESH);
registerChannel(app, "/events/charts", `${API_HOST}/api/charts/all`, CHARTS_REFRESH);
registerChannel(app, "/events/charts/odds", `${API_HOST}/api/charts/odds/fixtures`, CHARTS_REFRESH);

app.listen(PORT, () => {
  console.log("SSE server running on port", PORT);
});
