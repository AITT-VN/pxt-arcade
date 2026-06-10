// Local server mô phỏng CloudFront cho việc test trang chia sẻ play.html
// mà KHÔNG cần upload S3 / tạo invalidation.
//
//   - phục vụ tĩnh từ built/packaged
//   - /_<id>            -> trả play.html (giống CloudFront Function)
//   - /static/*         -> docs/static/*  (giống rewrite của CloudFront)
//   - /api/*            -> proxy sang backend đã deploy (gamelab.ohstem.vn)
//   - đường dẫn kết thúc "/" -> + index.html
//
// Chạy:  node share-play/local-server.js   (mặc định cổng 7700)
// Mở:    http://localhost:7700/_<id>        (id của một dự án đã chia sẻ thật)

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 7700;
const ROOT = path.resolve(__dirname, "..", "built", "packaged");
const PLAY_HTML = path.resolve(__dirname, "play.html"); // dùng bản nguồn để sửa nhanh
const API_HOST = "gamelab.ohstem.vn"; // backend thật để proxy /api

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png", ".jpg": "image/jpeg", ".gif": "image/gif",
    ".svg": "image/svg+xml", ".ico": "image/x-icon",
    ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
    ".map": "application/json", ".wav": "audio/wav", ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg", ".webmanifest": "application/manifest+json",
    ".manifest": "text/cache-manifest",
};

function send(res, code, body, type) {
    res.writeHead(code, { "Content-Type": type || "text/plain; charset=utf-8" });
    res.end(body);
}

function serveFile(res, filePath) {
    fs.readFile(filePath, (err, data) => {
        if (err) { send(res, 404, "Not found: " + filePath); return; }
        send(res, 200, data, MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream");
    });
}

function proxyApi(req, res) {
    const options = {
        host: API_HOST, port: 443, path: req.url, method: req.method,
        headers: Object.assign({}, req.headers, { host: API_HOST }),
    };
    const preq = https.request(options, (pres) => {
        res.writeHead(pres.statusCode, pres.headers);
        pres.pipe(res);
    });
    preq.on("error", (e) => send(res, 502, "Proxy error: " + e.message));
    req.pipe(preq);
}

const server = http.createServer((req, res) => {
    let uri = decodeURIComponent(req.url.split("?")[0]);

    // /api/* -> proxy backend thật
    if (uri.startsWith("/api/")) { proxyApi(req, res); return; }

    // /_<id> -> play.html
    if (/^\/_[A-Za-z0-9]{6,40}\/?$/.test(uri)) { serveFile(res, PLAY_HTML); return; }
    if (uri === "/play.html") { serveFile(res, PLAY_HTML); return; }

    // /static/* -> docs/static/*
    if (uri.startsWith("/static/")) { uri = "/docs" + uri; }

    // thư mục -> index.html
    if (uri.endsWith("/")) uri += "index.html";

    // chống path traversal
    const filePath = path.normalize(path.join(ROOT, uri));
    if (!filePath.startsWith(ROOT)) { send(res, 403, "Forbidden"); return; }
    serveFile(res, filePath);
});

server.listen(PORT, () => {
    console.log(`Local share test server: http://localhost:${PORT}`);
    console.log(`  Mở: http://localhost:${PORT}/_<id>  (id dự án đã share thật)`);
    console.log(`  Gốc tĩnh: ${ROOT}`);
    console.log(`  /api -> https://${API_HOST}`);
});
