import { randomBytes } from "node:crypto";

// Bảng base62, tránh ký tự dễ nhầm sẽ không cần vì id chỉ dùng nội bộ/URL.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Sinh shortid dạng "_" + 12 ký tự base62, giống định dạng của makecode.com
 * (vd "_JHw4cP1peDvH"). Tiền tố "_" giúp CloudFront nhận diện URL chia sẻ.
 */
export function generateShortId(length = 12): string {
    const bytes = randomBytes(length);
    let out = "_";
    for (let i = 0; i < length; i++) {
        out += ALPHABET[bytes[i] % ALPHABET.length];
    }
    return out;
}

/** Kiểm tra id hợp lệ để chống path traversal / input rác. */
export function isValidShortId(id: string): boolean {
    return /^_[A-Za-z0-9]{6,40}$/.test(id);
}
