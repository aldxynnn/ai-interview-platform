import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, FileUp, Loader2, ShieldCheck } from "lucide-react";
import { vacanciesApi } from "@/services/vacancies";
import type { Vacancy } from "@/types";

interface VacancyPdfImportCardProps {
  onImported: (vacancy: Vacancy) => void;
  compact?: boolean;
}
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function VacancyPdfImportCard({ onImported, compact = false }: VacancyPdfImportCardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (!file) { setError("Pilih file PDF deskripsi pekerjaan terlebih dahulu."); return; }
    if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf")) {
      setError("File harus berupa PDF."); return;
    }
    if (file.size > MAX_FILE_SIZE) { setError("Ukuran PDF maksimal 10 MB."); return; }
    setError(null);
    setImporting(true);
    try {
      const response = await vacanciesApi.importPdf(file);
      onImported(response.data.vacancy);
    } catch (e: any) {
      const status = e?.response?.status;
      const message = e?.response?.data?.errors?.[0]?.message || e?.response?.data?.error;
      setError(message || (status === 503
        ? "Ekstraksi AI sedang tidak tersedia. Coba lagi atau isi lowongan secara manual."
        : "PDF belum dapat diproses. Gunakan PDF teks yang jelas dan coba lagi."));
    } finally { setImporting(false); }
  };

  return (
    <Card id="vacancy-pdf-import" className="border-dashed">
      <CardHeader className={compact ? "pb-2" : "pb-3"}>
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><FileUp className="h-5 w-5" /></div>
          <div className="space-y-1">
            <CardTitle className="text-base">Buat fit/gap dari PDF lowongan</CardTitle>
            <CardDescription>Unggah job description. AI mengekstrak jabatan, ekspektasi kompetensi, dan skill; periksa hasilnya sebelum digunakan.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <label htmlFor="vacancy-pdf-file" className="block text-sm font-medium">File job description (PDF)</label>
        <input id="vacancy-pdf-file" type="file" accept="application/pdf,.pdf"
          onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(null); }}
          disabled={importing}
          className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:font-medium" />
        <p className="text-xs text-muted-foreground">PDF teks, maksimal 10 MB dan 50 halaman. PDF hasil scan tanpa teks belum didukung.</p>
        {file && <p className="text-xs text-muted-foreground">Dipilih: {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>}
        {error && <div role="alert" className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><span>{error}</span></div>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> PDF sumber tidak disimpan; hasil ekstraksi perlu ditinjau manusia.</p>
          <Button onClick={handleImport} disabled={!file || importing}>
            {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileUp className="h-4 w-4 mr-2" />}
            {importing ? "Menganalisis PDF..." : "Import dan lanjutkan"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
