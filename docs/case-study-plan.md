# Rencana Revamp Fullstack: Fit/Gap Report & Candidate Assessment
**Dokumentasi Perencanaan Teknis Case Study Product Engineer**  
**Fokus:** Fit/Gap Report yang Akurat, Andal, Aman (UU PDP), dan Berstandar Monozukuri  

---

## 1. Masalah Inti & Dampak Nyata Terhadap Pengguna

Berdasarkan verifikasi terarah pada repositori `ai-interview-platform`:

1. **Kegagalan Kontrak Data Fit/Gap (Data Seam Defect):**
   - *Masalah:* `FitGap::Engine` mengirimkan properti `:expected_level`, namun `ComparisonTable.tsx` dan TypeScript type membaca `c.required_level` (menghasilkan nilai `undefined`). Selain itu, informasi apakah suatu skor telah disesuaikan manusia (`:is_override`) tidak dikirimkan, dan narasi rekomendasi hiring (`overall_narrative`) tidak pernah ditampilkan jika narasi budaya (`culture_narrative`) terisi.
   - *Dampak Pengguna:* Hiring Manager dan Recruiter melihat tabel perbandingan dengan kolom target level yang **kosong tanpa angka**, kehilangan transparansi kalibrasi manusia (ikon ✏️ hilang), serta kehilangan ringkasan rekomendasi kelayakan rekrutmen.
2. **Badai Duplikasi Job Sidekiq Akibat Polling 404 (Job Storm):**
   - *Masalah:* `FitGapReport` baru dibuat di database setelah panggilan Gemini AI selesai (berdurasi 5–15 detik). Selama proses berjalan, `GET /fitgap/:vacancy_id` mengembalikan `404 Not Found`. Hook `usePolling` di frontend menangkap 404 dan langsung memicu `POST /fitgap` kembali setiap 5 detik.
   - *Dampak Pengguna & Sistem:* Terjadi antrean job berulang (*duplicate workers*), pemborosan kuota/rate-limit Gemini API, dan ketidakpastian status antarmuka bagi pengguna.
3. **Penghapusan Destruktif Catatan Kalibrasi Manusia (Data Loss):**
   - *Masalah:* `Portfolios::Generator#save_skills` memanggil `portfolio.portfolio_skills.destroy_all`, yang memicu *cascade deletion* pada relasi `has_one :assessor_override, dependent: :destroy`.
   - *Dampak Pengguna:* Seluruh catatan pertimbangan profesional dan revisi nilai yang telah diinput asesor terhapus permanen saat portofolio di-regenerate.
4. **Celah Otorisasi Lintas Tenant (IDOR):**
   - *Masalah:* Endpoint direct portfolio (`/portfolios/:id/fitgap`, `/portfolios/:id/export`, `/portfolios/:id/regenerate_fitgap`) menggunakan `Portfolio.find(params[:id])` tanpa memverifikasi kesesuaian `portfolio.session.tenant_id` terhadap `Current.tenant_id`.
   - *Dampak Pengguna & Kandidat:* Asesor dari Perusahaan A dapat mengakses atau mengekspor data evaluasi kandidat Perusahaan B, melanggar batas isolasi multi-tenant dan ketentuan UU PDP.
5. **Kebocoran Parameter Token & PII pada Log Server:**
   - *Masalah:* Tidak ada initializer `filter_parameter_logging.rb`, sehingga parameter seperti `invite_token`, `candidate_name`, dan kredensial tercatat terbuka di log Rails.
   - *Dampak Kandidat:* Pelanggaran perlindungan data pribadi kandidat (UU No. 27/2022).

---

## 2. Self-Defined Acceptance Criteria (Kriteria Keberterimaan)

Sesuai instruksi Step 4 PDF case study, berikut kriteria keberterimaan untuk setiap skenario dan edge case:

### A. Kontrak Data & Presentasi Fit/Gap
1. **Input Normal:**
   - Tabel menampilkan nama skill, level yang disyaratkan (`expected_level`), level capaian kandidat (`candidate_level`), dan badge hasil evaluasi (`match`, `gap`, `exceed`, `not_assessed`).
   - Selisih level (`delta`) ditampilkan secara jelas (misal: `+1` untuk exceed, `-1` untuk gap).
2. **Skill Belum Dinilai (*Unassessed Skills*):**
   - Jika suatu skill lowongan tidak teruji dalam wawancara, `candidate_level` bernilai `nil`, `result` berstatus `"not_assessed"`, tabel menampilkan tanda strip (`—`), dan status dihitung terpisah dalam ringkasan metrik.
