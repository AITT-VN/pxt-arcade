// Các kiểu dữ liệu khớp với contract sharing của pxt.
// Tham khảo: pxt/pxtlib/emitter/cloud.ts (JsonScript) và
// pxt/webapp/src/workspace.ts (getScriptRequest -> payload POST).

/** Payload mà editor gửi lên khi bấm Share (anonymousPublishAsync). */
export interface JsonScriptRequest {
    id?: string;
    shareId?: string;
    name: string;
    target?: string;
    targetVersion?: string;
    description?: string;
    editor?: string;
    /** JSON.stringify(header) — metadata cục bộ, lưu nguyên văn. */
    header?: string;
    /** JSON.stringify({ "main.blocks": "...", "main.ts": "...", ... }) */
    text: string;
    meta?: JsonScriptMeta;
    /** base64 (không có tiền tố data:) của ảnh thumbnail, nếu có. */
    thumbnailBuffer?: string;
    /** vd "image/png" | "image/gif" */
    thumbnailMimeType?: string;
}

export interface JsonScriptMeta {
    versions?: unknown;
    blocksHeight?: number;
    blocksWidth?: number;
}

/** Đối tượng trả về cho client (pxt.cloud.JsonScript). */
export interface JsonScript {
    kind: "script";
    id: string;
    shortid: string;
    time: number; // epoch giây
    name: string;
    description: string;
    target?: string;
    targetVersion?: string;
    editor?: string;
    meta?: JsonScriptMeta;
    thumb?: boolean;
}

/** Bản ghi lưu trong DynamoDB (metadata; nội dung file để ở S3). */
export interface ScriptRecord {
    id: string;
    kind: "script";
    time: number;
    name: string;
    description: string;
    target?: string;
    targetVersion?: string;
    editor?: string;
    meta?: JsonScriptMeta;
    header?: string;
    thumb?: boolean;
    thumbMime?: string;
    /** TTL (epoch giây) — chỉ set khi RETENTION_DAYS > 0. */
    expireAt?: number;
}

export function recordToJsonScript(r: ScriptRecord): JsonScript {
    return {
        kind: "script",
        id: r.id,
        shortid: r.id,
        time: r.time,
        name: r.name,
        description: r.description,
        target: r.target,
        targetVersion: r.targetVersion,
        editor: r.editor,
        meta: r.meta,
        thumb: r.thumb,
    };
}
