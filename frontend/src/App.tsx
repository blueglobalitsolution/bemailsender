import { Routes, Route, Navigate } from "react-router-dom";
import React, { useState, useEffect } from "react";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import DashboardLayout from "./components/DashboardLayout";
import Campaigns from "./pages/Campaigns";
import Wizard from "./pages/Wizard";
import Templates from "./pages/Templates";
import CampaignLogs from "./pages/CampaignLogs";
import Identities from "./pages/Identities";
import WhatsApp from "./pages/WhatsApp";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) setIsAuthenticated(true);
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<Login setAuth={setIsAuthenticated} />} />
      <Route path="/register" element={<Register setAuth={setIsAuthenticated} />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {isAuthenticated ? (
        <Route path="/" element={<DashboardLayout setAuth={setIsAuthenticated} />}>
          <Route index element={<Navigate to="/campaigns" replace />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="campaigns/:id/logs" element={<CampaignLogs />} />
          <Route path="wizard" element={<Wizard />} />
          <Route path="templates" element={<Templates />} />
          <Route path="identities" element={<Identities />} />
          <Route path="whatsapp" element={<WhatsApp />} />
          <Route path="logs" element={<CampaignLogs />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  );
}