3. **Rating Hasil Kalibrasi Asesor (*Overrides*):**
   - Jika skill memiliki override aktif, level yang digunakan dalam perhitungan Fit/Gap adalah `override_level`.
   - Tabel perbandingan wajib memuat penanda visual eksplisit (ikon pensil atau badge `"Dikalibrasi"`) beserta tooltip/keterangan yang membedakan nilai AI vs nilai hasil review manusia.
4. **Data Parsial (*Partial Data / Low Confidence*):**
   - Skill yang dievaluasi dengan `confidence == "low"` atau state `partial` harus menampilkan badge indikator kehati-hatian (*low confidence warning*) agar reviewer tidak mengambil keputusan terburu-buru.
5. **Teks Panjang (*Long Text States*):**
   - Narasi budaya kerja (`culture_narrative`) dan narasi rekomendasi hiring (`overall_narrative`) ditampilkan keduanya dalam kartu terpisah atau seksi bertingkat dengan tipografi yang nyaman dibaca (*whitespace-pre-wrap*, *relaxed line-height*).
   - Teks ringkasan kompetensi yang panjang tidak memecahkan layout tabel (*responsive card / collapsible detail*).

### B. Keandalan Sistem & Desain Jalur Kegagalan (*Failure Paths*)
6. **Penanganan Kegagalan Model & Timeout (*Model Call Failures*):**
   - Jika panggilan LLM ke Gemini gagal atau timeout, sistem beralih ke *fallback narrative generator* deterministik berbasis aturan perbandingan angka tanpa membuat proses Fit/Gap gagal total (*graceful degradation*).
7. **Pencegahan Job Duplikat & Idempotensi (*Duplicate Requests & Polling*):**
   - Endpoint `POST /portfolios/:id/fitgap` harus idempotent. Jika pembuatan laporan sedang berlangsung, kembalikan status `202 Accepted` (`status: "generating"`) tanpa memasukkan job baru ke Sidekiq.
   - Endpoint `GET /portfolios/:id/fitgap/:vacancy_id` saat status sedang diproses harus mengembalikan respons yang jelas (`{ status: "generating" }` atau laporan dengan status pending) dan bukan error `404 Not Found`, sehingga polling di frontend tidak memicu request `POST` berulang kali.
8. **Preservasi Data Kalibrasi Asesor (*Preserve Overrides on Regeneration*):**
   - Ketika portofolio di-regenerate, skill yang dianalisis ulang memperbarui nilai AI (`ai_level`, `ai_confidence`, `evidence`, `competency_summary`), namun `assessor_overrides` yang sudah tersimpan untuk skill tersebut **wajib dipertahankan** dan dihubungkan kembali secara aman.

### C. Keamanan & Privasi (UU PDP)
9. **Isolasi Multi-Tenant:**
   - Seluruh akses ke portofolio, Fit/Gap, dan ekspor PDF/JSON wajib memverifikasi bahwa `session.tenant_id == Current.tenant_id`. Jika tidak cocok, sistem melempar `404 Not Found` atau `403 Forbidden`.
10. **Sanitasi Logging:**
    - Parameter sensitif (`token`, `invite_token`, `candidate_name`, `password`, `secret`) otomatis disamarkan (*[FILTERED]*) pada seluruh log Rails.

---

## 3. Opsi Solusi & Analisis Trade-Off

| Dimensi Evaluasi | Opsi A: Minimal Frontend Hotfix | Opsi B: Fullstack Monozukuri Slice (Dipilih) | Opsi C: ActionCable Realtime Overhaul |
|---|---|---|---|
| **Product Impact** | Rendah. Memperbaiki tampilan tabel tapi membiarkan celah data loss & IDOR. | **Sangat Tinggi.** Fit/Gap akurat, data override aman, bebas duplikasi job, isolasi tenant terjamin, UI/UX matang. | Tinggi secara interaktivitas, tapi beban kompleksitas berlebihan. |
| **Effort Relatif** | Sangat Rendah (~0.5 hari). | **Sedang / Proporsional (~1.5–2 hari).** | Sangat Tinggi (>4 hari). |
| **Maintainability** | Buruk (utang teknis dan bug race condition tetap ada di backend). | **Sangat Baik.** Kode modular, migrasi aman, kontrak API & tipe TS sinkron. | Sulit dipelihara karena stateful WebSocket di berbagai runtime. |
| **Failure Modes** | Polling dari client lain tetap memicu job storm; override tetap terhapus saat regenerate. | **Terkendali.** Fallback narasi aktif saat Gemini down, idempotent worker lock mencegah duplikasi. | Kegagalan koneksi socket menyebabkan UI menggantung. |
| **Kesesuaian Konteks** | Tidak memenuhi kriteria *Monozukuri beyond minimum baseline*. | **Sangat Sesuai** dengan rubrik penilaian Product Engineer & kesiapan technical defense. | Berisiko tinggi terhadap stabilitas dan waktu pengiriman. |

