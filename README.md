# Frontend

React + TypeScript + Vite. Code chia theo `app/`, `pages/`, `features/`; component dùng chung nhiều feature mới đặt tại `src/components/`.

## Chạy local

1. Cài Node.js >= 22.12.
2. Chạy `npm install` và `npm run dev`.
3. Mở `http://localhost:5173`.

Mặc định FE gọi API tại `http://localhost:3000`. Để đổi địa chỉ, sao chép `.env.example` thành `.env` và sửa `VITE_API_URL`.

`npm run build` tạo bản production trong `dist/`.
