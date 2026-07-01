import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { authHeaders, queryClient } from "@/lib/queryClient";
import { Check, ImageIcon, Plus, Save, Trash2 } from "lucide-react";

type EventType = {
  id: number;
  name: string;
  isActive: boolean;
};

type EventTemplate = {
  id: number;
  eventTypeId: number;
  sourceBundleId?: number | null;
  name: string;
  description?: string | null;
  estimatedMinPrice?: number | null;
  estimatedMaxPrice?: number | null;
  images: string[];
  videos: string[];
  tags: string[];
  isActive: boolean;
  displayOrder: number;
  eventTypeName?: string | null;
};

type EventTemplateItem = {
  id: number;
  templateId: number;
  eventItemId?: number | null;
  defaultOptionId?: number | null;
  title: string;
  description?: string | null;
  images: string[];
  videos: string[];
  quantity: number;
  isRequired: boolean;
  displayOrder: number;
  eventItemName?: string | null;
  defaultOptionName?: string | null;
};

type QuestionnaireItem = {
  id: number;
  eventTypeId: number;
  questionText: string;
  questionType: string;
  displayOrder?: number | null;
};

type QuestionnaireOption = {
  id: number;
  questionnaireItemId: number;
  labelAr: string;
  labelEn?: string | null;
  value: string;
  imageUrl?: string | null;
  displayOrder: number;
};

type TemplateForm = {
  name: string;
  description: string;
  estimatedMinPrice: string;
  estimatedMaxPrice: string;
  images: string;
  videos: string;
  tags: string;
  isActive: boolean;
  displayOrder: string;
};

type TemplateItemForm = {
  title: string;
  description: string;
  eventItemId: string;
  defaultOptionId: string;
  images: string;
  videos: string;
  quantity: string;
  isRequired: boolean;
  displayOrder: string;
};

type QuestionOptionForm = {
  labelAr: string;
  labelEn: string;
  value: string;
  imageUrl: string;
  displayOrder: string;
};

const emptyTemplateForm: TemplateForm = {
  name: "",
  description: "",
  estimatedMinPrice: "",
  estimatedMaxPrice: "",
  images: "",
  videos: "",
  tags: "",
  isActive: true,
  displayOrder: "0",
};

const emptyItemForm: TemplateItemForm = {
  title: "",
  description: "",
  eventItemId: "",
  defaultOptionId: "",
  images: "",
  videos: "",
  quantity: "1",
  isRequired: true,
  displayOrder: "0",
};

const emptyOptionForm: QuestionOptionForm = {
  labelAr: "",
  labelEn: "",
  value: "",
  imageUrl: "",
  displayOrder: "0",
};

