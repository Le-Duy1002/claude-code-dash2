# claude-code-dash2

Dashboard xây dựng bằng [Next.js](https://nextjs.org) (App Router), React 19, Tailwind CSS v4 và shadcn/ui.

## Yêu cầu

- Node.js 18.18+ (khuyến nghị 20+)

## Bắt đầu

```bash
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000). Trang dashboard: `/dashboard`.

## Scripts

| Lệnh | Mô tả |
|------|-------|
| `npm run dev` | Chạy server phát triển |
| `npm run build` | Build bản production |
| `npm run start` | Chạy bản production đã build |
| `npm run lint` | Kiểm tra ESLint |

## Cấu trúc

- `app/` – route và layout (App Router)
- `components/` – component UI, `components/ui/` là các primitive shadcn/ui
- `hooks/` – React hooks dùng chung
- `lib/` – tiện ích (ví dụ `cn`)
