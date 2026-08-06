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
import Organizations from "./pages/Organizations";
import Departments from "./pages/Departments";
import AgentEnrollments from "./pages/AgentEnrollments";
import AuditLogs from "./pages/AuditLogs";
import SessionLogs from "./pages/SessionLogs";

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
  const role = localStorage.getItem("role") || "EMPLOYEE";
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
              <RoleGuard allowedRoles={["EMPLOYEE"]}>
                <EmployeeDashboard />
              </RoleGuard>
            } />

            <Route path="/Admin" element={
              <RoleGuard allowedRoles={["SUPER_ADMIN", "ORGANIZATION_ADMIN", "IT_ADMIN", "HR_ADMIN", "VIEWER"]}>
                <AdminDashboard />
              </RoleGuard>
            } />

            {/* Admin only routes */}
            <Route path="/system-health" element={
              <RoleGuard allowedRoles={["SUPER_ADMIN", "ORGANIZATION_ADMIN", "IT_ADMIN", "VIEWER"]}>
                <SystemHealth />
              </RoleGuard>
            } />
            <Route path="/network-monitor" element={
              <RoleGuard allowedRoles={["SUPER_ADMIN", "ORGANIZATION_ADMIN", "IT_ADMIN", "VIEWER"]}>
                <NetworkMonitor />
              </RoleGuard>
            } />
            <Route path="/reports" element={
              <RoleGuard allowedRoles={["SUPER_ADMIN", "ORGANIZATION_ADMIN", "IT_ADMIN", "HR_ADMIN", "VIEWER"]}>
                <Reports />
              </RoleGuard>
            } />
            <Route path="/alerts" element={
              <RoleGuard allowedRoles={["SUPER_ADMIN", "ORGANIZATION_ADMIN", "IT_ADMIN", "VIEWER"]}>
                <Alerts />
              </RoleGuard>
            } />
            <Route path="/users" element={
              <RoleGuard allowedRoles={["SUPER_ADMIN", "ORGANIZATION_ADMIN", "HR_ADMIN"]}>
                <Users />
              </RoleGuard>
            } />

            {/* Admin and Tech routes */}
             <Route path="/pc-health" element={
              <RoleGuard allowedRoles={["SUPER_ADMIN", "ORGANIZATION_ADMIN", "IT_ADMIN"]}>
                <PCHealthCheck />
              </RoleGuard>
            } />
             <Route path="/software" element={
              <RoleGuard allowedRoles={["SUPER_ADMIN", "ORGANIZATION_ADMIN", "IT_ADMIN"]}>
                <SoftwareInventory />
              </RoleGuard>
            } />
             <Route path="/assets" element={
              <RoleGuard allowedRoles={["SUPER_ADMIN", "ORGANIZATION_ADMIN", "IT_ADMIN", "HR_ADMIN", "VIEWER"]}>
                <AssetManagement />
              </RoleGuard>
            } />

            {/* General user pages */}
            <Route path="/tickets" element={
              <RoleGuard allowedRoles={["SUPER_ADMIN", "ORGANIZATION_ADMIN", "IT_ADMIN", "HR_ADMIN", "EMPLOYEE"]}>
                <TicketManagement />
              </RoleGuard>
            } />
            <Route path="/settings" element={
              <RoleGuard allowedRoles={["SUPER_ADMIN", "ORGANIZATION_ADMIN", "IT_ADMIN", "HR_ADMIN", "EMPLOYEE"]}>
                <Settings />
              </RoleGuard>
            } />

            {/* Custom ITSM views */}
            <Route path="/organizations" element={
              <RoleGuard allowedRoles={["SUPER_ADMIN"]}>
                <Organizations />
              </RoleGuard>
            } />
            <Route path="/departments" element={
              <RoleGuard allowedRoles={["SUPER_ADMIN", "ORGANIZATION_ADMIN"]}>
                <Departments />
              </RoleGuard>
            } />
            <Route path="/agent-enrollments" element={
              <RoleGuard allowedRoles={["SUPER_ADMIN", "ORGANIZATION_ADMIN", "IT_ADMIN"]}>
                <AgentEnrollments />
              </RoleGuard>
            } />
            <Route path="/audit-logs" element={
              <RoleGuard allowedRoles={["SUPER_ADMIN", "ORGANIZATION_ADMIN"]}>
                <AuditLogs />
              </RoleGuard>
            } />
            <Route path="/session-logs" element={
              <RoleGuard allowedRoles={["SUPER_ADMIN", "ORGANIZATION_ADMIN"]}>
                <SessionLogs />
              </RoleGuard>
            } />
          </Route>

        </Routes>
      </BrowserRouter>
      </BackendStatusProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
