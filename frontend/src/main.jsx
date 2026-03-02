import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App';
import CharacterDetail from './pages/CharacterDetail';
import Admin from './pages/Admin';
import Marathon from './pages/Marathon';
import RunnerReport from './pages/RunnerReport';
import Valorant from './pages/Valorant';
import ValorantDetail from './pages/ValorantDetail';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/character/:id" element={<CharacterDetail />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/marathon" element={<Marathon />} />
        <Route path="/runner/:id/report" element={<RunnerReport />} />
        <Route path="/valorant" element={<Valorant />} />
        <Route path="/valorant/:id" element={<ValorantDetail />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
