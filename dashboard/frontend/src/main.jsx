import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import Overview from "./pages/Overview.jsx";
import IncidentsList from "./pages/IncidentsList.jsx";
import IncidentDetail from "./pages/IncidentDetail.jsx";
import FaqPage from "./pages/Faq.jsx";
import Login from "./pages/Login.jsx";
import { AuthProvider, useAuth } from "./auth.jsx";
import { useIncidents } from "./useIncidents.js";
import "./styles.css";

function Console() {
  // One poll feeds the sidebar counters, the overview and the list.
  const { incidents, error, stats, apiUp, lastSync, refresh } = useIncidents();

  return (
    <AppShell stats={stats} apiUp={apiUp} lastSync={lastSync} onRefresh={refresh}>
      <Routes>
        <Route path="/" element={<Overview incidents={incidents} stats={stats} error={error} />} />
        <Route path="/incidents" element={<IncidentsList incidents={incidents} error={error} />} />
        <Route path="/incidents/:id" element={<IncidentDetail />} />
        <Route path="/help" element={<FaqPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

function App() {
  const { user } = useAuth();
  return user ? <Console /> : <Login />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
