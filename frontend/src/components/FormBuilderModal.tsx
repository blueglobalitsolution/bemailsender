import React, { useState } from "react";
import { Plus, Trash2, GripVertical, Check, X, Code, Save, Loader2, FormInput, Phone, Mail, Hash, AlignLeft, List } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useToast } from "./Toast";

export interface FormField {
  id: string;
  label: string;
  type: string; // text, email, tel, textarea, number, select
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

export interface CustomForm {
  id: number;
  name: string;
  shortcode: string;
  fields_schema: FormField[];
  button_text: string;
  success_message: string;
  redirect_url?: string;
  submissions_count?: number;
}

interface FormBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (form: CustomForm) => void;
  editingForm?: CustomForm | null;
}

const FIELD_TYPES = [
  { type: "text", label: "Single Line Text", icon: FormInput },
  { type: "email", label: "Email Address", icon: Mail },
  { type: "tel", label: "Phone Number", icon: Phone },
  { type: "number", label: "Number", icon: Hash },
  { type: "textarea", label: "Paragraph Text", icon: AlignLeft },
  { type: "select", label: "Dropdown Select", icon: List },
];

export default function FormBuilderModal({ isOpen, onClose, onSaved, editingForm }: FormBuilderModalProps) {
  const toast = useToast();
  const [formName, setFormName] = useState(editingForm ? editingForm.name : "");
  const [buttonText, setButtonText] = useState(editingForm ? editingForm.button_text : "Submit");
  const [successMessage, setSuccessMessage] = useState(editingForm ? editingForm.success_message : "Thank you! We have received your inquiry.");
  const [redirectUrl, setRedirectUrl] = useState(editingForm ? (editingForm.redirect_url || "") : "");
  const [fields, setFields] = useState<FormField[]>(
    editingForm?.fields_schema && editingForm.fields_schema.length > 0
      ? editingForm.fields_schema
      : [
          { id: "full_name", label: "Full Name", type: "text", placeholder: "e.g. John Doe", required: true },
          { id: "email", label: "Email Address", type: "email", placeholder: "e.g. john@company.com", required: true },
          { id: "phone", label: "Phone Number", type: "tel", placeholder: "e.g. +1 555-0192", required: false },
        ]
  );
  const [saving, setSaving] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  if (!isOpen) return null;

  const addField = (fieldType: string) => {
    const id = `field_${Date.now()}`;
    const defLabel = FIELD_TYPES.find((f) => f.type === fieldType)?.label || "Field";
    setFields([
      ...fields,
      {
        id,
        label: defLabel,
        type: fieldType,
        placeholder: `Enter ${defLabel.toLowerCase()}...`,
        required: false,
        options: fieldType === "select" ? ["Option 1", "Option 2", "Option 3"] : undefined,
      },
    ]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    setFields(
      fields.map((f, i) => (i === index ? { ...f, ...updates } : f))
    );
  };

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) return;
    const newFields = [...fields];
    const draggedItem = newFields[draggedIdx];
    newFields.splice(draggedIdx, 1);
    newFields.splice(targetIdx, 0, draggedItem);
    setDraggedIdx(targetIdx);
    setFields(newFields);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("Please enter a Form Name");
      return;
    }
    if (fields.length === 0) {
      toast.error("Please add at least one field to the form");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: formName.trim(),
        fields_schema: fields,
        button_text: buttonText.trim() || "Submit",
        success_message: successMessage.trim() || "Thank you!",
        redirect_url: redirectUrl.trim() || null,
      };

      const url = editingForm ? `/api/forms/${editingForm.id}/` : "/api/forms/";
      const method = editingForm ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const savedData: CustomForm = await res.json();
        toast.success(editingForm ? "Form updated successfully!" : "Form created successfully!");
        onSaved(savedData);
        onClose();
      } else {
        const err = await res.json();
        toast.error(Object.values(err).flat().join(" ") || "Failed to save form");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Network error saving form");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#161B1F] border border-[#2C353D] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2C353D] bg-[#1A2026]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <FormInput className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {editingForm ? "Edit Lead Capture Form" : "Drag & Drop Lead Form Builder"}
              </h3>
              <p className="text-xs text-[#8E9BA8]">
                Create dynamic forms that generate a reusable shortcode
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8E9BA8] hover:text-white p-1.5 rounded-lg hover:bg-[#222930] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body with 2 columns */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form Settings & Field Drawer */}
          <div className="lg:col-span-5 space-y-5">
            <div className="p-4 bg-[#1E252D] border border-[#2C353D] rounded-xl space-y-3.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#CBD5E1]">Form Basic Info</h4>
              <div>
                <label className="block text-xs font-medium text-[#8E9BA8] mb-1">Form Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Early Bird Signup"
                  className="w-full bg-[#161B1F] border border-[#2C353D] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8E9BA8] mb-1">Button Text</label>
                <input
                  type="text"
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  placeholder="Submit"
                  className="w-full bg-[#161B1F] border border-[#2C353D] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8E9BA8] mb-1">Success Message</label>
                <input
                  type="text"
                  value={successMessage}
                  onChange={(e) => setSuccessMessage(e.target.value)}
                  placeholder="Thank you! We will get in touch."
                  className="w-full bg-[#161B1F] border border-[#2C353D] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8E9BA8] mb-1">Redirect URL (Optional)</label>
                <input
                  type="url"
                  value={redirectUrl}
                  onChange={(e) => setRedirectUrl(e.target.value)}
                  placeholder="https://example.com/thank-you"
                  className="w-full bg-[#161B1F] border border-[#2C353D] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white transition-all"
                />
              </div>
            </div>

            {/* Field Library */}
            <div className="p-4 bg-[#1E252D] border border-[#2C353D] rounded-xl space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#CBD5E1]">Add Form Fields</h4>
              <p className="text-xs text-[#8E9BA8]">Click any field to add it to your form layout:</p>
              <div className="grid grid-cols-2 gap-2">
                {FIELD_TYPES.map((f) => {
                  const Icon = f.icon;
                  return (
                    <button
                      key={f.type}
                      type="button"
                      onClick={() => addField(f.type)}
                      className="flex items-center gap-2 p-2.5 bg-[#161B1F] hover:bg-[#26303A] border border-[#2C353D] rounded-lg text-xs font-semibold text-white transition-all text-left cursor-pointer group"
                    >
                      <Icon className="w-3.5 h-3.5 text-[#8E9BA8] group-hover:text-white shrink-0" />
                      <span className="truncate">{f.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Visual Form Builder / Drag & Drop Layout */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight">Form Fields Order & Config</h4>
                <p className="text-xs text-[#8E9BA8]">Drag items by the grip icon to re-order</p>
              </div>
              <span className="text-xs font-medium text-[#8E9BA8] bg-[#1E252D] px-2.5 py-1 rounded-md border border-[#2C353D]">
                {fields.length} {fields.length === 1 ? "Field" : "Fields"}
              </span>
            </div>

            {fields.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed border-[#2C353D] rounded-xl text-center bg-[#1A2026]/40">
                <FormInput className="w-10 h-10 text-[#8E9BA8] mb-3 opacity-60" />
                <p className="text-sm font-medium text-white mb-1">No Fields Added Yet</p>
                <p className="text-xs text-[#8E9BA8] max-w-xs">
                  Click on any field type in the left panel to build your custom lead capture form.
                </p>
              </div>
            ) : (
              <div className="space-y-3 flex-1 overflow-y-auto pr-1 max-h-[500px]">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`p-3.5 bg-[#1E252D] border rounded-xl transition-all ${
                      draggedIdx === index
                        ? "border-white bg-[#26303A] opacity-50"
                        : "border-[#2C353D] hover:border-[#3E4A56]"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="cursor-grab active:cursor-grabbing text-[#8E9BA8] hover:text-white p-1">
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider text-white bg-[#161B1F] px-2 py-0.5 rounded border border-[#2C353D]">
                        {field.type}
                      </span>
                      <div className="flex-1" />
                      <label className="flex items-center gap-1.5 text-xs text-[#CBD5E1] cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={field.required || false}
                          onChange={(e) => updateField(index, { required: e.target.checked })}
                          className="rounded border-[#2C353D] bg-[#161B1F] text-white"
                        />
                        Required
                      </label>
                      <button
                        type="button"
                        onClick={() => removeField(index)}
                        className="text-[#8E9BA8] hover:text-red-400 p-1 transition-colors cursor-pointer"
                        title="Remove field"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-[#8E9BA8] mb-0.5">Field Label</label>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => updateField(index, { label: e.target.value })}
                          className="w-full bg-[#161B1F] border border-[#2C353D] rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-[#8E9BA8] mb-0.5">Placeholder</label>
                        <input
                          type="text"
                          value={field.placeholder || ""}
                          onChange={(e) => updateField(index, { placeholder: e.target.value })}
                          placeholder="e.g. Enter details"
                          className="w-full bg-[#161B1F] border border-[#2C353D] rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white transition-all"
                        />
                      </div>
                    </div>

                    {field.type === "select" && (
                      <div className="mt-2.5">
                        <label className="block text-[11px] font-medium text-[#8E9BA8] mb-0.5">
                          Options (comma separated)
                        </label>
                        <input
                          type="text"
                          value={(field.options || []).join(", ")}
                          onChange={(e) =>
                            updateField(index, {
                              options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                            })
                          }
                          className="w-full bg-[#161B1F] border border-[#2C353D] rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white transition-all"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2C353D] bg-[#1A2026] flex items-center justify-between">
          <p className="text-xs text-[#8E9BA8]">
            Upon saving, a shortcode like <code className="text-white bg-[#161B1F] px-1.5 py-0.5 rounded border border-[#2C353D]">{"{{form_xxx}}"}</code> will be generated.
          </p>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#8E9BA8] hover:text-white rounded-lg hover:bg-[#222930] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold px-5 py-2 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {editingForm ? "Update Form" : "Save Form & Get Shortcode"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
