import axios from "axios";
import { randomUUID } from "crypto";
import { Request, Response } from "express";
import { SSEClient, FlushableResponse } from "../types/types";

export const sseService = (eventsEndpoint: string) => {

    const clients: SSEClient[] = [];

    const flushResponse = (res: FlushableResponse): void => {
        res.flush?.();
    };

    const addNewClient = (req: Request, res: Response) => {
        const clientId = randomUUID();
        clients.push({ id: clientId, res });

        console.log("Client connected:", clientId);

        req.on("close", () => {
            removeClient(clientId);
        });
    };

    const removeClient = (id: string) => {
        const index = clients.findIndex(c => c.id === id);
        if (index !== -1) {
            clients.splice(index, 1);
        }
        console.log("Client disconnected:", id);
    };

    const broadcast = (data: unknown) => {
        const failedIds: string[] = [];
        clients.forEach((c: SSEClient) => {
            try {
                c.res.write(`data: ${JSON.stringify(data)}\n\n`);
                flushResponse(c.res as FlushableResponse);
            } catch (err) {
                console.error("Failed to write to client:", c.id, err);
                failedIds.push(c.id);
            }
        });
        failedIds.forEach(removeClient);
        console.log("Broadcasted to clients:", clients.length - failedIds.length, "failed:", failedIds.length);
    };

    const fetchEvents = async () => {
        const response = await axios.get(eventsEndpoint);
        return response.data;
    };

    return {
        addNewClient,
        removeClient,
        broadcast,
        fetchEvents
    };

};
