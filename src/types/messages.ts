export enum SSEStatusCode {
    InternalServerError = 500,
}

export const SSEMessages = {
    ClientInitFailed: "Failed to initialize SSE client",
    InternalServerError: "Internal server error",
} as const;
