import { Express } from "express";
import { customReqHandler } from "../handler/custom-req-handler";
import { sseService } from "../service/SEEService";

export function registerChannel(app: Express, path: string, endpoint: string, refreshMs: number) {
  const { addNewClient, broadcast, fetchEvents } = sseService(endpoint);

  async function refresh() {
    try {
      const data = await fetchEvents();
      broadcast(data);
    } catch (err) {
      console.error("Spring API error", err);
    }
  }

  app.get(path, customReqHandler(addNewClient, refresh));
  setInterval(refresh, refreshMs);
}
