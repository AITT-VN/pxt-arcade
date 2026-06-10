import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
} from "@aws-sdk/lib-dynamodb";
import {
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import type { Readable } from "node:stream";
import type { ScriptRecord } from "./types.js";

const TABLE = process.env.SCRIPTS_TABLE!;
const BUCKET = process.env.ASSETS_BUCKET!;
// Prefix (folder) trong bucket, vd "gamelab-projects/". Chuẩn hoá để luôn
// kết thúc bằng "/" và không bắt đầu bằng "/".
const PREFIX = normalizePrefix(process.env.ASSETS_PREFIX || "");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
});
const s3 = new S3Client({});

const textKey = (id: string) => `${PREFIX}text/${id}.json`;
const thumbKey = (id: string) => `${PREFIX}thumb/${id}`;

function normalizePrefix(p: string): string {
    let out = p.replace(/^\/+/, "");
    if (out && !out.endsWith("/")) out += "/";
    return out;
}

/**
 * Ghi metadata vào DynamoDB. Dùng điều kiện attribute_not_exists để đảm bảo
 * id là duy nhất; ném lỗi đặc biệt khi đụng độ để tầng trên thử id khác.
 */
export class IdCollisionError extends Error {}

export async function putRecordIfAbsent(record: ScriptRecord): Promise<void> {
    try {
        await ddb.send(
            new PutCommand({
                TableName: TABLE,
                Item: record,
                ConditionExpression: "attribute_not_exists(id)",
            })
        );
    } catch (err) {
        if (err instanceof ConditionalCheckFailedException) {
            throw new IdCollisionError(record.id);
        }
        throw err;
    }
}

export async function getRecord(id: string): Promise<ScriptRecord | undefined> {
    const res = await ddb.send(
        new GetCommand({ TableName: TABLE, Key: { id } })
    );
    return res.Item as ScriptRecord | undefined;
}

/** Lưu nội dung các file project (chuỗi JSON đã stringify sẵn). */
export async function putText(id: string, textJson: string): Promise<void> {
    await s3.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key: textKey(id),
            Body: textJson,
            ContentType: "application/json",
        })
    );
}

export async function getText(id: string): Promise<string | undefined> {
    try {
        const res = await s3.send(
            new GetObjectCommand({ Bucket: BUCKET, Key: textKey(id) })
        );
        return await streamToString(res.Body as Readable);
    } catch (err) {
        if (isNotFound(err)) return undefined;
        throw err;
    }
}

export async function putThumb(
    id: string,
    base64: string,
    mime: string
): Promise<void> {
    await s3.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key: thumbKey(id),
            Body: Buffer.from(base64, "base64"),
            ContentType: mime,
        })
    );
}

export async function getThumb(
    id: string
): Promise<{ body: Buffer; mime: string } | undefined> {
    try {
        const res = await s3.send(
            new GetObjectCommand({ Bucket: BUCKET, Key: thumbKey(id) })
        );
        const body = await streamToBuffer(res.Body as Readable);
        return { body, mime: res.ContentType || "image/png" };
    } catch (err) {
        if (isNotFound(err)) return undefined;
        throw err;
    }
}

function isNotFound(err: unknown): boolean {
    const name = (err as { name?: string })?.name;
    const code = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata
        ?.httpStatusCode;
    return name === "NoSuchKey" || name === "NotFound" || code === 404;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

async function streamToString(stream: Readable): Promise<string> {
    return (await streamToBuffer(stream)).toString("utf-8");
}
