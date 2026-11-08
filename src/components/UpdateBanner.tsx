import { useRegisterSW } from "virtual:pwa-register/react";

export default function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="update-banner">
      <span className="ub-text">Nouvelle version disponible</span>
      <div className="ub-actions">
        <button className="btn small" onClick={() => setNeedRefresh(false)}>
          Plus tard
        </button>
        <button
          className="btn primary small"
          onClick={() => updateServiceWorker(true)}
        >
          Recharger
        </button>
      </div>
    </div>
  );
}
