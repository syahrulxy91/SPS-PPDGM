/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './views/DashboardLayout';
import { useAuthStatus } from './hooks/useAuthStatus';
import { fetchGoogleDriveConfig } from './lib/firebase';

// Lazy load heavy components for code splitting / bundle size reduction
const LandingPage = React.lazy(() => import('./views/LandingPage'));
const MainDashboard = React.lazy(() => import('./views/MainDashboard'));
const UnitDashboard = React.lazy(() => import('./views/UnitDashboard'));
const CarianPintar = React.lazy(() => import('./views/CarianPintar'));

// Loader components
const SplashLoader = () => (
  <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F5F7FA] font-sans">
    <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#0F2D52] border-t-transparent mb-4"></div>
    <div className="text-[#0F2D52] font-semibold text-lg tracking-wide">Memuatkan Sistem e-Laporan...</div>
    <div className="text-slate-400 text-xs mt-1">Sektor Pengurusan Sekolah Gua Musang</div>
  </div>
);

const ViewLoader = () => (
  <div className="flex flex-col items-center justify-center py-20 w-full font-sans">
    <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#1565C0] border-t-transparent mb-3"></div>
    <p className="text-slate-500 text-sm font-medium">Memuatkan maklumat halaman...</p>
  </div>
);

export default function App() {
  React.useEffect(() => {
    fetchGoogleDriveConfig();
  }, []);

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuthStatus();

  if (loading) {
    return <SplashLoader />;
  }

  return (
    <React.Suspense fallback={<SplashLoader />}>
      <Routes>
        <Route path="/" element={!isAuthenticated ? <LandingPage /> : <Navigate to="/dashboard" replace />} />
        
        <Route path="/dashboard" element={isAuthenticated ? <DashboardLayout /> : <Navigate to="/" replace />}>
          <Route 
            index 
            element={
              <React.Suspense fallback={<ViewLoader />}>
                <MainDashboard />
              </React.Suspense>
            } 
          />
          <Route 
            path="unit/:unitName" 
            element={
              <React.Suspense fallback={<ViewLoader />}>
                <UnitDashboard />
              </React.Suspense>
            } 
          />
          <Route 
            path="carian" 
            element={
              <React.Suspense fallback={<ViewLoader />}>
                <CarianPintar />
              </React.Suspense>
            } 
          />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </React.Suspense>
  );
}

