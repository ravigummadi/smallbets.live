/**
 * Main App component with routing
 *
 * Page components are lazy-loaded (React.lazy) so the initial bundle for "/"
 * only contains the shell (header/footer/router). Firebase/Firestore code is
 * reached solely through RoomPage's hooks, so it lands in that route's chunk.
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppHeader from './components/AppHeader';
import AppFooter from './components/AppFooter';

const HomePage = lazy(() => import('./components/pages/HomePage'));
const CreateRoomPage = lazy(() => import('./components/pages/CreateRoomPage'));
const JoinRoomPage = lazy(() => import('./components/pages/JoinRoomPage'));
const RoomPage = lazy(() => import('./components/pages/RoomPage'));
const RoomCreatedPage = lazy(() => import('./components/pages/RoomCreatedPage'));

/** Minimal, screen-reader-announced fallback shown while a route chunk loads. */
export function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite" aria-busy="true">
      <div className="spinner" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppHeader />
      <main className="main-content">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/create" element={<CreateRoomPage />} />
            <Route path="/room-created" element={<RoomCreatedPage />} />
            <Route path="/join/:code?" element={<JoinRoomPage />} />
            <Route path="/room/:code" element={<RoomPage />} />
            <Route path="/room/:code/u/:userKey" element={<RoomPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <AppFooter />
    </BrowserRouter>
  );
}

export default App;
