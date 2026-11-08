import { Routes, Route, Navigate } from "react-router-dom";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import CollectionPage from "./pages/CollectionPage";
import PatrimoinePage from "./pages/PatrimoinePage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/collection" replace />} />
          <Route path="/collection" element={<CollectionPage />} />
          <Route path="/patrimoine" element={<PatrimoinePage />} />
          <Route path="/parametres" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/collection" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
