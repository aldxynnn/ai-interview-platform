import React, { useState } from "react";
import { Shield, ChevronDown, ChevronUp, Lock, UserCheck, Eye, FileText, Check } from "lucide-react";

interface CandidatePDPNoticeProps {
  consented: boolean;
  onConsentChange: (consented: boolean) => void;
  roleTitle?: string;
  timeLimitMin?: number;
}

export default function CandidatePDPNotice({
  consented,
  onConsentChange,
  roleTitle,
  timeLimitMin,
}: CandidatePDPNoticeProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50/70 via-white to-sky-50/40 p-5 shadow-xs transition-all">
      <div className="flex items-start gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white shadow-xs">
          <Shield className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-sky-950">
              Pelindungan Data Pribadi &amp; Hak Kandidat (UU PDP No. 27/2022)
            </h3>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-900 transition-colors"
              aria-expanded={expanded}
            >
              {expanded ? (
                <>
                  Tutup rincian <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  Pelajari hak Anda <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
          <p className="text-xs leading-relaxed text-sky-900/80">
            Wawancara ini dipandu oleh kecerdasan buatan (AI) untuk posisi{" "}
            <span className="font-medium text-sky-950">{roleTitle || "yang dilamar"}</span> (durasi maksimal {timeLimitMin || 30} menit). Kami menjunjung tinggi transparansi, keadilan, dan keamanan data Anda.
          </p>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 rounded-lg border border-sky-100 bg-white/90 p-4 text-xs text-slate-700 animate-in fade-in-50 duration-200">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <UserCheck className="h-4 w-4 shrink-0 text-sky-600 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">Pengawasan Manusia (Human-in-the-Loop)</p>
                <p className="text-slate-600 leading-normal mt-0.5">
                  AI berfungsi sebagai asisten evaluasi objektif. Keputusan akhir sepenuhnya berada di tangan asesor dan hiring manager manusia.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Lock className="h-4 w-4 shrink-0 text-sky-600 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">Data Terenkripsi &amp; Terisolasi</p>
                <p className="text-slate-600 leading-normal mt-0.5">
                  Rekaman suara dan transkrip hanya dapat diakses oleh tim rekrutmen resmi penyedia kerja, tidak dijual, dan tidak dipakai untuk melatih AI publik.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Eye className="h-4 w-4 shrink-0 text-sky-600 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">Transparansi Rubrik Penilaian</p>
                <p className="text-slate-600 leading-normal mt-0.5">
                  Pertanyaan AI diarahkan untuk mengidentifikasi level kompetensi (L1–L5) berdasarkan bukti jawaban aktual Anda tanpa bias personal.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 shrink-0 text-sky-600 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">Hak Klarifikasi Kandidat</p>
                <p className="text-slate-600 leading-normal mt-0.5">
                  Sesuai UU PDP Pasal 5–13, Anda berhak mengetahui parameter penilaian dan mengajukan klarifikasi hasil wawancara kepada tim HR.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 pt-3.5 border-t border-sky-200/60">
        <label
          htmlFor="pdp-consent-checkbox"
          className="flex items-start gap-3 cursor-pointer select-none group"
        >
          <div className="relative flex items-center justify-center mt-0.5">
            <input
              id="pdp-consent-checkbox"
              type="checkbox"
              checked={consented}
              onChange={(e) => onConsentChange(e.target.checked)}
              className="peer sr-only"
            />
            <div className="h-4 w-4 rounded border border-sky-400 bg-white transition-all peer-checked:border-sky-600 peer-checked:bg-sky-600 peer-focus-visible:ring-2 peer-focus-visible:ring-sky-500 peer-focus-visible:ring-offset-1 group-hover:border-sky-500 flex items-center justify-center">
              {consented && <Check className="h-3 w-3 text-white stroke-[3]" />}
            </div>
          </div>
          <span className="text-xs text-slate-700 leading-normal group-hover:text-slate-900 transition-colors">
            Saya memahami alur wawancara ini dan <span className="font-semibold text-slate-900">memberikan persetujuan eksplisit</span> untuk pemrosesan audio suara dan transkrip wawancara guna penilaian kompetensi kerja sesuai ketentuan UU PDP No. 27 Tahun 2022.
          </span>
        </label>
      </div>
    </div>
  );
}
