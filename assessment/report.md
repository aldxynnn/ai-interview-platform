# Rakamin Take-home — Product Impact & Fit/Gap Reliability

Tanggal: 26 Oktober 2026  
Branch implementasi: `take-home/trustworthy-fitgap-20261026`  
Upstream base yang diverifikasi: `b836d02f45c6300b238b98ad50e66ead706723b6`

> **Status akhir: belum sepenuhnya siap diserahkan.** Implementasi utama telah dibuat dan CI historis lulus, tetapi hasil CI untuk regression test terbaru belum terkonfirmasi; seeded fault belum memiliki bukti log bahwa test benar-benar gagal; browser/responsive screenshot, local clean setup, Gemini live, PR, dan video walkthrough belum tersedia.

## 1. Produk dan pengguna

Platform mendukung assessor/recruiter dalam membandingkan kompetensi kandidat dengan kebutuhan posisi. Hiring manager menggunakan hasilnya dalam keputusan lanjutan. Kandidat ikut terdampak walau tidak memilih alat ini. Karena itu, ketiadaan bukti tidak boleh otomatis menjadi bukti ketidakmampuan, dan AI harus mendukung penilaian manusia.

Arsitektur: `api/` Rails, PostgreSQL, Sidekiq, RSpec, Gemini; `web/` React 18, TypeScript, Vite, Tailwind, Radix UI. Brief menyebut baseline awal tidak memiliki RSpec specs, frontend test runner, atau CI.

## 2. Temuan prioritas

| Prioritas | Temuan | Dampak / solusi |
|---|---|---|
| P1 | Risiko akses lintas tenant pada portfolio/skill/report dan lookup vacancy | Resource harus di-scope ke tenant aktif; request tenant asing harus ditolak tanpa side effect. |
| P1 | Kontrak Fit/Gap API/UI tidak konsisten (`expected_level` vs `required_level`, override flag) | Selaraskan payload dan tipe agar perbandingan tidak salah atau ambigu. |
| P1 | Lifecycle report/polling dan worker rentan duplikasi atau hasil lama | Status, fingerprint, lease token, error handling, pertahankan report terakhir. |
| P1 | Kegagalan lookup invitation dapat tampak seperti interview selesai | Pisahkan completion dari error dan sediakan retry. |
| P2 | Skill matching/evidence AI dapat ambigu | Bedakan `not_assessed` dari gap; gunakan skill ID stabil dan validasi kutipan transcript. |
| P2 | Portfolio generation dapat berisiko partial write/override hilang | Validasi sebelum write, transaksi, pertahankan override assessor. |
| P2/P3 | Setup docs dan aksesibilitas/responsive belum seluruhnya terbukti | README/path/port diperbaiki; browser review masih dibutuhkan. |

## 3. Alternatif dan keputusan

- **A — Trustworthy Fit/Gap end-to-end (dipilih):** dampak langsung pada otorisasi, keandalan hasil, dan recovery; biaya sedang; scope terukur.
- **B — Redesign visual seluruh aplikasi:** potensi polish tinggi, tetapi biaya dan risiko perubahan luas; tidak menyelesaikan trust boundary secepat opsi A.
- **C — Hanya selaraskan kontrak API/UI:** murah, tetapi tidak mengatasi otorisasi, job lifecycle, dan integritas data.

## 4. Perubahan yang dibuat

- Tenant-scoping portfolio, portfolio skill, vacancy, dan report.
- Kontrak Fit/Gap diselaraskan; `not_assessed` dibedakan dari gap.
- Report scheduler/worker menggunakan status, fingerprint, lease token, dan guard idempotensi.
- Portfolio generator memvalidasi respons dan menggunakan transaksi sambil menjaga override assessor.
- Interview page menampilkan error invitation dan retry, bukan completion palsu.
- Vitest/component test, RSpec request/service specs, CI workflow, perbaikan README port/path.
- Tambahan regression spec untuk mencegah tenant A menjadwalkan Fit/Gap dengan vacancy tenant B.

## 5. Hasil pengujian

CI historis pada commit `1d285f951ce12857a8f9b86a07381d78cacc8f5b` dilaporkan lulus: 16 RSpec examples / 0 failures, Vitest, production build, serta migration rollback dan re-apply pada PostgreSQL disposable.

