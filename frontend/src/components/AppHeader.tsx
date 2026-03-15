/**
 * AppHeader - Persistent top navigation bar
 */

import { Link, NavLink, useLocation } from 'react-router-dom';

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
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `app-header-link ${isActive ? 'app-header-link--active' : ''}`
            }
          >
            Home
          </NavLink>
          <NavLink
            to="/create"
            className={({ isActive }) =>
              `app-header-link ${isActive ? 'app-header-link--active' : ''}`
            }
          >
            Create Room
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
