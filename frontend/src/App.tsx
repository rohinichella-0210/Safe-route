import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from './components/Toaster';
import HomeScreen from './screens/HomeScreen';
import JourneyScreen from './screens/JourneyScreen';
import WatchScreen from './screens/WatchScreen';
import DashboardScreen from './screens/DashboardScreen';
import ReportScreen from './screens/ReportScreen';

export default function App() {
  return (
    <>
      <Toaster />
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/journey/:token" element={<JourneyScreen />} />
        <Route path="/watch/:token" element={<WatchScreen />} />
        <Route path="/report" element={<ReportScreen />} />
        <Route path="/dashboard" element={<DashboardScreen />} />
      </Routes>
    </>
  );
}
