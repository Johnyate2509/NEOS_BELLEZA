import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/global.css";
import { StoreProvider } from "./context/StoreContext";
import { AuthProvider } from "./context/AuthContext";
import NetworkStatus from "./components/NetworkStatus";
import InstallPWA from "./components/InstallPWA";

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("No se pudo activar el modo PWA:", error);
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <StoreProvider>
      <BrowserRouter>
        <App />
        <NetworkStatus />
        <InstallPWA />
      </BrowserRouter>
    </StoreProvider>
  </AuthProvider>
);


