import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit, Trash2, MessageSquare, Upload } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { authHeaders } from "@/lib/queryClient";
import { EventItemsManager } from "@/components/admin/event-items-manager";

// Type definitions
type EventType = {
  id: number;
  name: string;
  description: string;
  icon: string;
  images?: string[];
  videos?: string[];
  category?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

async function uploadAdminMedia(file: File, folder: string) {
  const intentRes = await fetch("/api/admin/media/upload-intent", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ filename: file.name, contentType: file.type, folder }),
  });
  if (!intentRes.ok) {
    const error = await intentRes.json().catch(() => null);
    throw new Error(error?.message || "Failed to prepare S3 upload");
  }

  const intent = await intentRes.json();
  if (!intent.uploadUrl) {
    throw new Error("S3 upload is not configured. Set S3_BUCKET and AWS_REGION on the backend.");
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20 * 60 * 1000);
  let uploadRes: Response;
  try {
    uploadRes = await fetch(intent.uploadUrl, {
      method: "PUT",
      headers: intent.headers || { "Content-Type": file.type },
      body: file,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Upload timed out. Try a smaller video or check your network connection.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
  if (!uploadRes.ok) {
    const errorText = await uploadRes.text().catch(() => "");
    throw new Error(errorText || `Failed to upload media to S3 (${uploadRes.status})`);
  }
  return intent.publicUrl as string;
}

function parseUrlLines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

type QuestionnaireItem = {
  id: number;
  eventTypeId: number;
  questionText: string;
  questionType: string;
  options: any;
  required: boolean;
  displayOrder: number;
  eventType?: EventType;
};

export default function EventsAdminPage() {
  const { t } = useTranslation();
  return (
    <AdminLayout title={t('adminEvents.title')}>
      <EventTypesTab />
    </AdminLayout>
  );
}

function EventTypesTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [questionsDialogOpen, setQuestionsDialogOpen] = useState(false);
  const [addQuestionDialogOpen, setAddQuestionDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [currentEventType, setCurrentEventType] = useState<EventType | null>(null);
  const [selectedEventTypeForQuestions, setSelectedEventTypeForQuestions] = useState<number | null>(null);
  const [eventTypeToDelete, setEventTypeToDelete] = useState<EventType | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    icon: "",
    category: "",
    images: "",
    videos: "",
    isActive: true
  });
  const [uploadingField, setUploadingField] = useState<"images" | "videos" | null>(null);

  // Question form state
  const [questionFormData, setQuestionFormData] = useState({
    questionText: "",
    questionType: "text",
    options: [] as string[],
    required: false,
    displayOrder: 1
  });

  // Queries
  const { data: eventTypes, isLoading: isLoadingEventTypes } = useQuery<EventType[]>({
    queryKey: ["/api/event-types"],
  });

  const { data: questionnaireItems } = useQuery<QuestionnaireItem[]>({
    queryKey: ["/api/questionnaire-items"],
  });

  // Mutations
  const createEventTypeMutation = useMutation({
    mutationFn: async (eventTypeData: Omit<EventType, 'id' | 'createdAt' | 'updatedAt'>) => {
      const res = await fetch('/api/event-types', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(eventTypeData),
      });
      if (!res.ok) throw new Error('Failed to create event type');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-types"] });
      setCreateDialogOpen(false);
      resetForm();
      toast({ title: t('adminEvents.eventCreated') });
    },
  });

  const updateEventTypeMutation = useMutation({
    mutationFn: async ({ id, ...eventTypeData }: Partial<EventType> & { id: number }) => {
      const res = await fetch(`/api/event-types/${id}`, {
        method: 'PATCH',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(eventTypeData),
      });
      if (!res.ok) throw new Error('Failed to update event type');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-types"] });
      setEditDialogOpen(false);
      resetForm();
      toast({ title: t('adminEvents.eventUpdated') });
    },
  });

  const deleteEventTypeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/event-types/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to delete event type');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-types"] });
      toast({ title: t('adminEvents.eventDeleted') });
    },
  });

  const createQuestionMutation = useMutation({
    mutationFn: async (questionData: any) => {
      const res = await fetch('/api/questionnaire-items', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(questionData),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => null);
        throw new Error(error?.message || t('adminEvents.questionCreateError'));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/questionnaire-items"] });
      setAddQuestionDialogOpen(false);
      resetQuestionForm();
      toast({ title: t('adminEvents.addQuestion') });
    },
    onError: (error) => {
      toast({
        title: t('adminEvents.questionCreateErrorTitle'),
        description: error instanceof Error ? error.message : t('adminEvents.questionCreateError'),
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      icon: "",
      category: "",
      images: "",
      videos: "",
      isActive: true
    });
    setCurrentEventType(null);
  };

  const resetQuestionForm = () => {
    setQuestionFormData({
      questionText: "",
      questionType: "text",
      options: [] as string[],
      required: false,
      displayOrder: 1
    });
  };

  const handleCreate = () => {
    setCreateDialogOpen(true);
    resetForm();
  };

  const handleEdit = (eventType: EventType) => {
    setCurrentEventType(eventType);
    setFormData({
      name: eventType.name,
      description: eventType.description || "",
      icon: eventType.icon || "",
      category: eventType.category || "",
      images: (eventType.images || []).join("\n"),
      videos: (eventType.videos || []).join("\n"),
      isActive: eventType.isActive
    });
    setEditDialogOpen(true);
  };

  const handleDelete = (eventType: EventType) => {
    setEventTypeToDelete(eventType);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (eventTypeToDelete) {
      deleteEventTypeMutation.mutate(eventTypeToDelete.id);
      setDeleteDialogOpen(false);
      setEventTypeToDelete(null);
    }
  };

  const handleViewQuestions = (eventTypeId: number) => {
    setSelectedEventTypeForQuestions(eventTypeId);
    setQuestionsDialogOpen(true);
  };

  const handleAddQuestion = () => {
    setAddQuestionDialogOpen(true);
    resetQuestionForm();
  };

  const handleSubmitQuestion = () => {
    if (!selectedEventTypeForQuestions) return;

    const questionData = {
      eventTypeId: selectedEventTypeForQuestions,
      questionText: questionFormData.questionText,
      questionType: questionFormData.questionType,
      options: questionFormData.options,
      required: questionFormData.required,
      displayOrder: questionFormData.displayOrder
    };

    createQuestionMutation.mutate(questionData);
  };

  const getQuestionsForEventType = (eventTypeId: number) => {
    return questionnaireItems?.filter(item => item.eventTypeId === eventTypeId) || [];
  };

  const handleSubmit = () => {
    const payload = {
      ...formData,
      images: parseUrlLines(formData.images),
      videos: parseUrlLines(formData.videos),
    };

    if (editDialogOpen && currentEventType) {
      updateEventTypeMutation.mutate({
        id: currentEventType.id,
        ...payload
      });
    } else {
      createEventTypeMutation.mutate(payload);
    }
  };

  const handleMediaUpload = async (file: File | undefined, field: "images" | "videos") => {
    if (!file) return;
    setUploadingField(field);
    try {
      const url = await uploadAdminMedia(file, `saneea/events/${field}`);
      setFormData((prev) => ({
        ...prev,
        [field]: [...parseUrlLines(prev[field]), url].join("\n"),
      }));
      toast({ title: field === "images" ? t('adminEvents.imageUploaded') : t('adminEvents.videoUploaded') });
    } catch (error) {
      toast({
        title: t('adminEvents.uploadFailed'),
        description: error instanceof Error ? error.message : t('adminEvents.uploadMediaError'),
        variant: "destructive",
      });
    } finally {
      setUploadingField(null);
    }
  };

  if (isLoadingEventTypes) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-10">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">{t('adminEvents.title')}</h2>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t('adminEvents.createEventType')}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {eventTypes?.map((eventType) => (
          <Card key={eventType.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {eventType.icon && <span>{eventType.icon}</span>}
                    {eventType.name}
                  </CardTitle>
                  <CardDescription>
                    {eventType.description || t('adminEventItems.noDescription')}
                  </CardDescription>
                </div>
                <Badge variant={eventType.isActive ? "default" : "secondary"}>
                  {eventType.isActive ? t('common.active') : t('common.inactive')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pb-2">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{t('adminEvents.questionnaire')}:</span>
                  <span>{getQuestionsForEventType(eventType.id).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">{t('adminEvents.created')}:</span>
                  <span>{new Date(eventType.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-2">
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleViewQuestions(eventType.id)}
                >
                  <MessageSquare className="h-3 w-3 mr-1" />
                  {t('adminEvents.questionnaire')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(eventType)}
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(eventType)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={createDialogOpen || editDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setCreateDialogOpen(false);
          setEditDialogOpen(false);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editDialogOpen ? t('adminEvents.editEventType') : t('adminEvents.createEventType')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('adminEvents.eventName')}</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder={t('adminEvents.eventNamePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('adminEvents.eventDescription')}</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t('adminEvents.eventDescriptionPlaceholder')}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('adminEvents.eventIcon')}</label>
              <Input
                value={formData.icon}
                onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                placeholder="🎉"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('adminEvents.category')}</label>
              <Input
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                placeholder={t('adminEvents.categoryPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('adminEvents.locationImageUrls')}</label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  disabled={uploadingField !== null}
                  onChange={(e) => handleMediaUpload(e.target.files?.[0], "images")}
                />
                {uploadingField === "images" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
              </div>
              <Textarea
                value={formData.images}
                onChange={(e) => setFormData(prev => ({ ...prev, images: e.target.value }))}
                placeholder={t('adminEvents.imageUrlsPlaceholder')}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('adminEvents.eventVideoUrls')}</label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="video/*"
                  disabled={uploadingField !== null}
                  onChange={(e) => handleMediaUpload(e.target.files?.[0], "videos")}
                />
                {uploadingField === "videos" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
              </div>
              <Textarea
                value={formData.videos}
                onChange={(e) => setFormData(prev => ({ ...prev, videos: e.target.value }))}
                placeholder={t('adminEvents.videoUrlsPlaceholder')}
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
              />
              <label className="text-sm font-medium">{t('adminEvents.isActive')}</label>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => {
              setCreateDialogOpen(false);
              setEditDialogOpen(false);
              resetForm();
            }}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createEventTypeMutation.isPending || updateEventTypeMutation.isPending}
            >
              {createEventTypeMutation.isPending || updateEventTypeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {editDialogOpen ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Questions Dialog */}
      <Dialog open={questionsDialogOpen} onOpenChange={setQuestionsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('adminEvents.questionnaire')}</DialogTitle>
            <DialogDescription>
              {selectedEventTypeForQuestions && eventTypes && (
                <span>
                  {t('adminEvents.questionsFor', { name: eventTypes.find(et => et.id === selectedEventTypeForQuestions)?.name })}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-end mb-4">
            <Button onClick={handleAddQuestion}>
              <Plus className="h-4 w-4 mr-2" />
              {t('adminEvents.addQuestion')}
            </Button>
          </div>
          
          <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
            {selectedEventTypeForQuestions && getQuestionsForEventType(selectedEventTypeForQuestions).length > 0 ? (
              getQuestionsForEventType(selectedEventTypeForQuestions).map((question, index) => (
                <div key={question.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium">{t('adminEvents.questionNumber', { number: index + 1 })}</h4>
                    <Badge variant="outline">{t(`adminEvents.questionTypes.${question.questionType}`, { defaultValue: question.questionType })}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {question.questionText}
                  </p>
                  {question.options && (
                    <div className="text-xs text-muted-foreground">
                      {t('adminEvents.options')}: {JSON.stringify(question.options)}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-2">
                    {t('adminEvents.requiredLabel', { value: question.required ? t('common.yes') : t('common.no') })}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {t('adminEvents.noQuestions')}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Question Dialog */}
      <Dialog open={addQuestionDialogOpen} onOpenChange={setAddQuestionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('adminEvents.addQuestion')}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">{t('adminEvents.questionText')}</label>
              <Textarea
                placeholder={t('adminEvents.questionTextPlaceholder')}
                value={questionFormData.questionText}
                onChange={(e) => setQuestionFormData(prev => ({ ...prev, questionText: e.target.value }))}
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t('adminEvents.questionType')}</label>
              <select
                className="w-full p-2 border border-input rounded-md bg-background"
                value={questionFormData.questionType}
                onChange={(e) => setQuestionFormData(prev => ({ ...prev, questionType: e.target.value }))}
              >
                <option value="text">{t('adminEvents.questionTypes.text')}</option>
                <option value="number">{t('adminEvents.questionTypes.number')}</option>
                <option value="select">{t('adminEvents.questionTypes.select')}</option>
                <option value="checkbox">{t('adminEvents.questionTypes.checkbox')}</option>
                <option value="textarea">{t('adminEvents.questionTypes.textarea')}</option>
                <option value="date">{t('adminEvents.questionTypes.date')}</option>
                <option value="time">{t('adminEvents.questionTypes.time')}</option>
              </select>
            </div>

            {questionFormData.questionType === 'select' && (
              <div>
                <label className="text-sm font-medium mb-2 block">{t('adminEvents.optionsCommaSeparated')}</label>
                <Input
                  placeholder={t('adminEvents.optionPlaceholder')}
                  onChange={(e) => {
                    const options = e.target.value.split(',').map(opt => opt.trim()).filter(opt => opt);
                    setQuestionFormData(prev => ({ ...prev, options }));
                  }}
                />
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Switch
                checked={questionFormData.required}
                onCheckedChange={(checked) => setQuestionFormData(prev => ({ ...prev, required: checked }))}
              />
              <label className="text-sm font-medium">{t('adminEvents.requiredField')}</label>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t('adminEvents.displayOrder')}</label>
              <Input
                type="number"
                min="1"
                value={questionFormData.displayOrder}
                onChange={(e) => setQuestionFormData(prev => ({ ...prev, displayOrder: parseInt(e.target.value) || 1 }))}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setAddQuestionDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSubmitQuestion}
              disabled={createQuestionMutation.isPending || !questionFormData.questionText.trim()}
            >
              {createQuestionMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {t('adminEvents.addQuestion')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('adminEvents.deleteEventType')}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>{t('common.confirmDeleteTitle')}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {t('common.thisActionCannotBeUndone')}
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteEventTypeMutation.isPending}
            >
              {deleteEventTypeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {t('common.delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>

      <EventItemsManager />
    </div>
  );
}
