# Naskah Video Demonstrasi — Bahasa Indonesia
## Judul: AI Interview Platform — Fit/Gap Calibration Revamp
**Durasi Target:** 4 menit 15 detik  
**Branch:** `feat-fitgap-calibration-revamp`  
**Catatan Pengucapan:** Istilah teknis (Fit/Gap, RSpec, Sidekiq, API) dibaca seperti tertulis; tidak perlu diindonesiakan.

---

## ▶ BAGIAN 1 — PEMBUKAAN (0:00 – 0:45)

**[Layar: Halaman utama aplikasi AI Interview Platform]**

> "Halo, saya [nama Anda]. Saya adalah Fullstack Product Engineer, dan di video ini saya akan menunjukkan bagaimana saya menyelesaikan case study dari Rakamin — membangun ulang fitur Fit/Gap Analysis yang sebelumnya rusak menjadi pengalaman yang benar-benar siap dipakai."

**[Layar: Daftar kandidat / portfolio halaman]**

> "Konteksnya begini: seorang recruiter harus bisa melihat dalam tiga detik — apakah kandidat ini cocok untuk posisi ini, atau tidak? Di platform ini, ada fitur bernama Fit/Gap Report yang seharusnya membantu recruiter membandingkan kemampuan kandidat dengan kebutuhan posisi.
> 
> Masalahnya — sebelum perbaikan saya — fitur ini hampir tidak bisa digunakan. Ada tiga bug P0 yang langsung berdampak ke pengguna."

---

## ▶ BAGIAN 2 — KONDISI AWAL / BEFORE (0:45 – 1:45)

**[Layar: Screenshot BEFORE — kolom "Required Level" kosong]**

> "Bug pertama: kolom 'Required Level' — atau level yang dibutuhkan untuk posisi ini — seluruhnya kosong. Ini terjadi karena API backend mengirimkan field bernama `expected_level`, tapi frontend mencari `required_level`. Ketidakcocokan kontrak ini membuat recruiter tidak bisa melihat apakah kandidat memenuhi syarat atau tidak."

**[Layar: Screenshot BEFORE — infinite spinner]**

> "Bug kedua: jika laporan belum selesai digenerate, halaman ini langsung polling ke server setiap 5 detik — tanpa batas. Server membalas dengan HTTP 404 karena laporan belum ada, tapi halaman terus kirim request lagi dan lagi. Akibatnya, Sidekiq — itu adalah sistem antrian background job kami — dibanjiri job duplikat sampai bisa membebani server."

**[Layar: Terminal / kode — PortfoliosController sebelum fix]**

> "Bug ketiga yang paling serius: celah keamanan. Seorang pengguna dari Tenant B bisa mengakses data kandidat milik Tenant A hanya dengan mengganti ID di URL. Ini melanggar Undang-Undang Perlindungan Data Pribadi — UU PDP Nomor 27 Tahun 2022 — yang mewajibkan data kandidat diakses hanya oleh pihak yang berwenang."

---

## ▶ BAGIAN 3 — SOLUSI TEKNIS (1:45 – 2:45)

**[Layar: Diff kode — FitGap::Engine]**

> "Saya memperbaiki ketiga bug ini dengan pendekatan yang saya sebut 'harmonized contract'. Di sini saya mengubah FitGap::Engine agar mengirimkan `required_level` — bukan `expected_level` — sehingga backend dan frontend berbicara bahasa yang sama. Saya juga menambahkan field `is_override` dan `assessor_notes` agar kalibrasi assessor ikut dikirim ke UI."

**[Layar: Diff kode — PortfoliosController]**

> "Untuk mengatasi bug polling, controller sekarang mengembalikan HTTP 202 Accepted ketika laporan masih dalam proses. Artinya, frontend tahu laporan sedang dibuat — bukan gagal. Di sisi frontend, saya tambahkan batas maksimal 15 kali polling, jadi tidak ada lagi loop tanpa akhir."

**[Layar: Diff kode — tenant scoping]**

> "Dan untuk keamanan multi-tenant: setiap query ke database sekarang di-scope berdasarkan tenant dari session pengguna yang sedang login. Kalau ada akses lintas tenant, server langsung mengembalikan 404 — bukan data orang lain."

