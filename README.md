# 📦 IPC-PASSED — Website Standar Susunan Pallet

[![Status](https://img.shields.io/badge/Status-Active-brightgreen.svg)]()
[![Type](https://img.shields.io/badge/Type-PWA%20%2F%20Web%20App-blue.svg)]()
[![QC--Compliance](https://img.shields.io/badge/QC-In--Process%20Control-orange.svg)]()
[![Live Demo](https://img.shields.io/badge/Demo-ipcquality.github.io%2FIPC--PASSED-blue?style=flat&logo=github)](https://ipcquality.github.io/IPC-PASSED/)

> **Sistem Informasi & Panduan Visual Standar Susunan Pallet (IPC Quality)**  
> Memastikan setiap produk tersusun rapi, aman, stabil, dan sesuai standar kualitas sebelum masuk gudang/pengiriman.  
> 🌐 **Live Website:** [https://ipcquality.github.io/IPC-PASSED/](https://ipcquality.github.io/IPC-PASSED/)

---

## 👷‍♂️ Doodle Petugas QC (In-Process Control Inspector)

```text
       _________________________________________________________________
      |                                                                 |
      |   👷‍♂️ PETUGAS QC ON DUTY: "Pemeriksaan Susunan Pallet!"         |
      |                                                                 |
      |             .-'""'-.               +------------------------+   |
      |            /  __  __\              |  📋 QC CHECKLIST       |   |
      |           |  (o)  (o)|             +------------------------+   |
      |           |    __    |   .-------->| [✓] Pola Interlock     |   |
      |            \  \__/  /   /          | [✓] Max Tumpukan/Layer |   |
      |          .-'--------'-.            | [✓] Batas Beban (kg)   |   |
      |         /  | QC PASS|  \           | [✓] Strapping / Wrap   |   |
      |        / / |   APPROVED| \         | [✓] Bebas Kemiringan   |   |
      |       /_/  |________|  \_\        +------------------------+   |
      |            |   ||   |                                           |
      |            |   ||   |       📦📦📦📦 [ PALLET STACK ]           |
      |           (____||____)      =========================           |
      |_________________________________________________________________|
```

---

## 📌 Tentang Project

**IPC-PASSED** adalah aplikasi berbasis web (PWA Ready) yang dirancang khusus untuk tim **Quality Control (QC / IPC)**, operator produksi, dan tim pergudangan (*warehouse*). Aplikasi ini menyediakan referensi visual dan panduan standar susunan pallet (*pallet stacking standard*) berdasarkan kode **MID** (Material Identification) untuk ratusan SKU produk.

### 🌟 Mengapa Aplikasi Ini Dibuat?
* ❌ **Mencegah Kerusakan Barang:** Susunan pallet yang salah dapat menyebabkan kardus/kemasan robek, penyok, atau runtuh.
* ⚡ **Quick Inspection:** Memudahkan petugas QC mengecek pola susunan, nomor TDK, dan notasi layer secara instan dari smartphone/tablet di area produksi.
* 🌐 **Offline First (PWA):** Dilengkapi *Service Worker* (`sw.js`) sehingga tetap berfungsi lancar tanpa koneksi internet di area gudang yang minim sinyal.

---

## 🚀 Fitur Utama

- 🔍 **Pencarian Autocomplete MID:** Pencarian instan berdasarkan kode MID atau deskripsi produk dengan saran otomatis (*autocomplete*).
- 📜 **Riwayat Pencarian:** Menyimpan daftar pencarian terakhir lokal (*localStorage*) untuk akses cepat.
- 🖼️ **Preview Gambar & Modal Zoom:** Visualisasi gambar susunan pallet dengan fitur modal zoom untuk pemeriksaan lebih rinci.
- 🌓 **Mode Gelap / Terang (Dark Mode):** Tampilan adaptif yang nyaman digunakan di berbagai kondisi pencahayaan area kerja.
- 📱 **Progressive Web App (PWA):** Mendukung caching offline melalui `sw.js`.
- 🔐 **Dashboard Admin Terintegrasi GitHub:** Panel manajemen data di `admin.html` yang terhubung langsung ke repositori GitHub via Personal Access Token (PAT).
- 🔄 **Atomic Commit & Sync Gambar:** Fitur sinkronisasi otomatis untuk menyamakan gambar pada produk bernotasi serupa.

---

## 📂 Struktur Repository

```text
.
├── 📁 images/          # Aset foto & diagram referensi standar susunan pallet
├── 📄 index.html        # Antarmuka pencarian utama untuk Petugas QC & Operator
├── 📄 admin.html        # Dashboard manajemen data (Editor & GitHub Sync Engine)
├── 📄 deskripsi.json    # Database JSON berisi daftar MID, deskripsi, notasi, TDK, & nama gambar
└── 📄 sw.js            # Service Worker untuk dukungan Progressive Web App (PWA)
```

---

## 🛠️ Rincian Berkas & Kode Utama

### 1. `index.html` (Halaman QC Viewer)
* **Fungsi:** Aplikasi utama bagi petugas QC untuk mencari standar susunan pallet berdasarkan MID.
* **Fitur Utama:**
  * Auto-complete search box yang memfilter data dari `deskripsi.json`.
  * Panel hasil pencarian yang menampilkan status **PASSED**, deskripsi produk, nomor TDK, notasi layer/stacking, dan gambar referensi.
  * Modal penampil gambar skala penuh.
  * Sistem riwayat pencarian terbaru (hingga 10 item).

### 2. `admin.html` (Dashboard Admin Editor)
* **Fungsi:** Panel autentikasi & pengelolaan data master bagi administrator/supervisi QC.
* **Fitur Utama:**
  * **GitHub API Integration:** Menggunakan Personal Access Token (PAT) untuk membaca, memperbarui, dan men-commit file `deskripsi.json` serta mengunggah gambar ke folder `images/`.
  * **Image Compression Engine:** Kompresi otomatis gambar (JPEG 80%, dimensi max 1280px) sebelum diunggah agar hemat memori.
  * **Notation Grouping:** Fitur *"Samakan Gambar Bernotasi Sama"* untuk menerapkan 1 file gambar ke seluruh MID dengan notasi serupa secara massal.
  * **Backup & Restore:** Ekspor/Impor berkas `deskripsi.json` lokal.

### 3. `deskripsi.json` (Database Master)
Format struktur data terstandar:

```json
{
  "version": 1,
  "count": 204,
  "records": [
    {
      "mid": "80888",
      "deskripsi": "SKL Sachet 22 g 12+1",
      "notasi": "22 Dus x 5 Tier = 110 Dus Maximum Stacking 2 Palet Shelf life 2 tahun",
      "tdk": "TDK/R&D/PAC/12/0",
      "img": "TDK_R_D_PAC_12_0.png"
    }
  ]
}
```

---

## 📖 Cara Penggunaan

### 🌐 Akses Langsung
Aplikasi dapat dibuka langsung via browser tanpa instalasi tambahan:
👉 **[https://ipcquality.github.io/IPC-PASSED/](https://ipcquality.github.io/IPC-PASSED/)**

### 👷‍♂️ Alur Kerja Petugas QC
1. Buka link **IPC-PASSED** pada perangkat smartphone/tablet.
2. Masukkan kode **MID** (contoh: `80888`, `61171`) atau ketik nama produk pada kolom pencarian.
3. Pilih item dari daftar saran atau tekan tombol **Cari**.
4. Verifikasi fisik susunan pallet di lapangan sesuai informasi:
   - **Jumlah Dus/Box per Layer (Tie)**
   - **Jumlah Layer ke atas (High / Tier)**
   - **Maksimum Stacking Pallet**
   - **Kesesuaian Gambar / Pola Kuncian**
5. Tekan gambar untuk memperbesar jika diperlukan.

---

<p align="center">
  <b>IPC-PASSED — Quality First, Safety Always! 🛡️📦</b><br>
  <i>In-Process Control Quality Control System</i>
</p>
