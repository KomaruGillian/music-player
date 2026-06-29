import { NavLink } from "react-router-dom";

const icons = {
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10"/></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  library: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  profile: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
};

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const logout = () => {
    localStorage.removeItem("token");
    window.location.reload();
  };

  return (
    <>
      <div className={`sidebar-overlay${open ? " open" : ""}`} onClick={onClose} />
      <nav className={`sidebar${open ? " open" : ""}`}>
        <div className="sidebar-logo">Music</div>
        <div className="sidebar-nav">
          <NavLink to="/" className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")} end onClick={onClose}>{icons.home} Главная</NavLink>
          <NavLink to="/search" className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")} onClick={onClose}>{icons.search} Поиск</NavLink>
          <NavLink to="/library" className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")} onClick={onClose}>{icons.library} Библиотека</NavLink>
          <NavLink to="/profile" className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")} onClick={onClose}>{icons.profile} Профиль</NavLink>
          <button className="sidebar-link" onClick={logout} style={{ marginTop: "auto", color: "var(--text-secondary)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Выход
          </button>
        </div>
      </nav>
    </>
  );
}
