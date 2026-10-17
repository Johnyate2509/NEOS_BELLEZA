import { useEffect, useState } from "react";
import "../styles/pwa-install.css";

const DISMISSED_KEY = "neosapp_pwa_install_dismissed";

const appIsInstalled = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

export default function InstallPWA() {
  const [installEvent, setInstallEvent] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (appIsInstalled() || window.localStorage.getItem(DISMISSED_KEY) === "true") return;

    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    setIsIOS(ios);

    const mostrarAviso = () => setShowPrompt(true);
    const capturarInstalacion = (event) => {
      event.preventDefault();
      setInstallEvent(event);
      mostrarAviso();
    };
    const instalacionCompletada = () => {
      setShowPrompt(false);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", capturarInstalacion);
    window.addEventListener("appinstalled", instalacionCompletada);

    // iOS no dispara beforeinstallprompt: se ofrece una guía para su menú Compartir.
    if (ios) mostrarAviso();

    return () => {
      window.removeEventListener("beforeinstallprompt", capturarInstalacion);
      window.removeEventListener("appinstalled", instalacionCompletada);
    };
  }, []);

  const instalar = async () => {
    if (!installEvent) {
      setShowInstructions(true);
      return;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    if (choice?.outcome === "accepted") setShowPrompt(false);
  };

  const cerrarAviso = () => {
    setShowPrompt(false);
    window.localStorage.setItem(DISMISSED_KEY, "true");
  };

  if (!showPrompt) return showInstructions ? (
    <div className="pwa-install-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowInstructions(false); }}>
      <section className="pwa-install-dialog" role="dialog" aria-modal="true" aria-labelledby="pwa-install-title">
        <button className="pwa-install-close" type="button" aria-label="Cerrar" onClick={() => setShowInstructions(false)}>×</button>
        <span className="pwa-install-eyebrow">NEOS BELLEZA</span>
        <h2 id="pwa-install-title">Instala la aplicación</h2>
        {isIOS ? (
          <ol>
            <li>Abre este sitio en Safari.</li>
            <li>Toca el botón <strong>Compartir</strong> del navegador.</li>
            <li>Elige <strong>Añadir a pantalla de inicio</strong> y confirma.</li>
          </ol>
        ) : (
          <p>Abre el menú del navegador y selecciona <strong>Instalar Neos Belleza</strong> o <strong>Instalar aplicación</strong>.</p>
        )}
        <button className="pwa-install-primary" type="button" onClick={() => setShowInstructions(false)}>Entendido</button>
      </section>
    </div>
  ) : null;

  return (
    <aside className="pwa-install-notice" aria-label="Instalar aplicación">
      <img className="pwa-install-icon" src="/favicon.ico" alt="" />
      <div className="pwa-install-copy">
        <strong>Instala Neos Belleza</strong>
        <span>Accede más rápido desde tu dispositivo.</span>
      </div>
      <button className="pwa-install-primary" type="button" onClick={instalar}>{installEvent ? "Instalar" : "Ver cómo"}</button>
      <button className="pwa-install-close" type="button" aria-label="Ahora no" onClick={cerrarAviso}>×</button>
    </aside>
  );
}
