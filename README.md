# 💣 Bomb Party — Game Kata Multiplayer

Game multiplayer real-time di mana pemain harus mengetik kata yang mengandung kombinasi huruf tertentu sebelum bom meledak!

## 🎮 Cara Main

1. **Buat Room** — Masukkan nama & buat room baru
2. **Bagikan Kode** — Kirim kode 4 huruf ke teman-teman
3. **Mulai Game** — Host klik "Mulai Game" (min. 2 pemain)
4. **Ketik Kata** — Saat giliran kamu, ketik kata yang mengandung huruf yang ditampilkan
5. **Jangan Sampai Meledak!** — Kalau bom meledak di giliran kamu, kamu kehilangan nyawa
6. **Terakhir Bertahan = Menang!** 🏆

## 🚀 Jalankan Lokal

```bash
npm install
npm start
```

Buka `http://localhost:3000` di browser.

## 📦 Deploy

### Railway
1. Push ke GitHub
2. Buka [railway.app](https://railway.app)
3. New Project → Deploy from GitHub
4. Pilih repo ini → Deploy! ✅

### Render
1. Push ke GitHub  
2. Buka [render.com](https://render.com)
3. New Web Service → Connect repo
4. Build Command: `npm install`
5. Start Command: `node server.js`
6. Deploy! ✅

## 🛠️ Tech Stack

- **Backend**: Node.js + Express + Socket.io
- **Frontend**: HTML + CSS + Vanilla JS
- **Real-time**: WebSocket via Socket.io
- **Design**: Dark mode, Glassmorphism, Neon UI
