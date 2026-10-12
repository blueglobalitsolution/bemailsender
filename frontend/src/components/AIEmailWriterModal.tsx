import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, Loader2, Copy, Check, Wand2, X, RefreshCw } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useToast } from "./Toast";

interface AIEmailWriterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (subject: string, body: string) => void;
}

export default function AIEmailWriterModal({ isOpen, onClose, onApply }: AIEmailWriterModalProps) {
  const toast = useToast();
  const [reference, setReference] = useState("");
  const [tone, setTone] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [result, setResult] = useState<{
    subject: string;
    body: string;
    detected_intent?: string;
    tone?: string;
    engine?: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!reference.trim()) {
      toast.error("Please provide some reference material or rough notes.");
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch("/api/ai/generate-email/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: reference.trim(),
          tone,
        }),
      });

      if (!res.ok) {
        let errorMsg = "Failed to generate email";
        try {
          const err = await res.json();
          errorMsg = err.error || err.detail || errorMsg;
        } catch {
          errorMsg = `Server error (${res.status})`;
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      setResult(data);
      toast.success("AI draft generated successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to connect to AI engine.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, isSubject: boolean) => {
    navigator.clipboard.writeText(text);
    if (isSubject) {
      setCopiedSubject(true);
      setTimeout(() => setCopiedSubject(false), 2000);
    } else {
      setCopiedBody(true);
      setTimeout(() => setCopiedBody(false), 2000);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Solid Backdrop - NO BLUR */}
      <div
        className="fixed inset-0 bg-black/60 transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Slide-out Drawer Panel Anchored Flush to Right Side */}
      <div className="fixed inset-y-0 right-0 top-0 bottom-0 flex max-w-full">
        <div className="w-screen max-w-2xl lg:max-w-3xl h-full bg-[#161B1F] border-l border-[#2C353D] flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
          {/* Drawer Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#2C353D] bg-[#1A2026] shrink-0">
            <div>
              <h3 className="text-base font-bold text-white">
                AI Email Architect
              </h3>
              <p className="text-xs text-[#8E9BA8] mt-0.5">
                Transform rough thoughts, old campaigns, or website notes into ready-to-send copy.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-[#8E9BA8] hover:text-white p-2 rounded-lg bg-[#222930] hover:bg-[#2C353D] border border-[#2C353D] transition-colors cursor-pointer"
              title="Close Drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Content Body */}
          <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-[#14181C] custom-scrollbar">
            {/* Reference Input */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1] mb-1.5">
                Reference Material / Rough Notes <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={5}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Paste product features, past email that worked, target audience details, or quick bullet points..."
                className="w-full bg-[#161B1F] border border-[#2C353D] rounded-xl p-3.5 text-sm text-[#E2E8F0] placeholder-[#64748B] focus:outline-none focus:border-white transition-colors"
              />
            </div>

            {/* Controls: Tone of Voice */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1] mb-1.5">
                Tone of Voice
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full bg-[#161B1F] border border-[#2C353D] rounded-xl p-2.5 text-sm text-[#E2E8F0] focus:outline-none focus:border-white transition-colors cursor-pointer"
              >
                <option value="auto">Auto-detect (Laya Decision)</option>
                <option value="conversational">Conversational & Direct</option>
                <option value="professional">Professional & Formal</option>
                <option value="urgent">Urgent & Value-Focused</option>
                <option value="friendly">Warm & Friendly</option>
              </select>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={handleGenerate}
                disabled={loading || !reference.trim()}
                className="bg-white hover:bg-[#CBD5E1] disabled:opacity-40 text-[#161B1F] font-bold text-xs px-5 py-2.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-md"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {loading ? "Generating Draft..." : "Generate Email Draft"}
              </button>
            </div>

            {/* Generated Result Section */}
            {result && (
              <div className="mt-6 border border-[#2C353D] bg-[#161B1F] rounded-xl p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2 shadow-lg">
                <div className="flex items-center justify-between border-b border-[#2C353D] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#8E9BA8]">Strategy:</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#222930] text-[#CBD5E1] border border-[#2C353D]">
                      {result.detected_intent || "outreach"}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#222930] text-[#CBD5E1] border border-[#2C353D]">
                      {result.tone || tone}
                    </span>
                  </div>
                  <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className="text-xs text-[#8E9BA8] hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Regenerate
                  </button>
                </div>

                {/* Subject Line */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-[#CBD5E1] uppercase tracking-wider">Suggested Subject</span>
                    <button
                      onClick={() => handleCopy(result.subject, true)}
                      className="text-xs text-[#8E9BA8] hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {copiedSubject ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedSubject ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="bg-[#14181C] border border-[#2C353D] rounded-lg p-3 text-sm font-semibold text-white">
                    {result.subject}
                  </div>
                </div>

                {/* Email Body */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-[#CBD5E1] uppercase tracking-wider">Draft Email Copy</span>
                    <button
                      onClick={() => handleCopy(result.body, false)}
                      className="text-xs text-[#8E9BA8] hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {copiedBody ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedBody ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="bg-[#14181C] border border-[#2C353D] rounded-lg p-3.5 text-sm text-[#E2E8F0] whitespace-pre-line font-sans leading-relaxed max-h-72 overflow-y-auto custom-scrollbar">
                    {result.body}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Drawer Footer Actions */}
          <div className="px-6 py-4 border-t border-[#2C353D] bg-[#1A2026] flex items-center justify-between shrink-0">
            <span className="text-[11px] text-[#8E9BA8]">
              Variables like <code className="text-[#CBD5E1]">{"{{first_name}}"}</code> are automatically formatted.
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-[#2C353D] bg-[#222930] hover:bg-[#2C353D] text-[#CBD5E1] hover:text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!result}
                onClick={() => {
                  if (result) {
                    onApply(result.subject, result.body);
                    onClose();
                    toast.success("Applied to editor!");
                  }
                }}
                className="bg-white hover:bg-[#CBD5E1] disabled:opacity-40 text-[#161B1F] font-bold text-xs px-5 py-2.5 rounded-lg transition-all cursor-pointer shadow-md"
              >
                Apply to Editor
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
