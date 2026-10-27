# Rakamin Take-home — Product Impact & Fit/Gap Reliability

Tanggal verifikasi: 27 Oktober 2026  
Branch implementasi: `feat/fit-gap-trustworthy-revamp`  
Commit branch yang diverifikasi CI: `632aacdf59ef82d0fe7eeb091bf7558d46bc7459`

> **Status: implementasi dan CI tersedia; submission keseluruhan belum lengkap.** CI run [40449318172](https://github.com/aldxynnn/ai-interview-platform/actions/runs/40449318172) selesai dengan status success untuk API RSpec, rollback/re-apply migration, Web Vitest, dan production build. Draft PR [#8](https://github.com/aldxynnn/ai-interview-platform/pull/8) berada di fork pribadi. Browser/responsive review, screenshot aktual, clean-clone setup, dan live Gemini belum diverifikasi. Video dan PR upstream belum tersedia.

## Ringkasan eksekutif

Fokus perubahan adalah membuat alur Fit/Gap lebih dapat dipercaya dan aman, bukan melakukan redesign luas. Prioritas utama: tenant authorization, kejelasan status skill yang belum dinilai, lifecycle job/report, konsistensi kontrak API–UI, dan perlindungan data dari error provider yang mungkin berisi transcript. Ini sesuai tujuan case study untuk menilai dampak produk dan kualitas eksekusi.

## Step 1 — Memahami sistem dan baseline

- Repository memisahkan `api/` (Rails, PostgreSQL, Sidekiq, RSpec, Gemini) dan `web/` (React 18, TypeScript, Vite, Tailwind, Radix UI).
- README menjelaskan urutan setup, kebutuhan PostgreSQL/Redis, dan port API `3001` serta web `5173`.
- Brief menyatakan baseline tidak memiliki RSpec specs, frontend test runner, atau CI; branch ini menambahkan tes dan workflow CI.
- **Batas verifikasi:** dokumentasi setup telah ditelaah, tetapi menjalankan kedua service dan menguji seluruh alur browser dari clone bersih belum diverifikasi di lingkungan ini. Jangan mengklaim smoke test manual selesai sebelum kamu menjalankannya.

## Step 2 — Produk, pengguna, dan dampak

Pengguna utama adalah assessor/recruiter yang membandingkan bukti kompetensi kandidat dengan kebutuhan vacancy; hiring manager memakai hasil sebagai masukan keputusan. Kandidat juga terdampak walau tidak memakai dashboard secara langsung. Sistem perlu membantu keputusan manusia, bukan mengubah ketiadaan bukti menjadi kesimpulan bahwa kandidat tidak mampu.

Risiko produk yang ditangani:
- Akses lintas tenant dapat membocorkan portfolio atau laporan kandidat.
- Label gap yang salah dapat membuat assessor/hiring manager mengambil keputusan berdasarkan sinyal yang keliru.
- Job gagal atau hasil lama dapat membuat laporan tidak tersedia atau tidak konsisten.
- Error AI yang memuat response body/transcript dapat mengekspos data pribadi lewat log atau pesan error.

Konteks Indonesia: transcript wawancara dapat memuat data pribadi; implementasi perlu ditinjau terhadap UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi. Catatan ini adalah identifikasi risiko teknis, bukan pendapat hukum. Riset pasar eksternal dan wawancara pengguna tidak dilakukan dalam pekerjaan ini; klaim di atas berangkat dari brief dan analisis alur produk, bukan riset pasar primer.

## Step 3 — Temuan, prioritas, dan jenis masalah

| Prioritas | Temuan | Klasifikasi | Dampak dan arah perbaikan |
|---|---|---|---|
| P1 | Resource portfolio/skill/report atau vacancy perlu dibatasi pada tenant aktif | Risiko otorisasi; regression test membuktikan bypass scope dapat dideteksi | Mencegah akses lintas organisasi; scope resource dan tambahkan cross-tenant tests. |
| P1 | Kontrak Fit/Gap API dan UI berbeda pada field level/override | Defect/ketidakselarasan implementasi | Hindari level requirement atau override salah ditafsirkan; selaraskan payload dan tipe. |
| P1 | Lifecycle report, polling, dan worker dapat mengalami duplicate/stale work | Risiko reliability pada proses asynchronous | Status, fingerprint, lease token, dan idempotency guard membatasi pekerjaan ganda dan hasil usang. |
| P1 | Kegagalan lookup invitation dapat tampak seperti interview selesai | Defect error-state UX | Tampilkan error dan retry, bukan completion palsu. |
| P2 | Skill tanpa bukti dapat disalahartikan sebagai gap | Ambiguitas spesifikasi/produk yang ditangani lewat kontrak status eksplisit | Bedakan `not_assessed` dari gap yang didukung bukti. |
| P2 | Portfolio generation dapat gagal parsial atau menghilangkan override assessor | Risiko integritas data | Validasi output sebelum write, transaksi, dan pertahankan override manusia. |
| P2 | Provider exception bisa mengandung detail sensitif | Risiko privasi/logging | Simpan/log pesan generik; jangan keluarkan raw provider response. |
| P2/P3 | Setup, responsive state, dan interaksi keyboard belum dibuktikan lengkap | Kesenjangan verifikasi, bukan klaim bahwa semua UI rusak | README/CI diperbaiki; manual browser review tetap harus dilakukan. |

Perbedaan penting: error `DoubleRenderError` pada `find_vacancy!` ditemukan sebagai defect konkret dan diperbaiki. Sebaliknya, query vacancy tanpa `tenant_id` secara eksplisit tidak dengan sendirinya membuktikan bypass karena model memiliki default scope `TenantScoped`. Kondisi itu diperkuat dengan tenant condition eksplisit sebagai defense-in-depth. Eksperimen fault yang valid sengaja menggunakan `Vacancy.unscoped.find_by` untuk benar-benar melewati default scope.

## Step 4 — Pilihan solusi dan trade-off

| Opsi | Dampak produk | Biaya | Maintainability | Failure mode / risiko | Kesesuaian konteks |
|---|---|---|---|---|---|
| A. Trustworthy Fit/Gap end-to-end (**dipilih**) | Tinggi: otorisasi, kejelasan hasil, recovery | Sedang | Menyatukan lifecycle dan kontrak; perlu menjaga kompleksitas status tetap terkendali | Race condition, stale jobs, dan provider failure perlu dites eksplisit | Paling tepat karena hasil assessment menyangkut data kandidat dan keputusan hiring. |
| B. Redesign visual luas | Meningkatkan polish dan kemudahan penggunaan | Tinggi | Berisiko mengubah banyak komponen sekaligus | Regression visual dan scope creep; tidak menyelesaikan trust boundary dengan cepat | Kurang tepat sebagai prioritas pertama untuk take-home yang menekankan reliability. |
| C. Hanya selaraskan API/UI | Mengurangi mismatch dengan biaya rendah | Rendah | Sederhana | Otorisasi, job duplicate, dan integritas data tetap tidak tertangani | Tidak cukup untuk alur assessment yang asynchronous dan multi-tenant. |

Opsi A dipilih karena menyelesaikan risiko dengan dampak paling tinggi sambil menjaga perubahan tetap terarah. Trade-off-nya: lifecycle status dan retry logic menambah kompleksitas, sehingga perlu regression tests dan dokumentasi yang jelas. Redesign visual penuh sengaja tidak menjadi scope; polish visual perlu dinilai melalui manual review yang belum dilakukan.

## Step 5 — Implementasi dan acceptance criteria

Perubahan yang dibuat:
- Tenant-scope pada portfolio, portfolio skill, vacancy, dan Fit/Gap report; tambahkan tes untuk scheduling lintas tenant.
- Selaraskan field/tipe API dan UI Fit/Gap.
- Bedakan `not_assessed` dari gap kompetensi.
- Tambahkan lifecycle report/scheduler/worker dengan status, fingerprint, lease token, dan guard idempotensi.
- Validasi hasil portfolio generator sebelum write, gunakan transaksi, dan pertahankan override assessor.
- Hindari menyimpan/log raw error dari provider AI; error yang disimpan dan ditampilkan bersifat generik.
- Tampilkan error invitation dan retry di UI, bukan status completion palsu.
- Tambahkan RSpec, Vitest/component tests, CI workflow, dan perbaikan petunjuk setup.

Acceptance criteria yang menjadi dasar review:
1. Request tenant A untuk resource tenant B ditolak dan tidak menjadwalkan pekerjaan atau membuat side effect.
2. Skill tanpa bukti cukup berstatus `not_assessed`; hanya bukti yang memenuhi kriteria yang dapat mendukung gap.
3. Request generation berulang untuk fingerprint yang sama tidak membuat pekerjaan duplikat; job lama tidak boleh menimpa hasil baru.
4. Kegagalan provider tidak membocorkan raw response/transcript ke log atau error yang disimpan.
5. Kegagalan invitation terlihat sebagai error yang bisa dicoba ulang, bukan completion.
6. Portfolio generation memvalidasi hasil sebelum transaksi/write dan tidak menghapus override assessor.
7. Tes backend/frontend dan production build lulus.
8. Manual browser review harus memeriksa loading, empty, error/retry, partial/missing assessment, long text, responsive layout, keyboard/focus, serta console/network. Kriteria ini **belum diverifikasi manual**.

## Bukti pengujian

- **CI final branch:** [Run 40449318172](https://github.com/aldxynnn/ai-interview-platform/actions/runs/40449318172), commit `632aacdf59ef82d0fe7eeb091bf7558d46bc7459`, status success. Kedua job sukses: API RSpec (termasuk migration rollback/re-apply) dan Web Vitest + production build.
- **Seeded fault:** [fault commit](https://github.com/aldxynnn/ai-interview-platform/commit/e59e85d598a595781650442fc4a77c9165f75316) pada branch scratch mengubah lookup menjadi `Vacancy.unscoped.find_by`; [CI fault](https://github.com/aldxynnn/ai-interview-platform/actions/runs/40261374272) gagal sesuai harapan karena cross-tenant test gagal (19 examples, 1 failure). [Recovery commit](https://github.com/aldxynnn/ai-interview-platform/commit/69597d629ed162a436f8e3f024ec8a8c78a5818d) memulihkan tenant scope; [CI recovery](https://github.com/aldxynnn/ai-interview-platform/actions/runs/40261381460) lulus. Fault hanya berada di scratch branch.
- **AI Verification Moment:** CI menangkap defect nyata `DoubleRenderError` di `Api::V1::PortfoliosController#find_vacancy!`. Helper sebelumnya merender error tetapi mengembalikan nilai truthy, sehingga action bisa berlanjut dan mencoba render lagi. Helper diubah agar secara eksplisit mengembalikan `nil` setelah render error; request specs dan CI setelah perbaikan lulus.
- Bukti rinci: [verification-notes.md](verification-notes.md).

CI membuktikan checks otomatis pada commit tersebut; **CI tidak membuktikan** tampilan browser, responsive behavior, setup lokal dari clone bersih, atau live Gemini integration.

## Privasi dan risiko tersisa

Transcript wawancara dapat memuat data pribadi. Sebelum produksi, tim tetap perlu meninjau tujuan/dasar pemrosesan, pemberitahuan kandidat, minimisasi data, retensi/penghapusan, kontrol akses, transmisi ke penyedia AI, penerima data, dan kewajiban UU PDP. Tidak ada klaim bahwa tinjauan legal formal telah dilakukan.

## Status submission — jangan tandai selesai sebelum item manual beres

- [x] Branch implementasi dan perubahan kode tersedia: [branch](https://github.com/aldxynnn/ai-interview-platform/tree/feat/fit-gap-trustworthy-revamp).
- [x] Draft PR untuk review di fork: [PR #8](https://github.com/aldxynnn/ai-interview-platform/pull/8).
- [x] CI terbaru branch final lulus: [run 40449318172](https://github.com/aldxynnn/ai-interview-platform/actions/runs/40449318172).
- [x] Analisis, prioritas, trade-off, acceptance criteria, dan batas verifikasi didokumentasikan di folder `assessment/`.
- [ ] Jalankan app dan lakukan browser smoke test desktop/mobile; cek console/network, loading/empty/error/retry, long text, keyboard/focus; ambil screenshot asli. **Dikerjakan oleh submitter.**
- [ ] Verifikasi setup dari clone bersih dan uji Gemini failure/timeout (stub; live jika kredensial tersedia). **Dikerjakan oleh submitter.**
- [ ] Buat PR ke upstream `rakamindev/ai-interview-platform`. Upaya via integrasi ditolak HTTP 403; PR fork bukan pengganti PR upstream bila brief mewajibkannya. **Dikerjakan manual oleh submitter dengan akses yang sesuai.**
- [ ] Rekam dan host video walkthrough 3–5 menit, tambahkan link ke dokumen/submission. **Dikerjakan oleh submitter.**
- [ ] Setelah screenshot dan link video ditambahkan, ekspor laporan final ke PDF. **Dikerjakan oleh submitter.**

Catatan tenggat: brief mencantumkan Rabu, 19 Agustus 2026 pukul 13.00 WIB; tanggal tersebut telah lewat per tanggal verifikasi ini. Status pengerjaan di atas tidak mengubah tenggat yang tercantum di brief.