### Pilihan Solusi: Opsi B (Fullstack Monozukuri Slice)
**Alasan:** Opsi B menyelesaikan akar masalah secara terpadu di backend dan frontend. Opsi ini memberikan nilai produk nyata bagi pengguna (tabel terbaca jelas, rekomendasi lengkap, data aman), menghapus risiko kehilangan data penilaian asesor, dan menjaga kepatuhan hukum UU PDP, dengan estimasi pengerjaan yang realistis dan dapat dipertanggungjawabkan saat live technical defense.

---

## 4. Rencana Automated Tests

1. **Backend Tests (RSpec):**
   - Menginisialisasi harness RSpec minimum (`rails generate rspec:install` atau konfigurasi `spec_helper.rb` & `rails_helper.rb`).
   - **FitGap::Engine Spec:**
     - Menguji perhitungan `expected_level`, `candidate_level`, `delta`, status `match`, `gap`, `exceed`, dan `not_assessed`.
     - Menguji penerapan override level pada perbandingan.
     - Menguji fallback narrative saat model LLM mengalami kegagalan.
   - **Portfolios Controller Spec:**
     - Menguji penolakan akses lintas tenant (IDOR prevention).
     - Menguji idempotensi trigger Fit/Gap (tidak menduplikasi Sidekiq job saat status generating).
   - **Portfolio Generator Spec:**
     - Menguji preservasi `assessor_override` saat portofolio di-regenerate.
2. **Frontend Tests (Vitest + Testing Library):**
   - Memasang test runner ringan di `web/` (`vitest`, `@testing-library/react`, `jsdom`).
   - **ComparisonTable Component Test:**
     - Menguji rendering kolom `Required` dengan level yang benar (L1–L5).
     - Menguji rendering penanda override (✏️) saat `is_override: true`.
     - Menguji rendering status `not_assessed`.
   - **FitGapReportPage Component Test:**
     - Menguji rendering kedua narasi (`culture_narrative` dan `overall_narrative`).
     - Menguji rendering state loading, partial data, dan error retry.
3. **Seeded Fault Verification:**
   - Memvalidasi bahwa test benar-benar menguji logika nyata dengan menjalankan tes sebelum perbaikan kode (harus fail), dan membuktikan lulus setelah perbaikan diimplementasikan.

---

## 5. Hasil Implementasi Aktual (Session 3 — 2026-10-25)

### File yang Diubah / Dibuat

| File | Status | Alasan |
|---|---|---|
| `api/app/services/fit_gap/engine.rb` | Modified (sesi sebelumnya) | Emit `expected_level`, `required_level`, `is_override` |
| `api/app/services/portfolios/generator.rb` | **Modified** | Upsert in-place daripada destroy_all — preservasi assessor_override |
| `api/app/controllers/api/v1/portfolios_controller.rb` | **Modified** | Tenant IDOR fix + idempotent fitgap + show_fitgap tidak lagi return 404 |
| `api/app/workers/fit_gap_generator_worker.rb` | **Modified** | Hapus Redis/cache lock di `ensure` setelah job selesai |
| `api/config/initializers/filter_parameter_logging.rb` | Created (sesi sebelumnya) | Filter PII dan token dari log |
| `web/src/pages/fitgap/FitGapReportPage.tsx` | **Rewritten** | Dual narrative, anti-duplicate trigger, state loading/error/empty/generating |
| `web/src/services/portfolios.ts` | **Modified** | Tipe return `getFitGap` yang benar (union type) |
| `web/src/types/index.ts` | Modified (sesi sebelumnya) | `SkillComparison` dengan `expected_level`, `required_level`, `is_override` |
| `web/src/components/fitgap/ComparisonTable.tsx` | Rewritten (sesi sebelumnya) | Metric banner, override badge, confidence warning |
| `web/src/components/fitgap/ComparisonTable.test.tsx` | Created (sesi sebelumnya) | Vitest test komponen |
| `web/src/pages/fitgap/FitGapReportPage.test.tsx` | **Created** | 10 test case: dual narrative, skeleton, error, polling idempotency |
| `web/vitest.config.ts` | Created (sesi sebelumnya) | Konfigurasi Vitest + jsdom |
| `web/src/test/setup.ts` | **Updated** | Tambah `/// <reference types>` untuk jest-dom Vitest augmentation |
| `web/tsconfig.json` | **Modified** | Tambah `vitest/globals` dan `@testing-library/jest-dom` ke types |
| `api/spec/spec_helper.rb` | Created (sesi sebelumnya) | RSpec config tanpa DB |
| `api/spec/services/fit_gap/engine_unit_spec.rb` | Created (sesi sebelumnya) | 3 spec unit tanpa DB |
| `api/spec/services/portfolios/generator_unit_spec.rb` | **Rewritten** | 6 spec dengan assertion nyata (override preservation + omission safety) |
| `api/spec/workers/fit_gap_generator_worker_unit_spec.rb` | **Created** | 6 spec unit lifecycle lock (safe release, retry retention, retries exhausted) |
| `docs/case-study-plan.md` | Created (sesi sebelumnya) + updated | Rencana + hasil aktual |

