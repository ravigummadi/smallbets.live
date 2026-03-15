/**
 * AppFooter - Simple footer for branding and completeness
 */

import { useLocation } from 'react-router-dom';

export default function AppFooter() {
  const location = useLocation();
  const isRoom = location.pathname.startsWith('/room/');

  // Don't show footer inside rooms — it would interfere with the host action bar
  if (isRoom) return null;

  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <span className="app-footer-copyright">
          &copy; {new Date().getFullYear()} SmallBets.live
        </span>
        <span className="app-footer-tagline">
          Made for watch parties
        </span>
      </div>
    </footer>
  );
}
