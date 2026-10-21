import { useState } from "react";
import { AlertTriangle, Check, Copy, Info, ShieldAlert, ShieldCheck } from "lucide-react";

export interface ValidationIssue {
  level: "error" | "warning" | "info";
  code: string;
  field: "subject" | "body" | string;
  message: string;
  snippet?: string;
  fix?: string;
}

export interface ValidationResult {
  ok: boolean;
  score: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
}

interface Props {
  result: ValidationResult | null;
  compact?: boolean;
}

const levelStyles: Record<string, { border: string; text: string; badge: string; label: string }> = {
  error: {
    border: "border-rose-500/30",
    text: "text-rose-400",
    badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    label: "Error",
  },
  warning: {
    border: "border-amber-500/30",
    text: "text-amber-400",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    label: "Warning",
  },
  info: {
    border: "border-sky-500/30",
    text: "text-sky-400",
    badge: "bg-sky-500/10 text-sky-400 border-sky-500/30",
    label: "Info",
  },
};

export default function TemplateValidationPanel({ result, compact = false }: Props) {
  const [copied, setCopied] = useState(false);

  if (!result) return null;

  const issues = [...result.errors, ...result.warnings, ...result.info];
  const hasErrors = result.summary.errors > 0;

  const buildReport = () => {
    const lines: string[] = [
      "Pre-send checks",
      `${result.summary.errors} errors · ${result.summary.warnings} warnings · ${result.summary.info} info`,
      `Status: ${hasErrors ? "BLOCKED" : result.summary.warnings > 0 ? "REVIEW" : "READY"}`,
      "",
    ];

    const groups: Array<[string, ValidationIssue[]]> = [
      ["ERRORS", result.errors],
      ["WARNINGS", result.warnings],
      ["INFO", result.info],
    ];

    for (const [title, list] of groups) {
      if (!list.length) continue;
      lines.push(`${title} (${list.length})`);
      list.forEach((issue, index) => {
        lines.push(`${index + 1}. [${issue.field}] ${issue.message}`);
        if (issue.snippet) lines.push(`   Snippet: ${issue.snippet}`);
        if (issue.fix) lines.push(`   Fix: ${issue.fix}`);
      });
      lines.push("");
    }

    return lines.join("\n").trim();
  };

  const copyReport = async () => {
    const text = buildReport();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`bg-[#14181C] border border-[#2C353D] rounded-xl ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {hasErrors ? (
            <ShieldAlert className="w-7 h-7 text-rose-400" />
          ) : result.summary.warnings > 0 ? (
            <AlertTriangle className="w-7 h-7 text-amber-400" />
          ) : (
            <ShieldCheck className="w-7 h-7 text-emerald-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-white">Pre-send checks</span>
            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 border rounded ${hasErrors ? levelStyles.error.badge : result.summary.warnings > 0 ? levelStyles.warning.badge : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"}`}>
              {hasErrors ? "Blocked" : result.summary.warnings > 0 ? "Review" : "Ready"}
            </span>
            <span className="text-[10px] font-mono text-[#8E9BA8]">
              {result.summary.errors} errors · {result.summary.warnings} warnings
            </span>
            <button
              type="button"
              onClick={copyReport}
              className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#CBD5E1] hover:text-white bg-[#222930] hover:bg-[#2C353D] border border-[#2C353D] rounded-md px-2 py-1 transition-colors cursor-pointer shrink-0"
              title="Copy all pre-send check results"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          {!compact && (
            <div className="mt-2 w-full bg-[#222930] h-1.5 overflow-hidden rounded-full">
              <div
                className={`h-full transition-all duration-500 ${hasErrors ? "bg-rose-500" : result.summary.warnings > 0 ? "bg-amber-400" : "bg-emerald-400"}`}
                style={{ width: `${Math.max(4, result.score)}%` }}
              />
            </div>
          )}

          {issues.length === 0 ? (
            <p className="text-xs text-emerald-400 mt-2">All checks passed — template looks clean.</p>
          ) : (
            <div className={`mt-3 space-y-2 ${compact ? "max-h-52" : "max-h-72"} overflow-y-auto pr-1`}>
              {issues.map((issue, index) => {
                const style = levelStyles[issue.level] || levelStyles.info;
                return (
                  <div key={`${issue.code}-${index}`} className={`border-l-2 ${style.border} pl-3 py-1.5`}>
                    <div className="flex items-start gap-2">
                      <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 border rounded shrink-0 ${style.badge}`}>
                        {style.label}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs text-[#CBD5E1] leading-relaxed">{issue.message}</p>
                        {issue.snippet && (
                          <code className="mt-1 block text-[10px] font-mono text-[#8E9BA8] bg-[#0B0F13] border border-[#2C353D] rounded px-2 py-1 truncate">
                            {issue.snippet}
                          </code>
                        )}
                        {issue.fix && (
                          <p className="mt-1 text-[10px] text-[#8E9BA8]">
                            <span className="font-semibold text-[#CBD5E1]">Fix:</span> {issue.fix}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hasErrors && (
            <p className="mt-2 text-[10px] text-rose-400">
              Fix the errors above before sending. You can still use “Send anyway” / “Launch anyway” if you are sure.
            </p>
          )}
        </div>

        {compact && issues.length === 0 && <Info className="w-4 h-4 text-[#8E9BA8]" />}
      </div>
    </div>
  );
}