### Hasil Test Aktual (Dijalankan dan Diverifikasi)

```
# RSpec unit specs (tanpa DB, in-memory cache — BypassSandbox: true)
bundle exec rspec spec/services/fit_gap/engine_unit_spec.rb spec/services/portfolios/generator_unit_spec.rb spec/workers/fit_gap_generator_worker_unit_spec.rb --format documentation
15 examples, 0 failures ✅
- FitGap::Engine (3 specs): payload contract, is_override, fallback narrative
- Portfolios::Generator (6 specs): in-place upsert, label matching, override preservation, AI omission safety
- FitGapGeneratorWorker (6 specs): lock release on success, lock retention during retry, Kleppmann safe release with token, terminal error release, retries exhausted hook

# Frontend Vitest (npx vitest run --reporter verbose)
✓ ComparisonTable > renders expected level L3 and override indicator
✓ FitGapReportPage > renders skeleton during initial load
✓ FitGapReportPage > shows both culture_narrative and overall_narrative as separate sections
✓ FitGapReportPage > shows culture_narrative alone when overall_narrative is absent
✓ FitGapReportPage > shows overall_narrative alone when culture_narrative is absent
✓ FitGapReportPage > shows fallback when both narratives are absent
✓ FitGapReportPage > triggers POST fitgap exactly once when GET returns not_started
✓ FitGapReportPage > shows generating spinner when GET returns not_started and POST is triggered
✓ FitGapReportPage > shows error banner when portfolio load fails
✓ FitGapReportPage > renders the comparison table when report is loaded
✓ FitGapReportPage > shows timeout warning card when polling exceeds maximum attempts without report
Test Files: 2 passed | Tests: 11 passed ✅

# TypeScript type check
npx tsc --noEmit → 0 errors ✅

# Production build
npx vite build → ✓ 1841 modules, built in 7.60s ✅
```

### Acceptance Criteria yang Terpenuhi

| AC | Status |
|---|---|
| `expected_level` muncul di kolom Required (bukan undefined) | ✅ DONE |
| Override badge ✏ dikalibrasi tampil saat `is_override: true` | ✅ DONE |
| `culture_narrative` dan `overall_narrative` tampil di card terpisah | ✅ DONE |
| Fallback state saat kedua narasi kosong | ✅ DONE |
| POST fitgap hanya dipanggil sekali saat polling (no job storm) | ✅ DONE |
| `show_fitgap` GET tidak return 404 — return 200 + status | ✅ DONE |
| Lock dipertahankan selama retry Sidekiq (tidak dihapus pada StandardError) | ✅ DONE |
| Lock dilepas saat retries exhausted atau error terminal (RecordNotFound) | ✅ DONE |
| Safe lock release (Martin Kleppmann token) mencegah worker lama hapus lock baru | ✅ DONE |
| Enqueue failure cleanup melepas lock jika perform_async gagal | ✅ DONE |
| TTL 10 menit menaungi seluruh rentang retry Sidekiq (2 retries ~2-3 menit) | ✅ DONE |
| Override assessor tidak dihapus saat portfolio regenerasi | ✅ DONE |
| Tenant IDOR: portfolio endpoints verifikasi `session.tenant_id` | ✅ DONE |
| PII/token tidak muncul di log (filter_parameter_logging) | ✅ DONE |
| State loading, error, empty, generating semua ditangani | ✅ DONE |
| Aksesibilitas: aria-label pada semua tombol interaktif | ✅ DONE |
| Responsive layout (max-w-4xl) | ✅ DONE |
| TypeScript strict mode tanpa error | ✅ DONE |
| Production build lulus | ✅ DONE |
| Override assessor tidak dihapus saat portfolio regenerasi | ✅ DONE |
| Tenant IDOR: portfolio endpoints verifikasi `session.tenant_id` | ✅ DONE |
| PII/token tidak muncul di log (filter_parameter_logging) | ✅ DONE |
| State loading, error, empty, generating semua ditangani | ✅ DONE |
| Aksesibilitas: aria-label pada semua tombol interaktif | ✅ DONE |
| Responsive layout (max-w-4xl) | ✅ DONE |
| TypeScript strict mode tanpa error | ✅ DONE |
| Production build lulus | ✅ DONE |

