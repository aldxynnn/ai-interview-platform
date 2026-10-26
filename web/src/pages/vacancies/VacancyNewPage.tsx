import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import { vacanciesApi } from "@/services/vacancies";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Briefcase,
  Target,
  Sparkles,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import type { VacancySkill } from "@/types";

interface VacancyFormValues {
  role_title: string;
  culture_dimensions: string;
  competency_expectations: string;
  skills: Partial<VacancySkill>[];
}

export default function VacancyNewPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<VacancyFormValues>({
    defaultValues: {
      role_title: "",
      culture_dimensions: "",
      competency_expectations: "",
      skills: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "skills" });

  const onSubmit = async (data: VacancyFormValues) => {
    setError(null);
    setSubmitting(true);
    try {
      await vacanciesApi.create({
        role_title: data.role_title.trim(),
        culture_dimensions: data.culture_dimensions.trim(),
        competency_expectations: data.competency_expectations.trim(),
        vacancy_skills_attributes: data.skills,
      });
      navigate("/vacancies");
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Failed to save vacancy profile.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb / Nav */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link
          to="/vacancies"
          className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Vacancies
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-900">New Vacancy</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create Job Vacancy</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure role requirements and rubrics. These serve as the baseline criteria for automated candidate Fit/Gap evaluations.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Section 1: Basic Information */}
        <Card className="border-slate-200/90 shadow-2xs">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 pb-2 border-b border-slate-100">
              <Briefcase className="h-4 w-4 text-sky-600" />
              <span>Role Identification</span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role_title" className="text-xs font-semibold text-slate-700">
                Role Title <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="role_title"
                placeholder="e.g. Senior Backend Engineer (Go / Distributed Systems)"
                className="bg-white border-slate-200 shadow-2xs"
                {...register("role_title", { required: "Role title is required" })}
              />
              {errors.role_title && (
                <p className="text-xs text-rose-600 font-medium">{errors.role_title.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Expected Skills */}
        <Card className="border-slate-200/90 shadow-2xs">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Target className="h-4 w-4 text-sky-600" />
                <span>Benchmark Competencies &amp; Rubric</span>
              </div>
              <span className="text-xs text-slate-400">
                {fields.length} {fields.length === 1 ? "skill" : "skills"} configured
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Define the required competency level (L1–L5) for each skill. During evaluation, candidate portfolio evidence will be compared against these benchmarks.
            </p>

            {fields.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-8 text-center space-y-3">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                  <Target className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-900">No skill benchmarks added yet</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Select competencies from our taxonomy to set expected proficiency levels.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPickerOpen(true)}
                  className="bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                >
                  <Plus className="h-3.5 w-3.5 mr-1 text-sky-600" /> Browse Skill Taxonomy
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {fields.map((field, index) => {
                  const currentLevel = watch(`skills.${index}.expected_level`) ?? 3;
                  return (
                    <div
                      key={field.id}
                      className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 space-y-3 transition-all hover:border-slate-300"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-100 text-2xs font-bold text-sky-700">
                            {index + 1}
                          </span>
                          <span className="text-sm font-semibold text-slate-900">
                            {watch(`skills.${index}.skill_label`)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors"
                          title="Remove skill"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="pt-1 border-t border-slate-100/80">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-600">Expected Proficiency Level:</span>
                          <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200/60">
                            Level {currentLevel} of 5
                          </span>
                        </div>
                        <LevelRadio
                          value={currentLevel}
                          onChange={(v) => setValue(`skills.${index}.expected_level`, v)}
                        />
                      </div>
                    </div>
                  );
                })}

                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPickerOpen(true)}
                    className="border-slate-200 hover:bg-slate-50 text-slate-700"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1 text-sky-600" /> Add Another Skill
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 3: Culture & Competency Expectations */}
        <Card className="border-slate-200/90 shadow-2xs">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 pb-2 border-b border-slate-100">
              <Sparkles className="h-4 w-4 text-sky-600" />
              <span>AI Evaluation Context (Culture &amp; Narrative)</span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="culture_dimensions" className="text-xs font-semibold text-slate-700">
                  Company &amp; Team Culture Dimensions
                </Label>
                <span className="text-2xs text-slate-400">Optional</span>
              </div>
              <p className="text-2xs text-slate-500">
                Describe workplace values, working style, and principles (e.g. "Customer obsession, async-first, bias for action, high agency").
              </p>
              <Textarea
                id="culture_dimensions"
                placeholder="e.g. Radical transparency, high ownership, async-first communication, and continuous learning..."
                rows={3}
                className="bg-white border-slate-200 shadow-2xs text-sm"
                {...register("culture_dimensions")}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="competency_expectations" className="text-xs font-semibold text-slate-700">
                  Qualitative Competency Expectations
                </Label>
                <span className="text-2xs text-slate-400">Optional</span>
              </div>
              <p className="text-2xs text-slate-500">
                Describe leadership, communication, or architectural expectations that the AI should analyze from dialogue evidence.
              </p>
              <Textarea
                id="competency_expectations"
                placeholder="e.g. Ability to mentor junior engineers, design scalable fault-tolerant microservices, and articulate trade-offs clearly..."
                rows={3}
                className="bg-white border-slate-200 shadow-2xs text-sm"
                {...register("competency_expectations")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Error Notification */}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/vacancies")}
            disabled={submitting}
            className="border-slate-200"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-sky-600 hover:bg-sky-700 text-white min-w-32 shadow-sm"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
              </>
            ) : (
              "Save Vacancy Profile"
            )}
          </Button>
        </div>
      </form>

      {/* Skill Picker Modal */}
      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(s) =>
          append({
            skill_id: s.skill_id,
            skill_label: s.skill_label,
            expected_level: 3,
          })
        }
      />
    </div>
  );
}
