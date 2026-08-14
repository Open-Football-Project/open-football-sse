import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { Express } from "express";
import { registerChannel } from "./channel-manager";
import { sseService } from "../service/SEEService";
import { customReqHandler } from "../handler/custom-req-handler";

jest.mock("../service/SEEService");
jest.mock("../handler/custom-req-handler");

const mockedSseService = sseService as jest.MockedFunction<typeof sseService>;
const mockedCustomReqHandler = customReqHandler as jest.MockedFunction<typeof customReqHandler>;

function makeMockApp(): Express {
    return { get: jest.fn() } as unknown as Express;
}

describe("registerChannel tests", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(global, "setInterval").mockImplementation(() => 0 as unknown as NodeJS.Timeout);
    });

    it("builds the sse service from the given endpoint", () => {
        mockedSseService.mockReturnValue({
            addNewClient: jest.fn(),
            removeClient: jest.fn(),
            broadcast: jest.fn(),
            fetchEvents: jest.fn<() => Promise<unknown>>(),
        });
        const app = makeMockApp();

        registerChannel(app, "/events", "http://api/events", 1000);

        expect(mockedSseService).toHaveBeenCalledWith("http://api/events");
    });

    it("registers the route with the handler built from addNewClient and a refresh function", () => {
        const addNewClient = jest.fn();
        mockedSseService.mockReturnValue({
            addNewClient,
            removeClient: jest.fn(),
            broadcast: jest.fn(),
            fetchEvents: jest.fn<() => Promise<unknown>>(),
        });
        const fakeHandler = jest.fn();
        mockedCustomReqHandler.mockReturnValue(fakeHandler);
        const app = makeMockApp();

        registerChannel(app, "/events", "http://api/events", 1000);

        expect(mockedCustomReqHandler).toHaveBeenCalledWith(addNewClient, expect.any(Function));
        expect(app.get).toHaveBeenCalledWith("/events", fakeHandler);
    });

    it("schedules refresh on the given interval", () => {
        mockedSseService.mockReturnValue({
            addNewClient: jest.fn(),
            removeClient: jest.fn(),
            broadcast: jest.fn(),
            fetchEvents: jest.fn<() => Promise<unknown>>(),
        });
        const app = makeMockApp();
        const setIntervalSpy = jest.spyOn(global, "setInterval");

        registerChannel(app, "/events", "http://api/events", 5000);

        expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
    });

    it("fetches and broadcasts data when refresh runs successfully", async () => {
        const broadcast = jest.fn();
        const fetchEvents = jest.fn<() => Promise<unknown>>().mockResolvedValue({ some: "data" });
        mockedSseService.mockReturnValue({
            addNewClient: jest.fn(),
            removeClient: jest.fn(),
            broadcast,
            fetchEvents,
        });
        const app = makeMockApp();

        registerChannel(app, "/events", "http://api/events", 1000);
        const refresh = mockedCustomReqHandler.mock.calls[0][1] as () => Promise<void>;
        await refresh();

        expect(fetchEvents).toHaveBeenCalled();
        expect(broadcast).toHaveBeenCalledWith({ some: "data" });
    });

    it("logs an error and does not broadcast when fetchEvents rejects", async () => {
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        const broadcast = jest.fn();
        const fetchEvents = jest.fn<() => Promise<unknown>>().mockRejectedValue(new Error("boom"));
        mockedSseService.mockReturnValue({
            addNewClient: jest.fn(),
            removeClient: jest.fn(),
            broadcast,
            fetchEvents,
        });
        const app = makeMockApp();

        registerChannel(app, "/events", "http://api/events", 1000);
        const refresh = mockedCustomReqHandler.mock.calls[0][1] as () => Promise<void>;
        await refresh();

        expect(consoleSpy).toHaveBeenCalledWith("Spring API error", expect.any(Error));
        expect(broadcast).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
    });
});