function parseLines(value: string) {
  return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

function toOptionalNumber(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const numberValue = Number(normalized);
  return Number.isFinite(numberValue) ? numberValue : null;
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: authHeaders({
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(error?.message || "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

function templateToForm(template: EventTemplate): TemplateForm {
  return {
    name: template.name,
    description: template.description || "",
    estimatedMinPrice: template.estimatedMinPrice?.toString() || "",
    estimatedMaxPrice: template.estimatedMaxPrice?.toString() || "",
    images: (template.images || []).join("\n"),
    videos: (template.videos || []).join("\n"),
    tags: (template.tags || []).join("\n"),
    isActive: template.isActive,
    displayOrder: String(template.displayOrder || 0),
  };
}

function itemToForm(item: EventTemplateItem): TemplateItemForm {
  return {
    title: item.title,
    description: item.description || "",
    eventItemId: item.eventItemId?.toString() || "",
    defaultOptionId: item.defaultOptionId?.toString() || "",
    images: (item.images || []).join("\n"),
    videos: (item.videos || []).join("\n"),
    quantity: String(item.quantity || 1),
    isRequired: item.isRequired,
    displayOrder: String(item.displayOrder || 0),
  };
}

function optionToForm(option: QuestionnaireOption): QuestionOptionForm {
  return {
    labelAr: option.labelAr,
    labelEn: option.labelEn || "",
    value: option.value,
    imageUrl: option.imageUrl || "",
    displayOrder: String(option.displayOrder || 0),
  };
}

export default function AdminTemplatesPage() {
  const { toast } = useToast();
  const [selectedEventTypeId, setSelectedEventTypeId] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<EventTemplate | null>(null);
  const [editingItem, setEditingItem] = useState<EventTemplateItem | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [editingOption, setEditingOption] = useState<QuestionnaireOption | null>(null);
  const [templateForm, setTemplateForm] = useState<TemplateForm>(emptyTemplateForm);
  const [itemForm, setItemForm] = useState<TemplateItemForm>(emptyItemForm);
  const [optionForm, setOptionForm] = useState<QuestionOptionForm>(emptyOptionForm);

  const { data: eventTypes = [] } = useQuery<EventType[]>({
    queryKey: ["/api/event-types"],
  });

  useEffect(() => {
    if (!selectedEventTypeId && eventTypes.length > 0) {
      setSelectedEventTypeId(eventTypes[0].id);
    }
  }, [eventTypes, selectedEventTypeId]);

  const templatesQueryKey = ["/api/admin/event-templates", selectedEventTypeId];
  const { data: templates = [], isLoading: templatesLoading } = useQuery<EventTemplate[]>({
    queryKey: templatesQueryKey,
    enabled: !!selectedEventTypeId,
    queryFn: () => apiJson(`/api/admin/event-templates?eventTypeId=${selectedEventTypeId}`),
  });

  const { data: templateItems = [] } = useQuery<EventTemplateItem[]>({
    queryKey: ["/api/admin/event-templates/items", selectedTemplate?.id],
    enabled: !!selectedTemplate,
    queryFn: () => apiJson(`/api/admin/event-templates/${selectedTemplate?.id}/items`),
  });

  const { data: questions = [] } = useQuery<QuestionnaireItem[]>({
    queryKey: ["/api/event-types/questionnaire-items", selectedEventTypeId],
    enabled: !!selectedEventTypeId,
    queryFn: () => apiJson(`/api/event-types/${selectedEventTypeId}/questionnaire-items`),
  });

  const { data: questionOptions = [] } = useQuery<QuestionnaireOption[]>({
    queryKey: ["/api/questionnaire-items/options", selectedQuestionId],
    enabled: !!selectedQuestionId,
    queryFn: () => apiJson(`/api/questionnaire-items/${selectedQuestionId}/options`),
  });

  const selectedEventName = useMemo(
    () => eventTypes.find((eventType) => eventType.id === selectedEventTypeId)?.name || "نوع الفعالية",
    [eventTypes, selectedEventTypeId]
  );

  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEventTypeId) throw new Error("اختر نوع الفعالية أولا");
      const payload = {
        eventTypeId: selectedEventTypeId,
        name: templateForm.name.trim(),
        description: templateForm.description.trim() || null,
        estimatedMinPrice: toOptionalNumber(templateForm.estimatedMinPrice),
        estimatedMaxPrice: toOptionalNumber(templateForm.estimatedMaxPrice),
        images: parseLines(templateForm.images),
        videos: parseLines(templateForm.videos),
        tags: parseLines(templateForm.tags),
        isActive: templateForm.isActive,
        displayOrder: Number(templateForm.displayOrder || 0),
      };
      const url = selectedTemplate ? `/api/admin/event-templates/${selectedTemplate.id}` : "/api/admin/event-templates";
      return apiJson<EventTemplate>(url, {
        method: selectedTemplate ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (template) => {
      queryClient.invalidateQueries({ queryKey: templatesQueryKey });
      setSelectedTemplate(template);
      setTemplateForm(templateToForm(template));
      toast({ title: "تم حفظ القالب" });
    },
    onError: (error) => toast({ title: "تعذر حفظ القالب", description: error instanceof Error ? error.message : undefined, variant: "destructive" }),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (templateId: number) => apiJson<void>(`/api/admin/event-templates/${templateId}`, { method: "DELETE" }),
    onSuccess: () => {
      setSelectedTemplate(null);
      setTemplateForm(emptyTemplateForm);
      queryClient.invalidateQueries({ queryKey: templatesQueryKey });
      toast({ title: "تم حذف القالب" });
    },
  });

  const saveItemMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate) throw new Error("اختر قالبا أولا");
      const payload = {
        title: itemForm.title.trim(),
        description: itemForm.description.trim() || null,
        eventItemId: toOptionalNumber(itemForm.eventItemId),
        defaultOptionId: toOptionalNumber(itemForm.defaultOptionId),
        images: parseLines(itemForm.images),
        videos: parseLines(itemForm.videos),
        quantity: Number(itemForm.quantity || 1),
        isRequired: itemForm.isRequired,
        displayOrder: Number(itemForm.displayOrder || 0),
      };
      const url = editingItem
        ? `/api/admin/event-template-items/${editingItem.id}`
        : `/api/admin/event-templates/${selectedTemplate.id}/items`;
      return apiJson<EventTemplateItem>(url, {
        method: editingItem ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/event-templates/items", selectedTemplate?.id] });
      setEditingItem(null);
      setItemForm(emptyItemForm);
      toast({ title: "تم حفظ عنصر القالب" });
    },
    onError: (error) => toast({ title: "تعذر حفظ العنصر", description: error instanceof Error ? error.message : undefined, variant: "destructive" }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: number) => apiJson<void>(`/api/admin/event-template-items/${itemId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/event-templates/items", selectedTemplate?.id] });
      toast({ title: "تم حذف عنصر القالب" });
    },
  });

  const saveOptionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedQuestionId) throw new Error("اختر سؤالا أولا");
      const payload = {
        labelAr: optionForm.labelAr.trim(),
        labelEn: optionForm.labelEn.trim() || null,
        value: optionForm.value.trim(),
        imageUrl: optionForm.imageUrl.trim() || null,
        displayOrder: Number(optionForm.displayOrder || 0),
      };
      const url = editingOption
        ? `/api/admin/questionnaire-options/${editingOption.id}`
        : `/api/admin/questionnaire-items/${selectedQuestionId}/options`;
      return apiJson<QuestionnaireOption>(url, {
        method: editingOption ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/questionnaire-items/options", selectedQuestionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/event-types/questionnaire-items", selectedEventTypeId] });
      setEditingOption(null);
      setOptionForm(emptyOptionForm);
      toast({ title: "تم حفظ خيار السؤال" });
    },
    onError: (error) => toast({ title: "تعذر حفظ الخيار", description: error instanceof Error ? error.message : undefined, variant: "destructive" }),
  });

  const deleteOptionMutation = useMutation({
    mutationFn: (optionId: number) => apiJson<void>(`/api/admin/questionnaire-options/${optionId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/questionnaire-items/options", selectedQuestionId] });
      toast({ title: "تم حذف الخيار" });
    },
  });

  function startNewTemplate() {
    setSelectedTemplate(null);
    setTemplateForm(emptyTemplateForm);
    setEditingItem(null);
    setItemForm(emptyItemForm);
  }

  function chooseTemplate(template: EventTemplate) {
    setSelectedTemplate(template);
    setTemplateForm(templateToForm(template));
    setEditingItem(null);
    setItemForm(emptyItemForm);
  }

  return (
    <AdminLayout title="قوالب تطبيق الجوال">
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>نوع الفعالية</CardTitle>
            <CardDescription>اختر الفعالية ثم أضف القوالب التي يراها العميل في الجوال.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <select
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={selectedEventTypeId || ""}
              onChange={(event) => {
                const nextId = Number(event.target.value);
                setSelectedEventTypeId(nextId);
                setSelectedTemplate(null);
                setTemplateForm(emptyTemplateForm);
                setSelectedQuestionId(null);
              }}
            >
              {eventTypes.map((eventType) => (
                <option key={eventType.id} value={eventType.id}>{eventType.name}</option>
              ))}
            </select>
            <Button className="w-full gap-2" onClick={startNewTemplate}>
              <Plus className="h-4 w-4" />
              قالب جديد
            </Button>
            <div className="space-y-2">
              {templatesLoading ? <p className="text-sm text-muted-foreground">جاري التحميل...</p> : null}
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => chooseTemplate(template)}
                  className={`w-full rounded-md border p-3 text-start transition ${selectedTemplate?.id === template.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{template.name}</span>
                    {template.isActive ? <Badge>ظاهر</Badge> : <Badge variant="secondary">مخفي</Badge>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{template.description || selectedEventName}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{selectedTemplate ? "تعديل القالب" : "إضافة قالب"}</CardTitle>
              <CardDescription>هذه البطاقة تظهر للعميل قبل إرسال الطلب. اجعل الصور واضحة والاسم بسيط.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <Input placeholder="اسم القالب" value={templateForm.name} onChange={(event) => setTemplateForm({ ...templateForm, name: event.target.value })} />
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-sm">ظاهر في الجوال</span>
                <Switch checked={templateForm.isActive} onCheckedChange={(isActive) => setTemplateForm({ ...templateForm, isActive })} />
              </div>
              <Input placeholder="أقل سعر تقديري" type="number" value={templateForm.estimatedMinPrice} onChange={(event) => setTemplateForm({ ...templateForm, estimatedMinPrice: event.target.value })} />
              <Input placeholder="أعلى سعر تقديري" type="number" value={templateForm.estimatedMaxPrice} onChange={(event) => setTemplateForm({ ...templateForm, estimatedMaxPrice: event.target.value })} />
              <Input placeholder="ترتيب العرض" type="number" value={templateForm.displayOrder} onChange={(event) => setTemplateForm({ ...templateForm, displayOrder: event.target.value })} />
              <Input placeholder="وسوم مختصرة مفصولة بسطر أو فاصلة" value={templateForm.tags} onChange={(event) => setTemplateForm({ ...templateForm, tags: event.target.value })} />
              <Textarea className="lg:col-span-2" placeholder="وصف القالب" value={templateForm.description} onChange={(event) => setTemplateForm({ ...templateForm, description: event.target.value })} />
              <Textarea placeholder="روابط الصور، كل رابط في سطر" value={templateForm.images} onChange={(event) => setTemplateForm({ ...templateForm, images: event.target.value })} />
              <Textarea placeholder="روابط الفيديو، كل رابط في سطر" value={templateForm.videos} onChange={(event) => setTemplateForm({ ...templateForm, videos: event.target.value })} />
              <div className="flex flex-wrap gap-2 lg:col-span-2">
                <Button className="gap-2" onClick={() => saveTemplateMutation.mutate()} disabled={saveTemplateMutation.isPending}>
                  <Save className="h-4 w-4" />
                  حفظ القالب
                </Button>
                {selectedTemplate ? (
                  <Button variant="destructive" className="gap-2" onClick={() => deleteTemplateMutation.mutate(selectedTemplate.id)}>
                    <Trash2 className="h-4 w-4" />
                    حذف
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>محتويات القالب</CardTitle>
              <CardDescription>أضف الأشياء التي يريد العميل رؤيتها داخل القالب: كوشة، ضيافة، تصوير، ديكور.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-3">
                {!selectedTemplate ? <p className="text-sm text-muted-foreground">اختر قالبا لإدارة محتوياته.</p> : null}
                {templateItems.map((item) => (
                  <div key={item.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.description || item.eventItemName || "بدون وصف"}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setEditingItem(item); setItemForm(itemToForm(item)); }}>تعديل</Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteItemMutation.mutate(item.id)}>حذف</Button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.images?.slice(0, 3).map((image) => (
                        <a key={image} href={image} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                          <ImageIcon className="h-3 w-3" />
                          صورة
                        </a>
                      ))}
                      {item.isRequired ? <Badge>مطلوب</Badge> : <Badge variant="secondary">اختياري</Badge>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-3 rounded-md border p-3">
                <Input placeholder="عنوان العنصر" value={itemForm.title} onChange={(event) => setItemForm({ ...itemForm, title: event.target.value })} />
                <Textarea placeholder="وصف العنصر" value={itemForm.description} onChange={(event) => setItemForm({ ...itemForm, description: event.target.value })} />
                <Input placeholder="رقم عنصر الخدمة اختياري" type="number" value={itemForm.eventItemId} onChange={(event) => setItemForm({ ...itemForm, eventItemId: event.target.value })} />
                <Input placeholder="رقم الخيار الافتراضي اختياري" type="number" value={itemForm.defaultOptionId} onChange={(event) => setItemForm({ ...itemForm, defaultOptionId: event.target.value })} />
                <Input placeholder="الكمية" type="number" value={itemForm.quantity} onChange={(event) => setItemForm({ ...itemForm, quantity: event.target.value })} />
                <Input placeholder="ترتيب العرض" type="number" value={itemForm.displayOrder} onChange={(event) => setItemForm({ ...itemForm, displayOrder: event.target.value })} />
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm">مطلوب</span>
                  <Switch checked={itemForm.isRequired} onCheckedChange={(isRequired) => setItemForm({ ...itemForm, isRequired })} />
                </div>
                <Textarea placeholder="روابط صور العنصر" value={itemForm.images} onChange={(event) => setItemForm({ ...itemForm, images: event.target.value })} />
                <Textarea placeholder="روابط فيديو العنصر" value={itemForm.videos} onChange={(event) => setItemForm({ ...itemForm, videos: event.target.value })} />
                <div className="flex gap-2">
                  <Button className="gap-2" onClick={() => saveItemMutation.mutate()} disabled={!selectedTemplate || saveItemMutation.isPending}>
                    <Check className="h-4 w-4" />
                    {editingItem ? "تحديث العنصر" : "إضافة العنصر"}
                  </Button>
                  {editingItem ? <Button variant="outline" onClick={() => { setEditingItem(null); setItemForm(emptyItemForm); }}>إلغاء</Button> : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>خيارات الأسئلة المرئية</CardTitle>
              <CardDescription>للأسئلة مثل النمط أو اللون، أضف خيارات مع صور حتى يختار العميل بالعين بدلا من كتابة نص.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-3">
                <select
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedQuestionId || ""}
                  onChange={(event) => {
                    const nextId = Number(event.target.value);
                    setSelectedQuestionId(nextId || null);
                    setEditingOption(null);
                    setOptionForm(emptyOptionForm);
                  }}
                >
                  <option value="">اختر السؤال</option>
                  {questions.map((question) => (
                    <option key={question.id} value={question.id}>{question.questionText}</option>
                  ))}
                </select>
                {questionOptions.map((option) => (
                  <div key={option.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{option.labelAr}</p>
                      <p className="truncate text-sm text-muted-foreground">{option.value}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setEditingOption(option); setOptionForm(optionToForm(option)); }}>تعديل</Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteOptionMutation.mutate(option.id)}>حذف</Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-3 rounded-md border p-3">
                <Input placeholder="العنوان بالعربية" value={optionForm.labelAr} onChange={(event) => setOptionForm({ ...optionForm, labelAr: event.target.value })} />
                <Input placeholder="العنوان بالإنجليزية اختياري" value={optionForm.labelEn} onChange={(event) => setOptionForm({ ...optionForm, labelEn: event.target.value })} />
                <Input placeholder="القيمة المحفوظة" value={optionForm.value} onChange={(event) => setOptionForm({ ...optionForm, value: event.target.value })} />
                <Input placeholder="رابط الصورة" value={optionForm.imageUrl} onChange={(event) => setOptionForm({ ...optionForm, imageUrl: event.target.value })} />
                <Input placeholder="ترتيب العرض" type="number" value={optionForm.displayOrder} onChange={(event) => setOptionForm({ ...optionForm, displayOrder: event.target.value })} />
                <div className="flex gap-2">
                  <Button className="gap-2" onClick={() => saveOptionMutation.mutate()} disabled={!selectedQuestionId || saveOptionMutation.isPending}>
                    <Check className="h-4 w-4" />
                    {editingOption ? "تحديث الخيار" : "إضافة الخيار"}
                  </Button>
                  {editingOption ? <Button variant="outline" onClick={() => { setEditingOption(null); setOptionForm(emptyOptionForm); }}>إلغاء</Button> : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
