# Product Impact & Fit/Gap Reliability

**Case study:** Fullstack Product Engineer  
**Tanggal:** 26 Oktober 2026  
**Branch implementasi:** [take-home/trustworthy-fitgap-20261026](https://github.com/aldxynnn/ai-interview-platform/tree/take-home/trustworthy-fitgap-20261026)  
**Area perubahan:** `api/`, `web/`, CI, dan dokumentasi

## Ringkasan eksekutif

Perubahan berfokus pada kepercayaan terhadap hasil Fit/Gap: akses harus dibatasi pada tenant yang benar, ketiadaan bukti kompetensi tidak boleh otomatis dinilai sebagai kekurangan, proses AI/background job harus tahan terhadap kegagalan dan duplikasi, dan assessor harus tetap memegang kendali atas override.

Pendekatan yang dipilih adalah satu slice full-stack yang memperkuat otorisasi, konsistensi kontrak, lifecycle report, integritas penulisan data, dan penanganan error. Otomatisasi pengujian ditambahkan agar regresi penting dapat dideteksi berulang, bukan hanya diperiksa secara manual.

## 1. Konteks produk dan pengguna

Platform membantu assessor/recruiter membandingkan bukti kompetensi kandidat dengan kebutuhan posisi. Hiring manager memakai hasil itu sebagai masukan keputusan; kandidat ikut terdampak walaupun tidak memilih alat penilaian ini.

Konsekuensi produk:
- Hasil harus membedakan bukti yang belum tersedia dari bukti bahwa suatu kompetensi belum memenuhi kebutuhan.
- AI adalah alat bantu analisis, bukan pengganti penilaian manusia.
- Data kandidat dan transcript wawancara perlu dibatasi aksesnya dan tidak boleh bocor melalui log atau pesan error.
- Status proses harus mencerminkan kondisi sebenarnya; kegagalan mengambil data tidak boleh terlihat seperti interview selesai.

Arsitektur baseline terdiri dari API Rails/PostgreSQL/Sidekiq/Gemini dan web React/TypeScript/Vite. Brief menyebut baseline tidak memiliki RSpec specs, frontend test runner, atau CI.

## 2. Gap analysis berdasarkan prioritas

| Prioritas | Temuan | Dampak pada workflow | Respons |
|---|---|---|---|
| P0 | Tidak ada P0 yang dapat dikonfirmasi hanya dari audit kode yang dilakukan. | Ini bukan jaminan bahwa risiko kritis tidak ada pada deployment/runtime. | Batasi klaim pada bukti yang tersedia; verifikasi runtime tetap menjadi kontrol tersendiri. |
| P1 | Resource portfolio, skill, report, dan vacancy memerlukan batas tenant yang konsisten. | Akses lintas tenant dapat mengungkap atau mengubah data organisasi lain. | Scope query ke tenant aktif; tambahkan request regression tests untuk akses lintas tenant. |
| P1 | Kontrak Fit/Gap API dan UI tidak konsisten pada nama field dan override state. | Level yang dibandingkan atau status override dapat ditafsirkan salah. | Selaraskan tipe dan payload di API/UI. |
| P1 | Lifecycle report dan background worker rentan terhadap duplikasi, hasil kedaluwarsa, atau state yang tidak jelas. | Assessor dapat melihat hasil lama atau proses yang tampak macet. | Tambahkan status lifecycle, fingerprint, lease token, dan guard idempotensi. |
| P1 | Kegagalan lookup invitation dapat menyerupai completion. | Pengguna dapat mengira sesi selesai padahal data tidak berhasil dimuat. | Tampilkan error state dan retry yang eksplisit. |
| P2 | Skill tanpa bukti dapat disalahartikan sebagai gap. | Kandidat berisiko dinilai negatif tanpa dasar bukti yang cukup. | Representasikan `not_assessed` secara eksplisit dan gunakan skill ID stabil. |
| P2 | Portfolio generation dapat gagal sebagian atau menimpa override assessor. | Data yang tersimpan tidak konsisten dan keputusan manusia hilang. | Validasi sebelum write, gunakan transaksi, dan pertahankan override. |
| P3 | Kualitas visual, responsive, dan aksesibilitas perlu ditinjau di browser nyata. | Layout atau state interaksi dapat bermasalah pada ukuran layar dan metode input berbeda. | Lakukan review browser desktop/mobile dan dokumentasikan screenshot aktual pada artefak submission. |

## 3. Opsi solusi dan trade-off

**Opsi A — Trustworthy Fit/Gap end-to-end (dipilih).** Memperbaiki trust boundary, konsistensi data, job lifecycle, dan state UI secara bersama. Biayanya menengah, tetapi langsung menyasar risiko keputusan dan integritas data.

**Opsi B — Redesign visual seluruh aplikasi.** Berpotensi meningkatkan polish secara luas, tetapi scope dan risiko regresinya besar serta tidak menyelesaikan otorisasi dan integritas background job terlebih dahulu.

**Opsi C — Hanya menyelaraskan kontrak API/UI.** Biaya rendah, tetapi meninggalkan risiko tenant isolation, job lifecycle, dan partial write.

Opsi A paling sesuai karena mengutamakan correctness dan perlindungan kandidat, dengan perubahan yang masih dapat diuji per modul. Trade-off-nya adalah redesign visual menyeluruh tidak menjadi fokus utama slice ini.

## 4. Acceptance criteria

1. Pengguna dari tenant A tidak dapat membaca atau menjadwalkan report dengan resource tenant B; request lintas tenant ditolak tanpa side effect.
2. Same-tenant positive control tetap berhasil.
3. Skill tanpa bukti dinyatakan `not_assessed`, bukan otomatis `gap`.
4. Field level, evidence, dan override memiliki kontrak konsisten antara API dan UI.
5. Job duplikat atau hasil lama tidak menimpa state yang lebih baru; lifecycle dan lease mencegah pemrosesan yang tidak sah.
6. Portfolio generation memvalidasi output sebelum menulis, memakai transaksi, dan mempertahankan override assessor.
7. Error provider tidak membocorkan raw response body atau detail sensitif ke log maupun status error yang disimpan.
8. Kegagalan lookup invitation terlihat sebagai error yang dapat dicoba ulang, bukan completion palsu.
9. Migration lifecycle dapat di-rollback dan diterapkan kembali.
10. Test suite backend/frontend dan production build berjalan di CI.

## 5. Implementasi

- Menambahkan tenant scoping pada akses portfolio, portfolio skill, vacancy, dan Fit/Gap report.
- Menyelaraskan kontrak Fit/Gap API/UI dan membedakan `not_assessed` dari gap.
- Memperkuat scheduler/worker dengan lifecycle state, fingerprint, lease token, dan idempotency guard.
- Memvalidasi portfolio generation sebelum write, membungkus perubahan data dalam transaksi, dan mempertahankan override assessor.
- Menyimpan pesan error generik dan mencegah raw response body provider masuk ke log atau exception HTTP client.
- Menambahkan error/retry state untuk lookup invitation.
- Menambahkan RSpec request/service/client tests, Vitest component test, workflow CI, dan pembaruan instruksi setup lokal.

## 6. Bukti pengujian otomatis

**CI pada snapshot kode branch sebelum pembaruan dokumentasi ini:** [GitHub Actions run 40271673290](https://github.com/aldxynnn/ai-interview-platform/actions/runs/40271673290) — kedua job berstatus sukses:
- API — RSpec, termasuk migrasi dan pemeriksaan rollback/re-apply.
- Web — Vitest dan production build.

Pembaruan setelah run tersebut hanya menyentuh dokumentasi laporan. Jalankan/cek ulang CI setelah commit dokumentasi terakhir sebelum menganggap status check pada HEAD PR sudah hijau.

**CI privacy regression snapshot:** [run 40264619423](https://github.com/aldxynnn/ai-interview-platform/actions/runs/40264619423) — 22 RSpec examples, 0 failures; Vitest, production build, dan migration rollback/re-apply lulus.

### Seeded fault test

Untuk membuktikan test mendeteksi regresi, lookup vacancy pada branch scratch sengaja diubah menjadi `Vacancy.unscoped.find_by(id: id)`, yang melewati default tenant scope.

- Fault commit: [e59e85d](https://github.com/aldxynnn/ai-interview-platform/commit/e59e85d598a595781650442fc4a77c9165f75316)
- [CI fault run](https://github.com/aldxynnn/ai-interview-platform/actions/runs/40261374272) gagal sesuai harapan: test lintas tenant menerima 503 alih-alih 404 (19 examples, 1 failure).
- Recovery commit: [69597d6](https://github.com/aldxynnn/ai-interview-platform/commit/69597d629ed162a436f8e3f024ec8a8c78a5818d)
- [CI recovery run](https://github.com/aldxynnn/ai-interview-platform/actions/runs/40261381460) lulus.

Fault hanya diterapkan pada branch scratch; tidak menjadi bagian dari implementasi final.

## 7. AI verification moment

Review menemukan error path pada `Api::V1::PortfoliosController#find_vacancy!`: saat vacancy tidak ditemukan atau ditolak, helper merender error tetapi hasil render yang truthy memungkinkan action berlanjut dan berpotensi melakukan render kedua (`AbstractController::DoubleRenderError`). Perbaikan mengembalikan `nil` secara eksplisit setelah render error, dengan request tests sebagai regression coverage.

Review juga memeriksa kekhawatiran query vacancy tanpa kondisi tenant eksplisit. Model memakai `TenantScoped` default scope, sehingga query awal saja bukan bukti bahwa bypass lintas tenant benar-benar terjadi. Implementasi menambahkan kondisi `tenant_id` eksplisit sebagai defense-in-depth; seeded fault menggunakan `unscoped` untuk menguji bypass secara nyata.

## 8. Privasi dan risiko

Transcript wawancara dapat mengandung data pribadi. Perubahan mencegah raw response body provider dan detail exception masuk ke log atau error state portfolio generation. Sebelum penggunaan produksi, organisasi tetap perlu meninjau dasar dan tujuan pemrosesan, pemberitahuan kandidat, minimisasi data, retensi/penghapusan, kontrol akses, transmisi kepada penyedia AI, penerima data, serta kewajiban UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi. Ini adalah area review, bukan kesimpulan hukum.

## 9. Batas bukti dan artefak submission

CI yang lulus membuktikan pemeriksaan otomatis yang tercakup oleh workflow, bukan seluruh perilaku runtime. Browser smoke test desktop/mobile, pemeriksaan visual keyboard/focus/contrast, screenshot UI aktual, dan verifikasi Gemini live belum dibuktikan oleh CI. Screenshot aktual dan video walkthrough 3–5 menit harus menjadi artefak submission; jangan menggantinya dengan gambar ilustratif atau mengklaim interaksi yang belum diuji.

**Pull request:** buat PR dari branch implementasi ke `main` upstream melalui [halaman compare GitHub](https://github.com/rakamindev/ai-interview-platform/compare/main...aldxynnn:take-home/trustworthy-fitgap-20261026?expand=1).
