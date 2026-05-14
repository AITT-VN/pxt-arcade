# Lessons Learned: Debugging RP2040 UF2 Build Issues

Tài liệu này tổng hợp những bài học rút ra từ vụ debug panic code `911` trên thiết bị RP2040+ILI9341 (commit `b88247fc`, 2026-05-14). Mục tiêu: nếu gặp lại lỗi tương tự, đi thẳng vào checklist thay vì mò mẫm.

## TL;DR

- **Triệu chứng**: UF2 download từ `gamelab.ohstem.vn` cho dòng máy R2 (RP2040) làm thiết bị hiển thị mã `911` ngay khi khởi động. UF2 cũ vẫn chạy được.
- **Root cause**: Lúc inline `pxt.json`/`targetoverrides.ts` từ `pxt-common-packages` vào `pxt-arcade` (commit `a5fbbc4c`), file `libs/screen---st7735/targetoverrides.ts` đã được rewrite — bỏ buffer cố định 160x120 và `setupScreenStatusBar(8)`. Trên panel ILI9341 (`doubleSize=true, mult=2`), runtime tạo image bằng kích thước panel (320x240), trong khi `screen.cpp:updateScreen` check `img.width × mult == display->width` → `320×2=640 ≠ 320` → `target_panic(PANIC_SCREEN_ERROR)`.
- **Fix**: Khôi phục logic Feb 3 (commit `bdd8e2f9`) cho `libs/screen---st7735/targetoverrides.ts` + khôi phục `yotta.config.PXT_SUPPORT_*` cho `libs/accelerometer/pxt.json`.

## Panic codes quan trọng

Bảng tra cứu nhanh (xem đầy đủ tại [libs/base/pxtbase.h](../../libs/base/pxtbase.h) từ dòng 251):

| Code | Tên | Khả năng |
| ---- | --- | -------- |
| 90 | `PANIC_CODAL_HARDWARE_CONFIGURATION_ERROR` | Detection accelerometer / cấu hình HW sai |
| 901 | `PANIC_INVALID_BINARY_HEADER` | Binary header hỏng, sai magic |
| 906 | `PANIC_INTERNAL_ERROR` | Lỗi runtime nội bộ |
| 910 | `PANIC_MEMORY_LIMIT_EXCEEDED` | Hết heap |
| **911** | **`PANIC_SCREEN_ERROR`** | **Khởi tạo hoặc render màn hình thất bại** |
| 913 | `PANIC_INVALID_IMAGE` | Image bpp/format sai |
| 916 | `PANIC_STACK_OVERFLOW` | Stack overflow |
| 920 | `PANIC_SETTINGS_CLEARED` | Settings flash bị xóa |
| 980+ | `PANIC_CAST_*` | TS runtime cast lỗi |

**Chú ý format**: 3 chữ số ở giữa màn hình + mặt buồn `:(` ở trên (ST7735 panic.cpp hardcode dùng ST7735 init commands; trên ILI9341 chỉ hiện ở góc trên-trái 160x128).

## 6 invariant phải nhớ khi đụng vào RP2040 build

### 1. Screen buffer size MUST match `display->width / mult, display->displayHeight / mult`

`libs/screen---st7735/screen.cpp:updateScreen` check:
```c
if (img->bpp() != 4 ||
    img->width()  * mult != display->width ||
    img->height() * mult != display->displayHeight)
    target_panic(PANIC_SCREEN_ERROR);
```

Trong đó:
- `mult = display->doubleSize ? 2 : 1`
- `doubleSize = true` khi `dispTp == DISPLAY_TYPE_ILI9341` (`screen.cpp:84`)
- `display->width = getConfig(CFG_DISPLAY_WIDTH, 160)` ← đọc từ user-binary configData hoặc CF2 trong flash
- `display->displayHeight` bị giảm nếu `setupScreenStatusBar(barHeight)` được gọi VÀ `!doubleSize`

Hệ quả thực tế: **buffer image của game LUÔN là 160x120**, bất kể panel native là 160x128 (ST7735) hay 320x240 (ILI9341). Runtime hardware tự upscale 2x cho ILI9341.

### 2. `targetoverrides.ts` quyết định kích thước buffer

File [libs/screen---st7735/targetoverrides.ts](../../libs/screen---st7735/targetoverrides.ts) phải dùng:

```ts
const img = image.create(getScreenWidth(160), getScreenHeight(120));
setupScreenStatusBar(8);
```

KHÔNG dùng `image.create(CFG_DISPLAY_WIDTH, CFG_DISPLAY_HEIGHT)` (đọc panel native size). Cũng cần khai báo shim cho `setupScreenStatusBar`, `updateScreenStatusBar`, `getScreenWidth`, `getScreenHeight`.

Khi inline file này từ `pxt-common-packages` → kiểm tra kỹ block này.

### 3. CF2 (bootloader config) ≠ userconfig (user binary)

