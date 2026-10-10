import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import IncidentsList from "./pages/IncidentsList.jsx";
import IncidentDetail from "./pages/IncidentDetail.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <header className="topbar">
        <a href="/" className="brand">USB Forensics <span>Investigator Dashboard</span></a>
      </header>
      <main className="page">
        <Routes>
          <Route path="/" element={<IncidentsList />} />
          <Route path="/incidents/:id" element={<IncidentDetail />} />
        </Routes>
      </main>
    </BrowserRouter>
  </React.StrictMode>
);
