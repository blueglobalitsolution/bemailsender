import React, { useState } from "react";
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
  const [instruction, setInstruction] = useState("");
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
          instruction: instruction.trim(),
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#121212] border border-[#2a2a2a] w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222222] bg-[#161616]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#00ffff]/10 border border-[#00ffff]/30 rounded-lg text-[#00ffff]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                AI Email Architect <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-[#00ffff]/10 text-[#00ffff] border border-[#00ffff]/20 rounded">Laya Powered</span>
              </h3>
              <p className="text-xs text-neutral-400">Transform rough thoughts, old campaigns, or website notes into ready-to-send copy.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {/* Reference Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1.5">
              Reference Material / Rough Notes <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={4}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Paste product features, past email that worked, target audience details, or quick bullet points..."
              className="w-full bg-[#181818] border border-[#2b2b2b] rounded-lg p-3 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-[#00ffff] transition-colors"
            />
          </div>

          {/* Controls: Tone & Optional Instructions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1.5">
                Tone of Voice
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full bg-[#181818] border border-[#2b2b2b] rounded-lg p-2.5 text-sm text-neutral-200 focus:outline-none focus:border-[#00ffff] transition-colors"
              >
                <option value="auto">Auto-detect (Laya Decision)</option>
                <option value="conversational">Conversational & Direct</option>
                <option value="professional">Professional & Formal</option>
                <option value="urgent">Urgent & Value-Focused</option>
                <option value="friendly">Warm & Friendly</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1.5">
                Extra Instructions (Optional)
              </label>
              <input
                type="text"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="e.g. Keep under 80 words, mention 14-day free trial"
                className="w-full bg-[#181818] border border-[#2b2b2b] rounded-lg p-2.5 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-[#00ffff] transition-colors"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={loading || !reference.trim()}
              className="bg-[#19b3d2] hover:bg-[#20c4e6] disabled:opacity-40 text-black font-semibold text-xs px-5 py-2.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#00ffff]/10"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {loading ? "Generating Draft..." : "Generate Email Draft"}
            </button>
          </div>

          {/* Generated Result Section */}
          {result && (
            <div className="mt-6 border border-[#2e2e2e] bg-[#141414] rounded-xl p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between border-b border-[#222222] pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-neutral-400">Strategy:</span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-200 border border-neutral-700">
                    {result.detected_intent || "outreach"}
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-200 border border-neutral-700">
                    {result.tone || tone}
                  </span>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="text-xs text-neutral-400 hover:text-white flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Regenerate
                </button>
              </div>

              {/* Subject Line */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Suggested Subject</span>
                  <button
                    onClick={() => handleCopy(result.subject, true)}
                    className="text-xs text-neutral-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedSubject ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedSubject ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-2.5 text-sm font-medium text-[#00ffff]">
                  {result.subject}
                </div>
              </div>

              {/* Email Body */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Draft Email Copy</span>
                  <button
                    onClick={() => handleCopy(result.body, false)}
                    className="text-xs text-neutral-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedBody ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedBody ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 text-sm text-neutral-200 whitespace-pre-line font-sans leading-relaxed max-h-60 overflow-y-auto custom-scrollbar">
                  {result.body}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-4 border-t border-[#222222] bg-[#161616] flex items-center justify-between">
          <span className="text-[11px] text-neutral-500">Variables like {'{{name}}'} and {'{{company}}'} are automatically formatted.</span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white text-xs px-4 py-2 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              disabled={!result}
              onClick={() => {
                if (result) {
                  onApply(result.subject, result.body);
                  onClose();
                  toast.success("Applied to editor!");
                }
              }}
              className="bg-[#00ffff] hover:bg-[#00e6e6] disabled:opacity-40 text-black font-semibold text-xs px-5 py-2 rounded-lg transition-all cursor-pointer"
            >
              Apply to Editor
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