Hai nguồn config khi `getConfig(key, defl)` chạy (xem [libs/base/core.cpp:1520](../../libs/base/core.cpp#L1520)):

1. **userconfig**: section `_pxt_config_data` trong user binary, sinh ra từ `namespace config { export const X = N }` trong TS. Override nếu có.
2. **CF2** (bootloader): được nạp qua [sample-config.uf2](../../libs/hw---rp2040/sample-config.uf2) hoặc bootloader, ở các offset cuối flash (4kB trước 1MB/2MB/4MB/8MB/16MB/32MB). Magic header `0x1e9e10f1 0x20227a79`.
3. **Default**: tham số `defl` của `getConfig`.

`namespace config` trong [libs/hw/config.ts](../../libs/hw/config.ts) hiện tại không emit DISPLAY_WIDTH/HEIGHT vào configData (chỉ tham gia compile sim). Do đó hardware đọc CF2.

### 4. UF2 family ID cho RP2040 = `0xe48bff56`

Mỗi block UF2 dài 512 byte = 32 byte header + 256 byte payload + magic end. Family ID nằm ở offset 28. Xem [scripts/empty-rp2040-cfg.js](../../scripts/empty-rp2040-cfg.js).

### 5. Hex cache là điểm cứu chính khi remove cloud build

Trong static deploy (`pxt staticpkg`), editor fetch `hexcache/{sha}.hex` từ CDN (xem [pxt/pxtlib/cpp.ts:1434](../../../pxt/pxtlib/cpp.ts#L1434)). `sha` là `sha256(JSON.stringify({config, tag, replaceFiles, dependencies}))` của C++ extension input.

`replaceFiles` bao gồm `extensionFiles + generatedFiles` (trong đó có `pointers.cpp`, `pxtconfig.h`, `codal.json`, …). Đổi BẤT KỲ file nào trong này → sha đổi → cache miss → build sẽ trigger lại Docker codal.

### 6. jmpTbl marker bắt buộc

pxt-core dùng marker `0108010842424242010801083ED8E98D` để định vị bảng function pointers trong firmware hex ([pxt/pxtcompiler/emitter/hexfile.ts:373](../../../pxt/pxtcompiler/emitter/hexfile.ts#L373)). Nếu firmware nào không có marker này, pxt-core sẽ `oops("No hex start")`. Bản firmware Microsoft cloud cũ (trước 2022) dùng cơ chế khác, KHÔNG tương thích pxt-core hiện tại — không dùng cách "extract firmware từ UF2 cũ rồi nhét lại" được.

## Diagnostic workflow (8 bước)

Khi gặp UF2 download không chạy được trên thiết bị, làm theo thứ tự sau:

### Bước 1: Đọc panic code

Số 3 chữ số trên màn hình → tra bảng panic. Không đoán: `911` ≠ `913` ≠ `980` — mỗi mã chỉ một loại lỗi.

### Bước 2: Test project rỗng

Tạo project mới chỉ có `forever(() => {})`. Nếu blank cũng panic → vấn đề ở firmware hoặc cấu hình hệ thống. Nếu blank chạy được → vấn đề ở code/asset của game cụ thể.

### Bước 3: Verify hex cache fetch (browser Network)

1. Chrome Incognito, F12 → Network, **Disable cache**.
2. Load `gamelab.ohstem.vn`, chọn hardware, nhấn Download.
3. Filter `hex` trong Network. Phải thấy `hexcache/{sha}.hex` trả về 200.

Nếu 404 → sha mismatch giữa client compute và server có. Cần rebuild hex hoặc check `compileService` config trong [pxtarget.json](../../pxtarget.json).

### Bước 4: Verify hex file đúng

Tính build date của firmware bằng cách search chuỗi `"<Month> <day> 20XX"` trong hex/UF2 (đoạn `RelWithDebInfo` cũng giúp định danh). Nếu build date khớp với commit hiện tại của bạn → firmware reproducible. Nếu khác → có ai đó rebuild với env khác.

### Bước 5: So sánh UF2 với reference UF2 đang chạy

Nếu có UF2 cũ đang chạy được trên cùng thiết bị:

```bash
python3 <<'EOF'
# Trích blocks từ UF2, so sánh firmware portion (< user code start)
# Xem các script đã dùng tại commit b88247fc
EOF
```

So sánh:
- **Address range**: cả 2 phải cùng base 0x10000000
- **Block dưới program header magic** `708e3b92c615a841c49866c975ee5197`: phần này là firmware, phải IDENTICAL nếu cùng build env
- **Template hash** (8 byte sau magic): phải khớp với sha prefix của hex cache

### Bước 6: Check sample-config.uf2 trên thiết bị

CF2 trong flash thiết bị quyết định DISPLAY_TYPE/WIDTH/HEIGHT, pin assignments. Nếu user code expect ST7735 nhưng CF2 set ILI9341 → mismatch. Hai cách check:

1. Đọc bằng script Python parse UF2 (xem code chúng ta đã dùng — search `1e9e10f1 20227a79` magic, parse `(key, value)` pairs từ offset 16).
2. Mở USB serial 115200 baud sau khi reset → đọc DMESG output `configure screen: FRMCTR1=… MADCTL=… type=…` và `screen: <w>x<h>, off=…`.

### Bước 7: So sánh source với upstream commit cuối (`bdd8e2f9`, 2026-02-03)

Bất cứ khi nào nghi ngờ OhStem customization phá hỏng cái gì:

```bash
cd pxt-arcade
git diff bdd8e2f9..HEAD -- libs/screen---st7735/ libs/screen/ libs/accelerometer/ libs/hw/ libs/hw---rp2040/ libs/base/ libs/core/ libs/core---rp2040/
```

Đặc biệt chú ý các file `targetoverrides.ts`, `pxt.json`, `screen.cpp`. Các thay đổi rủi ro:
- Bỏ block `yotta.config` (mất `#define` flags lúc compile C++)
- Rewrite `createScreen()` (đổi kích thước buffer)
- Đổi `blockIdentity` (chỉ ảnh hưởng UI block, không gây panic)
- Đổi shim signature (nguy hiểm — breaks jmpTbl ordering)

### Bước 8: Force fresh build + clear browser cache

Sau khi sửa source:
1. `rm pxt-arcade/built/hexcache/<old_sha>.hex` và `pxt-arcade/built/packaged/hexcache/<old_sha>.hex`
2. `echo '{"sha": "", "modSha": ""}' > pxt-arcade/libs/hw---rp2040/built/dockercodal/buildcache.json` (force docker rebuild)
3. Chạy `build_deploy.bat` (cần Docker Desktop chạy + image `pext/arm:gcc9`)
4. Verify hex mới xuất hiện trong cache với tên sha khác
5. Test với Chrome Incognito (tránh IndexedDB cache cũ — pxt-core cache hex theo `host.cacheGetAsync("hex-" + sha)`)

## Anti-patterns đã từng làm mất nhiều thời gian

### ❌ "Hex cache stale → rebuild sẽ giải quyết"

Sai. Build deterministic — cùng input (C++ source + codal commits đã pin) sẽ ra cùng output. Nếu rebuild ra output giống hệt → vấn đề KHÔNG phải ở docker / codal version. Đi tìm chỗ khác.

### ❌ "Cloud build sẽ cho firmware chuẩn"

Sai (cho project này). Microsoft cloud CDN `cdn.makecode.com/compile/{sha}.hex` cache theo sha. Cùng sha → cùng hex. Cloud KHÔNG rebuild khi đã có cache. Chỉ giúp được nếu sha hiện tại KHÁC sha lúc Feb 3 (= source khác) — cloud có thể có cached hex cho sha cũ.

### ❌ "Marker mất → patch marker vào"

Sai. Firmware hex cũ không có marker `0108010842424242010801083ED8E98D` thì là build từ pxt-core version khác. Không thể "patch marker thủ công" vì pxt-core còn cần `topFlashAddr` + đúng layout function pointers ngay sau marker. Phải rebuild firmware với pxt-core hiện tại.

### ❌ "Sai DISPLAY_TYPE trong CF2"

Sai (trong vụ này). User có ILI9341 nhưng sample-config.uf2 trong repo set ST7735. Tưởng đây là root cause vì ảnh panic hiển thị ở góc trên-trái (= ST7735 commands trên ILI9341 panel). Nhưng panic vẫn xảy ra do mismatch BUFFER size, không phải DISPLAY_TYPE. Logic Feb 3 đúng cho cả 2 panel type.

## Các quy ước nên giữ khi customize pxt-arcade tiếp

1. **Mỗi khi inline file từ `pxt-common-packages`**: dùng `git show bdd8e2f9:libs/<lib>/<file>` để so sánh với upstream. Đừng tự gõ lại từ memory — bỏ sót `yotta.config`, `optionalConfig`, `userConfigs` là chuyện rất dễ.
2. **Test trên cả 2 hardware** (STM32F4 + RP2040) trước khi commit thay đổi liên quan `screen---st7735`, `accelerometer`, `mixer---*`, hoặc bất kỳ file C++ shared.
3. **Test với panel ILI9341 thật**: Một số bug chỉ hiện ra khi `doubleSize=true`. Test trên panel ST7735 không cover được.
4. **Tách commit theo concern**: commit gộp `Vietnamese localization + remove HW targets + relocate forever() + utility scripts` (như `a5fbbc4c`) cực kỳ khó debug. Tách thành commits nhỏ.

## File / commit / sha tham khảo

- Commit upstream cuối trước OhStem fork: `bdd8e2f9` (2026-02-03 in `pxt-arcade`)
- Commit OhStem inline lib gây regression: `a5fbbc4c` (2026-03-17)
- Commit fix bug 911: `b88247fc` (2026-05-14, "fix(hw): restore 160x120 screen buffer and accelerometer build config")
- File firmware hex chuẩn (Feb 3 build, có MPU6050 driver, vector table khớp GOOD UF2): sha bắt đầu `62ddc54ce447954b…`
- File firmware hex broken (Apr 16 / Mar 18 build, thiếu PXT_SUPPORT_*): sha bắt đầu `e46826eb83398cfd…`
