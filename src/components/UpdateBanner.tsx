import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * Mises à jour automatiques : le service worker (registerType "autoUpdate")
 * installe et active la nouvelle version tout seul ; on recharge la page une
 * seule fois quand le nouveau SW prend le contrôle, pour afficher la MAJ sans
 * manip ni bandeau. Composant sans rendu.
 */
export default function UpdateBanner() {
  // Enregistre le SW et vérifie les mises à jour.
  useRegisterSW({ immediate: true });

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // On ne recharge que s'il y avait déjà un contrôleur (= vraie mise à jour,
    // pas la première installation), pour éviter un reload au premier chargement.
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    const onChange = () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    return () =>
      navigator.serviceWorker.removeEventListener("controllerchange", onChange);
  }, []);

  return null;
}
