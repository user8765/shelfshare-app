import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getToken } from './api/client';
import Layout from './components/Layout';
import Login from './pages/Login';
import Library from './pages/Library';
import Discover from './pages/Discover';
import Borrows from './pages/Borrows';
import Communities from './pages/Communities';
import Messages from './pages/Messages';

function RequireAuth({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Navigate to="/discover" replace />} />
          <Route path="/discover"    element={<Discover />} />
          <Route path="/library"     element={<Library />} />
          <Route path="/borrows"     element={<Borrows />} />
          <Route path="/communities" element={<Communities />} />
          <Route path="/messages"    element={<Messages />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
