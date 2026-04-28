import { AppShell } from "./components/layout/AppShell"
import { HomeScreen } from "./screens/HomeScreen"
import { VaultScreen } from "./screens/VaultScreen"
import { SwapScreen } from "./screens/SwapScreen"
import { SendScreen } from "./screens/SendScreen"
import { ReceiveScreen } from "./screens/ReceiveScreen"
import { ActivityScreen } from "./screens/ActivityScreen"
import { StakingScreen } from "./screens/StakingScreen"
import { SettingsScreen } from "./screens/SettingsScreen"
import { OnboardingScreen } from "./screens/OnboardingScreen"
import { ImportWalletScreen } from "./screens/ImportWalletScreen"
import { CreatePasswordScreen } from "./screens/CreatePasswordScreen"
import { AddressBookScreen } from "./screens/AddressBookScreen"
import { useRouter } from "./contexts/RouterContext"

function Router() {
  const { location } = useRouter()

  if (location === '/welcome') return <OnboardingScreen />
  if (location === '/import') return <ImportWalletScreen />
  if (location === '/create-password') return <CreatePasswordScreen />
  if (location === '/') return <HomeScreen />
  if (location === '/vault') return <VaultScreen />
  if (location === '/swap') return <SwapScreen />
  if (location === '/send') return <SendScreen />
  if (location === '/receive') return <ReceiveScreen />
  if (location === '/activity') return <ActivityScreen />
  if (location === '/staking') return <StakingScreen />
  if (location === '/settings') return <SettingsScreen />
  if (location === '/settings/address-book') return <AddressBookScreen />

  // Fallback
  return <div className="p-8 text-center text-text-muted">Screen not found</div>
}

export default function App() {
  return (
    <AppShell>
      <Router />
    </AppShell>
  )
}
