import React, { useState, useEffect } from 'react';
import { MessageSquare, RefreshCw, LogOut, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { getWhatsAppUrl, whatsappFetch } from '../lib/api';

export default function WhatsApp() {
  const [status, setStatus] = useState<'not_initialized' | 'initializing' | 'qr' | 'authenticated' | 'ready' | 'error' | 'logged_out'>('not_initialized');
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const response = await whatsappFetch('/api/whatsapp/status');
      const data = await response.json();
      setStatus(data.status);
      setQr(data.qr);
    } catch (error) {
      console.error('Error fetching WhatsApp status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleInitialize = async () => {
    setLoading(true);
    try {
      await whatsappFetch('/api/whatsapp/initialize', { method: 'POST' });
      fetchStatus();
    } catch (error) {
      console.error('Error initializing WhatsApp:', error);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await whatsappFetch('/api/whatsapp/logout', { method: 'POST' });
      fetchStatus();
    } catch (error) {
      console.error('Error logging out WhatsApp:', error);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold skeuo-text flex items-center gap-3">
          <MessageSquare className="w-8 h-8 text-green-600" /> WhatsApp Connection
        </h1>
        <p className="text-gray-500 mt-2">Manage your WhatsApp Web connection for automated messaging.</p>
      </div>

      <div className="skeuo-card p-8 text-center">
        {loading && status === 'not_initialized' ? (
          <div className="flex flex-col items-center py-12">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <p className="text-gray-600 font-medium">Checking connection status...</p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-col items-center">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] border-4 ${
                status === 'ready' ? 'bg-green-100 border-green-500 text-green-600' :
                status === 'qr' ? 'bg-blue-100 border-blue-500 text-blue-600' :
                status === 'initializing' ? 'bg-amber-100 border-amber-500 text-amber-600' :
                'bg-gray-100 border-gray-300 text-gray-400'
              }`}>
                {status === 'ready' ? <CheckCircle className="w-10 h-10" /> :
                 status === 'error' ? <AlertCircle className="w-10 h-10" /> :
                 <MessageSquare className="w-10 h-10" />}
              </div>
              <h2 className="text-2xl font-bold skeuo-text capitalize">
                {status.replace('_', ' ')}
              </h2>
              <p className="text-gray-500 mt-1">
                {status === 'ready' ? 'Your WhatsApp is connected and ready to send messages.' :
                 status === 'qr' ? 'Scan the QR code below with your WhatsApp app.' :
                 status === 'initializing' ? 'Starting WhatsApp client, please wait...' :
                 'Connect your WhatsApp account to start sending automated messages.'}
              </p>
            </div>

            {status === 'qr' && qr && (
              <div className="flex flex-col items-center space-y-4 animate-in fade-in duration-500">
                <div className="p-4 bg-white rounded-2xl shadow-xl border-8 border-gray-100">
                  <img src={qr} alt="WhatsApp QR Code" className="w-64 h-64" />
                </div>
                <p className="text-sm text-gray-500 font-medium">
                  Open WhatsApp on your phone {'>'} Settings {'>'} Linked Devices {'>'} Link a Device
                </p>
              </div>
            )}

            {status === 'initializing' && (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-4" />
                <p className="text-amber-600 font-bold">Initializing session...</p>
              </div>
            )}

            <div className="flex justify-center gap-4 pt-4">
              {status === 'not_initialized' || status === 'logged_out' || status === 'error' ? (
                <button 
                  onClick={handleInitialize}
                  className="skeuo-btn-primary px-8 py-3 flex items-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" /> Initialize Connection
                </button>
              ) : (
                <button 
                  onClick={handleLogout}
                  className="skeuo-btn-danger px-8 py-3 flex items-center gap-2"
                >
                  <LogOut className="w-5 h-5" /> Disconnect WhatsApp
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 skeuo-inset-box p-6">
        <h3 className="font-bold text-lg mb-2 skeuo-text flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-500" /> Important Note
        </h3>
        <ul className="text-sm text-gray-600 space-y-2 list-disc pl-5 font-medium">
          <li>WhatsApp Web automation can sometimes lead to account bans if used for spam.</li>
          <li>Always use a reasonable delay between messages (at least 5-10 seconds).</li>
          <li>Ensure your recipients have opted-in to receive messages from you.</li>
          <li>Keep this tab open or the server running to maintain the connection.</li>
        </ul>
      </div>
    </div>
  );
}
