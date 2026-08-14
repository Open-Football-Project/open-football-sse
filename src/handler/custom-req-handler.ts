import { Request, Response } from "express";
import { SSEMessages, SSEStatusCode } from "../types/messages";

type AddNewClient = (req: Request, res: Response) => void;
type Refresh = () => void;

export function customReqHandler(addNewClient: AddNewClient, refresh: Refresh) {
  return function handleRequest(req: Request, res: Response) {
    try {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      addNewClient(req, res);
      refresh();
    } catch (err) {
      console.error(SSEMessages.ClientInitFailed, err);

      if (!res.headersSent) {
        res.status(SSEStatusCode.InternalServerError).json({ error: SSEMessages.InternalServerError });
      } else {
        res.end();
      }
    }
  };
}