**[Layar: Diff kode — Portfolios::Generator#save_skills]**

> "Satu perbaikan tambahan yang penting: operasi simpan skill sekarang dibungkus dalam transaction. Kalau ada langkah yang gagal di tengah jalan, seluruh operasi dibatalkan. Tidak ada lagi data yang tersimpan sebagian."

---

## ▶ BAGIAN 4 — HASIL UI/UX MONOZUKURI (2:45 – 3:45)

**[Layar: AFTER — Recruiter Executive Summary card]**

> "Sekarang kita lihat hasilnya. Ini adalah tampilan baru Fit/Gap Report. Di bagian atas ada Recruiter Executive Summary — sebuah kartu ringkasan yang menampilkan angka kecocokan kandidat, rekomendasi keputusan, dan enam metrik utama. Recruiter bisa langsung tahu dalam tiga detik."

**[Layar: AFTER — tabel 5 kolom dengan level progression]**

> "Di tabel di bawahnya, sekarang ada lima kolom: nama skill, level yang dibutuhkan posisi, level yang dinilai AI, level akhir setelah kalibrasi assessor, dan status — apakah Fit, Gap, Override, atau Unassessed. Kalau assessor mengubah nilai AI, ada catatan kalibrasi yang muncul langsung di bawah baris tersebut — transparan dan bisa ditelusuri."

**[Layar: AFTER — tab filtering]**

> "Ada juga tab filter interaktif. Recruiter bisa klik 'Gaps' untuk melihat skill yang kurang, atau klik 'Overrides' untuk melihat semua kalibrasi manual yang sudah dilakukan assessor. Satu klik, langsung terfilter."

**[Layar: AFTER — generating state dengan progress bar]**

> "Dan saat laporan sedang dibuat, ini yang muncul: progress bar dengan pesan yang jelas, bukan spinner tanpa informasi. Kalau sampai batas waktu, ada tombol retry yang bisa diklik — bukan halaman yang terus muter sendiri."

**[Layar: AFTER — tampilan mobile]**

> "Semua ini juga responsif. Di layar mobile 390px, kartu dan tabel tetap terbaca dengan baik, tanpa teks yang terpotong."

---

## ▶ BAGIAN 5 — BUKTI TEST DAN PENUTUP (3:45 – 4:15)

**[Layar: Terminal — RSpec running]**

> "Terakhir, bukti bahwa ini bukan hanya terlihat bagus — tapi juga benar secara teknis. Saya menjalankan RSpec sekarang."

*(Tunggu output terminal muncul)*

**[Layar: Terminal — output "14 examples, 0 failures"]**

> "14 test, 0 kegagalan. Test ini mencakup: Engine yang menghasilkan data benar, controller yang memblokir akses lintas tenant, dan controller override yang tidak menghancurkan laporan yang sudah ada."

**[Layar: Kembali ke halaman Fit/Gap Report yang sudah revamp]**

> "Ada satu hal yang saya sangat banggakan: saya sengaja menanamkan bug di branch terpisah — menyetel `required_level` menjadi nil — dan RSpec langsung menangkap 3 kegagalan. Itu bukti bahwa test suite ini benar-benar bisa mendeteksi regresi, bukan sekadar formalitas."

> "Jadi, dalam satu vertical slice yang fokus, saya berhasil memperbaiki tiga bug P0, memenuhi UU PDP, membangun UI yang bisa dipahami recruiter dalam tiga detik, dan membuktikan semuanya dengan automated test. Terima kasih sudah menonton."

---

## Catatan Pengucapan untuk Istilah Teknis

| Istilah | Cara Baca |
|---|---|
| Fit/Gap | "fit — gap" |
| RSpec | "ar-es-pek" |
| Sidekiq | "said-kik" |
| HTTP 202 | "hach-ti-ti-pi — dua ratus dua" |
| API | "ei-pi-ai" |
| UU PDP | "u-u — pe-de-pe" |
| Tenant | "te-nant" |
| ActiveRecord | "aktif-re-kord" |
| Transaction | "tran-sak-si" |
| Polling | "po-ling" |
| Override | "over-ride" |
| Frontend / Backend | dibaca apa adanya |

---

## Checklist Sebelum Rekam

- [ ] Browser sudah buka halaman Fit/Gap Report yang revamp
- [ ] Terminal siap untuk menjalankan `bundle exec rspec`
- [ ] Volume microphone dicek, tidak ada noise
- [ ] Screen recording dimulai sebelum mulai bicara
- [ ] Pastikan tidak ada notifikasi popup saat merekam
- [ ] Jalankan RSpec live di depan kamera — jangan gunakan rekaman lama

---

## Checklist Setelah Rekam

- [ ] Durasi video antara 3 menit 45 detik – 5 menit
- [ ] RSpec output terlihat jelas di layar
- [ ] Semua screenshot AFTER muncul di layar saat dijelaskan
- [ ] Tidak ada istilah yang salah (misalnya menyebut "expected_level" saat seharusnya "required_level")
- [ ] Upload ke platform yang ditentukan dan salin URL video ke compliance matrix