### Kendala Tersisa

1. **PostgreSQL tidak berjalan di sandbox** — RSpec integration spec (`engine_spec.rb`, `rails_helper.rb`) tidak bisa dijalankan. Unit spec (no-DB) sudah diverifikasi.
2. **RSpec request spec untuk IDOR prevention** — membutuhkan DB. Tidak bisa dijalankan, hanya kode implementasi yang ada.
3. **`portfolio_skills_controller.rb#regenerate_stale_fitgap_reports`** masih memanggil `report.destroy` + `perform_async`. Ini by-design (override sudah aman karena fix di generator), tapi tetap merupakan kandidat untuk diubah menjadi soft-delete/status-based di masa depan.

### Hal yang Tidak Diubah (Out of Scope)

- Interview audio flow
- Assessment form deletion bug (`_destroy` pattern)  
- SkillCard prefix display bug
- Coverage system
- Redesign halaman lain


---

## 6. AI Verification Moments (Saran AI yang Berisiko / Terbukti Salah)

Sesuai instruksi brief Case Study Rakamin (Point 5 & Evaluator Guidelines), berikut adalah momen verifikasi di mana saran atau asumsi awal AI ditolak atau dikoreksi setelah audit kode sumber nyata:

1. **Hipotesis AI tentang Migration `generation_status` pada `fit_gap_reports`:**
   - *Saran Awal AI:* Menambahkan kolom `generation_status` pada tabel `fit_gap_reports` melalui Rails migration baru untuk melacak status pembuatan laporan.
   - *Hasil Verifikasi Kode:* DITOLAK (VERIFIED NOT NEEDED). Tabel `fit_gap_reports` menggunakan kolom `skill_comparisons` bertipe `jsonb`. Status laporan sudah diwakili oleh keberadaan record itu sendiri atau cache lock in-memory/Redis (`fitgap_generating:<portfolio_id>:<vacancy_id>`). Menjalankan migrasi database di lingkungan multi-tenant membawa risiko downtime, lock tabel, dan potensi kegagalan rollback tanpa nilai tambah arsitektural.
   - *Tindakan Koreksi:* Menggunakan idempotency lock berbasis cache (`Rails.cache.write(lock_key, true, expires_in: 3.minutes)`) di controller dan merilisnya di blok `ensure` worker Sidekiq.

2. **Pengabaian Akses Lintas Tenant pada `portfolio_skills_controller#override`:**
   - *Saran Awal AI:* Menganggap proteksi IDOR cukup hanya pada `portfolios_controller.rb`.
   - *Hasil Verifikasi Kode:* DITOLAK (VERIFIED CRITICAL DEFECT). `PortfolioSkill` tidak menggunakan `TenantScoped`. Pemanggilan `POST /api/v1/portfolio-skills/:id/override` memungkinkan asesor dari tenant lain mengubah nilai kalibrasi kandidat tenant korban dan memicu regenerasi laporan fit/gap tenant korban.
   - *Tindakan Koreksi:* Menambahkan verifikasi eksplisit `@portfolio_skill.portfolio.session.tenant_id == current_tenant_id` pada `set_portfolio_skill` sebelum aksi override diizinkan.

3. **Urutan Pengecekan pada `portfolios_controller#export`:**
   - *Saran Awal AI:* Menempatkan `authorize_portfolio!` setelah pengecekan kelayakan status (`unless @portfolio.complete?`).
   - *Hasil Verifikasi Kode:* DITOLAK (INFORMATION DISCLOSURE). Jika asesor tenant lain meminta export portofolio korban yang belum selesai di-generate, server mengembalikan error 422 "Portfolio is not ready (status: ...)" yang membocorkan status kandidat korban kepada pihak luar sebelum dicek otorisasi.
   - *Tindakan Koreksi:* Memindahkan `authorize_portfolio!(@portfolio)` ke baris pertama sebelum validasi format atau status.

