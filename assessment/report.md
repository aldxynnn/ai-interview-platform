# Product Impact & Fit/Gap Reliability: Rakamin AI Interview Platform

**Case study:** Fullstack Product Engineer  
**Tanggal:** 26 Oktober 2026  
**Branch implementasi:** [feat/monozukuri-fullstack-craft](https://github.com/aldxynnn/ai-interview-platform/tree/feat/monozukuri-fullstack-craft)  
**Parent base branch:** `take-home/trustworthy-fitgap-20261026`  
**Area perubahan:** `api/`, `web/`, `.github/workflows/ci.yml`, dan `assessment/`

---

## Ringkasan Eksekutif

Prinsip utama yang memandu implementasi ini adalah **Monozukuri (Pride in Making)**:
> *"The change we are most interested in is the one that makes this product genuinely better for the people it touches, not the one that touches the most lines of code."*

Perubahan berfokus pada dua pilar berbobot seimbang:
1. **Product Impact & Monozukuri Craft (50%):** Menghadirkan pengalaman pengguna kelas enterprise yang utuh, empatik, dan transparan. Mencakup gerbang kepatuhan **UU Pelindungan Data Pribadi (UU PDP No. 27/2022)** yang mewajibkan *explicit consent* sebelum wawancara AI dimulai, pengawasan *Human-in-the-Loop*, serta perombakan menyeluruh desain UI/UX di seluruh alur assessor dan kandidat (Assessment Hub, Job Vacancies, Portfolio Results, Live Monitor, Transcript, dan Auth).
2. **Engineering Craft & System Rigor (50%):** Keandalan sistem fullstack dengan isolasi multi-tenant yang ketat (*tenant-scoping* pada portfolio, vacancy, dan fit/gap report), kontrak API/UI yang selaras (*expected_level* vs *required_level*, pembedaan tegas *not_assessed* vs *gap*), background worker tahan kegagalan (*fingerprint*, *lease token*, *idempotency guards*), perlindungan data sensitif, serta harness pengujian otomatis (19 RSpec examples + 7 Vitest specs = 26 automated tests, 0 failures).

---

## 1. Konteks Produk dan Pengguna

Platform ini mempertemukan dua sisi pengguna penting:
- **Assessor & Hiring Manager:** Membutuhkan dasar pertimbangan objektif, auditable, dan transparan untuk menilai kesesuaian kandidat dengan kebutuhan organisasi tanpa kehilangan kontrol manual (*human override*).
- **Kandidat Wawancara:** Berada dalam posisi rentan ketika dievaluasi oleh kecerdasan buatan. Mereka berhak atas transparansi parameter penilaian, jaminan kerahasiaan data suara dan transkrip, serta kepastian bahwa keputusan akhir tetap di tangan manusia (*Human-in-the-Loop*).

### Konsekuensi Desain & Regulasi:
1. **Kepatuhan UU PDP No. 27/2022:** Pemrosesan audio suara dan transkrip AI memerlukan persetujuan eksplisit kandidat (*Candidate Explicit Consent*) yang dijelaskan dengan bahasa lugas sebelum hardware check dan interaksi suara dapat diakses.
2. **Pembedaan Objektif Evidence:** Ketiadaan bukti atas suatu keahlian tidak boleh otomatis divonis sebagai *gap/kekurangan* melainkan diakui sebagai `not_assessed` (belum dinilai).
3. **Isolasi Data Antar-Tenant:** Tidak ada celah bagi pengguna Tenant A untuk melihat atau menjadwalkan laporan pada resource milik Tenant B (*defense-in-depth scoping*).
4. **State Machine UI Lengkap:** Setiap halaman menangani seluruh status interaksi (*loading skeleton*, *empty state* dengan CTA jelas, *error banner* dengan tombol retry, *partial write*, dan *responsive layout* desktop/mobile).

---

## 2. Gap Analysis Berdasarkan Prioritas

| Prioritas | Temuan Awal | Dampak Workflow | Solusi Rekayasa yang Dikirim |
|---|---|---|---|
| **P0** | **UU PDP Compliance Gap** pada alur kandidat. Kandidat langsung diarahkan ke pengecekan mic/speaker tanpa disclosure hak privasi dan consent eksplisit. | Risiko hukum serius di bawah UU PDP No. 27/2022, potensi gugatan privasi, dan ketidaknyamanan kandidat terhadap evaluasi AI. | Komponen `CandidatePDPNotice` dengan rincian hak yang dapat diperluas (*Human-in-the-Loop*, enkripsi, transparansi rubrik, hak klarifikasi) dan gating hardware check di balik persetujuan eksplisit. |
| **P1** | **Tenant-Scoping Bypass Risk** pada resource vacancy, portfolio, dan fit/gap report. | Potensi kebocoran data kandidat dan profil lowongan antar perusahaan (cross-tenant leakage). | Terapkan isolasi scoping berlapis (*defense-in-depth*) dengan verifikasi `tenant_id` eksplisit dan request specs multi-tenant. |
| **P1** | **Kontrak API/UI Fit/Gap Tidak Konsisten** (`expected_level` vs `required_level`, flag override terabaikan). | Level perbandingan kompetensi dan penimpaan nilai assessor ditafsirkan keliru oleh frontend. | Penyelarasan tipe TypeScript, payload serialisasi Rails, dan validasi rubrik L1–L5. |
| **P1** | **Lifecycle Background Job & Idempotensi Lemah**. | Worker AI rentan terhadap duplikasi pekerjaan, kondisi *race condition*, dan data stale. | Penambahan state machine lifecycle (`queued`, `generating`, `complete`, `failed`, `stale`), *fingerprint*, *lease token*, dan *idempotency lock*. |
| **P1** | **False Completion pada Invitation Token Gagal**. | Token invitation rusak/invalid menampilkan seolah-olah wawancara telah selesai. | Penanganan error eksplisit dengan alert informatif dan CTA kontak tim rekrutmen. |
| **P2** | **Kompetensi Tanpa Bukti Dicap Sebagai Gap**. | Kandidat dirugikan karena keterampilan yang memang tidak diuji diberi label negatif. | Pemisahan status `not_assessed` secara visual dan algoritmik dari `gap` dan `match`. |
| **P2** | **Portfolio Generation Partial Write**. | Jika parsing LLM gagal di tengah jalan, database berada dalam state korup atau menimpa override assessor. | Validasi skema sebelum commit, pemrosesan dalam transaksi database (`ActiveRecord::Base.transaction`), dan preservasi override assessor. |
| **P3** | **Kualitas UI/UX Minimalis & Monoton**. Halaman assessor hanya berupa list kartu polos tanpa ringkasan metrik, filter pencarian, dan branding. | Pengalaman kerja asesor lambat dan tidak mencerminkan produk siap rilis (*production-ready*). | Perombakan menyeluruh desain antarmuka (*AssessorLayout*, *AssessmentListPage*, *VacancyListPage*, *PortfolioPage*, *TranscriptPage*, *LiveMonitorPage*, *LoginPage*). |

---

## 3. Detail Implementasi Monozukuri & UI/UX

### A. Candidate Privacy & Consent Gate (`CandidatePDPNotice`)
- **Letak:** `web/src/components/interview/CandidatePDPNotice.tsx`
- **Fitur:**
  - Banner gradient sky/indigo yang ramah dan menenangkan bagi kandidat.
  - Ringkasan posisi jabatan dan batas waktu maksimal wawancara.
  - Bagian rincian hak kandidat yang dapat diperluas (*expandable*) memuat 4 pilar UU PDP:
    1. **Pengawasan Manusia (Human-in-the-Loop):** AI hanya asisten evaluasi; keputusan ada pada manusia.
    2. **Data Terenkripsi & Terisolasi:** Audio dan transkrip tidak dijual dan tidak dipakai melatih model publik.
    3. **Transparansi Rubrik Penilaian:** Parameter penilaian L1–L5 objektif berbasis bukti faktual.
    4. **Hak Klarifikasi Kandidat:** Hak mengajukan klarifikasi hasil wawancara kepada HR (UU PDP Pasal 5–13).
  - Checkbox persetujuan eksplisit yang mengunci (*gates*) hardware check dan sesi interaksi suara.
  - Tiga unit tests Vitest (`CandidatePDPNotice.test.tsx`) menguji render, toggle ekspansi, dan pemanggilan callback.

### B. Revitalisasi Assessor Workspace Hub (`AssessmentListPage`)
- **Metrik Strip:** Menampilkan total sesi penilaian, sesi aktif (*Live Now*), dan sesi selesai.
- **Real-Time Filter:** Pencarian instan berdasarkan judul posisi atau nama kandidat.
- **Badge Status Semantik:** Badge interaktif dengan animasi *ping pulse* untuk sesi yang sedang berlangsung.
- **Bahasa & Durasi:** Tag visual untuk bahasa wawancara (Bahasa Indonesia / English) dan batas waktu.
- **Perbaikan URL Undangan:** Menggunakan `window.location.origin` agar URL invitation kandidat selalu valid di environment apa pun.

### C. Manajemen Lowongan & Taksonomi Kompetensi (`VacancyListPage`, `VacancyNewPage`, `VacancyEditPage`)
- **Metrik Ringkasan:** Total open vacancies, total target kompetensi terdefinisi, dan kesiapan AI fit/gap.
- **Filter Pencarian:** Penyaringan cepat berdasarkan judul pekerjaan, nilai budaya, atau keterampilan teknis.
- **Pill Kompetensi Berjenjang:** Visualisasi tingkat keahlian yang diharapkan (misal `React L3`, `Distributed Systems L4`).
- **Formulir Terstruktur:** Pemisahan kartu identifikasi peran, penetapan rubrik keahlian (L1–L5) dengan *SkillPicker*, serta panduan konteks budaya dan ekspektasi kualitatif untuk analisis AI.

### D. Portfolio Hasil & Fit/Gap Launcher (`PortfolioPage`)
- **Metrik Kompetensi:** Rekapitulasi jumlah kompetensi terkonfigurasi, kompetensi temuan baru (*discovered skills*), dan override asesor.
- **State Dinamis yang Informatif:** Animasi proses analisis AI dengan penjelasan tahapan dan indikator polling otomatis; penanganan kegagalan dengan tombol coba ulang yang aman.
- **Fit/Gap Launcher Terintegrasi:** Dropdown pemilihan vacancy yang menampilkan ringkasan jumlah keahlian yang disyaratkan serta tombol satu klik untuk menjalankan analisis kesesuaian.

### E. Penampil Transkrip Dialog Interaktif (`TranscriptPage`)
- **Statistik Percakapan:** Ringkasan jumlah turn total, pertanyaan AI, dan respon kandidat.
- **Pencarian Kata Kunci:** Fitur filter langsung pada teks transkrip untuk melacak penyebutan teknologi atau metrik tertentu.
- **Bubble Percakapan Modern:** Avatar dan warna kontras untuk AI vs Kandidat, penomoran turn, serta tombol salin (*copy quote*) dengan feedback visual mikro.
- **Unduh Transkrip:** Ekspor transkrip lengkap berformat `.txt` dengan header terstruktur.

### F. Modernisasi Autentikasi (`LoginPage`, `SignupPage`)
- **Visual Branding:** Gradient logo dengan ikon Sparkles dan tipografi profesional.
- **Trust Badges:** Penegasan kepatuhan UU PDP No. 27/2022, isolasi data multi-tenant, dan rubric auditing.
- **Role Toggle:** Pemilihan peran yang jelas antara Assessor dan Admin.

---

## 4. Harness Pengujian Otomatis (Proven Correctness)

Semua pengujian berjalan 100% lulus di lokal dan CI GitHub Actions:

### Backend RSpec Suite (19 Examples, 0 Failures)
- `spec/requests/api/v1/assessments_spec.rb`: Pengujian pembuatan, pengambilan, dan otorisasi assessment multi-tenant.
- `spec/requests/api/v1/sessions_spec.rb`: Pengujian siklus hidup sesi wawancara, pembuatan token, dan masking PII.
- `spec/requests/api/v1/portfolios_spec.rb`: Pengujian tenant isolation, pencegahan double-render pada kegagalan vacancy lookup, dan preservasi override.
- `spec/services/fit_gap_reporter_spec.rb`: Pengujian perhitungan rubrik match, exceed, gap, dan `not_assessed`.
- `spec/services/portfolio_generator_spec.rb`: Pengujian integritas penulisan transaksional database.

### Frontend Vitest Suite (7 Specs, 0 Failures)
- `CandidatePDPNotice.test.tsx` (3 specs):
  - Memverifikasi rendering teks disclosure UU PDP No. 27/2022.
  - Memverifikasi interaksi buka-tutup rincian hak privasi kandidat.
  - Memverifikasi bahwa checkbox memicu callback consent secara tepat.
- `ComparisonTable.test.tsx` (4 specs):
  - Memverifikasi perbandingan level kandidat vs level posisi.
  - Memverifikasi badge pembeda `not_assessed` dari `gap`.
  - Memverifikasi penandaan override assessor.
  - Memverifikasi aksesibilitas tabel.

### Production Vite Build
- `npm run build` sukses dalam 6.9 detik tanpa error TypeScript (`0 errors`).

---

## 5. Seeded Fault Test (Bukti Ketangguhan Test)

Untuk membuktikan bahwa rangkaian pengujian benar-benar mendeteksi regresi fungsional (bukan sekadar green build palsu), sebuah kegagalan disuntikkan secara sengaja pada scratch branch:

- **Bentuk Fault:** Bypass tenant scope pada lookup lowongan di `Api::V1::PortfoliosController`:
  ```ruby
  # Sengaja diubah menjadi unscoped untuk mensimulasikan bug isolasi data:
  @vacancy = Vacancy.unscoped.find_by(id: params[:vacancy_id])
  ```
- **Fault Commit:** [e59e85d](https://github.com/aldxynnn/ai-interview-platform/commit/e59e85d598a595781650442fc4a77c9165f75316)
- **Hasil CI Fault:** [GitHub Actions Run 40261374272](https://github.com/aldxynnn/ai-interview-platform/actions/runs/40261374272) **GAGAL** tepat pada asersi request lintas-tenant (19 examples, 1 failure). Test membuktikan bahwa upaya membaca lowongan tenant lain berhasil tertangkap.
- **Recovery Commit:** [69597d6](https://github.com/aldxynnn/ai-interview-platform/commit/69597d629ed162a436f8e3f024ec8a8c78a5818d) mengembalikan scoped lookup dengan verifikasi eksplisit.
- **Hasil CI Recovery:** [GitHub Actions Run 40261381460](https://github.com/aldxynnn/ai-interview-platform/actions/runs/40261381460) **LULUS** (19 examples, 0 failures).

---

## 6. AI Verification Moment

Selama perancangan backend helper `find_vacancy!`:
- **Kode Awal yang Dihasilkan AI:**
  ```ruby
  def find_vacancy!
    @vacancy = current_tenant.vacancies.find_by(id: params[:vacancy_id])
    render_error("Vacancy not found", :not_found) unless @vacancy
  end
  ```
- **Risiko & Temuan:**
  Pemanggilan `render_error` di Rails merender respons HTTP ke klien. Namun, fungsi helper ini tidak menghentikan eksekusi method controller induk (*early return*). Karena nilai kembalian `render_error` bernilai *truthy*, controller melanjutkan pemrosesan dan memanggil `render json: ...` untuk kedua kalinya. Ini mengakibatkan `AbstractController::DoubleRenderError` pada skenario error path.
- **Verifikasi & Koreksi:**
  Kode diperbaiki dengan mengembalikan `nil` secara eksplisit dan menambahkan guard di action controller:
  ```ruby
  def find_vacancy!
    @vacancy = current_tenant.vacancies.find_by(id: params[:vacancy_id])
    return @vacancy if @vacancy
    render_error("Vacancy not found", :not_found)
    nil
  end
  ```
  Ditambahkan pula regression spec spesifik untuk skenario ketika ID vacancy tidak ditemukan guna memastikan error 404 dikembalikan secara bersih tanpa exception server 500.

---

## 7. Indeks Artefak & Screenshot Bukti Nyata

Semua tangkapan layar diambil langsung dari browser Chromium nyata yang merender antarmuka aplikasi:

| File Screenshot | Deskripsi Halaman & Fitur yang Ditampilkan |
|---|---|
| `assessment/screenshots/01-candidate-pdp-consent.png` | Gerbang persetujuan kandidat UU PDP No. 27/2022 sebelum hardware check. |
| `assessment/screenshots/02-candidate-pdp-expanded.png` | Rincian hak privasi yang diperluas (Human-in-the-Loop, enkripsi, rubrik). |
| `assessment/screenshots/03-assessment-hub.png` | Assessment Hub asesor dengan kartu metrik, status live session, dan filter pencarian. |
| `assessment/screenshots/04-vacancies-list.png` | Dashboard Job Vacancies dengan metrik kompetensi, chip L1–L5, dan preview konteks AI. |
| `assessment/screenshots/05-candidate-mobile.png` | Tampilan responsive mobile kandidat (iPhone viewport 390x844). |
| `assessment/screenshots/06-auth-login.png` | Halaman login asesor bernuansa enterprise dengan trust badges dan validasi. |

---

## 8. Kesimpulan & Monozukuri Checklist

- [x] **Product Impact:** Kandidat terlindungi oleh consent gate UU PDP; asesor memiliki alur evaluasi yang andal dan transparan.
- [x] **Monozukuri UI/UX:** Seluruh antarmuka dirombak dengan hierarki visual modern, penanganan state lengkap (loading, empty, error, filter, responsive), dan micro-interactions yang rapi.
- [x] **Proven Correctness:** 26 pengujian otomatis (19 RSpec + 7 Vitest) dengan 0 kegagalan; verifikasi seeded fault test tercatat.
- [x] **Protected Data:** Tidak ada API key, token, atau PII rahasia yang ter-commit ke repositori git (`web/.env` tetap aman di gitignore).
- [x] **Small & Readable Commits:** Setiap perubahan dipecah menjadi commit logis dan deskriptif tanpa pernah menyentuh langsung branch `main`.
