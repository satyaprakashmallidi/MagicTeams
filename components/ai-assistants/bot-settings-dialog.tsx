'use client';

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Icon } from "@/components/ui/icons";
import { useToast } from "@/hooks/use-toast";
import { RealtimeCaptureField, CustomQuestion } from "@/types/database";

const realtimeCaptureFieldSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Field name is required"),
  type: z.enum(['text', 'number', 'enum', 'boolean']),
  description: z.string().min(1, "Description is required"),
  required: z.boolean(),
  enum_values: z.array(z.string()).optional(),
});

const settingsSchema = z.object({
  is_realtime_capture_enabled: z.boolean(),
  realtime_capture_fields: z.array(realtimeCaptureFieldSchema),
  custom_questions: z.array(z.object({
    id: z.string(),
    question: z.string(),
    enabled: z.boolean()
  })),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

interface BotSettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialSettings: {
    is_realtime_capture_enabled?: boolean;
    realtime_capture_fields?: RealtimeCaptureField[];
    custom_questions?: CustomQuestion[];
  };
  onSave: (settings: {
    is_realtime_capture_enabled: boolean;
    realtime_capture_fields: RealtimeCaptureField[];
    custom_questions: CustomQuestion[];
  }) => void;
}

export function BotSettingsDialog({
  isOpen,
  onOpenChange,
  initialSettings,
  onSave
}: BotSettingsDialogProps) {
  const [realtimeCaptureFields, setRealtimeCaptureFields] = useState<RealtimeCaptureField[]>([]);
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      is_realtime_capture_enabled: false,
      realtime_capture_fields: [],
      custom_questions: [],
    },
  });

  const isRealtimeCaptureEnabled = watch("is_realtime_capture_enabled");

  useEffect(() => {
    if (isOpen) {
      const fields = initialSettings.realtime_capture_fields || [];
      const questions = initialSettings.custom_questions || [];
      
      setRealtimeCaptureFields(fields);
      setCustomQuestions(questions);
      
      setValue("is_realtime_capture_enabled", initialSettings.is_realtime_capture_enabled || false);
      setValue("realtime_capture_fields", fields);
      setValue("custom_questions", questions);
    }
  }, [isOpen, initialSettings, setValue]);

  const addRealtimeField = () => {
    const newField: RealtimeCaptureField = {
      id: `field_${Date.now()}`,
      name: '',
      type: 'text',
      description: '',
      required: false,
    };
    
    const updatedFields = [...realtimeCaptureFields, newField];
    setRealtimeCaptureFields(updatedFields);
    setValue("realtime_capture_fields", updatedFields);
  };

  const updateRealtimeField = (index: number, field: Partial<RealtimeCaptureField>) => {
    const updatedFields = realtimeCaptureFields.map((f, i) => 
      i === index ? { ...f, ...field } : f
    );
    setRealtimeCaptureFields(updatedFields);
    setValue("realtime_capture_fields", updatedFields);
  };

  const removeRealtimeField = (index: number) => {
    const updatedFields = realtimeCaptureFields.filter((_, i) => i !== index);
    setRealtimeCaptureFields(updatedFields);
    setValue("realtime_capture_fields", updatedFields);
  };

  const addEnumValue = (fieldIndex: number) => {
    const field = realtimeCaptureFields[fieldIndex];
    const enumValues = field.enum_values || [];
    const updatedField = {
      ...field,
      enum_values: [...enumValues, '']
    };
    updateRealtimeField(fieldIndex, updatedField);
  };

  const updateEnumValue = (fieldIndex: number, enumIndex: number, value: string) => {
    const field = realtimeCaptureFields[fieldIndex];
    const enumValues = field.enum_values || [];
    enumValues[enumIndex] = value;
    updateRealtimeField(fieldIndex, { enum_values: [...enumValues] });
  };

  const removeEnumValue = (fieldIndex: number, enumIndex: number) => {
    const field = realtimeCaptureFields[fieldIndex];
    const enumValues = field.enum_values || [];
    updateRealtimeField(fieldIndex, { 
      enum_values: enumValues.filter((_, i) => i !== enumIndex) 
    });
  };

  const addCustomQuestion = () => {
    const newQuestion: CustomQuestion = {
      id: `q${Date.now()}`,
      question: '',
      enabled: true
    };
    const updatedQuestions = [...customQuestions, newQuestion];
    setCustomQuestions(updatedQuestions);
    setValue("custom_questions", updatedQuestions);
  };

  const updateCustomQuestion = (index: number, question: Partial<CustomQuestion>) => {
    const updatedQuestions = customQuestions.map((q, i) => 
      i === index ? { ...q, ...question } : q
    );
    setCustomQuestions(updatedQuestions);
    setValue("custom_questions", updatedQuestions);
  };

  const removeCustomQuestion = (index: number) => {
    const updatedQuestions = customQuestions.filter((_, i) => i !== index);
    setCustomQuestions(updatedQuestions);
    setValue("custom_questions", updatedQuestions);
  };

  const onSubmit = async (data: SettingsFormData) => {
    setLoading(true);
    try {
      onSave({
        is_realtime_capture_enabled: data.is_realtime_capture_enabled,
        realtime_capture_fields: data.realtime_capture_fields,
        custom_questions: data.custom_questions,
      });
      
      toast({
        title: "Settings saved",
        description: "Bot settings have been updated successfully",
      });
      
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bot Settings</DialogTitle>
        </DialogHeader>
        <div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Realtime Data Capture Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={isRealtimeCaptureEnabled}
                onCheckedChange={(checked) => setValue("is_realtime_capture_enabled", checked)}
              />
              <Label className="text-base font-medium">Enable Realtime Data Capture</Label>
            </div>
            
            <p className="text-sm text-muted-foreground">
              When enabled, the bot will capture structured data in real-time during conversations based on the fields you define below.
            </p>

            {isRealtimeCaptureEnabled && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Capture Fields</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addRealtimeField}
                  >
                    <Icon name="plus" className="h-4 w-4 mr-1" />
                    Add Field
                  </Button>
                </div>

                {realtimeCaptureFields.length === 0 ? (
                  <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      No capture fields defined. Add fields to capture specific information during calls.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {realtimeCaptureFields.map((field, index) => (
                      <div key={field.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Field {index + 1}</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRealtimeField(index)}
                          >
                            <Icon name="trash" className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Field Name</Label>
                            <Input
                              placeholder="e.g., budget"
                              value={field.name}
                              onChange={(e) => updateRealtimeField(index, { name: e.target.value })}
                            />
                          </div>
                          
                          <div>
                            <Label className="text-xs">Field Type</Label>
                            <Select
                              value={field.type}
                              onValueChange={(value: RealtimeCaptureField['type']) => 
                                updateRealtimeField(index, { type: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">Text</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                                <SelectItem value="enum">Enum (Options)</SelectItem>
                                <SelectItem value="boolean">Boolean</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs">Description</Label>
                          <Textarea
                            placeholder="Describe what this field captures..."
                            value={field.description}
                            onChange={(e) => updateRealtimeField(index, { description: e.target.value })}
                            className="h-20"
                          />
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateRealtimeField(index, { required: e.target.checked })}
                            className="rounded"
                          />
                          <Label className="text-xs">Required field</Label>
                        </div>

                        {field.type === 'enum' && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Enum Values</Label>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addEnumValue(index)}
                              >
                                <Icon name="plus" className="h-3 w-3 mr-1" />
                                Add Option
                              </Button>
                            </div>
                            {(field.enum_values || []).map((enumValue, enumIndex) => (
                              <div key={enumIndex} className="flex items-center gap-2">
                                <Input
                                  placeholder="Option value"
                                  value={enumValue}
                                  onChange={(e) => updateEnumValue(index, enumIndex, e.target.value)}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeEnumValue(index, enumIndex)}
                                >
                                  <Icon name="x" className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Custom Questions Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Custom Questions for Call Analysis</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCustomQuestion}
              >
                <Icon name="plus" className="h-4 w-4 mr-1" />
                Add Question
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Define questions to extract specific information from call transcripts and summaries using AI analysis.
            </p>

            {customQuestions.length === 0 ? (
              <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  No custom questions defined. Add questions to analyze call content and extract specific information.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {customQuestions.map((question, index) => (
                  <div key={question.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={question.enabled}
                          onChange={(e) => updateCustomQuestion(index, { enabled: e.target.checked })}
                          className="rounded"
                        />
                        <Label className="text-sm font-medium">Question {index + 1}</Label>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCustomQuestion(index)}
                      >
                        <Icon name="trash" className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                    <Input
                      placeholder="e.g., How many square feet does the user want?"
                      value={question.question}
                      onChange={(e) => updateCustomQuestion(index, { question: e.target.value })}
                      className={!question.enabled ? 'opacity-50' : ''}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}