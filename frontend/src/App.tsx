/**
 * Main App component with routing
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './components/pages/HomePage';
import CreateRoomPage from './components/pages/CreateRoomPage';
import JoinRoomPage from './components/pages/JoinRoomPage';
import RoomPage from './components/pages/RoomPage';
import AppHeader from './components/AppHeader';
import AppFooter from './components/AppFooter';

function App() {
  return (
    <BrowserRouter>
      <AppHeader />
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/create" element={<CreateRoomPage />} />
          <Route path="/join/:code?" element={<JoinRoomPage />} />
          <Route path="/room/:code" element={<RoomPage />} />
          <Route path="/room/:code/u/:userKey" element={<RoomPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <AppFooter />
    </BrowserRouter>
  );
}

export default App;
