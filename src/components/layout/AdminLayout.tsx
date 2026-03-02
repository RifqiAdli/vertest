import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Brain, LayoutDashboard, FileText, HelpCircle, Users, BarChart3, LogOut, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/tests", icon: FileText, label: "Kelola Tes" },
  { to: "/admin/questions", icon: HelpCircle, label: "Kelola Soal" },
  { to: "/admin/sessions", icon: Users, label: "Sesi Live" },
  { to: "/admin/results", icon: BarChart3, label: "Hasil" },
  { to: "/admin/analytics", icon: TrendingUp, label: "Analitik" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card hidden md:flex flex-col">
        <div className="p-4 border-b">
          <Link to="/admin" className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <span className="font-display font-bold text-primary">VreTest Admin</span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t">
          <div className="text-xs text-muted-foreground mb-2 px-3 truncate">{user?.email}</div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-start">
            <LogOut className="h-4 w-4 mr-2" /> Keluar
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex-1 flex flex-col">
        <header className="md:hidden border-b bg-card p-3 flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <span className="font-display font-bold text-sm text-primary">VreTest</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>
        {/* Mobile nav */}
        <nav className="md:hidden border-b bg-card px-2 py-1 flex overflow-x-auto gap-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium whitespace-nowrap",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-3 w-3" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
