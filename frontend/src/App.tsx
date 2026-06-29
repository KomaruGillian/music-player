import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { usePlayerStore } from "./store/playerStore";
import { themeStore, getThemeCSS } from "./store/themeStore";
import API from "./lib/api";
import Sidebar from "./components/Sidebar";
import Player from "./components/Player";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Search from "./pages/Search";
import Library from "./pages/Library";
import Profile from "./pages/Profile";
import ArtistPage from "./pages/ArtistPage";
import AlbumPage from "./pages/AlbumPage";
import TrackPage from "./pages/TrackPage";
import "./styles/global.css";

function App() {
  const token = localStorage.getItem("token");
  const setVolume = usePlayerStore((s) => s.setVolume);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("volume");
    if (saved) setVolume(parseFloat(saved));
  }, []);

  useEffect(() => {
    if (token) {
      API.get("/users/me/theme").then((res) => {
        const d = res.data;
        themeStore.setTheme({
          preset: d.themePreset || "dark",
          accentColor: d.accentColor,
          bgColor: d.bgColor,
          cardColor: d.cardColor,
          textColor: d.textColor,
        });
      }).catch(() => {});
    }
  }, [token]);

  useEffect(() => {
    const css = getThemeCSS();
    for (const [k, v] of Object.entries(css)) {
      document.documentElement.style.setProperty(k, v);
    }
    document.body.className = themeStore.preset === "light" ? "light" : "";
  });

  if (!token) return <Login />;

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="main-content">
          <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Меню">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={24} height={24}><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/library" element={<Library />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/artist/:id" element={<ArtistPage />} />
            <Route path="/album/:id" element={<AlbumPage />} />
            <Route path="/track/:id" element={<TrackPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
        <Player />
      </div>
    </BrowserRouter>
  );
}

export default App;
