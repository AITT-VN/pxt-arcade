# GameLab – Dịch vụ chia sẻ dự án (share backend)

Backend serverless (AWS SAM + TypeScript) implement contract chia sẻ của pxt cho
GameLab (OhStem MakeCode Arcade). Cho phép user bấm **Share** để tạo link dạng
`https://gamelab.ohstem.vn/_abc123` — ai có link đều chơi thử và xem được code.

## Kiến trúc

```
Trình duyệt (editor static trên S3/CloudFront)
        │  POST /api/scripts        (lưu project, trả _shortid)
        │  GET  /api/{id}           (metadata khi mở link)
        │  GET  /api/{id}/text      (nội dung file để load game + xem code)
        │  GET  /api/{id}/thumb     (ảnh thumbnail)
        ▼
CloudFront (gamelab.ohstem.vn)
   ├── behavior /api/*  ─────────────►  API Gateway (HTTP API) ──► Lambda (TS)
   │                                                                 ├─ DynamoDB (metadata)
   │                                                                 └─ S3 (s3://ohstem-public/gamelab-projects/)
   └── behavior  *      ─────────────►  S3 (editor tĩnh)
   └── CloudFront Function (viewer-request): /_id -> /#pub:_id
```

Vì site đã deploy chạy với `apiRoot = "/api/"` ([pxt/pxtlib/emitter/cloud.ts](../../../pxt/pxtlib/emitter/cloud.ts)),
**không cần sửa code gọi API** ở frontend — chỉ cần route `/api/*` của CloudFront
trỏ về API Gateway này.

## Thành phần trong thư mục

| Đường dẫn | Vai trò |
|---|---|
| `template.yaml` | SAM: HTTP API + Lambda + DynamoDB + S3 |
| `src/handler.ts` | Router cho 4 route |
| `src/scripts.ts` | Tạo/đọc project, validate, sinh shortid |
| `src/storage.ts` | DynamoDB (metadata) + S3 (text/thumbnail) |
| `src/shortid.ts` | Sinh id `_` + 12 ký tự base62 |
| `src/types.ts` | Kiểu khớp `JsonScript` / payload editor |
| `cloudfront/rewrite-share-url.js` | CloudFront Function rewrite URL chia sẻ |
| `samconfig.toml` | Cấu hình deploy mặc định (profile `ohstem`) |

## Yêu cầu

