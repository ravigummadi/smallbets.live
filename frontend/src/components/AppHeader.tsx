/**
 * AppHeader - Persistent top navigation bar
 */

import { Link, useLocation } from 'react-router-dom';

export default function AppHeader() {
  const location = useLocation();
  const isRoom = location.pathname.startsWith('/room/');

  // Don't show the header inside rooms — RoomHeader handles that context
  if (isRoom) return null;

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link to="/" className="app-header-logo">
          <div className="app-header-logo-icon">SB</div>
          <div className="app-header-logo-text">
            <span className="app-header-brand">SmallBets</span>
            <span className="app-header-brand-suffix">.live</span>
          </div>
        </Link>
        <nav className="app-header-nav">
          <Link
            to="/"
            className={`app-header-link ${location.pathname === '/' ? 'app-header-link--active' : ''}`}
          >
            Home
          </Link>
          <Link
            to="/create"
            className={`app-header-link ${location.pathname === '/create' ? 'app-header-link--active' : ''}`}
          >
            Create Room
          </Link>
        </nav>
      </div>
    </header>
  );
}
