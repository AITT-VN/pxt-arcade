// CloudFront Function (viewer-request) cho distribution gamelab.ohstem.vn.
//
// Đây là bản GỘP của function "gamelab-rewrite-static-path" đang chạy, cộng
// thêm xử lý URL chia sẻ. Giữ NGUYÊN logic cũ (static path + default document)
// để không phá vỡ routing của site, rồi thêm:
//   - URL chia sẻ đẹp "/_abc123" -> phục vụ trang player tĩnh "/play.html"
//     (rewrite uri, KHÔNG redirect) nên trình duyệt vẫn giữ URL "/_abc123".
//     play.html đọc id từ đường dẫn rồi nhúng run.html để chạy game; có nút
//     "Xem code" và "Mở trình soạn thảo".
//
// Script setup-cloudfront.ps1 sẽ cập nhật code function này + publish.

function handler(event) {
    var request = event.request;
    var uri = request.uri;

    // 1) URL chia sẻ: /_xxxxx -> phục vụ /play.html (giữ nguyên URL trên trình duyệt)
    //    (chỉ khớp đúng một segment id, có hoặc không có "/" ở cuối)
    var shareMatch = uri.match(/^\/(_[A-Za-z0-9]{6,40})\/?$/);
    if (shareMatch) {
        request.uri = "/play.html";
        return request;
    }

    // 2) Rewrite /static/* -> /docs/static/*  (logic cũ)
    if (uri.startsWith("/static/")) {
        request.uri = "/docs" + uri;
    }

    // 3) Default document cho thư mục  (logic cũ)
    if (uri.endsWith("/")) {
        request.uri += "index.html";
    }

    return request;
}
