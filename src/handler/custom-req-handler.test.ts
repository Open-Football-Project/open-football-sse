import { describe, it, expect, jest } from "@jest/globals";
import { Request, Response } from "express";
import { customReqHandler } from "./custom-req-handler";

type MockResponse = Response & {
    setHeader: jest.Mock;
    status: jest.Mock;
    json: jest.Mock;
    end: jest.Mock;
};

function makeMockRes(headersSent: boolean): MockResponse {
    return {
        setHeader: jest.fn(),
        headersSent,
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        end: jest.fn(),
    } as unknown as MockResponse;
}

const mockReq = {} as Request;

describe("customReqHandler tests", () => {
    it("sets SSE headers, registers the client, and triggers a refresh on success", () => {
        const addNewClient = jest.fn<(req: Request, res: Response) => void>();
        const refresh = jest.fn();
        const res = makeMockRes(false);

        const handler = customReqHandler(addNewClient, refresh);
        handler(mockReq, res);

        expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
        expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-cache");
        expect(res.setHeader).toHaveBeenCalledWith("Connection", "keep-alive");

        expect(addNewClient).toHaveBeenCalledWith(mockReq, res);
        expect(refresh).toHaveBeenCalled();
    });

    it("logs the error and sends a 500 response when addNewClient throws and headers are not sent", () => {
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        const addNewClient = jest.fn<(req: Request, res: Response) => void>(() => {
            throw new Error("Failed to add client");
        });
        const refresh = jest.fn();
        const res = makeMockRes(false);

        const handler = customReqHandler(addNewClient, refresh);
        handler(mockReq, res);

        expect(consoleSpy).toHaveBeenCalledWith("Failed to initialize SSE client", expect.any(Error));
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
        expect(refresh).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
    });

    it("logs the error and closes the connection when addNewClient throws after headers are sent", () => {
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        const addNewClient = jest.fn<(req: Request, res: Response) => void>(() => {
            throw new Error("Write error");
        });
        const refresh = jest.fn();
        const res = makeMockRes(true);

        const handler = customReqHandler(addNewClient, refresh);
        handler(mockReq, res);

        expect(consoleSpy).toHaveBeenCalledWith("Failed to initialize SSE client", expect.any(Error));
        expect(res.end).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
    });
});
