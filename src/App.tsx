import { AppShell } from './components/layout/AppShell'
import { HomeScreen } from './screens/HomeScreen'
import { VaultScreen } from './screens/VaultScreen'
import { SwapScreen } from './screens/SwapScreen'
import { SendScreen } from './screens/SendScreen'
import { ReceiveScreen } from './screens/ReceiveScreen'
import { ActivityScreen } from './screens/ActivityScreen'
import { StakingScreen } from './screens/StakingScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { BrowserScreen } from './screens/BrowserScreen'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { ImportWalletScreen } from './screens/ImportWalletScreen'
import { CreatePasswordScreen } from './screens/CreatePasswordScreen'
import { AddressBookScreen } from './screens/AddressBookScreen'
import { useRouter } from './contexts/RouterContext'

function Router() {
  const { location } = useRouter()

  switch (location) {
    case '/welcome':             return <OnboardingScreen />
    case '/import':              return <ImportWalletScreen />
    case '/create-password':     return <CreatePasswordScreen />
    case '/':                    return <HomeScreen />
    case '/tokens':              return <HomeScreen />
    case '/vault':               return <VaultScreen />
    case '/swap':                return <SwapScreen />
    case '/send':                return <SendScreen />
    case '/receive':             return <ReceiveScreen />
    case '/activity':            return <ActivityScreen />
    case '/staking':             return <StakingScreen />
    case '/browser':             return <BrowserScreen />
    case '/settings':            return <SettingsScreen />
    case '/settings/address-book': return <AddressBookScreen />
    default:                     return <HomeScreen />
  }
}

export default function App() {
  return (
    <AppShell>
      <Router />
    </AppShell>
  )
}
