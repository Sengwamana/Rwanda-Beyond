import React, { useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  Globe,
  MapPin,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Save,
  Shield,
  Sliders,
  Smartphone,
  Sun,
  User,
  Wifi,
} from 'lucide-react';
import { Language, translations } from '../utils/translations';
import {
  useAdminConfigs,
  useAdminDevices,
  useFarms,
  useProfile,
  useSensorsByFarm,
  useSystemHealth,
  useUpdateProfile,
  useUpdateSystemConfig,
} from '../hooks/useApi';
import { useAppStore, useAuthStore, useFarmStore } from '../store';

interface SettingsProps {
  language?: Language;
  setLanguage?: (lang: Language) => void;
}

type NotificationPreferences = {
  pest: boolean;
  irrigation: boolean;
  soil: boolean;
  sms: boolean;
  ussd: boolean;
};

type DeviceListItem = {
  id: string;
  deviceId: string;
  displayName: string;
  status: string;
  batteryLevel?: number;
  lastSeen?: string | null;
  location?: string | null;
};

const defaultNotifications: NotificationPreferences = {
  pest: true,
  irrigation: true,
  soil: false,
  sms: true,
  ussd: false,
};

function parseNumberValue(value: unknown, fallback: number) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function parseBooleanValue(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'enabled'].includes(normalized)) return true;
    if (['false', '0', 'no', 'disabled'].includes(normalized)) return false;
  }
  return fallback;
}

function getConfigItem(
  configMap: Record<string, Record<string, { value: unknown; description?: string }>> | undefined,
  key: string
) {
  if (!configMap) return undefined;

  for (const group of Object.values(configMap)) {
    if (group && typeof group === 'object' && key in group) {
      return group[key];
    }
  }

  return undefined;
}

function formatStatusLabel(status?: string | null) {
  if (!status) return 'Unknown';
  return status.replace(/_/g, ' ');
}

function formatDateTime(value?: string | null) {
  if (!value) return 'No recent check-in';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString();
}

function ToggleRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-[#FAFAF9] dark:bg-slate-700 rounded-2xl">
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-100 ml-1">{label}</span>
      <button
        onClick={onToggle}
        className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ${
          value ? 'bg-[#0F5132]' : 'bg-slate-200 dark:bg-slate-600'
        }`}
      >
        <div
          className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
            value ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export const Settings: React.FC<SettingsProps> = ({ language = 'en', setLanguage }) => {
  const t = translations[language].settings;
  const { user, updateUserProfile } = useAuthStore();
  const {
    theme,
    toggleTheme,
    sidebarCollapsed,
    toggleSidebar,
    setLanguage: setAppLanguage,
  } = useAppStore();
  const { selectedFarm, farms: storedFarms } = useFarmStore();
  const { data: farmsResponse } = useFarms({ isActive: true, page: 1, limit: 25 });

  const isAdmin = user?.role === 'admin';
  const availableFarms = farmsResponse?.data || storedFarms;
  const activeFarm = selectedFarm || availableFarms[0] || null;

  const { data: profile } = useProfile();
  const updateProfileMutation = useUpdateProfile();
  const { data: adminConfigs } = useAdminConfigs(isAdmin);
  const updateSystemConfigMutation = useUpdateSystemConfig();
  const { data: adminDevices } = useAdminDevices({ page: 1, limit: 6 }, isAdmin);
  const { data: systemHealth } = useSystemHealth(isAdmin);
  const { data: farmSensors } = useSensorsByFarm(activeFarm?.id || '');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<Language>(language);
  const [notifications, setNotifications] = useState<NotificationPreferences>(defaultNotifications);
  const [moistureThreshold, setMoistureThreshold] = useState(25);
  const [criticalMoistureThreshold, setCriticalMoistureThreshold] = useState(18);
  const [pestConfidenceThreshold, setPestConfidenceThreshold] = useState(0.75);
  const [smsGatewayEnabled, setSmsGatewayEnabled] = useState(true);
  const [ussdGatewayEnabled, setUssdGatewayEnabled] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;

    setFirstName(profile.firstName || '');
    setLastName(profile.lastName || '');
    setPhoneNumber(profile.phoneNumber || '');
    setPreferredLanguage(profile.preferredLanguage || language);

    const metadataNotifications = profile.metadata?.notificationPreferences;
    if (metadataNotifications && typeof metadataNotifications === 'object') {
      setNotifications({
        pest: metadataNotifications.pest ?? defaultNotifications.pest,
        irrigation: metadataNotifications.irrigation ?? defaultNotifications.irrigation,
        soil: metadataNotifications.soil ?? defaultNotifications.soil,
        sms: metadataNotifications.sms ?? defaultNotifications.sms,
        ussd: metadataNotifications.ussd ?? defaultNotifications.ussd,
      });
    }
  }, [profile, language]);

  useEffect(() => {
    if (!adminConfigs) return;

    setMoistureThreshold(parseNumberValue(getConfigItem(adminConfigs, 'alerts.soil_moisture.low')?.value, 25));
    setCriticalMoistureThreshold(
      parseNumberValue(getConfigItem(adminConfigs, 'alerts.soil_moisture.critical_low')?.value, 18)
    );
    setPestConfidenceThreshold(
      parseNumberValue(getConfigItem(adminConfigs, 'ai.pest_detection.confidence_threshold')?.value, 0.75)
    );
    setSmsGatewayEnabled(parseBooleanValue(getConfigItem(adminConfigs, 'notifications.sms.enabled')?.value, true));
    setUssdGatewayEnabled(parseBooleanValue(getConfigItem(adminConfigs, 'notifications.ussd.enabled')?.value, true));
  }, [adminConfigs]);

  const deviceItems = useMemo<DeviceListItem[]>(() => {
    if (isAdmin) {
      return (adminDevices?.data || []).map((device) => ({
        id: device.id,
        deviceId: device.deviceId,
        displayName: device.deviceId,
        status: device.status,
        lastSeen: device.lastSeen,
        location: device.farmName,
      }));
    }

    return (farmSensors || []).map((sensor) => ({
      id: sensor.id,
      deviceId: sensor.deviceId,
      displayName: sensor.name || sensor.sensorType.replace(/_/g, ' '),
      status: sensor.status,
      batteryLevel: sensor.batteryLevel,
      lastSeen: sensor.updatedAt,
      location: sensor.locationDescription,
    }));
  }, [adminDevices, farmSensors, isAdmin]);

  const onlineDeviceCount = deviceItems.filter((device) =>
    ['active', 'online', 'standby'].includes(device.status.toLowerCase())
  ).length;

  const profileDisplayName =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.email ||
    'Account profile';

  const activeFarmLocation = activeFarm?.locationName || activeFarm?.name || 'No active farm found';

  const toggleNotification = (key: keyof NotificationPreferences) => {
    setNotifications((previous) => ({ ...previous, [key]: !previous[key] }));
  };

  const handleSave = async () => {
    try {
      const response = await updateProfileMutation.mutateAsync({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
        preferredLanguage,
        metadata: {
          ...(profile?.metadata || user?.metadata || {}),
          notificationPreferences: notifications,
        },
      });

      updateUserProfile(response.data);
      setLanguage?.(preferredLanguage);
      setAppLanguage(preferredLanguage);

      if (isAdmin) {
        await updateSystemConfigMutation.mutateAsync({
          key: 'alerts.soil_moisture.low',
          data: {
            value: String(moistureThreshold),
            description: 'Low soil moisture threshold (%)',
          },
        });

        await updateSystemConfigMutation.mutateAsync({
          key: 'alerts.soil_moisture.critical_low',
          data: {
            value: String(criticalMoistureThreshold),
            description: 'Critical low soil moisture threshold (%)',
          },
        });

        await updateSystemConfigMutation.mutateAsync({
          key: 'ai.pest_detection.confidence_threshold',
          data: {
            value: String(pestConfidenceThreshold),
            description: 'Minimum confidence for pest detection alerts',
          },
        });

        await updateSystemConfigMutation.mutateAsync({
          key: 'notifications.sms.enabled',
          data: {
            value: String(smsGatewayEnabled),
            description: 'Enable SMS notifications across the platform',
          },
        });

        await updateSystemConfigMutation.mutateAsync({
          key: 'notifications.ussd.enabled',
          data: {
            value: String(ussdGatewayEnabled),
            description: 'Enable USSD notifications across the platform',
          },
        });
      }

      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch {
      // Mutations surface errors through the shared notification store.
    }
  };

  const isSaving = updateProfileMutation.isPending || updateSystemConfigMutation.isPending;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{t.title}</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{t.subtitle}</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`px-8 py-3 rounded-full font-bold text-sm flex items-center gap-2 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 ${
            saved ? 'bg-emerald-500 text-white' : 'bg-[#0F5132] text-white hover:bg-[#0a3622]'
          } ${isSaving ? 'opacity-80 cursor-not-allowed' : ''}`}
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : saved ? (
            <>{t.saved}</>
          ) : (
            <>
              <Save size={18} /> {t.save}
            </>
          )}
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="space-y-8">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-2xl text-slate-600 dark:text-slate-200">
                <User size={20} />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">{t.profile}</h3>
            </div>

            <div className="space-y-5">
              <div className="flex flex-col items-center mb-4">
                <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-700 border-4 border-white dark:border-slate-700 shadow-md overflow-hidden mb-3">
                  <img
                    src={
                      profile?.profileImageUrl ||
                      user?.profileImageUrl ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || user?.role || 'user'}`
                    }
                    className="w-full h-full"
                    alt="Profile"
                  />
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{profileDisplayName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {profile?.email || user?.email || 'No email available'}
                </p>
                <p className="text-xs uppercase tracking-wider text-slate-400 mt-1">{user?.role || 'user'}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="w-full bg-[#FAFAF9] dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-2xl px-5 py-4 text-sm font-semibold text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="w-full bg-[#FAFAF9] dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-2xl px-5 py-4 text-sm font-semibold text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  className="w-full bg-[#FAFAF9] dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-2xl px-5 py-4 text-sm font-semibold text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">
                  {t.location}
                </label>
                <div className="relative">
                  <MapPin size={18} className="absolute left-5 top-4 text-slate-400" />
                  <input
                    type="text"
                    value={activeFarmLocation}
                    readOnly
                    className="w-full bg-[#FAFAF9] dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-2xl pl-12 pr-5 py-4 text-sm font-semibold text-slate-600 dark:text-slate-200"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-2xl text-slate-600 dark:text-slate-200">
                <BellRing size={20} />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">{t.notificationConfig}</h3>
            </div>

            <div className="space-y-4">
              <ToggleRow label={t.pestAlerts} value={notifications.pest} onToggle={() => toggleNotification('pest')} />
              <ToggleRow
                label={t.irrigationAlerts}
                value={notifications.irrigation}
                onToggle={() => toggleNotification('irrigation')}
              />
              <ToggleRow label={t.soilAlerts} value={notifications.soil} onToggle={() => toggleNotification('soil')} />
              <ToggleRow label={t.smsAlerts} value={notifications.sms} onToggle={() => toggleNotification('sms')} />
              <ToggleRow label={t.ussdPrompts} value={notifications.ussd} onToggle={() => toggleNotification('ussd')} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-2xl text-slate-600 dark:text-slate-200">
                <Globe size={20} />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">{t.appPref}</h3>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 bg-[#FAFAF9] dark:bg-slate-700 rounded-2xl">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-100 ml-1">{t.language}</span>
                <div className="flex gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600">
                  {(['rw', 'en', 'fr'] as Language[]).map((option) => (
                    <button
                      key={option}
                      onClick={() => setPreferredLanguage(option)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        preferredLanguage === option ? 'bg-[#0F5132] text-white shadow-md' : 'bg-transparent text-slate-400'
                      }`}
                    >
                      {option.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={toggleTheme}
                className="flex items-center justify-between p-4 bg-[#FAFAF9] dark:bg-slate-700 rounded-2xl text-left"
              >
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-100 ml-1">Theme</span>
                <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-300">
                  {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                  {theme === 'dark' ? 'Dark' : 'Light'}
                </span>
              </button>

              <button
                onClick={toggleSidebar}
                className="flex items-center justify-between p-4 bg-[#FAFAF9] dark:bg-slate-700 rounded-2xl text-left"
              >
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-100 ml-1">Sidebar</span>
                <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-300">
                  {sidebarCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
                  {sidebarCollapsed ? 'Collapsed' : 'Expanded'}
                </span>
              </button>

              <div className="flex items-center justify-between p-4 bg-[#FAFAF9] dark:bg-slate-700 rounded-2xl">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-100 ml-1">Current Farm</span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-300">
                  {activeFarm?.name || 'No farm selected'}
                </span>
              </div>
            </div>
          </div>

          {isAdmin ? (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl text-[#0F5132]">
                    <Sliders size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg">{t.calibration}</h3>
                    <p className="text-xs text-slate-400">Live platform thresholds and delivery channels</p>
                  </div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 border border-emerald-100 dark:border-emerald-800">
                  <Shield size={14} /> Editable
                </div>
              </div>

              <div className="space-y-8">
                <div>
                  <div className="flex justify-between items-end mb-4">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-100 uppercase tracking-wide">
                      {t.threshold}
                    </label>
                    <span className="text-3xl font-bold text-[#0F5132]">{moistureThreshold}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="60"
                    value={moistureThreshold}
                    onChange={(event) => setMoistureThreshold(parseInt(event.target.value, 10))}
                    className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-[#0F5132]"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-end mb-4">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-100 uppercase tracking-wide">
                      Critical moisture threshold
                    </label>
                    <span className="text-3xl font-bold text-[#0F5132]">{criticalMoistureThreshold}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="45"
                    value={criticalMoistureThreshold}
                    onChange={(event) => setCriticalMoistureThreshold(parseInt(event.target.value, 10))}
                    className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-[#0F5132]"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-end mb-4">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-100 uppercase tracking-wide">
                      Pest alert confidence threshold
                    </label>
                    <span className="text-3xl font-bold text-[#0F5132]">{Math.round(pestConfidenceThreshold * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="95"
                    value={Math.round(pestConfidenceThreshold * 100)}
                    onChange={(event) => setPestConfidenceThreshold(parseInt(event.target.value, 10) / 100)}
                    className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-[#0F5132]"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <button
                    onClick={() => setSmsGatewayEnabled((current) => !current)}
                    className="flex items-center justify-between p-4 bg-[#FAFAF9] dark:bg-slate-700 rounded-2xl text-left"
                  >
                    <span className="inline-flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-100">
                      <Smartphone size={16} />
                      SMS delivery
                    </span>
                    <span className={`text-xs font-bold ${smsGatewayEnabled ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-400'}`}>
                      {smsGatewayEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </button>

                  <button
                    onClick={() => setUssdGatewayEnabled((current) => !current)}
                    className="flex items-center justify-between p-4 bg-[#FAFAF9] dark:bg-slate-700 rounded-2xl text-left"
                  >
                    <span className="inline-flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-100">
                      <Wifi size={16} />
                      USSD delivery
                    </span>
                    <span className={`text-xs font-bold ${ussdGatewayEnabled ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-400'}`}>
                      {ussdGatewayEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </button>
                </div>

                <div className="p-5 rounded-[1.5rem] bg-[#FAFAF9] dark:bg-slate-700 border border-slate-100 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-200">
                  Changes here are saved to the live system configuration and affect dashboard behavior across users.
                  <span className="block mt-3 text-xs uppercase tracking-wider text-slate-400">
                    System health: {systemHealth?.status || 'checking'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl text-[#0F5132]">
                    <Sliders size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg">Farm Operations Snapshot</h3>
                    <p className="text-xs text-slate-400">Live values from the selected farm and connected sensors</p>
                  </div>
                </div>
                <div className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 px-4 py-2 rounded-full text-xs font-bold">
                  Read Only
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-5 rounded-[1.5rem] bg-[#FAFAF9] dark:bg-slate-700 border border-slate-100 dark:border-slate-600">
                  <p className="text-xs uppercase tracking-wider text-slate-400">Farm</p>
                  <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{activeFarm?.name || 'No farm selected'}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{activeFarmLocation}</p>
                </div>

                <div className="p-5 rounded-[1.5rem] bg-[#FAFAF9] dark:bg-slate-700 border border-slate-100 dark:border-slate-600">
                  <p className="text-xs uppercase tracking-wider text-slate-400">Growth stage</p>
                  <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                    {activeFarm?.currentGrowthStage ? activeFarm.currentGrowthStage.replace(/_/g, ' ') : 'Not recorded'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                    Crop: {activeFarm?.cropVariety || 'Maize'}
                  </p>
                </div>

                <div className="p-5 rounded-[1.5rem] bg-[#FAFAF9] dark:bg-slate-700 border border-slate-100 dark:border-slate-600">
                  <p className="text-xs uppercase tracking-wider text-slate-400">Connected sensors</p>
                  <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{deviceItems.length}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{onlineDeviceCount} currently online</p>
                </div>

                <div className="p-5 rounded-[1.5rem] bg-[#FAFAF9] dark:bg-slate-700 border border-slate-100 dark:border-slate-600">
                  <p className="text-xs uppercase tracking-wider text-slate-400">Farm size</p>
                  <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                    {typeof activeFarm?.sizeHectares === 'number' ? `${activeFarm.sizeHectares} ha` : 'Not recorded'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                    Thresholds and channel settings are managed by administrators.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-2xl text-slate-600 dark:text-slate-200">
                <Wifi size={20} />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">{t.connectedDevices}</h3>
            </div>

            {deviceItems.length === 0 ? (
              <div className="p-5 rounded-[1.5rem] bg-[#FAFAF9] dark:bg-slate-700 border border-slate-100 dark:border-slate-600 text-sm text-slate-500 dark:text-slate-300">
                {isAdmin ? 'No IoT devices registered yet.' : 'No sensors are registered for the selected farm.'}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {deviceItems.map((device) => (
                  <div
                    key={device.id || device.deviceId}
                    className="flex items-center justify-between p-5 bg-[#FAFAF9] dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-[1.5rem]"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          ['active', 'online', 'standby'].includes(device.status.toLowerCase())
                            ? 'bg-emerald-500'
                            : 'bg-red-500'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{device.displayName}</p>
                        <p className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wide truncate">
                          {device.deviceId || device.id}
                        </p>
                        {device.location && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-300 truncate mt-1">
                            {device.location}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-600 text-slate-600 dark:text-slate-200">
                        {formatStatusLabel(device.status)}
                      </span>
                      {device.batteryLevel !== undefined && (
                        <span className="text-[10px] text-slate-400">{device.batteryLevel}% battery</span>
                      )}
                      <span className="text-[10px] text-slate-400">{formatDateTime(device.lastSeen)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
