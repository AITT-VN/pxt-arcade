# Bản Dịch Khối Lệnh MakeCode Arcade Tiếng Việt

Tài liệu này cung cấp các bản dịch tham khảo cho hệ thống khối lệnh mặc định của Microsoft MakeCode Arcade sang tiếng Việt, hỗ trợ cho việc Việt hóa ứng dụng. Tiêu chí dịch: ngắn gọn, dễ hiểu và tương đồng với các thuật ngữ quen thuộc (như Scratch).

## 1. Nhóm Sprites (Nhân vật)
* `set [mySprite] to sprite [ ] of kind [Player]` ➔ `đặt [mySprite] thành nhân vật [ ] loại [Người chơi]`
* `on created sprite [mySprite] of kind [Player]` ➔ `khi tạo nhân vật [mySprite] loại [Người chơi]`
* `destroy [mySprite]` ➔ `hủy [mySprite]`
* `destroy [mySprite] with [fire] effect for [500] ms` ➔ `hủy [mySprite] với hiệu ứng [lửa] trong [500] ms`
* `set [mySprite] [x] to [0]` ➔ `đặt [x] của [mySprite] thành [0]` *(các thuộc tính x, y, vx, vy, lifespan... có thể giữ nguyên hoặc dịch là: tọa độ x, tọa độ y, vận tốc x...)*
* `change [mySprite] [x] by [0]` ➔ `thay đổi [x] của [mySprite] một lượng [0]`
* `set [mySprite] position to x [0] y [0]` ➔ `đặt vị trí [mySprite] tại x [0] y [0]`
* `set [mySprite] velocity to vx [50] vy [50]` ➔ `đặt vận tốc [mySprite] thành vx [50] vy [50]`
* `on [sprite] of kind [Player] overlaps [otherSprite] of kind [Enemy]` ➔ `khi [sprite] loại [Người chơi] chạm [otherSprite] loại [Kẻ thù]`

## 2. Nhóm Controller (Điều khiển)
* `move [mySprite] with buttons` ➔ `điều khiển [mySprite] bằng các nút bấm`
* `on [A] button [pressed]` ➔ `khi nút [A] [được nhấn]` *(các trạng thái: pressed - được nhấn, released - được thả, thả ra)*
* `is [A] button pressed` ➔ `nút [A] đang được nhấn?`

## 3. Nhóm Game (Trò chơi)
* `on game update` ➔ `khi trò chơi cập nhật`
* `on game update every [500] ms` ➔ `mỗi [500] ms cập nhật trò chơi`
* `game over [LOSE]` ➔ `kết thúc trò chơi [THUA]` *(có thể đổi thành THẮNG/THUA)*
* `reset game` ➔ `chơi lại từ đầu`
* `splash [ " " ]` ➔ `hiện thông báo [ " " ]`
* `show long text [ " " ] [bottom]` ➔ `hiện văn bản dài [ " " ] ở [dưới cùng]`

## 4. Nhóm Info (Thông tin)
* `set score to [0]` ➔ `đặt điểm thành [0]`
* `change score by [1]` ➔ `tăng điểm thêm [1]`
* `score` ➔ `điểm số`
* `set life to [3]` ➔ `đặt số mạng thành [3]`
* `change life by [-1]` ➔ `thay đổi số mạng một lượng [-1]` (hoặc `trừ đi 1 mạng`)
* `life` ➔ `số mạng`
* `start countdown [10] (s)` ➔ `bắt đầu đếm ngược [10] (giây)`

## 5. Nhóm Scene (Khung cảnh)
* `set background color to [ ]` ➔ `đặt màu nền thành [ ]`
* `set background image to [ ]` ➔ `đặt hình nền thành [ ]`
* `set tilemap to [ ]` ➔ `đặt bản đồ ô vuông thành [ ]` *(hoặc gọi tắt là `đặt bản đồ`)*
* `place [mySprite] on top of random [ ] tile` ➔ `đặt [mySprite] lên ô [ ] ngẫu nhiên`
* `camera follow sprite [mySprite]` ➔ `máy ảnh đi theo [mySprite]`

## 6. Nhóm Music (Âm thanh)
* `play sound [ba ding]` ➔ `phát âm thanh [ba ding]`
* `play melody [ ] at tempo [120]` ➔ `phát giai điệu [ ] với tốc độ [120]`

## 7. Nhóm Loops (Vòng lặp) & Logic (Điều kiện)
* `repeat [4] times` ➔ `lặp lại [4] lần`
* `while [true]` ➔ `trong khi [đúng]`
* `for element [value] of [list]` ➔ `với mỗi phần tử [value] trong danh sách [list]`
* `if [true] then` ➔ `nếu [đúng] thì`
* `else` ➔ `nếu không thì`

## 8. Nhóm Math (Toán)
* `pick random [0] to [10]` ➔ `lấy ngẫu nhiên từ [0] đến [10]`
* `absolute of [0]` ➔ `giá trị tuyệt đối của [0]`
* `remainder of [0] ÷ [0]` ➔ `phần dư của [0] ÷ [0]`