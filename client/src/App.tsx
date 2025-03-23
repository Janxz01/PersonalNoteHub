import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ThemeToggle } from "@/components/ThemeToggle";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Notes from "@/pages/Notes";
import NoteDetail from "@/pages/NoteDetail";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useEffect, lazy, Suspense } from "react";

function Router() {
  const [location] = useLocation();

  // Check if user is on auth page to style body
  useEffect(() => {
    if (location === "/login" || location === "/register") {
      document.body.classList.add("bg-gray-50");
    } else {
      document.body.classList.remove("bg-gray-50");
    }
  }, [location]);

  return (
    <>
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50">
        <ThemeToggle />
      </div>
      <div className="overflow-x-hidden"> {/* Added overflow-x-hidden here */}
        <Switch>
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/">
            {() => (
              <ProtectedRoute>
                <Notes />
              </ProtectedRoute>
            )}
          </Route>
          <Route path="/notes/:id">
            {(params) => (
              <ProtectedRoute>
                <NoteDetail />
              </ProtectedRoute>
            )}
          </Route>
          <Route component={NotFound} />
        </Switch>
      </div>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;