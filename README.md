# minum ya... 💧

> Pengingat minum air putih harianmu yang segar & interaktif — berbasis PWA

[![Live Demo](https://img.shields.io/badge/Live%20Demo-minum--ya--app.surge.sh-0ea5e9?style=for-the-badge&logo=surge&logoColor=white)](https://minum-ya-app.surge.sh)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)

---

## ✨ Fitur

| Fitur | Deskripsi |
|---|---|
| 💧 **Tracking mL** | Pantau asupan air harian dalam mL, bukan sekadar "gelas" |
| 🎯 **Target Kustom** | Set target harian & ukuran gelas sendiri saat setup |
| ⏰ **Timer Pengingat** | Countdown berbasis timestamp — aman meski tab di-background |
| 🔔 **Web Notification** | Notifikasi push langsung ke HP dengan pesan acak |
| 🔊 **Suara Segar** | Efek suara via Web Audio API — tanpa file audio eksternal |
| 📊 **History 7 Hari** | Bar chart + statistik rata-rata, streak, dan hari terbaik |
| 🕐 **Jam Operasional** | Atur rentang jam aktif biar notif nggak ganggu waktu tidur |
| 🔄 **Reset Harian Otomatis** | Data hari baru otomatis terset ulang saat tengah malam |
| 📲 **PWA Installable** | Bisa diinstall di homescreen Android & iOS |
| ♿ **Aksesibel** | ARIA labels, live regions, & role attributes |

---

## 📸 Screenshot

### Tampilan Utama
Gelas air animasi yang terisi sesuai progress + timer countdown pengingat.

### History
Bar chart 7 hari terakhir + statistik streak, rata-rata, & target tercapai.

### Setup Wizard
3 langkah onboarding: pilih target mL → ukuran gelas → izin notifikasi.

---

## 🚀 Cara Pakai

### Buka Langsung (Online)
```
https://minum-ya-app.surge.sh
```

### Jalankan Lokal
```bash
# Clone repo
git clone https://github.com/AdrianHanafi/minum-ya.git
cd minum-ya

# Jalankan local server (butuh Node.js)
npx serve .

# Buka di browser
# http://localhost:3000
```

> ⚠️ **Catatan:** Fitur Service Worker & Web Notification butuh HTTPS atau `localhost`.
> Jangan buka via `file://` langsung.

---

## 🛠️ Tech Stack

- **HTML5** — Struktur & markup semantik
- **Tailwind CSS** (via CDN) — Styling utility-first
- **Vanilla JavaScript** — Semua logic tanpa framework
- **Web Audio API** — Synthesize suara tanpa file audio
- **Web Notifications API** — Push notification browser
- **localStorage** — Persistensi data tanpa backend
- **Service Worker** — Caching & offline support
- **PWA Manifest** — Installable ke homescreen

---

## 📁 Struktur File

```
minum-ya/
├── index.html      # SPA — semua view dalam satu file
├── app.js          # Logic utama (state, timer, audio, history)
├── manifest.json   # PWA manifest
├── sw.js           # Service Worker (cache-first strategy)
├── icon-192.png    # App icon 192×192
├── icon-512.png    # App icon 512×512
└── README.md
```

---

## ⚙️ Cara Kerja Timer

Timer menggunakan **timestamp `Date.now()`** bukan `setInterval` murni, sehingga:
- ✅ Tetap akurat meski tab di-background (browser throttle setInterval)
- ✅ Saat tab dibuka kembali, langsung cek apakah sudah waktunya notif
- ✅ Data timer tersimpan di `localStorage` — aman meski browser ditutup

```js
// Logika inti timer
const elapsed    = Date.now() - state.timer.last_reset;
const intervalMs = state.reminder_interval * 60 * 1000;
if (elapsed >= intervalMs) triggerReminder();
```

---

## 📦 Deploy

Project ini di-deploy ke **[Surge.sh](https://surge.sh)** secara gratis:

```bash
npx surge . minum-ya-app.surge.sh
```

Atau drag & drop folder ke **[netlify.com/drop](https://app.netlify.com/drop)**.

---

## 🤝 Kontribusi

Pull request welcome! Kalau ada ide fitur atau nemu bug, buka aja [Issues](../../issues).

---

## 📄 Lisensi

MIT License — bebas dipakai, dimodif, dan didistribusikan.

---

<div align="center">
  Dibuat dengan ❤️ untuk kesehatan hidrasi kita semua 💧
</div>
