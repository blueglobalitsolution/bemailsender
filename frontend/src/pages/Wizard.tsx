import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Wand2, User, Users, FileText, Settings, ArrowRight, ArrowLeft, Upload, CheckCircle } from "lucide-react";
import { apiFetch, getApiUrl, whatsappFetch, getWhatsAppUrl } from "../lib/api";

export default function Wizard() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<any[]>([]);
  const [identities, setIdentities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [campaignName, setCampaignName] = useState("");
  const [campaignType, setCampaignType] = useState<'email' | 'whatsapp'>('email');
  const [identityId, setIdentityId] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [delayMs, setDelayMs] = useState("1000");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDays, setScheduleDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [whatsappStatus, setWhatsappStatus] = useState<string>('not_initialized');

  useEffect(() => {
    apiFetch(`/api/templates/?type=${campaignType}`)
      .then((res) => res.json())
      .then((data) => setTemplates(data));

    if (campaignType === 'email') {
      apiFetch("/api/identities/")
        .then((res) => res.json())
        .then((data) => setIdentities(data));
    } else {
      whatsappFetch("/api/whatsapp/status")
        .then((res) => res.json())
        .then((data) => setWhatsappStatus(data.status));
    }
  }, [campaignType]);

  const handleNext = () => setStep((s) => Math.min(s + 1, 4));
  const handlePrev = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    if (!csvFile || !templateId || (campaignType === 'email' && !identityId)) {
      alert("Please fill all required fields");
      return;
    }

    if (campaignType === 'whatsapp' && whatsappStatus !== 'ready') {
      alert("WhatsApp must be connected and ready to launch a campaign.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("name", campaignName || `Campaign ${new Date().toLocaleDateString()}`);
    formData.append("type", campaignType);
    formData.append("templateId", templateId);
    if (campaignType === 'email') {
      formData.append("identityId", identityId);
    }
    formData.append("delayMs", delayMs);
    formData.append("scheduleDays", isScheduled ? JSON.stringify(scheduleDays) : "[]");
    formData.append("startTime", isScheduled ? startTime : "");
    formData.append("endTime", isScheduled ? endTime : "");
    formData.append("csv", csvFile);

    try {
      const res = await apiFetch("/api/campaigns/send/", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        navigate(`/campaigns/${data.campaignId}/logs`);
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { id: 1, title: "Identity", icon: User },
    { id: 2, title: "Audience", icon: Users },
    { id: 3, title: "Creative", icon: FileText },
    { id: 4, title: "Governance", icon: Settings },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2 skeuo-text">
          <Wand2 className="w-6 h-6 text-blue-600 drop-shadow-sm" /> Automation Wizard
        </h2>
      </div>

      {/* Progress Bar */}
      <div className="skeuo-card p-6">
        <div className="flex justify-between items-center relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-2 skeuo-progress-track -z-10" />
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-2 skeuo-progress-bar -z-10 transition-all duration-300"
            style={{ width: `${((step - 1) / 3) * 100}%` }}
          />

          {steps.map((s) => (
            <div key={s.id} className="flex flex-col items-center gap-2 px-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 skeuo-step ${step >= s.id ? 'active' : 'text-gray-400'
                }`}>
                <s.icon className="w-5 h-5 drop-shadow-sm" />
              </div>
              <span className={`text-xs font-bold uppercase tracking-wider ${step >= s.id ? 'skeuo-text' : 'text-gray-400'
                }`}>{s.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="skeuo-card p-8 min-h-[400px]">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <h3 className="text-xl font-bold mb-2 skeuo-text">Configure Identity</h3>
              <p className="text-gray-500 text-sm mb-6">Choose your campaign type and sender identity.</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">Campaign Type</label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setCampaignType('email')}
                    className={`flex-1 p-4 rounded-xl font-bold transition-all ${campaignType === 'email' ? 'skeuo-btn-primary' : 'skeuo-btn'
                      }`}
                  >
                    Email Campaign
                  </button>
                  <button
                    onClick={() => setCampaignType('whatsapp')}
                    className={`flex-1 p-4 rounded-xl font-bold transition-all ${campaignType === 'whatsapp' ? 'skeuo-btn-primary' : 'skeuo-btn'
                      }`}
                  >
                    WhatsApp Campaign
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">Campaign Name (Optional)</label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="w-full skeuo-input py-3 px-4"
                  placeholder="e.g., Q3 Outreach"
                />
              </div>

              {campaignType === 'email' ? (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">Select Sender Identity</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {identities.length === 0 ? (
                      <div className="col-span-full text-center py-8 text-gray-500 skeuo-inset-box">
                        No identities found. <a href="/identities" className="text-blue-600 hover:underline font-bold">Add one here</a>.
                      </div>
                    ) : (
                      identities.map((identity) => (
                        <div
                          key={identity.id}
                          onClick={() => setIdentityId(identity.id.toString())}
                          className={`p-4 rounded-xl cursor-pointer transition-all ${identityId === identity.id.toString()
                            ? 'bg-blue-50 border-2 border-blue-400 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_2px_4px_rgba(0,0,0,0.1)]'
                            : 'skeuo-btn'
                            }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-lg skeuo-text">{identity.name}</h4>
                            {identityId === identity.id.toString() && <CheckCircle className="w-5 h-5 text-blue-600 drop-shadow-sm" />}
                          </div>
                          <p className="text-sm text-gray-600 font-medium">{identity.smtp_user}</p>
                          <p className="text-xs text-gray-500 mt-1 font-mono">{identity.host}:{identity.port}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="skeuo-inset-box p-6">
                  <h4 className="font-bold text-lg mb-2 skeuo-text">WhatsApp Connection</h4>
                  {whatsappStatus === 'ready' ? (
                    <div className="flex items-center gap-2 text-green-600 font-bold">
                      <CheckCircle className="w-5 h-5" /> WhatsApp is connected and ready.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-red-500 font-medium">WhatsApp is not connected. Please connect your WhatsApp account first.</p>
                      <a href="/whatsapp" className="inline-block skeuo-btn-primary px-6 py-2 rounded-lg text-sm">Connect WhatsApp</a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <h3 className="text-xl font-bold mb-2 skeuo-text">Import Audience</h3>
              <p className="text-gray-500 text-sm mb-6">Upload a CSV file containing your contacts. Must include an '{campaignType === 'email' ? 'email' : 'phone'}' column.</p>
            </div>

            <div className="skeuo-inset-box p-12 text-center hover:bg-gray-200 transition-colors cursor-pointer relative border-dashed border-2">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-12 h-12 text-gray-500 mx-auto mb-4 drop-shadow-sm" />
              <h4 className="text-lg font-bold mb-1 skeuo-text">Click to upload or drag and drop</h4>
              <p className="text-sm text-gray-500 font-medium">CSV files only</p>

              {csvFile && (
                <div className="mt-6 inline-flex items-center gap-2 bg-gradient-to-b from-green-50 to-green-100 text-green-700 px-4 py-2 rounded-lg text-sm font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.1)] border border-green-200">
                  <CheckCircle className="w-4 h-4" /> {csvFile.name}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <h3 className="text-xl font-bold mb-2 skeuo-text">Select Creative</h3>
              <p className="text-gray-500 text-sm mb-6">Choose a {campaignType} template from your Script Architect library.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {templates.length === 0 ? (
                <div className="col-span-full text-center py-12 text-gray-500 skeuo-inset-box">
                  No {campaignType} templates found. Please create one in Script Architect first.
                </div>
              ) : (
                templates.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setTemplateId(t.id.toString())}
                    className={`p-6 rounded-xl cursor-pointer transition-all ${templateId === t.id.toString()
                      ? 'bg-blue-50 border-2 border-blue-400 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_2px_4px_rgba(0,0,0,0.1)]'
                      : 'skeuo-btn'
                      }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-lg skeuo-text">{t.name}</h4>
                      {templateId === t.id.toString() && <CheckCircle className="w-5 h-5 text-blue-600 drop-shadow-sm" />}
                    </div>
                    {campaignType === 'email' && <p className="text-sm text-gray-600 font-medium mb-4 line-clamp-1">{t.subject}</p>}
                    <div className="text-xs font-mono text-gray-500 line-clamp-3 skeuo-inset-box p-3">
                      {t.body}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <h3 className="text-xl font-bold mb-2 skeuo-text">Governance & Control</h3>
              <p className="text-gray-500 text-sm mb-6">Set delivery rules and scheduling.</p>
            </div>
            <div className="skeuo-inset-box p-6">
              <h4 className="font-bold text-lg mb-4 skeuo-text">Traffic Control</h4>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">Inter-Message Latency (ms)</label>
                <input
                  type="number"
                  value={delayMs}
                  onChange={(e) => setDelayMs(e.target.value)}
                  className="w-full md:w-1/2 skeuo-input py-3 px-4"
                  placeholder="1000"
                />
                <p className="text-xs text-gray-500 mt-2 font-medium">Delay between sending each {campaignType === 'email' ? 'email' : 'message'} to prevent spam flagging (1000ms = 1s).</p>
              </div>
            </div>

            <div className="skeuo-inset-box p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-bold text-lg skeuo-text">Campaign Schedule</h4>
                  <p className="text-sm text-gray-600 mt-1 font-medium">Enable to set specific days and times for this campaign to run.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={isScheduled}
                    onChange={(e) => setIsScheduled(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]"></div>
                </label>
              </div>

              {isScheduled && (
                <div className="space-y-6 pt-4 border-t border-gray-200 animate-in fade-in duration-300">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">Active Days</label>
                    <div className="flex flex-wrap gap-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            if (scheduleDays.includes(index)) {
                              setScheduleDays(scheduleDays.filter(d => d !== index));
                            } else {
                              setScheduleDays([...scheduleDays, index]);
                            }
                          }}
                          className={`px-4 py-2 text-sm font-bold transition-colors rounded-lg ${scheduleDays.includes(index)
                            ? 'skeuo-btn-primary'
                            : 'skeuo-btn'
                            }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">Start Time</label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full skeuo-input py-2 px-4"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">End Time</label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full skeuo-input py-2 px-4"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center">
        <button
          onClick={handlePrev}
          disabled={step === 1}
          className={`px-6 py-3 font-bold flex items-center gap-2 transition-colors ${step === 1 ? 'text-gray-400 cursor-not-allowed opacity-50 skeuo-btn' : 'skeuo-btn'
            }`}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {step < 4 ? (
          <button
            onClick={handleNext}
            className="skeuo-btn-primary px-6 py-3 font-bold flex items-center gap-2"
          >
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-gradient-to-b from-orange-400 to-orange-600 border border-orange-700 border-bottom-orange-800 shadow-[0_2px_4px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.4)] text-white text-shadow-[0_-1px_0_rgba(0,0,0,0.3)] hover:from-orange-500 hover:to-orange-700 active:from-orange-600 active:to-orange-400 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] px-8 py-3 rounded-lg font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Launching..." : "Launch Campaign"} <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
