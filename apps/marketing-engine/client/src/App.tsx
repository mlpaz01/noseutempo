import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/Login";
import { Router, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Campanhas from "./pages/Campanhas";
import Criativos from "./pages/Criativos";
import Metricas from "./pages/Metricas";
import Recalibracao from "./pages/Recalibracao";
import Biblioteca from "./pages/Biblioteca";
import Integracoes from "./pages/Integracoes";

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={Dashboard} />
      <Route path="/campanhas" component={Campanhas} />
      <Route path="/campanhas/:id" component={Campanhas} />
      <Route path="/criativos" component={Criativos} />
      <Route path="/metricas" component={Metricas} />
      <Route path="/recalibracao" component={Recalibracao} />
      <Route path="/biblioteca" component={Biblioteca} />
      <Route path="/integracoes" component={Integracoes} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router base="/marketing">
            <AppRouter />
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
