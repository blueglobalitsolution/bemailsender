import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { getApiUrl } from "../lib/api";

export default function PublicLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    const fetchLandingHtml = async () => {
      try {
        setLoading(true);
        const res = await fetch(getApiUrl(`/api/public/html/${slug}/`));
        if (res.ok) {
          const htmlText = await res.text();
          setHtmlContent(htmlText);
        } else {
          setError("Landing page not found or has been removed.");
        }
      } catch (err: any) {
        console.error(err);
        setError("Network error loading landing page.");
      } finally {
        setLoading(false);
      }
    };
    fetchLandingHtml();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#101417] flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-white animate-spin mb-4" />
        <p className="text-sm text-[#8E9BA8]">Loading Landing Page...</p>
      </div>
    );
  }

  if (error || !htmlContent) {
    return (
      <div className="min-h-screen bg-[#101417] flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
        <p className="text-[#8E9BA8] max-w-md text-sm">{error || "The requested landing page does not exist."}</p>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen m-0 p-0 overflow-hidden bg-black">
      <iframe
        srcDoc={htmlContent}
        title="Landing Page Preview"
        className="w-full h-full border-0 block"
        style={{ width: "100vw", height: "100vh", border: "none" }}
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals"
      />
    </div>
  );
}
