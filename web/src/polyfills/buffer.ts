import { Buffer } from "buffer/";

const globalWithBuffer = globalThis as unknown as {
    Buffer?: unknown;
};

if (globalWithBuffer.Buffer === undefined) {
    globalWithBuffer.Buffer = Buffer;
}