4. **Penghapusan Skill Tanpa Mengecek Keberadaan Override:**
   - *Saran Awal AI:* Melakukan `skill.destroy unless matched` pada semua skill lama yang tidak ada dalam respon AI baru.
   - *Hasil Verifikasi Kode:* DITOLAK (DATA LOSS RISK). Jika model AI mengalami halusinasi atau omisi nama skill pada saat regenerasi, pemanggilan `skill.destroy` akan memicu `dependent: :destroy` pada `assessor_override`, menghapus catatan manusia secara permanen.
   - *Tindakan Koreksi:* Menambahkan klausa `skill.destroy unless matched || skill.assessor_override.present?`. Skill yang memiliki kalibrasi manusia dijamin tidak akan pernah dihapus oleh regenerasi otomatis AI.

---

## 7. Seeded Fault Test Verification (Bukti Pengujian Kesalahan Sengaja)

Untuk membuktikan bahwa test suite benar-benar menguji perilaku nyata (bukan sekadar mock selalu hijau):

1. **Seeded Fault 1: Menghapus Field `expected_level` / `required_level` di Frontend Table**
   - *Simulasi:* Mengembalikan implementasi `ComparisonTable.tsx` ke versi baseline (`c.required_level` saja sementara payload backend mengirim `expected_level`).
   - *Hasil:* Vitest `ComparisonTable.test.tsx` GAGAL dengan pesan: `expected "L3" to be in document, found empty string`.
   - *Kesimpulan:* Test terbukti menangkap regresi data seam frontend-backend.

2. **Seeded Fault 2: Mengembalikan `destroy_all` pada `Portfolios::Generator#save_skills`**
   - *Simulasi:* Mengembalikan baris `portfolio.portfolio_skills.destroy_all`.
   - *Hasil:* RSpec `generator_unit_spec.rb` GAGAL pada:
     - `updates the existing skill record in-place rather than destroying it` (destroyed bernilai `true`)
     - `preserves the assessor_override reference on the existing skill` (override bernilai `nil` karena destroyed)
   - *Kesimpulan:* Test terbukti melindungi sistem dari cascade deletion pada override asesor.

3. **Seeded Fault 3: Polling Tanpa Batas / Infinite Spinner**
   - *Simulasi:* Menghapus `pollCountRef` pada `FitGapReportPage.tsx`.
   - *Hasil:* Vitest `shows timeout warning card when polling exceeds maximum attempts without report` GAGAL karena kartu peringatan timeout tidak pernah muncul setelah 16 putaran polling.
   - *Kesimpulan:* Test terbukti memvalidasi designed failure path saat background job mengalami keterlambatan atau kegagalan.

---

## 8. Designed Failure Paths Matrix

| Kegagalan Sistem | Mekanisme Penanganan | Hasil Pengalaman Pengguna |
|---|---|---|
| **Gemini API Timeout / Rate Limit** | `FitGap::Engine#generate_narratives` menangkap exception dan fallback ke narasi berbasis aturan deterministik | Laporan tetap selesai di-generate; hiring manager tetap menerima ringkasan metrik dan perbandingan |
| **Worker Sidekiq Gagal / Crash** | Blok `ensure` di `FitGapGeneratorWorker` selalu menghapus `lock_key` di cache | Idempotency lock tidak menggantung; user dapat menekan tombol regenerasi tanpa terkunci |
| **Polling Latar Belakang Terlalu Lama (>75s)** | `pollCountRef` pada `FitGapReportPage.tsx` menghentikan polling pada upaya ke-15 | Spinner berhenti; muncul kartu peringatan ramah pengguna dengan tombol "Coba Regenerasi Ulang" |
| **Akses Lintas Tenant (IDOR)** | `authorize_portfolio!` dan `set_portfolio_skill` memverifikasi `tenant_id` session | Penyerang mendapat 403 Forbidden / 404 Not Found; tidak ada kebocoran status atau metadata |
| **Input Token / Password di Request** | `filter_parameter_logging.rb` menyaring 11 parameter sensitif | Log server Rails hanya mencatat `[FILTERED]`, melindungi privasi kandidat sesuai UU PDP |
