import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import StoryboardList from './pages/StoryboardList';
import StoryboardEditor from './pages/StoryboardEditor';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StoryboardList />} />
        <Route path="/s/:id" element={<StoryboardEditor />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
