import { Link, useNavigate } from "@tanstack/react-router";
import { GraduationCap, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="h-9 w-9 rounded-md bg-primary flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl tracking-tight">Scholar</span>
        </Link>

        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                to={role === "teacher" ? "/teacher" : "/student"}
                className="text-sm font-medium px-3 py-2 rounded-md hover:bg-secondary transition-colors"
              >
                Dashboard
              </Link>
              <span className="text-xs uppercase tracking-wider text-muted-foreground px-2">
                {role}
              </span>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-1.5" />
                Sign out
              </Button>
            </>
          ) : (
            <Link to="/auth">
              <Button size="sm">Sign in</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
