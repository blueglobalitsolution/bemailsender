import React, { useState, useEffect, useRef } from "react";
import { FileText, Plus, Save, Trash2, Edit3, Mail, MessageSquare } from "lucide-react";
import EmailEditor, { EditorRef } from "react-email-editor";
import { apiFetch, getApiUrl } from "../lib/api";

interface Template {
  id: number;
  name: string;
  subject: string;
  body: string;
  type: 'email' | 'whatsapp';
  design?: any;
}

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'email' | 'whatsapp'>('all');
  const [newTemplate, setNewTemplate] = useState<{ name: string, subject: string, body: string, type: 'email' | 'whatsapp', design?: any }>({
    name: "", subject: "", body: "", type: 'email'
  });

  const emailEditorRef = useRef<EditorRef>(null);

  const fetchTemplates = async () => {
    try {
      const res = await apiFetch("/api/templates/");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newTemplate.type === 'email' && emailEditorRef.current?.editor) {
      emailEditorRef.current.editor.exportHtml(async (data) => {
        const { design, html } = data;
        await saveTemplate(html, design);
      });
    } else {
      await saveTemplate(newTemplate.body, undefined);
    }
  };

  const saveTemplate = async (body: string, design?: any) => {
    try {
      const url = editingId ? `/api/templates/${editingId}/` : "/api/templates/";
      const method = editingId ? "PUT" : "POST";

      const payload = {
        ...newTemplate,
        body,
        design
      };

      const res = await apiFetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setIsCreating(false);
        setEditingId(null);
        setNewTemplate({ name: "", subject: "", body: "", type: 'email', design: undefined });
        fetchTemplates();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (template: Template) => {
    setNewTemplate({
      name: template.name,
      subject: template.subject || "",
      body: template.body,
      type: template.type || 'email',
      design: template.design
    });
    setEditingId(template.id);
    setIsCreating(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onReady = () => {
    if (newTemplate.design && emailEditorRef.current?.editor) {
      emailEditorRef.current.editor.loadDesign(newTemplate.design);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      const res = await apiFetch(`/api/templates/${id}/`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchTemplates();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading templates...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2 skeuo-text">
          <FileText className="w-6 h-6 text-blue-600 drop-shadow-sm" /> Script Architect
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex skeuo-inset-box p-1">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${filterType === 'all' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('email')}
              className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${filterType === 'email' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
            >
              Email
            </button>
            <button
              onClick={() => setFilterType('whatsapp')}
              className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${filterType === 'whatsapp' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
            >
              WhatsApp
            </button>
          </div>
          <button
            onClick={() => {
              setNewTemplate({ name: "", subject: "", body: "", type: 'email', design: undefined });
              setEditingId(null);
              setIsCreating(true);
            }}
            className="skeuo-btn-primary px-4 py-2 text-sm font-bold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Template
          </button>
        </div>
      </div>

      {isCreating && (
        <div className="skeuo-card p-6">
          <h3 className="text-lg font-bold mb-4 skeuo-text">{editingId ? "Edit Template" : "Create New Template"}</h3>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">Template Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewTemplate({ ...newTemplate, type: 'email' })}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${newTemplate.type === 'email' ? 'skeuo-btn-primary' : 'skeuo-btn'
                      }`}
                  >
                    <Mail className="w-4 h-4" /> Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTemplate({ ...newTemplate, type: 'whatsapp' })}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${newTemplate.type === 'whatsapp' ? 'skeuo-btn-primary' : 'skeuo-btn'
                      }`}
                  >
                    <MessageSquare className="w-4 h-4" /> WhatsApp
                  </button>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">Template Name</label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  className="w-full skeuo-input py-2 px-4"
                  required
                />
              </div>
            </div>

            {newTemplate.type === 'email' ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">Email Subject</label>
                  <input
                    type="text"
                    value={newTemplate.subject}
                    onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })}
                    className="w-full skeuo-input py-2 px-4"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">Email Design</label>
                  <p className="text-xs text-gray-500 mb-2 font-medium">Use {'{{variable_name}}'} for dynamic content (e.g., {'{{first_name}}'})</p>
                  <div className="w-full h-[600px] border border-gray-300 rounded-lg overflow-hidden shadow-inner">
                    <EmailEditor
                      key={editingId || 'new'}
                      ref={emailEditorRef}
                      onReady={onReady}
                      minHeight={600}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">WhatsApp Message</label>
                <p className="text-xs text-gray-500 mb-2 font-medium">Use {'{{variable_name}}'} for dynamic content (e.g., {'{{first_name}}'})</p>
                <textarea
                  value={newTemplate.body}
                  onChange={(e) => setNewTemplate({ ...newTemplate, body: e.target.value })}
                  className="w-full skeuo-input py-4 px-4 h-64 font-mono text-sm"
                  placeholder="Hello {{first_name}}, this is a message from..."
                  required
                />
              </div>
            )}

            <div className="flex justify-end gap-4 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingId(null);
                  setNewTemplate({ name: "", subject: "", body: "", type: 'email', design: undefined });
                }}
                className="skeuo-btn px-6 py-2 text-sm font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-gradient-to-b from-orange-400 to-orange-600 border border-orange-700 border-bottom-orange-800 shadow-[0_2px_4px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.4)] text-white text-shadow-[0_-1px_0_rgba(0,0,0,0.3)] hover:from-orange-500 hover:to-orange-700 active:from-orange-600 active:to-orange-400 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] px-8 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Save Template
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates
          .filter(t => filterType === 'all' || t.type === filterType)
          .map((template) => (
            <div key={template.id} className="skeuo-card p-6 flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  {template.type === 'whatsapp' ? (
                    <MessageSquare className="w-4 h-4 text-green-600" />
                  ) : (
                    <Mail className="w-4 h-4 text-blue-600" />
                  )}
                  <h3 className="font-bold text-lg line-clamp-1 skeuo-text" title={template.name}>{template.name}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleEdit(template)} className="p-2 skeuo-btn text-blue-600">
                    <Edit3 className="w-4 h-4 drop-shadow-sm" />
                  </button>
                  <button onClick={() => handleDelete(template.id)} className="p-2 skeuo-btn-danger">
                    <Trash2 className="w-4 h-4 drop-shadow-sm" />
                  </button>
                </div>
              </div>

              {template.type === 'email' && (
                <div className="mb-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1 skeuo-text">Subject</p>
                  <p className="text-sm text-gray-700 line-clamp-1 font-medium" title={template.subject}>{template.subject}</p>
                </div>
              )}

              <div className="flex-1 skeuo-inset-box p-4 overflow-hidden relative group">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">Content Preview</p>
                <div className="text-xs font-mono text-gray-600 line-clamp-6 whitespace-pre-wrap">
                  {template.body.replace(/<[^>]*>?/gm, '').substring(0, 150)}...
                </div>
              </div>
            </div>
          ))}
        {templates.length === 0 && !isCreating && (
          <div className="col-span-full text-center py-12 text-gray-500 skeuo-inset-box font-bold">
            No templates found. Create one to get started!
          </div>
        )}
      </div>
    </div>
  );
}
