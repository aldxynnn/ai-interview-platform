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

CI terbaru yang mencakup positive-control tenant dan same-tenant scheduling lulus pada commit `5a0b0dd488013d52f7623860a83b703db931bda5`: 19 RSpec examples / 0 failures, Vitest dan production build lulus, serta migration rollback dan re-apply lulus. Run: https://github.com/aldxynnn/ai-interview-platform/actions/runs/40261210781.

Perbaikan `DoubleRenderError` sebelumnya juga lulus CI pada commit `fefb4ac2d65ade6e2d07821316c4da3a32179d61`: https://github.com/aldxynnn/ai-interview-platform/actions/runs/40260693346.

Browser E2E/responsive, screenshot aktual, Gemini live/timeout, dan setup dari clone bersih belum dilakukan atau belum terverifikasi. CI hijau tidak membuktikan item-item manual tersebut.
## 6. AI Verification Moment

Verifikasi menemukan error path nyata pada `Api::V1::PortfoliosController#find_vacancy!`: saat vacancy tidak ditemukan atau ditolak, helper merender error tetapi sebelumnya mengembalikan hasil render yang truthy; controller lalu berlanjut dan dapat memicu `AbstractController::DoubleRenderError`. Helper diperbaiki agar merender error lalu mengembalikan `nil`, dan request spec membuktikan same-tenant path bekerja. CI awal menangkap kegagalan ini; CI setelah perbaikan lulus.

Pembedaan penting: review awal juga menyorot query vacancy yang tidak menuliskan `tenant_id`. Investigasi lebih lanjut menemukan model `Vacancy` memakai `TenantScoped` default scope. Karena itu, `Vacancy.find_by(id: id)` saja tidak cukup untuk menyimpulkan adanya bypass tenant dalam konfigurasi ini. Query sekarang tetap mencantumkan `tenant_id: current_tenant_id` sebagai defense-in-depth. Seeded fault yang valid menggunakan `Vacancy.unscoped.find_by(id: id)` untuk benar-benar melewati default scope; hasilnya dicatat di bagian berikut.

Detail: [verification-notes.md](verification-notes.md).

## 7. Seeded Fault Test

Percobaan valid dijalankan pada branch terpisah `scratch/seeded-fault-unscoped-20261026`, berbasis commit dengan positive-control test.

- Fault commit: https://github.com/aldxynnn/ai-interview-platform/commit/e59e85d598a595781650442fc4a77c9165f75316 — mengubah lookup menjadi `Vacancy.unscoped.find_by(id: id)`.
- CI fault: https://github.com/aldxynnn/ai-interview-platform/actions/runs/40261374272 — **gagal sesuai harapan**: request lintas tenant menerima 503, bukan 404; 19 examples, 1 failure. Ini membuktikan regression test mendeteksi bypass tenant scope.
- Recovery commit: https://github.com/aldxynnn/ai-interview-platform/commit/69597d629ed162a436f8f3e024ec8a8c78a5818d — mengembalikan lookup dengan tenant scope.
- CI recovery: https://github.com/aldxynnn/ai-interview-platform/actions/runs/40261381460 — **lulus**.

Percobaan scratch sebelumnya tidak terisolasi dengan benar dan tidak dipakai sebagai bukti. Percobaan yang dicantumkan di atas adalah bukti fault/recovery yang valid; fault hanya berada di scratch branch, bukan branch implementasi.
## 8. Privasi, UU PDP, dan risiko tersisa

Transcript wawancara dapat memuat data pribadi. Sebelum produksi, review tujuan/dasar pemrosesan, pemberitahuan kandidat, minimisasi, retensi/penghapusan, kontrol akses, transmisi ke penyedia AI, penerima data, dan kewajiban UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi. Ini daftar risiko untuk ditinjau, bukan kesimpulan legal atau klaim pelanggaran.

## 9. Submission dan tindak lanjut

- Branch: https://github.com/aldxynnn/ai-interview-platform/tree/take-home/trustworthy-fitgap-20261026
- CI terbaru (19 RSpec examples, 0 failures; Vitest/build/migration checks lulus): https://github.com/aldxynnn/ai-interview-platform/actions/runs/40261210781
- PR: pembuatan melalui integrasi GitHub ditolak dengan HTTP 403 (Resource not accessible by integration); tidak ada PR yang dibuat. Buat PR manual dari fork ke upstream menggunakan branch di atas.
- Video walkthrough 3–5 menit: belum direkam/di-host.
- UI screenshot: belum ada karena browser smoke test belum dilakukan.
- Local setup: ikuti `api/README.md` dan `web/README.md`; belum diverifikasi dari clone bersih.

### Acceptance criteria yang belum tertutup

1. Jalankan browser smoke test desktop/mobile, periksa console/network, keyboard/focus, empty/error/long-text states; ambil screenshot aktual.
2. Verifikasi local setup dari clone bersih dan failure path Gemini dengan stub; live integration jika kredensial tersedia.
3. Buat PR manual ke upstream (pembuatan via integrasi ditolak HTTP 403).
4. Rekam dan host video walkthrough 3–5 menit; tambahkan link video pada PR/submission.
