import {
  OptionRow,
  SettingsSection,
} from '../../components/wallet/settings/SettingsPrimitives';
import { ScreenHeader } from '../../components/wallet/ui/ScreenHeader';
import {
  LANGUAGES,
  type LanguageCode,
  useLanguage,
} from '../../lib/preferences';

export function LanguageSettingsScreen() {
  const [current, setCurrent] = useLanguage();
  return (
    <div className="flex flex-col">
      <ScreenHeader
        title="Language"
        subtitle="Display language for the wallet UI"
      />
      <div className="p-4 space-y-4">
        <SettingsSection label="Available">
          {LANGUAGES.map((l) => (
            <OptionRow<LanguageCode>
              key={l.code}
              label={l.label}
              sub={l.native}
              value={l.code}
              current={current}
              onSelect={setCurrent}
            />
          ))}
        </SettingsSection>
        <p className="text-text-muted text-[11px] px-1 leading-relaxed">
          Currently English is fully translated. Other languages will roll out
          in upcoming releases.
        </p>
      </div>
    </div>
  );
}
