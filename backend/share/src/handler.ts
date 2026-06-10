import type {
    APIGatewayProxyEventV2,
    APIGatewayProxyResultV2,
} from "aws-lambda";
import { gunzipSync } from "node:zlib";
import { createScript, getScriptMeta, ValidationError } from "./scripts.js";
import { getText, getThumb } from "./storage.js";
import { isValidShortId } from "./shortid.js";

const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 3_145_728);

const JSON_HEADERS = {
    "content-type": "application/json; charset=utf-8",
    // /api được phục vụ same-origin qua CloudFront ở prod; CORS để mở cho
    // trường hợp dev (localhost) gọi sang API đã deploy.
    "access-control-allow-origin": "*",
};

export async function handler(
    event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
    const method = event.requestContext.http.method;
    const routeKey = event.routeKey; // vd "POST /api/scripts"

    try {
        if (method === "POST" && routeKey === "POST /api/scripts") {
            return await handleCreate(event);
        }
        if (method === "GET" && routeKey === "GET /api/{id}/text") {
            return await handleGetText(event);
        }
        if (method === "GET" && routeKey === "GET /api/{id}/thumb") {
            return await handleGetThumb(event);
        }
        if (method === "GET" && routeKey === "GET /api/{id}") {
            return await handleGetMeta(event);
        }
        return json(404, { error: "Not found" });
    } catch (err) {
        if (err instanceof ValidationError) {
            return json(400, { error: err.message });
        }
        console.error("Unhandled error", err);
        return json(500, { error: "Internal error" });
    }
}

async function handleCreate(
    event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
    const raw = readBody(event);
    if (raw.length > MAX_BODY_BYTES) {
        return json(413, { error: "Payload quá lớn" });
    }
    let payload: unknown;
    try {
        payload = JSON.parse(raw.toString("utf-8"));
    } catch {
        return json(400, { error: "Body không phải JSON hợp lệ" });
    }
    const script = await createScript(payload as never);
    return json(200, script);
}

async function handleGetMeta(
    event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
    const id = idParam(event);
    if (!id) return json(400, { error: "id không hợp lệ" });
    const meta = await getScriptMeta(id);
    if (!meta) return json(404, { error: "Not found" });
    return json(200, meta);
}

async function handleGetText(
    event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
    const id = idParam(event);
    if (!id) return json(400, { error: "id không hợp lệ" });
    const text = await getText(id);
    if (text === undefined) return json(404, { error: "Not found" });
    // Client (downloadScriptFilesAsync) đọc resp.text rồi JSON.parse,
    // nên trả thẳng chuỗi JSON đã lưu.
    return {
        statusCode: 200,
        headers: {
            ...JSON_HEADERS,
            "cache-control": "public, max-age=31536000, immutable",
        },
        body: text,
    };
}

async function handleGetThumb(
    event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
    const id = idParam(event);
    if (!id) return json(400, { error: "id không hợp lệ" });
    const thumb = await getThumb(id);
    if (!thumb) return json(404, { error: "Not found" });
    return {
        statusCode: 200,
        headers: {
            "content-type": thumb.mime,
            "access-control-allow-origin": "*",
            "cache-control": "public, max-age=31536000, immutable",
        },
        isBase64Encoded: true,
        body: thumb.body.toString("base64"),
    };
}

/** Lấy id từ path param, kiểm tra hợp lệ để tránh input rác. */
function idParam(event: APIGatewayProxyEventV2): string | undefined {
    const id = event.pathParameters?.id;
    if (!id) return undefined;
    return isValidShortId(id) ? id : undefined;
}

/** Đọc body, giải nén gzip nếu editor gửi kèm (allowGzipPost). */
function readBody(event: APIGatewayProxyEventV2): Buffer {
    if (!event.body) return Buffer.alloc(0);
    const buf = event.isBase64Encoded
        ? Buffer.from(event.body, "base64")
        : Buffer.from(event.body, "utf-8");
    const encoding =
        event.headers?.["content-encoding"] ||
        event.headers?.["Content-Encoding"];
    if (encoding && encoding.toLowerCase().includes("gzip")) {
        return gunzipSync(buf);
    }
    return buf;
}

function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
    return {
        statusCode,
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
    };
}
