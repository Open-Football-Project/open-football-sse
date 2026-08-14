import axios from "axios";
import { sseService } from "./SEEService";
import { describe, it, expect, jest } from "@jest/globals";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

function makeMockRes() {
    return {
        write: jest.fn(),
    };
}

function makeMockReq() {
    const listeners: Record<string, Array<() => void>> = {};
    return {
        on: jest.fn((event: string, cb: () => void) => {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(cb);
        }),
        emit: (event: string) => listeners[event]?.forEach(cb => cb()),
    };
}

describe("sseService", () => {
    const endpoint = "http://test-api/events";

    describe("addNewClient", () => {
        it("registers a client and logs connection", () => {
            const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
            const { addNewClient, broadcast } = sseService(endpoint);
            const req = makeMockReq();
            const res = makeMockRes();

            addNewClient(req as any, res as any);
            broadcast("hello");

            expect(res.write).toHaveBeenCalledWith('data: "hello"\n\n');
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Client connected:"), expect.any(String));
            consoleSpy.mockRestore();
        });

        it("registers the close listener on the request", () => {
            const { addNewClient } = sseService(endpoint);
            const req = makeMockReq();
            const res = makeMockRes();

            addNewClient(req as any, res as any);

            expect(req.on).toHaveBeenCalledWith("close", expect.any(Function));
        });

        it("removes client automatically when request closes", () => {
            const { addNewClient, broadcast } = sseService(endpoint);
            const req = makeMockReq();
            const res = makeMockRes();

            addNewClient(req as any, res as any);
            req.emit("close");
            broadcast("after disconnect");

            expect(res.write).not.toHaveBeenCalledWith('data: "after disconnect"\n\n');
        });
    });

    describe("removeClient", () => {
        it("removes an existing client by id", () => {
            const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
            const { addNewClient, removeClient, broadcast } = sseService(endpoint);
            const req = makeMockReq();
            const res = makeMockRes();

            addNewClient(req as any, res as any);
            const capturedId = consoleSpy.mock.calls.find(
                call => String(call[0]).includes("Client connected:")
            )?.[1];
            removeClient(capturedId);
            broadcast("test");

            expect(res.write).not.toHaveBeenCalled();
            consoleSpy.mockRestore();
            jest.restoreAllMocks();
        });

        it("is a no-op when id does not exist", () => {
            const { removeClient } = sseService(endpoint);
            const req = makeMockReq();
            const res = makeMockRes();

            const service = sseService(endpoint);
            service.addNewClient(req as any, res as any);

            expect(() => removeClient("non-existent-uuid")).not.toThrow();
        });
    });

    describe("broadcast", () => {
        it("sends JSON-formatted SSE data to all connected clients", () => {
            const { addNewClient, broadcast } = sseService(endpoint);

            const req1 = makeMockReq();
            const res1 = makeMockRes();
            const req2 = makeMockReq();
            const res2 = makeMockRes();

            addNewClient(req1 as any, res1 as any);
            addNewClient(req2 as any, res2 as any);

            const payload = { score: "1-0" };
            broadcast(payload);

            const expected = `data: ${JSON.stringify(payload)}\n\n`;
            expect(res1.write).toHaveBeenCalledWith(expected);
            expect(res2.write).toHaveBeenCalledWith(expected);
        });

        it("removes and skips clients that throw on write", () => {
            const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
            const { addNewClient, broadcast } = sseService(endpoint);

            const req1 = makeMockReq();
            const res1 = makeMockRes();
            const req2 = makeMockReq();
            const res2 = makeMockRes();

            addNewClient(req1 as any, res1 as any);
            addNewClient(req2 as any, res2 as any);

            res1.write.mockImplementationOnce(() => { throw new Error("socket closed"); });

            broadcast("event");

            expect(res2.write).toHaveBeenCalledTimes(1);

            broadcast("event2");
            expect(res1.write).toHaveBeenCalledTimes(1); 

            consoleSpy.mockRestore();
        });

        it("does nothing when there are no clients", () => {
            const { broadcast } = sseService(endpoint);
            expect(() => broadcast({ foo: "bar" })).not.toThrow();
        });
    });

    describe("fetchEvents", () => {
        it("calls the configured endpoint and returns response data", async () => {
            const mockData = [{ id: 1, homeTeamName: "Team A", awayTeamName: "Team B" }];
            mockedAxios.get.mockResolvedValueOnce({ data: mockData } as any);

            const { fetchEvents } = sseService(endpoint);
            const result = await fetchEvents();

            expect(mockedAxios.get).toHaveBeenCalledWith(endpoint);
            expect(result).toEqual(mockData);
        });

        it("propagates errors from axios", async () => {
            mockedAxios.get.mockRejectedValueOnce(new Error("Network error"));

            const { fetchEvents } = sseService(endpoint);

            await expect(fetchEvents()).rejects.toThrow("Network error");
        });
    });
});
