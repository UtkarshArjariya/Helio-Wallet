import { AppShell } from './components/layout/AppShell'
import { HomeScreen } from './screens/HomeScreen'
import { VaultScreen } from './screens/VaultScreen'
import { SwapScreen } from './screens/SwapScreen'
import { SendScreen } from './screens/SendScreen'
import { ReceiveScreen } from './screens/ReceiveScreen'
import { ActivityScreen } from './screens/ActivityScreen'
import { StakingScreen } from './screens/StakingScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { ImportWalletScreen } from './screens/ImportWalletScreen'
import { CreatePasswordScreen } from './screens/CreatePasswordScreen'
import { SeedPhraseScreen } from './screens/SeedPhraseScreen'
import { UnlockScreen } from './screens/UnlockScreen'
import { AddressBookScreen } from './screens/AddressBookScreen'
import { LanguageSettingsScreen } from './screens/settings/LanguageSettingsScreen'
import { CurrencySettingsScreen } from './screens/settings/CurrencySettingsScreen'
import { NetworkSettingsScreen } from './screens/settings/NetworkSettingsScreen'
import { AutoLockSettingsScreen } from './screens/settings/AutoLockSettingsScreen'
import { PushNotificationsScreen } from './screens/settings/PushNotificationsScreen'
import { VaultAlertsScreen } from './screens/settings/VaultAlertsScreen'
import { CustomizeScreen } from './screens/settings/CustomizeScreen'
import { ChangePasswordScreen } from './screens/settings/ChangePasswordScreen'
import { ManageAppsScreen } from './screens/settings/ManageAppsScreen'
import { SpendingApprovalsScreen } from './screens/settings/SpendingApprovalsScreen'
import { LaunchModeScreen } from './screens/settings/LaunchModeScreen'
import { ExportRecoveryPhraseScreen } from './screens/settings/ExportRecoveryPhraseScreen'
import { ExportPrivateKeyScreen } from './screens/settings/ExportPrivateKeyScreen'
import { TokenDetailScreen } from './screens/TokenDetailScreen'
import { useRouter } from './contexts/RouterContext'

function Router() {
  const { location } = useRouter()

  // Dynamic-segment routes (handled before the static switch).
  if (location.startsWith('/token/')) return <TokenDetailScreen />

  switch (location) {
    case '/welcome':                       return <OnboardingScreen />
    case '/import':                        return <ImportWalletScreen />
    case '/create-password':               return <CreatePasswordScreen />
    case '/seed-phrase':                   return <SeedPhraseScreen />
    case '/unlock':                        return <UnlockScreen />
    case '/':                              return <HomeScreen />
    case '/tokens':                        return <HomeScreen />
    case '/vault':                         return <VaultScreen />
    case '/swap':                          return <SwapScreen />
    case '/send':                          return <SendScreen />
    case '/receive':                       return <ReceiveScreen />
    case '/activity':                      return <ActivityScreen />
    case '/staking':                       return <StakingScreen />
    case '/settings':                      return <SettingsScreen />
    case '/settings/language':             return <LanguageSettingsScreen />
    case '/settings/currency':             return <CurrencySettingsScreen />
    case '/settings/network':              return <NetworkSettingsScreen />
    case '/settings/customize':            return <CustomizeScreen />
    case '/settings/address-book':         return <AddressBookScreen />
    case '/settings/notifications':        return <PushNotificationsScreen />
    case '/settings/vault-alerts':         return <VaultAlertsScreen />
    case '/settings/manage-apps':          return <ManageAppsScreen />
    case '/settings/spending-approvals':   return <SpendingApprovalsScreen />
    case '/settings/auto-lock':            return <AutoLockSettingsScreen />
    case '/settings/launch-mode':          return <LaunchModeScreen />
    case '/settings/change-password':      return <ChangePasswordScreen />
    case '/settings/export-recovery-phrase': return <ExportRecoveryPhraseScreen />
    case '/settings/export-private-key':     return <ExportPrivateKeyScreen />
    default:                               return <HomeScreen />
  }
}

export default function App() {
  return (
    <AppShell>
      <Router />
    </AppShell>
  )
}
