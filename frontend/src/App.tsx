import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import SystemHealth from "./pages/SystemHealth";
import NetworkMonitor from "./pages/NetworkMonitor";
import PCHealthCheck from "./pages/PCHealthCheck";
import SoftwareInventory from "./pages/SoftwareInventory";
import TicketManagement from "./pages/TicketManagement";
import AssetManagement from "./pages/AssetManagement";
import Reports from "./pages/Reports";
import Alerts from "./pages/Alerts";
import Users from "./pages/Users";
import Settings from "./pages/Settings";

import EmployeeDashboard from "./components/EmployeeDashboard";
import AdminDashboard from "./components/AdminDashboard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const role = localStorage.getItem("role") || "Viewer";
  if (!allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

import { ThemeProvider } from "./hooks/useTheme";
import { BackendStatusProvider } from "./hooks/useBackendStatus";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BackendStatusProvider>
          <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            
            {/* Role Dashboards */}
            <Route path="/MySupport" element={
              <RoleGuard allowedRoles={["Viewer"]}>
                <EmployeeDashboard />
              </RoleGuard>
            } />

            <Route path="/Admin" element={
              <RoleGuard allowedRoles={["Admin", "Super Administrator", "Administrator"]}>
                <AdminDashboard />
              </RoleGuard>
            } />

            {/* Admin only routes */}
            <Route path="/system-health" element={
              <RoleGuard allowedRoles={["Admin", "Super Administrator", "Administrator"]}>
                <SystemHealth />
              </RoleGuard>
            } />
            <Route path="/network-monitor" element={
              <RoleGuard allowedRoles={["Admin", "Super Administrator", "Administrator"]}>
                <NetworkMonitor />
              </RoleGuard>
            } />
            <Route path="/reports" element={
              <RoleGuard allowedRoles={["Admin", "Super Administrator", "Administrator"]}>
                <Reports />
              </RoleGuard>
            } />
            <Route path="/alerts" element={
              <RoleGuard allowedRoles={["Admin", "Super Administrator", "Administrator"]}>
                <Alerts />
              </RoleGuard>
            } />
            <Route path="/users" element={
              <RoleGuard allowedRoles={["Admin", "Super Administrator", "Administrator"]}>
                <Users />
              </RoleGuard>
            } />

            {/* Admin and Tech routes */}
             <Route path="/pc-health" element={
              <RoleGuard allowedRoles={["Admin", "Super Administrator", "Administrator"]}>
                <PCHealthCheck />
              </RoleGuard>
            } />
             <Route path="/software" element={
              <RoleGuard allowedRoles={["Admin", "Super Administrator", "Administrator"]}>
                <SoftwareInventory />
              </RoleGuard>
            } />
             <Route path="/assets" element={
              <RoleGuard allowedRoles={["Admin", "Super Administrator", "Administrator"]}>
                <AssetManagement />
              </RoleGuard>
            } />

            {/* General user pages */}
            <Route path="/tickets" element={<TicketManagement />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

        </Routes>
      </BrowserRouter>
      </BackendStatusProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