- Node.js 20+, [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- AWS CLI profile `ohstem` (đã dùng cho lệnh `npm run deploy` của pxt-arcade)
- Region đề xuất: `ap-southeast-1` (Singapore) — chỉnh trong `samconfig.toml`

## Build & test local

```bash
cd pxt-arcade/backend/share
npm install
npm run typecheck          # kiểm tra TypeScript
sam build                  # esbuild bundle Lambda
sam local start-api        # chạy API ở http://127.0.0.1:3000
```

Thử nhanh:

```bash
# Tạo project
curl -s -X POST http://127.0.0.1:3000/api/scripts \
  -H 'content-type: application/json' \
  -d '{"name":"Demo","target":"arcade","text":"{\"main.ts\":\"game.splash(\\\"hi\\\")\"}"}'
# -> {"kind":"script","id":"_xxx","shortid":"_xxx",...}

curl -s http://127.0.0.1:3000/api/_xxx
curl -s http://127.0.0.1:3000/api/_xxx/text
```

## Deploy

```bash
cd pxt-arcade/backend/share
npm install
sam build
sam deploy --guided        # lần đầu; các lần sau chỉ cần `sam deploy`
```

Sau khi deploy, lấy `ApiEndpoint` trong Outputs (dạng
`https://xxxx.execute-api.ap-southeast-1.amazonaws.com/prod`).

## Đấu nối CloudFront (distribution E26OB3OVA7KBC6)

### Cách tự động (khuyến nghị): `cloudfront/setup-cloudfront.ps1`

Script làm hết: cập nhật + publish CloudFront Function, thêm Origin + Behavior
`/api/*`, và tạo invalidation. **Mặc định chạy dry-run** (chỉ in ra thay đổi,
ghi config đề xuất ra `distribution-config.proposed.json`, không đụng gì).

```powershell
cd pxt-arcade/backend/share/cloudfront
powershell -ExecutionPolicy Bypass -File ./setup-cloudfront.ps1          # xem trước
powershell -ExecutionPolicy Bypass -File ./setup-cloudfront.ps1 -Apply   # thực thi
```

> **Quan trọng – function dùng chung:** distribution đang gắn sẵn CloudFront
> Function `gamelab-rewrite-static-path` (rewrite `/static/` + default document).
> CloudFront chỉ cho 1 function/viewer-request, nên [rewrite-share-url.js](rewrite-share-url.js)
> đã **gộp** toàn bộ logic cũ + thêm xử lý URL chia sẻ, và script cập nhật
> chính function đó *tại chỗ* — không đổi function-association (an toàn nhất).
> Tham số có thể chỉnh: `-DistributionId`, `-ApiDomain`, `-OriginPath`, `-FunctionName`.

> **Trang player chia sẻ:** function rewrite `/_id` → phục vụ `/play.html`
> (giữ nguyên URL đẹp trên trình duyệt). [share-play/play.html](../../share-play/play.html)
> đọc id từ đường dẫn, nhúng `run.html?id=<id>` để chạy game (khung gamepad), kèm
> nút **Xem code** (toggle sang `#sandbox:<id>`) và **Mở trình soạn thảo** (`#pub:<id>`).
> `build_deploy.bat` tự copy `play.html` vào `built/packaged/` mỗi lần build.

### Cách thủ công (console) — nếu không dùng script

1. **Thêm Origin**: domain = host của `ApiEndpoint` (`xxxx.execute-api...amazonaws.com`),
   Origin path = `/prod`, Protocol = HTTPS only.
2. **Thêm Behavior**: Path pattern `/api/*` → origin vừa tạo, đặt **trên** `Default (*)`.
   - Viewer protocol: Redirect HTTP to HTTPS
   - Allowed methods: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
   - Cache policy: **CachingDisabled** (POST không được cache)
   - Origin request policy: **AllViewerExceptHostHeader**
3. **CloudFront Function**: cập nhật code function `gamelab-rewrite-static-path`
   bằng nội dung [rewrite-share-url.js](rewrite-share-url.js), Publish. (Đã gắn sẵn
   ở Default behavior / Viewer request nên không cần gắn lại.)
4. Invalidation `/*` sau khi xong.

## Cấu hình frontend (đã sửa sẵn)

Trong [pxtarget.json](../../pxtarget.json) `appTheme` đã đổi:

```json
"homeUrl":  "https://gamelab.ohstem.vn/",
"embedUrl": "https://gamelab.ohstem.vn/",
"shareUrl": "https://gamelab.ohstem.vn/",
"qrCode": true
```

Sau khi sửa cần **rebuild & deploy lại site tĩnh** (`build_deploy.bat` + `npm run deploy`).

## Bảo mật & vận hành

- API Gateway throttling mặc định: 20 req/s, burst 50 (chỉnh trong `template.yaml`).
- Giới hạn payload `MAX_BODY_BYTES` (mặc định 3MB), kiểm tra target = `arcade`.
- `RetentionDays > 0` để tự xoá project ẩn danh cũ qua TTL của DynamoDB.
- File project + thumbnail lưu ở `s3://ohstem-public/gamelab-projects/` (đổi qua
  tham số `AssetsBucketName` / `AssetsPrefix`). IAM của Lambda chỉ được cấp quyền
  `GetObject`/`PutObject` trên đúng prefix này.
- Nội dung chia sẻ là public theo link — cân nhắc kiểm duyệt nếu mở rộng quy mô.

## Tham chiếu contract pxt

- Payload POST: `getScriptRequest` trong [pxt/webapp/src/workspace.ts](../../../pxt/webapp/src/workspace.ts)
- POST tới `scripts`: `anonymousPublishAsync` (cùng file)
- Đọc lại: `installByIdAsync` → `GET {id}` + `downloadScriptFilesAsync` → `GET {id}/text`
- Shape trả về: `JsonScript` trong [pxt/pxtlib/emitter/cloud.ts](../../../pxt/pxtlib/emitter/cloud.ts)
