import { Response } from "express";

export interface SSEClient {
    id: string;
    res: Response;
}
export interface FlushableResponse extends Response {
     flush?: () => void;
}