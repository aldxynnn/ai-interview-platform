import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Briefcase,
  Target,
  Sparkles,
  Clock,
  Globe,
  AlertCircle,
} from "lucide-react";
import { assessmentsApi } from "@/services/assessments";
import { TIME_LIMIT_OPTIONS } from "@/utils/constants";
import type { AssessmentSkill } from "@/types";

export interface AssessmentFormValues {
  name: string;
  time_limit_min: number;
  language: "en" | "id";
  skills: Partial<AssessmentSkill>[];
}

export default function AssessmentNewPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AssessmentFormValues>({
    defaultValues: {
      name: "",
      time_limit_min: 45,
      language: "en",
      skills: [],
    },
  });

  const { register, handleSubmit, control, setValue, formState: { errors } } = form;
  const { fields, append, remove, move } = useFieldArray({ control, name: "skills" });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((f) => f.id === active.id);
      const newIndex = fields.findIndex((f) => f.id === over.id);
      move(oldIndex, newIndex);
    }
  };

  const addCustomSkill = () => {
    append({
      skill_label: "",
      is_custom: true,
      expected_level: 3,
      display_order: fields.length,
    });
  };

  const addTaxonomySkill = (skill: Partial<AssessmentSkill>) => {
    append({ ...skill, display_order: fields.length });
  };

  const onSubmit = async (data: AssessmentFormValues) => {
    if (data.skills.length === 0) {
      setError("Please add at least one competency skill to assess.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        name: data.name.trim(),
        time_limit_min: data.time_limit_min,
        language: data.language,
        assessment_skills_attributes: data.skills.map((s, i) => ({
          ...s,
          display_order: i,
        })),
      };
      const res = await assessmentsApi.create(payload);
      navigate(`/assessments/${res.data.assessment.id}/invite`);
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Failed to save assessment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link
          to="/assessments"
          className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Assessment Hub
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-900">New Assessment</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create Assessment Syllabus</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure the evaluation scope, interview duration, language, and competency rubrics for AI-led interviews.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Section 1: Parameters */}
        <Card className="border-slate-200/90 shadow-2xs">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 pb-2 border-b border-slate-100">
              <Briefcase className="h-4 w-4 text-sky-600" />
              <span>Assessment Setup</span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold text-slate-700">
                Target Role Title <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g. Senior Frontend Engineer (React / TypeScript)"
                className="bg-white border-slate-200 shadow-2xs text-sm"
                {...register("name", { required: "Role title is required" })}
              />
              {errors.name && (
                <p className="text-xs text-rose-600 font-medium">{errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-sky-600" />
                  <span>Session Time Limit</span>
                </Label>
                <Select
                  defaultValue="45"
                  onValueChange={(v) => setValue("time_limit_min", Number(v))}
                >
                  <SelectTrigger className="w-full bg-white border-slate-200 shadow-2xs text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_LIMIT_OPTIONS.map((min) => (
                      <SelectItem key={min} value={String(min)} className="text-xs">
                        {min} minutes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-sky-600" />
                  <span>Interview Language</span>
                </Label>
                <Select
                  defaultValue="en"
                  onValueChange={(v) => setValue("language", v as "en" | "id")}
                >
                  <SelectTrigger className="w-full bg-white border-slate-200 shadow-2xs text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en" className="text-xs">English (Default)</SelectItem>
                    <SelectItem value="id" className="text-xs">Bahasa Indonesia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Skills */}
        <Card className="border-slate-200/90 shadow-2xs">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Target className="h-4 w-4 text-sky-600" />
                <span>Competency Rubric &amp; Questions</span>
              </div>
              <span className="text-xs text-slate-400">
                {fields.length} {fields.length === 1 ? "skill" : "skills"}
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Drag skills to reorder the interviewer's priority sequence. The AI interviewer will pace questions across these competencies.
            </p>

            {fields.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-8 text-center space-y-3">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                  <Target className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-900">No skills added yet</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Add competencies from our skill taxonomy or create custom skills for this assessment.
                  </p>
                </div>
                <div className="flex justify-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPickerOpen(true)}
                    className="bg-white border-slate-200 hover:bg-slate-50 text-slate-700 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1 text-sky-600" /> Browse Taxonomy
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCustomSkill}
                    className="bg-white border-slate-200 hover:bg-slate-50 text-slate-700 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1 text-sky-600" /> Custom Skill
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={fields.map((f) => f.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2.5">
                      {fields.map((field, index) => (
                        <SkillCard
                          key={field.id}
                          id={field.id}
                          index={index}
                          form={form}
                          onRemove={() => remove(index)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPickerOpen(true)}
                    className="bg-white border-slate-200 hover:bg-slate-50 text-slate-700 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1 text-sky-600" /> Add from Taxonomy
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCustomSkill}
                    className="bg-white border-slate-200 hover:bg-slate-50 text-slate-700 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1 text-sky-600" /> Add Custom Skill
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/assessments")}
            disabled={submitting}
            className="border-slate-200"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-sky-600 hover:bg-sky-700 text-white min-w-36 shadow-sm"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
              </>
            ) : (
              "Save & Create Session →"
            )}
          </Button>
        </div>
      </form>

      <SkillPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={addTaxonomySkill}
      />
    </div>
  );
}
