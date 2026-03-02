import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import LandingPage from "./pages/LandingPage";
import TestEntry from "./pages/TestEntry";
import TestSession from "./pages/TestSession";
import TestResult from "./pages/TestResult";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminTests from "./pages/admin/AdminTests";
import AdminQuestions from "./pages/admin/AdminQuestions";
import AdminSessions from "./pages/admin/AdminSessions";
import AdminResults from "./pages/admin/AdminResults";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Memuat...</div>;
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/test/entry/:testId" element={<TestEntry />} />
            <Route path="/test/session/:sessionId" element={<TestSession />} />
            <Route path="/test/result/:sessionId" element={<TestResult />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/tests" element={<AdminRoute><AdminTests /></AdminRoute>} />
            <Route path="/admin/questions" element={<AdminRoute><AdminQuestions /></AdminRoute>} />
            <Route path="/admin/sessions" element={<AdminRoute><AdminSessions /></AdminRoute>} />
            <Route path="/admin/results" element={<AdminRoute><AdminResults /></AdminRoute>} />
            <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
