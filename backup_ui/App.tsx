import { Route, Switch } from "wouter";
import { AppShell } from "./components/layout/AppShell";
import { HomeScreen } from "./screens/HomeScreen";
import { VaultScreen } from "./screens/VaultScreen";
import { SwapScreen } from "./screens/SwapScreen";

export default function App() {
  return (
    <AppShell>
      <Switch>
        <Route path="/" component={HomeScreen} />
        <Route path="/vault" component={VaultScreen} />
        <Route path="/swap" component={SwapScreen} />
        <Route>
          <div className="p-8 text-center text-text-muted">Screen not found</div>
        </Route>
      </Switch>
    </AppShell>
  );
}
