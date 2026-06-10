import { generateShortId } from "./shortid.js";
import {
    IdCollisionError,
    getRecord,
    putRecordIfAbsent,
    putText,
    putThumb,
} from "./storage.js";
import {
    recordToJsonScript,
    type JsonScript,
    type JsonScriptRequest,
    type ScriptRecord,
} from "./types.js";

const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 3_145_728);
const RETENTION_DAYS = Number(process.env.RETENTION_DAYS || 0);
const TARGET_ID = process.env.TARGET_ID || "arcade";
const MAX_NAME_LEN = 256;
const MAX_DESCRIPTION_LEN = 1024;

export class ValidationError extends Error {}

/** Tạo project chia sẻ mới từ payload của editor. */
export async function createScript(
    req: JsonScriptRequest
): Promise<JsonScript> {
    if (!req || typeof req !== "object") {
        throw new ValidationError("Payload không hợp lệ.");
    }
    if (!req.name || typeof req.name !== "string") {
        throw new ValidationError("Thiếu tên dự án.");
    }
    if (!req.text || typeof req.text !== "string") {
        throw new ValidationError("Thiếu nội dung dự án.");
    }
    // Chống lưu target lạ (chỉ phục vụ GameLab/arcade).
    if (req.target && req.target !== TARGET_ID) {
        throw new ValidationError(`Target không được hỗ trợ: ${req.target}`);
    }

    // text phải là JSON hợp lệ chứa map các file.
    let files: Record<string, unknown>;
    try {
        files = JSON.parse(req.text);
    } catch {
        throw new ValidationError("Trường text không phải JSON hợp lệ.");
    }
    if (!files || typeof files !== "object" || Array.isArray(files)) {
        throw new ValidationError("Trường text phải là map các file.");
    }

    const textBytes = Buffer.byteLength(req.text, "utf-8");
    if (textBytes > MAX_BODY_BYTES) {
        throw new ValidationError("Dự án quá lớn để chia sẻ.");
    }

    const now = Math.floor(Date.now() / 1000);
    const record: ScriptRecord = {
        id: "", // gán bên dưới
        kind: "script",
        time: now,
        name: clamp(req.name, MAX_NAME_LEN),
        description: clamp(req.description || "", MAX_DESCRIPTION_LEN),
        target: req.target || TARGET_ID,
        targetVersion: req.targetVersion,
        editor: req.editor,
        meta: req.meta,
        header: req.header,
    };

    const thumb = parseThumb(req);
    if (thumb) {
        record.thumb = true;
        record.thumbMime = thumb.mime;
    }
    if (RETENTION_DAYS > 0) {
        record.expireAt = now + RETENTION_DAYS * 86_400;
    }

    // Sinh id duy nhất, thử lại nếu đụng độ (cực hiếm).
    let id = "";
    for (let attempt = 0; attempt < 6; attempt++) {
        id = generateShortId();
        record.id = id;
        try {
            await putRecordIfAbsent(record);
            break;
        } catch (err) {
            if (err instanceof IdCollisionError && attempt < 5) continue;
            throw err;
        }
    }

    // Ghi nội dung file + thumbnail vào S3 sau khi đã chốt id.
    await putText(id, req.text);
    if (thumb) {
        await putThumb(id, thumb.base64, thumb.mime);
    }

    return recordToJsonScript(record);
}

export async function getScriptMeta(
    id: string
): Promise<JsonScript | undefined> {
    const record = await getRecord(id);
    return record ? recordToJsonScript(record) : undefined;
}

function parseThumb(
    req: JsonScriptRequest
): { base64: string; mime: string } | undefined {
    if (!req.thumbnailBuffer || !req.thumbnailMimeType) return undefined;
    if (!/^image\/(png|gif|jpeg)$/.test(req.thumbnailMimeType)) return undefined;
    if (!/^[A-Za-z0-9+/]+=*$/.test(req.thumbnailBuffer)) return undefined;
    return { base64: req.thumbnailBuffer, mime: req.thumbnailMimeType };
}

function clamp(s: string, max: number): string {
    return s.length > max ? s.substring(0, max) : s;
}
