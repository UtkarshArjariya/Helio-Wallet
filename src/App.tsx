import { DappApprovalOverlay } from './components/dapp/DappApprovalOverlay';
import { AppShell } from './components/layout/AppShell';
import { useRouter } from './contexts/RouterContext';
import { ActivityScreen } from './screens/ActivityScreen';
import { AddressBookScreen } from './screens/AddressBookScreen';
import { CreatePasswordScreen } from './screens/CreatePasswordScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ImportPrivateKeyScreen } from './screens/ImportPrivateKeyScreen';
import { ImportWalletScreen } from './screens/ImportWalletScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { ReceiveScreen } from './screens/ReceiveScreen';
import { SeedPhraseScreen } from './screens/SeedPhraseScreen';
import { SendScreen } from './screens/SendScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StakingScreen } from './screens/StakingScreen';
import { SwapScreen } from './screens/SwapScreen';
import { AutoLockSettingsScreen } from './screens/settings/AutoLockSettingsScreen';
import { ChangePasswordScreen } from './screens/settings/ChangePasswordScreen';
import { CurrencySettingsScreen } from './screens/settings/CurrencySettingsScreen';
import { CustomizeScreen } from './screens/settings/CustomizeScreen';
import { ExportPrivateKeyScreen } from './screens/settings/ExportPrivateKeyScreen';
import { ExportRecoveryPhraseScreen } from './screens/settings/ExportRecoveryPhraseScreen';
import { LanguageSettingsScreen } from './screens/settings/LanguageSettingsScreen';
import { LaunchModeScreen } from './screens/settings/LaunchModeScreen';
import { ManageAppsScreen } from './screens/settings/ManageAppsScreen';
import { NetworkSettingsScreen } from './screens/settings/NetworkSettingsScreen';
import { PushNotificationsScreen } from './screens/settings/PushNotificationsScreen';
import { SpendingApprovalsScreen } from './screens/settings/SpendingApprovalsScreen';
import { VaultAlertsScreen } from './screens/settings/VaultAlertsScreen';
import { TokenDetailScreen } from './screens/TokenDetailScreen';
import { UnlockScreen } from './screens/UnlockScreen';
import { VaultScreen } from './screens/VaultScreen';

function Router() {
  const { location } = useRouter();

  // Dynamic-segment routes (handled before the static switch).
  if (location.startsWith('/token/')) return <TokenDetailScreen />;

  switch (location) {
    case '/welcome':
      return <OnboardingScreen />;
    case '/import':
      return <ImportWalletScreen />;
    case '/import-private-key':
      return <ImportPrivateKeyScreen />;
    case '/create-password':
      return <CreatePasswordScreen />;
    case '/seed-phrase':
      return <SeedPhraseScreen />;
    case '/unlock':
      return <UnlockScreen />;
    case '/':
      return <HomeScreen />;
    case '/tokens':
      return <HomeScreen />;
    case '/vault':
      return <VaultScreen />;
    case '/swap':
      return <SwapScreen />;
    case '/send':
      return <SendScreen />;
    case '/receive':
      return <ReceiveScreen />;
    case '/activity':
      return <ActivityScreen />;
    case '/staking':
      return <StakingScreen />;
    case '/settings':
      return <SettingsScreen />;
    case '/settings/language':
      return <LanguageSettingsScreen />;
    case '/settings/currency':
      return <CurrencySettingsScreen />;
    case '/settings/network':
      return <NetworkSettingsScreen />;
    case '/settings/customize':
      return <CustomizeScreen />;
    case '/settings/address-book':
      return <AddressBookScreen />;
    case '/settings/notifications':
      return <PushNotificationsScreen />;
    case '/settings/vault-alerts':
      return <VaultAlertsScreen />;
    case '/settings/manage-apps':
      return <ManageAppsScreen />;
    case '/settings/spending-approvals':
      return <SpendingApprovalsScreen />;
    case '/settings/auto-lock':
      return <AutoLockSettingsScreen />;
    case '/settings/launch-mode':
      return <LaunchModeScreen />;
    case '/settings/change-password':
      return <ChangePasswordScreen />;
    case '/settings/export-recovery-phrase':
      return <ExportRecoveryPhraseScreen />;
    case '/settings/export-private-key':
      return <ExportPrivateKeyScreen />;
    default:
      return <HomeScreen />;
  }
}

export default function App() {
  return (
    <AppShell>
      <Router />
      <DappApprovalOverlay />
    </AppShell>
  );
}