**Verifikasi terbaru:** setelah regression spec menemukan `AbstractController::DoubleRenderError`, helper `find_vacancy!` diperbaiki agar mengembalikan `nil` setelah merender error sehingga controller berhenti dengan benar. CI pada commit `fefb4ac2d65ade6e2d07821316c4da3a32179d61` lulus: job API RSpec dan job Web (Vitest + production build) sukses; migration rollback dan re-apply juga sukses dalam job API. Run: https://github.com/aldxynnn/ai-interview-platform/actions/runs/40260693346. Browser E2E/responsive, screenshot aktual, Gemini live/timeout, dan setup dari clone bersih tetap belum dilakukan atau belum terverifikasi.

## 6. AI Verification Moment

Review lanjutan menemukan `Api::V1::PortfoliosController#find_vacancy!` menggunakan `Vacancy.find_by(id: id)` tanpa `tenant_id`, padahal portfolio sudah di-scope ke tenant aktif. Endpoint scheduling Fit/Gap dapat menerima ID vacancy tenant lain. Query diperbaiki menjadi `Vacancy.find_by(id: id, tenant_id: current_tenant_id)` dan regression request spec ditambahkan. Ini temuan nyata pada implementasi AI-assisted, bukan contoh hipotetis; test baru belum terkonfirmasi lulus pada CI terbaru.

Detail: [verification-notes.md](verification-notes.md).

## 7. Seeded Fault Test

Scratch branch: `scratch/seeded-fault-fitgap-20261026`.

- Fault commit: https://github.com/aldxynnn/ai-interview-platform/commit/91f2405bd96395bc508bb99e7ea6541e0b0d3305
- Recovery commit: https://github.com/aldxynnn/ai-interview-platform/commit/74317ce7cd093da7825b2cb9d43f8917e26e1377

Percobaan awal di branch lama tidak terisolasi dengan benar karena test gagal akibat `DoubleRenderError` baik saat fault maupun recovery; hasil itu bukan bukti valid bahwa tenant fault yang memicu kegagalan. Percobaan terisolasi baru berjalan pada `scratch/seeded-fault-isolated-20261026`, dibuat dari commit yang telah memperbaiki error response. Fault commit `c5268e6f2a5384624db07bf4bbc822307174c06c`; recovery commit `0398928da567264baed414bda2f3723feab8a48f`. CI kedua commit masih berjalan saat laporan ini diperbarui; hasil akhir harus diperiksa sebelum mengklaim fault fail / recovery pass.

## 8. Privasi, UU PDP, dan risiko tersisa

Transcript wawancara dapat memuat data pribadi. Sebelum produksi, review tujuan/dasar pemrosesan, pemberitahuan kandidat, minimisasi, retensi/penghapusan, kontrol akses, transmisi ke penyedia AI, penerima data, dan kewajiban UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi. Ini daftar risiko untuk ditinjau, bukan kesimpulan legal atau klaim pelanggaran.

## 9. Submission dan tindak lanjut

- Branch: https://github.com/aldxynnn/ai-interview-platform/tree/take-home/trustworthy-fitgap-20261026
- CI historis: https://github.com/aldxynnn/ai-interview-platform/actions/runs/40256979092
- PR: belum dibuat. Branch implementasi siap untuk review; buat PR ke upstream setelah memastikan hasil CI terbaru dan isi deskripsi dengan batasan verifikasi.
- Video walkthrough 3–5 menit: belum direkam/di-host.
- UI screenshot: belum ada karena browser smoke test belum dilakukan.
- Local setup: ikuti `api/README.md` dan `web/README.md`; belum diverifikasi dari clone bersih.

### Acceptance criteria yang belum tertutup

1. Konfirmasi CI terbaru pada branch implementasi dan hasil test tenant baru.
2. Tunjukkan log seeded fault yang gagal, lalu bukti recovery pass.
3. Jalankan browser smoke test desktop/mobile, periksa console/network, keyboard/focus, empty/error/long-text states; ambil screenshot aktual.
4. Verifikasi local setup dan failure path Gemini dengan stub; live integration jika kredensial tersedia.
5. Siapkan PR sesuai izin pemilik repository serta video walkthrough 3–5 menit.
