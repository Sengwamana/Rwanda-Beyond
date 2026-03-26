import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Sprout,
  AlertTriangle,
  Activity,
  FileClock,
  Cpu,
  SlidersHorizontal,
  RadioTower,
  FileSpreadsheet,
  Send,
  Shield,
  RefreshCw,
  ClipboardCopy,
  BarChart2,
  BookOpen,
  MessageSquare,
  CheckCircle,
} from 'lucide-react';
import {
  useSystemOverview,
  useAdminUserStatistics,
  useAdminFarmStatistics,
  useAdminFarms,
  useAdminUsers,
  useUsers,
  useUser,
  useDistricts,
  useAdminAnalytics,
  useAnalyticsDashboard,
  useUpdateUser,
  useAuditLogs,
  useAdminDevices,
  useAdminSensorHealth,
  useAdminConfigs,
  useUpdateSystemConfig,
  useGenerateDeviceToken,
  useRevokeDeviceToken,
  useSystemHealth,
  useSystemMetrics,
  useAlertStatistics,
  useSendBroadcast,
  useProcessNotificationQueue,
  useNotificationQueueSnapshot,
  useGenerateAdminReport,
  usePestOutbreakMap,
  useSystemAnalytics,
  useRecentActivityAnalytics,
  useExportRecentActivity,
  useExportAnalyticsData,
  useAllDistrictsAnalytics,
  useContentResources,
  useContentFAQ,
  useAiHealth,
  useUssdHealth,
  useUssdCallback,
  useUssdCallbackV2,
  useFarmIssue,
  useAllFarmIssues,
  useActiveRecommendations,
  useRecommendations,
  usePestDetections,
  useRecommendationStatistics,
  useUpdateFarmIssue,
  useBulkGenerateRecommendations,
} from '../hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { LoadingState, ErrorState, EmptyState } from './ui/Spinner';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { MapboxMap, type MapboxMarkerData, type MapboxMarkerTone } from './ui/MapboxMap';
import { ScheduleInsightsPanel } from './ui/ScheduleInsightsPanel';
import { User, UserRole } from '../types';
import { adminService } from '../services/admin';
import { sensorService } from '../services/sensors';

type AdminTab =
  | 'overview'
  | 'users'
  | 'farms'
  | 'audit'
  | 'devices'
  | 'irrigation'
  | 'fertilization'
  | 'config'
  | 'monitoring'
  | 'reports'
  | 'broadcast'
  | 'analytics'
  | 'map-view'
  | 'content'
  | 'ussd';

interface ConnectedAdminDashboardProps {
  activeTab?: string;
  searchQuery?: string;
}

const ADMIN_TABS: AdminTab[] = [
  'overview',
  'users',
  'farms',
  'audit',
  'devices',
  'irrigation',
  'fertilization',
  'config',
  'monitoring',
  'reports',
  'broadcast',
  'analytics',
  'map-view',
  'content',
  'ussd',
];

const workspaceGridClass = 'dash-workspace-section dash-workspace-grid-lg';
const workspaceMainClass = 'dash-workspace-main-lg';
const workspaceMainStackClass = 'dash-workspace-main-stack-lg';
const workspaceMainWideStackClass = 'dash-workspace-main-wide-stack-lg';
const workspaceRailClass = 'dash-workspace-rail-lg';
const sectionShellClass = 'dash-workspace-section';
const centeredMetricTileClass = 'dash-metric-tile text-center min-h-[112px] flex flex-col justify-center';
const softBlockClass = 'dash-soft-block';
const outlineBlockClass = 'dash-outline-block';
const filterBarClass = 'dash-filter-bar';
const roundedSelectClass = 'dash-control';
const compactSelectClass = 'dash-control-compact';
const textAreaClass = 'dash-textarea';
const actionButtonClass = 'dash-action-btn';

const normalizeTab = (value?: string): AdminTab =>
  ADMIN_TABS.includes((value || 'overview') as AdminTab) ? (value as AdminTab) : 'overview';

const toDateString = (value?: string | number) => {
  if (!value) return 'N/A';
  const parsed = typeof value === 'number' ? new Date(value) : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleString();
};

const truncateText = (value: string, max = 96) =>
  value.length > max ? `${value.slice(0, max - 1)}...` : value;

const getUserDistrictId = (user: Partial<User> | any): string | undefined =>
  user?.districtId
  || user?.district_id
  || user?.metadata?.districtId
  || user?.metadata?.district_id
  || undefined;

const getFarmDistrictId = (issue: any): string | undefined =>
  issue?.farm?.districtId
  || issue?.farm?.district_id
  || issue?.farm?.district?.id
  || undefined;

const getFarmMapCoordinates = (farm: any) => {
  if (typeof farm?.coordinates?.lat === 'number' && typeof farm?.coordinates?.lng === 'number') {
    return farm.coordinates;
  }
  if (typeof farm?.latitude === 'number' && typeof farm?.longitude === 'number') {
    return { lat: farm.latitude, lng: farm.longitude };
  }

  const sensorCoordinates = Array.isArray(farm?.sensors)
    ? farm.sensors.find(
        (sensor: any) =>
          (typeof sensor?.coordinates?.lat === 'number' && typeof sensor?.coordinates?.lng === 'number')
          || (typeof sensor?.latitude === 'number' && typeof sensor?.longitude === 'number')
      )
    : undefined;

  if (typeof sensorCoordinates?.coordinates?.lat === 'number' && typeof sensorCoordinates?.coordinates?.lng === 'number') {
    return sensorCoordinates.coordinates;
  }
  if (typeof sensorCoordinates?.latitude === 'number' && typeof sensorCoordinates?.longitude === 'number') {
    return { lat: sensorCoordinates.latitude, lng: sensorCoordinates.longitude };
  }

  const nestedSensorCoordinates = Array.isArray(farm?.sensors)
    ? farm.sensors.find(
        (sensor: any) => typeof sensor?.coordinates?.lat === 'number' && typeof sensor?.coordinates?.lng === 'number'
      )?.coordinates
    : undefined;

  return typeof nestedSensorCoordinates?.lat === 'number' && typeof nestedSensorCoordinates?.lng === 'number'
    ? nestedSensorCoordinates
    : undefined;
};

const formatActivityLabel = (value: string) =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const toRole = (value: unknown): UserRole => {
  if (value === 'admin' || value === 'expert' || value === 'farmer') return value;
  return 'farmer';
};

const isUserActive = (user: any): boolean => {
  if (typeof user?.isActive === 'boolean') return user.isActive;
  if (typeof user?.status === 'string') return user.status !== 'inactive';
  return true;
};

const getUserName = (user: any): string =>
  [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
  user?.email ||
  user?.phoneNumber ||
  user?.phone ||
  user?.id ||
  'Unknown User';

const getDeviceId = (device: any): string => device?.deviceId || device?.device_id || device?.id || '';
const getDeviceRenderKey = (device: any, index: number): string =>
  [
    device?.id,
    device?._id,
    device?.deviceId,
    device?.device_id,
    device?.createdAt,
    device?.created_at,
    device?.lastSeen,
    device?.last_seen,
    index,
  ]
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .map((value) => String(value))
    .join('-');

const getDeviceStatus = (device: any): string =>
  String(device?.status || (device?.is_active === false ? 'inactive' : 'active')).toLowerCase();

const getBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (status === 'active' || status === 'healthy') return 'secondary';
  if (status === 'inactive' || status === 'revoked') return 'outline';
  if (status === 'critical' || status === 'unhealthy' || status === 'degraded') return 'destructive';
  return 'default';
};

const parseConfigValue = (value: string): any => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
};

const confirmAction = (message: string): boolean => {
  if (typeof window === 'undefined') return true;
  return window.confirm(message);
};

const matchesSearchTerm = (term: string, values: Array<unknown>) => {
  if (!term) return true;
  return values
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(term);
};

type SearchScopeItem = {
  label: string;
  value: number;
  total?: number;
};

function SearchScopePills({
  items,
  accent = 'sky',
}: {
  items: SearchScopeItem[];
  accent?: 'sky' | 'green';
}) {
  if (!items.length) return null;

  const accentClass =
    accent === 'green'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/35 dark:text-green-300'
      : 'bg-sky-100 text-sky-800 dark:bg-sky-900/35 dark:text-sky-300';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <span key={item.label} className={`dash-pill ${accentClass}`}>
          {item.label}: {item.value}
          {typeof item.total === 'number' ? `/${item.total}` : ''}
        </span>
      ))}
    </div>
  );
}

export function ConnectedAdminDashboard({ activeTab = 'overview', searchQuery = '' }: ConnectedAdminDashboardProps) {
  const tab = normalizeTab(activeTab);
  const analyticsWindowEnabled = tab === 'overview' || tab === 'monitoring' || tab === 'analytics';

  const [search, setSearch] = useState('');
  const [usersPage, setUsersPage] = useState(1);
  const [farmsPage, setFarmsPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [devicesPage, setDevicesPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [farmStatusFilter, setFarmStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [farmDistrictFilter, setFarmDistrictFilter] = useState('');
  const [metricsPeriod, setMetricsPeriod] = useState<'1h' | '6h' | '24h' | '7d'>('24h');
  const [activityHours, setActivityHours] = useState<6 | 24 | 168>(24);
  const [activityType, setActivityType] = useState<'all' | 'user' | 'farm' | 'recommendation' | 'pest_detection' | 'pest_control' | 'sensor_reading'>('all');
  const [reportType, setReportType] = useState<'summary' | 'users' | 'farms' | 'sensors' | 'recommendations' | 'farm-issues' | 'pest-detections' | 'pest-control'>('summary');
  const [reportFormat, setReportFormat] = useState<'json' | 'csv'>('json');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [deviceFarmId, setDeviceFarmId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [deviceTokenResult, setDeviceTokenResult] = useState<{
    deviceId?: string;
    token?: string;
    expiresAt?: string;
    warning?: string;
  } | null>(null);
  const [configDrafts, setConfigDrafts] = useState<Record<string, string>>({});
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastMessageRw, setBroadcastMessageRw] = useState('');
  const [broadcastRole, setBroadcastRole] = useState<'all' | UserRole>('all');
  const [broadcastChannel, setBroadcastChannel] = useState<'sms' | 'push' | 'email' | 'all'>('sms');
  const [notificationQueueResult, setNotificationQueueResult] = useState<{
    processed: number;
    sent: number;
    failed: number;
    retried: number;
  } | null>(null);
  const [bulkGenerateDistrict, setBulkGenerateDistrict] = useState('');
  const [bulkGenerateType, setBulkGenerateType] = useState<'general' | 'irrigation' | 'fertilization' | 'pest_alert' | 'weather_alert'>('general');
  const [tabExportFormat, setTabExportFormat] = useState<'csv' | 'json'>('csv');
  const normalizedExternalSearch = searchQuery.trim();
  const normalizedDashboardSearch = normalizedExternalSearch.toLowerCase();
  const effectiveSearch = normalizedExternalSearch || search;

  useEffect(() => {
    setUsersPage(1);
  }, [effectiveSearch, roleFilter, statusFilter]);

  useEffect(() => {
    setFarmsPage(1);
  }, [effectiveSearch, farmDistrictFilter, farmStatusFilter]);

  useEffect(() => {
    if (tab === 'users') return;
    setUsersPage(1);
  }, [tab]);

  useEffect(() => {
    if (tab === 'farms') return;
    setFarmsPage(1);
  }, [tab]);

  useEffect(() => {
    if (tab === 'audit') return;
    setAuditPage(1);
  }, [tab]);

  useEffect(() => {
    if (tab === 'devices') return;
    setDevicesPage(1);
  }, [tab]);

  const overviewQuery = useSystemOverview(tab === 'overview');
  const dashboardSummaryQuery = useAnalyticsDashboard(undefined, tab === 'overview');
  const userStatisticsQuery = useAdminUserStatistics(tab === 'overview');
  const farmStatisticsQuery = useAdminFarmStatistics(tab === 'overview');
  const adminUsersRouteQuery = useAdminUsers({ page: 1, limit: 5 }, tab === 'overview');
  const recentUsersQuery = useUsers({ page: 1, limit: 5 }, tab === 'overview');
  const activeRecommendationsQuery = useActiveRecommendations(undefined, tab === 'overview');
  const globalRecommendationsQuery = useRecommendations({ page: 1, limit: 6 }, tab === 'overview');
  const globalPestDetectionsQuery = usePestDetections({ page: 1, limit: 6 }, tab === 'overview');
  const analyticsQuery = useAdminAnalytics({ period: '30d' }, analyticsWindowEnabled);
  const recentActivityQuery = useRecentActivityAnalytics({ hours: activityHours, limit: 8, type: activityType }, tab === 'overview');
  const exportRecentActivity = useExportRecentActivity();

  const usersQuery = useUsers(
    {
      page: usersPage,
      limit: 25,
      search: effectiveSearch || undefined,
      role: roleFilter === 'all' ? undefined : roleFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
    },
    tab === 'users'
  );
  const selectedUserQuery = useUser(selectedUserId);
  const farmsQuery = useAdminFarms(
    {
      page: farmsPage,
      limit: 20,
      districtId: farmDistrictFilter || undefined,
      isActive:
        farmStatusFilter === 'all'
          ? undefined
          : farmStatusFilter === 'active',
      search: effectiveSearch || undefined,
    },
    tab === 'farms'
  );
  const resourceFarmsQuery = useAdminFarms(
    {
      page: 1,
      limit: 100,
      search: effectiveSearch || undefined,
    },
    tab === 'irrigation' || tab === 'fertilization'
  );
  const mapViewFarmsQuery = useAdminFarms({ page: 1, limit: 100 }, tab === 'map-view');
  const districtsQuery = useDistricts(
    tab === 'users'
      || tab === 'overview'
      || tab === 'analytics'
      || tab === 'farms'
      || tab === 'irrigation'
      || tab === 'fertilization'
  );
  const auditLogsQuery = useAuditLogs({ page: auditPage, limit: 30 }, tab === 'audit');
  const devicesQuery = useAdminDevices({ page: devicesPage, limit: 20 }, tab === 'devices');
  const configsQuery = useAdminConfigs(tab === 'config');
  const sensorHealthQuery = useAdminSensorHealth(tab === 'monitoring' || tab === 'irrigation' || tab === 'fertilization');
  const healthQuery = useSystemHealth(tab === 'monitoring' || tab === 'irrigation' || tab === 'fertilization');
  const metricsQuery = useSystemMetrics({ period: metricsPeriod }, tab === 'monitoring');
  const mapViewOutbreakQuery = usePestOutbreakMap({ days: 30 }, tab === 'map-view');

  const updateUserMutation = useUpdateUser();
  const updateConfigMutation = useUpdateSystemConfig();
  const generateDeviceTokenMutation = useGenerateDeviceToken();
  const revokeDeviceTokenMutation = useRevokeDeviceToken();
  const sendBroadcastMutation = useSendBroadcast();
  const processNotificationQueueMutation = useProcessNotificationQueue();
  const notificationQueueQuery = useNotificationQueueSnapshot({ limit: 8, maxRetries: 3 }, tab === 'broadcast');
  const contentResourcesQuery = useContentResources();
  const contentFaqQuery = useContentFAQ();
  const aiHealthHeroQuery = useAiHealth();
  const ussdHealthHeroQuery = useUssdHealth(tab === 'ussd');
  const generateReportMutation = useGenerateAdminReport();
  const bulkGenerateRecommendationsMutation = useBulkGenerateRecommendations();

  const overview = overviewQuery.data as any;
  const analytics = analyticsQuery.data as any;
  const dashboardSummary = dashboardSummaryQuery.data as any;
  const userStatistics = userStatisticsQuery.data as any;
  const farmStatistics = farmStatisticsQuery.data as any;
  const adminUsersRoute = adminUsersRouteQuery.data?.data || [];
  const activeRecommendations = activeRecommendationsQuery.data || [];
  const globalRecommendations = globalRecommendationsQuery.data?.data || [];
  const globalPestDetections = globalPestDetectionsQuery.data?.data || [];
  const filteredOverviewUsers = useMemo(() => {
    const source = recentUsersQuery.data?.data || [];
    if (!normalizedDashboardSearch) return source;
    return source.filter((user: any) =>
      matchesSearchTerm(normalizedDashboardSearch, [
        getUserName(user),
        user.email,
        user.phoneNumber,
        user.phone,
        user.role,
      ])
    );
  }, [normalizedDashboardSearch, recentUsersQuery.data?.data]);
  const filteredAdminUserDirectory = useMemo(() => {
    if (!normalizedDashboardSearch) return adminUsersRoute;
    return adminUsersRoute.filter((user: any) =>
      matchesSearchTerm(normalizedDashboardSearch, [
        getUserName(user),
        user.email,
        user.phoneNumber,
        user.phone,
        user.role,
      ])
    );
  }, [adminUsersRoute, normalizedDashboardSearch]);
  const filteredGlobalRecommendations = useMemo(() => {
    if (!normalizedDashboardSearch) return globalRecommendations;
    return globalRecommendations.filter((recommendation: any) =>
      matchesSearchTerm(normalizedDashboardSearch, [
        recommendation.title,
        recommendation.description,
        recommendation.actionRequired,
        recommendation.type,
        recommendation.priority,
        recommendation.status,
        recommendation.farm?.name,
        recommendation.farmId,
      ])
    );
  }, [globalRecommendations, normalizedDashboardSearch]);
  const filteredActiveRecommendations = useMemo(() => {
    if (!normalizedDashboardSearch) return activeRecommendations;
    return activeRecommendations.filter((recommendation: any) =>
      matchesSearchTerm(normalizedDashboardSearch, [
        recommendation.title,
        recommendation.description,
        recommendation.actionRequired,
        recommendation.type,
        recommendation.priority,
        recommendation.status,
        recommendation.farm?.name,
        recommendation.farmId,
      ])
    );
  }, [activeRecommendations, normalizedDashboardSearch]);
  const filteredGlobalPestDetections = useMemo(() => {
    if (!normalizedDashboardSearch) return globalPestDetections;
    return globalPestDetections.filter((detection: any) =>
      matchesSearchTerm(normalizedDashboardSearch, [
        detection.pestType,
        detection.severity,
        detection.status,
        detection.farm?.name,
        detection.farmId,
        detection.locationDescription,
      ])
    );
  }, [globalPestDetections, normalizedDashboardSearch]);
  const users = usersQuery.data?.data || [];
  const selectedUser = selectedUserQuery.data as any;
  const adminFarms = farmsQuery.data?.data || [];
  const resourceFarms = resourceFarmsQuery.data?.data || [];
  const mapViewFarms = mapViewFarmsQuery.data?.data || [];
  const mapViewFarmPagination = mapViewFarmsQuery.data?.pagination;
  const districts = districtsQuery.data || [];
  const auditLogs = auditLogsQuery.data?.data || [];
  const devices = devicesQuery.data?.data || [];
  const sensorHealth = sensorHealthQuery.data as any;
  const health = healthQuery.data as any;
  const metrics = metricsQuery.data as any;
  const mapViewOutbreak = mapViewOutbreakQuery.data as any;
  const notificationQueueSnapshot = notificationQueueQuery.data;
  const contentResources = (contentResourcesQuery.data as any)?.items ?? [];
  const contentFaqs = (contentFaqQuery.data as any)?.items ?? [];
  const aiHealthHero = aiHealthHeroQuery.data as any;
  const ussdHealthHero = ussdHealthHeroQuery.data as any;
  const filteredQueuedMessages = useMemo(() => {
    const queued = notificationQueueSnapshot?.queued || [];
    if (!normalizedDashboardSearch) return queued;
    return queued.filter((message: any) =>
      matchesSearchTerm(normalizedDashboardSearch, [
        message.channel,
        message.recipient,
        message.subject,
        message.content,
        message.failedReason,
        message.status,
      ])
    );
  }, [normalizedDashboardSearch, notificationQueueSnapshot?.queued]);
  const filteredFailedMessages = useMemo(() => {
    const failed = notificationQueueSnapshot?.failed || [];
    if (!normalizedDashboardSearch) return failed;
    return failed.filter((message: any) =>
      matchesSearchTerm(normalizedDashboardSearch, [
        message.channel,
        message.recipient,
        message.subject,
        message.content,
        message.failedReason,
        message.status,
      ])
    );
  }, [normalizedDashboardSearch, notificationQueueSnapshot?.failed]);

  useEffect(() => {
    if (tab !== 'users') return;
    if (!selectedUserId && users.length > 0) {
      setSelectedUserId(users[0].id);
      return;
    }
    if (selectedUserId && users.length > 0 && !users.some((user: any) => user.id === selectedUserId)) {
      setSelectedUserId(users[0].id);
    }
  }, [tab, selectedUserId, users]);

  const flattenedConfigs = useMemo(() => {
    const configMap = (configsQuery.data || {}) as Record<string, Record<string, any>>;
    const output: Array<{ category: string; key: string; value: any; description?: string; isActive?: boolean; updatedAt?: string | number }> = [];

    for (const [category, categoryMap] of Object.entries(configMap)) {
      for (const [key, item] of Object.entries(categoryMap || {})) {
        output.push({
          category,
          key,
          value: item?.value,
          description: item?.description,
          isActive: item?.isActive,
          updatedAt: item?.updatedAt,
        });
      }
    }

    return output;
  }, [configsQuery.data]);

  const filteredConfigs = useMemo(() => {
    const term = effectiveSearch.trim().toLowerCase();
    if (!term) return flattenedConfigs;
    return flattenedConfigs.filter((entry) => {
      const haystack = [entry.category, entry.key, entry.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [effectiveSearch, flattenedConfigs]);
  const adminSearchScopeItems = useMemo<SearchScopeItem[]>(() => {
    if (!effectiveSearch.trim()) return [];

    if (tab === 'overview') {
      return [
        {
          label: 'Users',
          value: filteredOverviewUsers.length,
          total: recentUsersQuery.data?.data?.length || 0,
        },
        {
          label: 'Directory',
          value: filteredAdminUserDirectory.length,
          total: adminUsersRoute.length,
        },
        {
          label: 'Recommendations',
          value: filteredGlobalRecommendations.length,
          total: globalRecommendations.length,
        },
        {
          label: 'Active',
          value: filteredActiveRecommendations.length,
          total: activeRecommendations.length,
        },
        {
          label: 'Detections',
          value: filteredGlobalPestDetections.length,
          total: globalPestDetections.length,
        },
      ];
    }

    if (tab === 'users') {
      return [{ label: 'Users', value: users.length, total: usersQuery.data?.pagination?.total || users.length }];
    }

    if (tab === 'farms') {
      return [{ label: 'Farms', value: adminFarms.length, total: farmsQuery.data?.pagination?.total || adminFarms.length }];
    }

    if (tab === 'audit') {
      return [{ label: 'Audit Logs', value: auditLogs.length, total: auditLogsQuery.data?.pagination?.total || auditLogs.length }];
    }

    if (tab === 'devices') {
      return [{ label: 'Devices', value: devices.length, total: devicesQuery.data?.pagination?.total || devices.length }];
    }

    if (tab === 'config') {
      return [{ label: 'Configs', value: filteredConfigs.length, total: flattenedConfigs.length }];
    }

    if (tab === 'broadcast') {
      return [
        {
          label: 'Queued',
          value: filteredQueuedMessages.length,
          total: notificationQueueSnapshot?.queued?.length || 0,
        },
        {
          label: 'Failed',
          value: filteredFailedMessages.length,
          total: notificationQueueSnapshot?.failed?.length || 0,
        },
      ];
    }

    return [];
  }, [
    activeRecommendations.length,
    adminFarms.length,
    adminUsersRoute.length,
    auditLogs.length,
    auditLogsQuery.data?.pagination?.total,
    devices.length,
    devicesQuery.data?.pagination?.total,
    effectiveSearch,
    farmsQuery.data?.pagination?.total,
    filteredActiveRecommendations.length,
    filteredAdminUserDirectory.length,
    filteredConfigs.length,
    filteredFailedMessages.length,
    filteredGlobalPestDetections.length,
    filteredGlobalRecommendations.length,
    filteredOverviewUsers.length,
    filteredQueuedMessages.length,
    flattenedConfigs.length,
    globalPestDetections.length,
    globalRecommendations.length,
    notificationQueueSnapshot?.failed?.length,
    notificationQueueSnapshot?.queued?.length,
    recentUsersQuery.data?.data,
    tab,
    users.length,
    usersQuery.data?.pagination?.total,
  ]);

  const overviewCards = {
    totalUsers: overview?.users?.total || recentUsersQuery.data?.pagination?.total || 0,
    totalFarms: overview?.farms?.total || 0,
    totalSensors: overview?.sensors?.total || 0,
    pendingAlerts: overview?.recommendations?.byStatus?.pending || 0,
  };

  const userSegmentStats = useMemo(() => {
    const roleBreakdown: Record<UserRole, number> = { farmer: 0, expert: 0, admin: 0 };
    let active = 0;

    users.forEach((user: any) => {
      const role = toRole(user.role);
      roleBreakdown[role] += 1;
      if (isUserActive(user)) active += 1;
    });

    return {
      total: users.length,
      active,
      inactive: Math.max(users.length - active, 0),
      roleBreakdown,
    };
  }, [users]);

  const farmSegmentStats = useMemo(() => {
    let active = 0;
    let totalAreaHectares = 0;
    const districtCounts: Record<string, number> = {};

    adminFarms.forEach((farm: any) => {
      if (!(farm.isActive === false || farm.is_active === false)) active += 1;

      const area = farm.sizeHectares ?? farm.size_hectares;
      if (typeof area === 'number') {
        totalAreaHectares += area;
      }

      const districtName =
        farm.district?.name
        || districts.find((district: any) => String(district.id) === String(farm.districtId || farm.district_id))?.name
        || farm.district_name
        || 'Unknown district';

      districtCounts[districtName] = (districtCounts[districtName] || 0) + 1;
    });

    const topDistricts = Object.entries(districtCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    return {
      total: adminFarms.length,
      active,
      inactive: Math.max(adminFarms.length - active, 0),
      totalAreaHectares,
      averageAreaHectares: adminFarms.length > 0 ? totalAreaHectares / adminFarms.length : 0,
      topDistricts,
    };
  }, [adminFarms, districts]);

  const auditSegmentStats = useMemo(() => {
    const byEntity: Record<string, number> = {};
    const byAction: Record<string, number> = {};

    auditLogs.forEach((log: any) => {
      const entity = String(log.entityType || log.entity_type || 'system');
      const action = String(log.action || 'UNKNOWN_ACTION');
      byEntity[entity] = (byEntity[entity] || 0) + 1;
      byAction[action] = (byAction[action] || 0) + 1;
    });

    const topEntities = Object.entries(byEntity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    const topActions = Object.entries(byAction)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const latestAudit = auditLogs[0] as (typeof auditLogs[number] & { created_at?: string }) | undefined;

    return {
      total: auditLogs.length,
      uniqueEntities: Object.keys(byEntity).length,
      uniqueActions: Object.keys(byAction).length,
      topEntities,
      topActions,
      latestTimestamp: latestAudit ? toDateString(latestAudit.createdAt || latestAudit.created_at) : 'N/A',
    };
  }, [auditLogs]);

  const deviceSegmentStats = useMemo(() => {
    const byStatus: Record<string, number> = {};

    devices.forEach((device: any) => {
      const status = getDeviceStatus(device);
      byStatus[status] = (byStatus[status] || 0) + 1;
    });

    const topStatuses = Object.entries(byStatus)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      total: devices.length,
      active: byStatus.active || 0,
      inactive: byStatus.inactive || 0,
      revoked: byStatus.revoked || 0,
      topStatuses,
    };
  }, [devices]);

  const configSegmentStats = useMemo(() => {
    const categoryCounts: Record<string, number> = {};
    let active = 0;

    filteredConfigs.forEach((entry) => {
      categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1;
      if (entry.isActive !== false) active += 1;
    });

    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      total: filteredConfigs.length,
      active,
      inactive: Math.max(filteredConfigs.length - active, 0),
      categories: Object.keys(categoryCounts).length,
      topCategories,
    };
  }, [filteredConfigs]);

  const monitoringSegmentStats = useMemo(() => {
    const totalSensors = sensorHealth?.totalSensors ?? 0;
    const activeSensors = sensorHealth?.activeSensors ?? 0;
    const faultySensors = sensorHealth?.faultySensors ?? 0;
    const maintenanceRequired = sensorHealth?.maintenanceRequired ?? 0;

    return {
      totalSensors,
      activeSensors,
      inactiveSensors: Math.max(totalSensors - activeSensors, 0),
      faultySensors,
      maintenanceRequired,
      avgBatteryLevel: typeof sensorHealth?.avgBatteryLevel === 'number' ? Math.round(sensorHealth.avgBatteryLevel) : null,
      healthStatus: String(health?.status || 'unknown'),
      healthCheckedAt: toDateString(health?.timestamp),
      sensorReadings: metrics?.metrics?.sensorReadings ?? 0,
      recommendationsGenerated: metrics?.metrics?.recommendationsGenerated ?? 0,
      messagesSent: metrics?.metrics?.messagesSent ?? 0,
      errors: metrics?.metrics?.errors ?? 0,
    };
  }, [health, metrics, sensorHealth]);
  const filteredContentResources = useMemo(() => {
    if (!normalizedDashboardSearch) return contentResources;
    return contentResources.filter((resource: any) =>
      matchesSearchTerm(normalizedDashboardSearch, [
        resource.title,
        resource.category,
        resource.type,
        resource.desc,
        resource.url,
      ])
    );
  }, [contentResources, normalizedDashboardSearch]);
  const filteredContentFaqs = useMemo(() => {
    if (!normalizedDashboardSearch) return contentFaqs;
    return contentFaqs.filter((faq: any) =>
      matchesSearchTerm(normalizedDashboardSearch, [
        faq.question,
        faq.answer,
        faq.category,
      ])
    );
  }, [contentFaqs, normalizedDashboardSearch]);
  const contentHeroStats = useMemo(() => {
    const categories = new Set<string>();
    filteredContentResources.forEach((resource: any) => {
      if (resource?.category) categories.add(String(resource.category));
    });
    return {
      resources: filteredContentResources.length,
      faqs: filteredContentFaqs.length,
      categories: categories.size,
      scope: normalizedDashboardSearch ? 'Filtered' : 'All content',
    };
  }, [filteredContentFaqs.length, filteredContentResources, normalizedDashboardSearch]);
  const ussdHeroStatus = ussdHealthHero?.status === 'ok' ? 'healthy' : String(ussdHealthHero?.status || 'unknown');
  const adminMapFarmMarkers = useMemo<MapboxMarkerData[]>(
    () =>
      mapViewFarms.flatMap((farm: any) => {
        const coordinates = getFarmMapCoordinates(farm);
        const latitude = coordinates?.lat;
        const longitude = coordinates?.lng;

        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
          return [];
        }

        return [{
          id: `farm-${farm.id}`,
          latitude,
          longitude,
          label: farm.name || 'Farm',
          badge: farm.cropVariety || 'Farm',
          description: farm.locationName || farm.district?.name || 'Mapped farm',
          tone: 'success',
        }];
      }),
    [mapViewFarms]
  );
  const adminMapDistrictCoverage = useMemo(() => {
    return new Set(
      mapViewFarms
        .map((farm: any) => farm.district?.name || farm.districtId || farm.district_id)
        .filter(Boolean)
    ).size;
  }, [mapViewFarms]);
  const adminMapOutbreakMarkers = useMemo<MapboxMarkerData[]>(
    () =>
      (mapViewOutbreak?.detections || []).flatMap((detection: any) => {
        const latitude = detection.coordinates?.lat;
        const longitude = detection.coordinates?.lng;

        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
          return [];
        }

        const severity = String(detection.severity || 'low');
        const tone: MapboxMarkerTone =
          severity === 'severe' || severity === 'high'
            ? 'danger'
            : severity === 'medium'
              ? 'warning'
              : 'success';

        return [{
          id: `outbreak-${detection.id}`,
          latitude,
          longitude,
          label: detection.pestType || 'Outbreak detection',
          badge: `${severity} severity`,
          description: `${detection.farm?.name || detection.locationDescription || 'Unknown location'} • ${new Date(detection.createdAt).toLocaleDateString()}`,
          tone,
        }];
      }),
    [mapViewOutbreak?.detections]
  );

  const reportSegmentStats = useMemo(() => {
    const hasDateWindow = Boolean(reportStartDate || reportEndDate);
    return {
      type: reportType,
      format: reportFormat,
      hasDateWindow,
      windowLabel: hasDateWindow
        ? `${reportStartDate || 'Beginning'} -> ${reportEndDate || 'Now'}`
        : 'Default backend window',
    };
  }, [reportEndDate, reportFormat, reportStartDate, reportType]);

  const broadcastSegmentStats = useMemo(() => {
    const englishLength = broadcastMessage.trim().length;
    const kinyarwandaLength = broadcastMessageRw.trim().length;
    return {
      englishLength,
      kinyarwandaLength,
      totalLength: englishLength + kinyarwandaLength,
      hasDraft: englishLength > 0 || kinyarwandaLength > 0,
      targetRole: broadcastRole,
      channel: broadcastChannel,
    };
  }, [broadcastChannel, broadcastMessage, broadcastMessageRw, broadcastRole]);

  const handleRoleChange = (user: any, role: UserRole) => {
    updateUserMutation.mutate({ id: user.id, data: { role } });
  };

  const handleExpertDistrictChange = (user: any, districtId: string | null) => {
    updateUserMutation.mutate({ id: user.id, data: { districtId } });
  };

  const handleToggleUserStatus = (user: any) => {
    const nextStateIsActive = !isUserActive(user);
    const confirmed = confirmAction(
      nextStateIsActive
        ? 'Reactivate this user account?'
        : 'Deactivate this user account?'
    );
    if (!confirmed) return;

    updateUserMutation.mutate({ id: user.id, data: { isActive: nextStateIsActive } });
  };

  const handleSaveConfig = (entry: { key: string; value: any }) => {
    const rawValue =
      configDrafts[entry.key] !== undefined
        ? configDrafts[entry.key]
        : typeof entry.value === 'string'
          ? entry.value
          : JSON.stringify(entry.value);

    const confirmed = confirmAction(`Save configuration value for "${entry.key}"?`);
    if (!confirmed) return;

    updateConfigMutation.mutate({
      key: entry.key,
      data: { value: parseConfigValue(rawValue) },
    });
  };

  const handleGenerateDeviceToken = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!deviceFarmId.trim() || !deviceName.trim()) return;

    try {
      const response = await generateDeviceTokenMutation.mutateAsync({
        farmId: deviceFarmId.trim(),
        deviceName: deviceName.trim(),
      });
      setDeviceTokenResult(response.data);
    } catch {
      // Error notification is handled in the mutation hook.
    }
  };

  const handleGenerateReport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const blob = await generateReportMutation.mutateAsync({
        type: reportType,
        format: reportFormat,
        startDate: reportStartDate || undefined,
        endDate: reportEndDate || undefined,
      });

      const extension = reportFormat === 'csv' ? 'csv' : 'json';
      const fileName = `admin-${reportType}-report.${extension}`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Error notification is handled in the mutation hook.
    }
  };

  const handleSendBroadcast = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!broadcastMessage.trim()) return;

    try {
      await sendBroadcastMutation.mutateAsync({
        message: broadcastMessage.trim(),
        messageKinyarwanda: broadcastMessageRw.trim() || undefined,
        channel: broadcastChannel,
        targetRole: broadcastRole,
        priority: 'normal',
      });
      setBroadcastMessage('');
      setBroadcastMessageRw('');
    } catch {
      // Error notification is handled in the mutation hook.
    }
  };

  const handleBulkGenerateRecommendations = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await bulkGenerateRecommendationsMutation.mutateAsync({
        district: bulkGenerateDistrict || undefined,
        type: bulkGenerateType,
      });
    } catch {
      // Error notification is handled in the mutation hook.
    }
  };

  const handleProcessNotificationQueue = async () => {
    try {
      const response = await processNotificationQueueMutation.mutateAsync();
      setNotificationQueueResult(response.data);
    } catch {
      // Error notification is handled in the mutation hook.
    }
  };

  const handleExportRecentActivity = async (format: 'csv' | 'json') => {
    try {
      const blob = await exportRecentActivity.mutateAsync({
        hours: activityHours,
        limit: 100,
        type: activityType,
        format,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `admin-system-activity.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Error notification is handled in the mutation hook.
    }
  };

  const handleRefreshTab = () => {
    if (tab === 'overview') {
      overviewQuery.refetch();
      userStatisticsQuery.refetch();
      farmStatisticsQuery.refetch();
      recentUsersQuery.refetch();
      analyticsQuery.refetch();
      return;
    }
    if (tab === 'users') {
      usersQuery.refetch();
      if (selectedUserId) {
        selectedUserQuery.refetch();
      }
      return;
    }
    if (tab === 'farms') {
      farmsQuery.refetch();
      return;
    }
    if (tab === 'audit') {
      auditLogsQuery.refetch();
      return;
    }
    if (tab === 'devices') {
      devicesQuery.refetch();
      return;
    }
    if (tab === 'config') {
      configsQuery.refetch();
      return;
    }
    if (tab === 'monitoring') {
      sensorHealthQuery.refetch();
      healthQuery.refetch();
      metricsQuery.refetch();
      analyticsQuery.refetch();
      return;
    }
    if (tab === 'broadcast') {
      notificationQueueQuery.refetch();
    }
  };

  const handleResetUserFilters = () => {
    setSearch('');
    setRoleFilter('all');
    setStatusFilter('all');
    setUsersPage(1);
  };

  const renderPagination = (
    currentPage: number,
    totalPages: number | undefined,
    onChange: (nextPage: number) => void
  ) => {
    const safeTotal = totalPages || 1;
    return (
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button
          size="sm"
          variant="outline"
          disabled={currentPage <= 1}
          onClick={() => onChange(currentPage - 1)}
        >
          Previous
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {currentPage} of {safeTotal}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={currentPage >= safeTotal}
          onClick={() => onChange(currentPage + 1)}
        >
          Next
        </Button>
      </div>
    );
  };

  const copyToClipboard = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const exportCsv = (filename: string, headers: string[], rows: Array<Array<string | number>>) => {
    if (rows.length === 0) return;
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename);
  };

  const exportJson = (filename: string, payload: unknown) => {
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), filename);
  };

  const handleExportCurrentTab = () => {
    const dateSuffix = new Date().toISOString().slice(0, 10);
    if (tab === 'users') {
      const data = users.map((user: any) => ({
        id: user.id,
        name: getUserName(user),
        email: user.email || '',
        phone: user.phoneNumber || user.phone || '',
        role: toRole(user.role),
        status: isUserActive(user) ? 'active' : 'inactive',
      }));

      if (tabExportFormat === 'csv') {
        exportCsv(
          `admin-users-${dateSuffix}.csv`,
          ['id', 'name', 'email', 'phone', 'role', 'status'],
          data.map((item) => [item.id, item.name, item.email, item.phone, item.role, item.status])
        );
      } else {
        exportJson(`admin-users-${dateSuffix}.json`, data);
      }
      return;
    }

    if (tab === 'farms') {
      const data = adminFarms.map((farm: any) => ({
        id: farm.id || farm._id || '',
        name: farm.name || '',
        district: farm.district?.name || farm.district_name || farm.districtId || farm.district_id || '',
        location: farm.locationName || farm.location_name || '',
        cropVariety: farm.cropVariety || farm.crop_variety || '',
        growthStage: farm.currentGrowthStage || farm.current_growth_stage || '',
        sizeHectares: farm.sizeHectares ?? farm.size_hectares ?? '',
        status: farm.isActive === false || farm.is_active === false ? 'inactive' : 'active',
      }));

      if (tabExportFormat === 'csv') {
        exportCsv(
          `admin-farms-${dateSuffix}.csv`,
          ['id', 'name', 'district', 'location', 'cropVariety', 'growthStage', 'sizeHectares', 'status'],
          data.map((item) => [
            item.id,
            item.name,
            item.district,
            item.location,
            item.cropVariety,
            item.growthStage,
            item.sizeHectares,
            item.status,
          ])
        );
      } else {
        exportJson(`admin-farms-${dateSuffix}.json`, data);
      }
      return;
    }

    if (tab === 'audit') {
      const data = auditLogs.map((log: any) => ({
        id: log.id || '',
        action: log.action || 'UNKNOWN_ACTION',
        entityType: log.entityType || log.entity_type || 'system',
        userId: log.userId || log.user_id || '',
        createdAt: toDateString(log.createdAt || log.created_at),
      }));

      if (tabExportFormat === 'csv') {
        exportCsv(
          `admin-audit-${dateSuffix}.csv`,
          ['id', 'action', 'entityType', 'userId', 'createdAt'],
          data.map((item) => [item.id, item.action, item.entityType, item.userId, item.createdAt])
        );
      } else {
        exportJson(`admin-audit-${dateSuffix}.json`, data);
      }
      return;
    }

    if (tab === 'devices') {
      const data = devices.map((device: any) => ({
        deviceId: getDeviceId(device),
        deviceName: device.device_name || device.deviceName || '',
        farm: device.farm_name || device.farmId || device.farm_id || '',
        status: getDeviceStatus(device),
        lastSeen: toDateString(device.lastSeen || device.last_seen),
      }));

      if (tabExportFormat === 'csv') {
        exportCsv(
          `admin-devices-${dateSuffix}.csv`,
          ['deviceId', 'deviceName', 'farm', 'status', 'lastSeen'],
          data.map((item) => [item.deviceId, item.deviceName, item.farm, item.status, item.lastSeen])
        );
      } else {
        exportJson(`admin-devices-${dateSuffix}.json`, data);
      }
      return;
    }

    if (tab === 'config') {
      const data = filteredConfigs.map((entry) => ({
        category: entry.category,
        key: entry.key,
        value: entry.value,
        isActive: entry.isActive === false ? 'inactive' : 'active',
        updatedAt: toDateString(entry.updatedAt),
      }));

      if (tabExportFormat === 'csv') {
        exportCsv(
          `admin-config-${dateSuffix}.csv`,
          ['category', 'key', 'value', 'isActive', 'updatedAt'],
          data.map((item) => [
            item.category,
            item.key,
            typeof item.value === 'string' ? item.value : JSON.stringify(item.value),
            item.isActive,
            item.updatedAt,
          ])
        );
      } else {
        exportJson(`admin-config-${dateSuffix}.json`, data);
      }
      return;
    }

    if (tab === 'overview') {
      const data = [
        { metric: 'totalUsers', value: overviewCards.totalUsers },
        { metric: 'totalFarms', value: overviewCards.totalFarms },
        { metric: 'totalSensors', value: overviewCards.totalSensors },
        { metric: 'pendingRecommendations', value: overviewCards.pendingAlerts },
        { metric: 'sensorReadings30d', value: analytics?.metrics?.sensorReadings ?? 0 },
        { metric: 'recommendations30d', value: analytics?.metrics?.recommendationsGenerated ?? 0 },
        { metric: 'messages30d', value: analytics?.metrics?.messagesSent ?? 0 },
        { metric: 'errors30d', value: analytics?.metrics?.errors ?? 0 },
      ];

      if (tabExportFormat === 'csv') {
        exportCsv(
          `admin-overview-${dateSuffix}.csv`,
          ['metric', 'value'],
          data.map((item) => [item.metric, item.value])
        );
      } else {
        exportJson(`admin-overview-${dateSuffix}.json`, data);
      }
    }
  };

  const adminHeroMeta: Record<AdminTab, { eyebrow: string; title: string; description: string }> = {
    overview: {
      eyebrow: 'Administration Bridge',
      title: 'System Operations Hub',
      description: 'Manage users, farms, devices, monitoring, and platform-level controls from one console.',
    },
    users: {
      eyebrow: 'Identity Workspace',
      title: 'User Administration',
      description: 'Review user roles, status, and profile details without leaving the operations shell.',
    },
    farms: {
      eyebrow: 'Field Registry',
      title: 'Farm Operations',
      description: 'Track farm activation, area coverage, and district distribution in one management lane.',
    },
    audit: {
      eyebrow: 'Governance Trail',
      title: 'Audit Log Review',
      description: 'Inspect system actions, entity coverage, and the latest administrative events.',
    },
    devices: {
      eyebrow: 'Device Fleet',
      title: 'Device Operations',
      description: 'Manage device registration, token status, and fleet health from the same workspace.',
    },
    config: {
      eyebrow: 'Platform Controls',
      title: 'System Configuration',
      description: 'Review live configuration categories, active settings, and platform toggles safely.',
    },
    monitoring: {
      eyebrow: 'Monitoring Center',
      title: 'Sensor & Platform Monitoring',
      description: 'Watch sensor fleet health, platform checks, and backend metrics in a unified console.',
    },
    reports: {
      eyebrow: 'Report Studio',
      title: 'Report Generation',
      description: 'Prepare exports with the right type, format, and reporting window before generation.',
    },
    broadcast: {
      eyebrow: 'Communication Queue',
      title: 'Broadcast Operations',
      description: 'Manage queued notifications, failed deliveries, and outbound targeting from one lane.',
    },
    analytics: {
      eyebrow: 'Analytics Studio',
      title: 'System Analytics',
      description: 'Compare district coverage, sensor activity, recommendation output, and recent system trends.',
    },
    irrigation: {
      eyebrow: 'Water Operations',
      title: 'Irrigation',
      description: 'Monitor irrigation schedules and water usage across the platform with district-level rollups.',
    },
    fertilization: {
      eyebrow: 'Nutrient Operations',
      title: 'Fertilization',
      description: 'Review fertilization schedules and nutrient usage across the platform with district-level rollups.',
    },
    'map-view': {
      eyebrow: 'Spatial Control',
      title: 'Map View',
      description: 'Inspect mapped farms and outbreak detections across the platform in one admin map workspace.',
    },
    content: {
      eyebrow: 'Content Library',
      title: 'Content Management',
      description: 'Maintain public resources and FAQ content with a clear view of what is currently visible.',
    },
    ussd: {
      eyebrow: 'Service Monitor',
      title: 'USSD Operations',
      description: 'Monitor the USSD service, AI health, and integration readiness without leaving admin.',
    },
  };
  const currentHeroMeta = adminHeroMeta[tab] || adminHeroMeta.overview;
  const adminQuickStats = useMemo<Array<{ label: string; value: string | number; badge: string; helper: string }>>(() => {
    if (tab === 'users') {
      return [
        {
          label: 'Visible Users',
          value: userSegmentStats.total,
          badge: `${userSegmentStats.active} active`,
          helper: `${userSegmentStats.inactive} inactive accounts in the current view`,
        },
        {
          label: 'Experts',
          value: userSegmentStats.roleBreakdown.expert,
          badge: `${userSegmentStats.roleBreakdown.admin} admins`,
          helper: 'Expert accounts available for field support and review',
        },
        {
          label: 'Farmers',
          value: userSegmentStats.roleBreakdown.farmer,
          badge: `${userSegmentStats.roleBreakdown.expert} experts`,
          helper: 'Farmer accounts represented in the current user directory',
        },
        {
          label: 'Focused Profile',
          value: selectedUser ? getUserName(selectedUser) : 'No user selected',
          badge: selectedUser ? toRole(selectedUser.role) : 'Directory view',
          helper: selectedUser ? `Status: ${isUserActive(selectedUser) ? 'active' : 'inactive'}` : 'Select a user to inspect profile details',
        },
      ];
    }

    if (tab === 'farms') {
      return [
        {
          label: 'Visible Farms',
          value: farmSegmentStats.total,
          badge: `${farmSegmentStats.active} active`,
          helper: `${farmSegmentStats.inactive} inactive in the current farm registry view`,
        },
        {
          label: 'Total Area',
          value: `${farmSegmentStats.totalAreaHectares.toFixed(1)} ha`,
          badge: `${farmSegmentStats.averageAreaHectares.toFixed(1)} avg`,
          helper: 'Combined area covered by visible farm records',
        },
        {
          label: 'District Coverage',
          value: farmSegmentStats.topDistricts.length,
          badge: `${districts.length} districts loaded`,
          helper: 'Top districts currently represented in the farm registry',
        },
        {
          label: 'Search Scope',
          value: effectiveSearch ? 'Filtered' : 'All farms',
          badge: farmStatusFilter === 'all' ? 'All statuses' : farmStatusFilter,
          helper: farmDistrictFilter || 'All districts',
        },
      ];
    }

    if (tab === 'audit') {
      return [
        {
          label: 'Logged Events',
          value: auditSegmentStats.total,
          badge: `${auditLogsQuery.data?.pagination?.total || auditSegmentStats.total} total`,
          helper: 'Audit entries currently loaded into this review lane',
        },
        {
          label: 'Entity Types',
          value: auditSegmentStats.uniqueEntities,
          badge: `${auditSegmentStats.topEntities.length} top entities`,
          helper: 'Distinct entity types represented in recent logs',
        },
        {
          label: 'Action Types',
          value: auditSegmentStats.uniqueActions,
          badge: `${auditSegmentStats.topActions.length} top actions`,
          helper: 'Unique administrative actions present in the current page',
        },
        {
          label: 'Latest Event',
          value: auditSegmentStats.latestTimestamp,
          badge: `${auditPage} page`,
          helper: 'Timestamp of the most recent visible audit entry',
        },
      ];
    }

    if (tab === 'devices') {
      return [
        {
          label: 'Visible Devices',
          value: deviceSegmentStats.total,
          badge: `${deviceSegmentStats.active} active`,
          helper: `${deviceSegmentStats.inactive} inactive device registrations`,
        },
        {
          label: 'Inactive Devices',
          value: deviceSegmentStats.inactive,
          badge: `${deviceSegmentStats.revoked} revoked`,
          helper: 'Devices that are not currently active in the fleet',
        },
        {
          label: 'Revoked Tokens',
          value: deviceSegmentStats.revoked,
          badge: `${deviceSegmentStats.topStatuses.length} statuses`,
          helper: 'Registrations that need token regeneration or re-onboarding',
        },
        {
          label: 'Search Scope',
          value: effectiveSearch ? 'Filtered' : 'All devices',
          badge: `${devicesQuery.data?.pagination?.total || deviceSegmentStats.total} total`,
          helper: 'Current device directory scope in this workspace',
        },
      ];
    }

    if (tab === 'config') {
      return [
        {
          label: 'Visible Configs',
          value: configSegmentStats.total,
          badge: `${configSegmentStats.active} active`,
          helper: `${configSegmentStats.inactive} inactive configuration entries`,
        },
        {
          label: 'Categories',
          value: configSegmentStats.categories,
          badge: `${configSegmentStats.topCategories.length} top groups`,
          helper: 'Distinct configuration groups in the current filtered view',
        },
        {
          label: 'Search Scope',
          value: effectiveSearch ? 'Filtered' : 'All configs',
          badge: `${flattenedConfigs.length} total`,
          helper: 'Configuration visibility after the current search term',
        },
        {
          label: 'Active Entries',
          value: configSegmentStats.active,
          badge: `${configSegmentStats.inactive} inactive`,
          helper: 'Configuration entries currently enabled',
        },
      ];
    }

    if (tab === 'monitoring') {
      return [
        {
          label: 'Tracked Sensors',
          value: monitoringSegmentStats.totalSensors,
          badge: `${monitoringSegmentStats.activeSensors} active`,
          helper: `${monitoringSegmentStats.inactiveSensors} inactive sensors in the fleet`,
        },
        {
          label: 'Faulty Sensors',
          value: monitoringSegmentStats.faultySensors,
          badge: `${monitoringSegmentStats.maintenanceRequired} maintenance`,
          helper: 'Devices currently marked with degraded health',
        },
        {
          label: 'Avg Battery',
          value: monitoringSegmentStats.avgBatteryLevel !== null ? `${monitoringSegmentStats.avgBatteryLevel}%` : '--',
          badge: monitoringSegmentStats.healthStatus,
          helper: `Checked ${monitoringSegmentStats.healthCheckedAt}`,
        },
        {
          label: 'Sensor Readings',
          value: monitoringSegmentStats.sensorReadings,
          badge: `${monitoringSegmentStats.recommendationsGenerated} recommendations`,
          helper: `${monitoringSegmentStats.errors} errors in the current metrics window`,
        },
      ];
    }

    if (tab === 'reports') {
      return [
        {
          label: 'Report Type',
          value: reportSegmentStats.type.replace('-', ' '),
          badge: reportSegmentStats.format.toUpperCase(),
          helper: 'Current export type selected for generation',
        },
        {
          label: 'Date Window',
          value: reportSegmentStats.hasDateWindow ? 'Custom' : 'Default',
          badge: reportSegmentStats.windowLabel,
          helper: 'Reporting window that will be sent to the backend',
        },
        {
          label: 'Output Format',
          value: reportSegmentStats.format.toUpperCase(),
          badge: reportSegmentStats.type.replace('-', ' '),
          helper: 'The download format currently staged in the report form',
        },
        {
          label: 'Generation State',
          value: generateReportMutation.isPending ? 'Running' : 'Ready',
          badge: reportSegmentStats.hasDateWindow ? 'Scoped' : 'Platform default',
          helper: generateReportMutation.isPending ? 'Report generation is in progress' : 'The current report configuration is ready to run',
        },
      ];
    }

    if (tab === 'broadcast') {
      return [
        {
          label: 'Queued Messages',
          value: notificationQueueSnapshot?.counts?.queued ?? 0,
          badge: `${filteredQueuedMessages.length} visible`,
          helper: 'Messages currently waiting in the outbound queue',
        },
        {
          label: 'Failed Messages',
          value: notificationQueueSnapshot?.counts?.failed ?? 0,
          badge: `${filteredFailedMessages.length} visible`,
          helper: 'Messages that need retry or manual review',
        },
        {
          label: 'Draft Length',
          value: broadcastSegmentStats.totalLength,
          badge: broadcastSegmentStats.hasDraft ? 'Draft ready' : 'No draft',
          helper: `${broadcastSegmentStats.englishLength} EN • ${broadcastSegmentStats.kinyarwandaLength} RW`,
        },
        {
          label: 'Target Route',
          value: `${broadcastSegmentStats.targetRole}/${broadcastSegmentStats.channel}`,
          badge: processNotificationQueueMutation.isPending ? 'Processing queue' : 'Ready',
          helper: 'Current audience and delivery channel for the draft',
        },
      ];
    }

    if (tab === 'analytics') {
      return [
        {
          label: 'Districts Loaded',
          value: districts.length,
          badge: `${effectiveSearch ? 'Filtered' : 'Full'} scope`,
          helper: 'District coverage available in the analytics workspace',
        },
        {
          label: 'Sensor Readings',
          value: analytics?.metrics?.sensorReadings ?? 0,
          badge: `${analytics?.metrics?.recommendationsGenerated ?? 0} recommendations`,
          helper: 'Platform activity for the current analytics period',
        },
        {
          label: 'Messages Sent',
          value: analytics?.metrics?.messagesSent ?? 0,
          badge: `${analytics?.metrics?.errors ?? 0} errors`,
          helper: 'Outbound system activity captured in analytics',
        },
        {
          label: 'Tracked Alerts',
          value: overviewCards.pendingAlerts,
          badge: `${activeRecommendations.length} active`,
          helper: 'Pending recommendation load contributing to analytics context',
        },
      ];
    }

    if (tab === 'irrigation') {
      return [
        {
          label: 'Scoped Farms',
          value: resourceFarms.length,
          badge: effectiveSearch ? 'Filtered scope' : 'Platform scope',
          helper: 'Farm records contributing irrigation usage to this admin workspace',
        },
        {
          label: 'District Coverage',
          value: districts.length,
          badge: `${resourceFarms.length} farms loaded`,
          helper: 'District footprint represented in irrigation reporting',
        },
        {
          label: 'Pending Alerts',
          value: overviewCards.pendingAlerts,
          badge: `${activeRecommendations.length} active`,
          helper: 'Operational signals that could impact irrigation planning',
        },
        {
          label: 'System Health',
          value: health?.status || 'Checking',
          badge: `${sensorHealth?.healthy ?? 0} healthy sensors`,
          helper: 'Telemetry readiness behind irrigation monitoring',
        },
      ];
    }

    if (tab === 'fertilization') {
      return [
        {
          label: 'Scoped Farms',
          value: resourceFarms.length,
          badge: effectiveSearch ? 'Filtered scope' : 'Platform scope',
          helper: 'Farm records contributing fertilizer usage to this admin workspace',
        },
        {
          label: 'District Coverage',
          value: districts.length,
          badge: `${resourceFarms.length} farms loaded`,
          helper: 'District footprint represented in nutrient reporting',
        },
        {
          label: 'Active Advice',
          value: activeRecommendations.length,
          badge: `${filteredGlobalRecommendations.length} visible`,
          helper: 'Recommendation volume that can influence fertilizer operations',
        },
        {
          label: 'Monitoring Status',
          value: health?.status || 'Checking',
          badge: `${sensorHealth?.total ?? 0} tracked sensors`,
          helper: 'Platform readiness for nutrient planning and execution',
        },
      ];
    }

    if (tab === 'map-view') {
      return [
        {
          label: 'Mapped Farms',
          value: adminMapFarmMarkers.length,
          badge: `${mapViewFarms.length} loaded`,
          helper: `${Math.max(mapViewFarms.length - adminMapFarmMarkers.length, 0)} farms still need coordinates`,
        },
        {
          label: 'District Coverage',
          value: adminMapDistrictCoverage,
          badge: `${districts.length} platform districts`,
          helper: 'Districts represented by the current nationwide farm map',
        },
        {
          label: 'Country Scope',
          value: 'Rwanda',
          badge: `${adminMapFarmMarkers.length} mapped farms`,
          helper: 'Map view shows farmer records across the full national platform',
        },
        {
          label: 'Coordinate Gaps',
          value: Math.max(mapViewFarms.length - adminMapFarmMarkers.length, 0),
          badge: normalizedExternalSearch ? 'Search filtered' : 'National scope',
          helper: 'Farmer records that still need coordinates before they can appear on the map',
        },
      ];
    }

    if (tab === 'content') {
      return [
        {
          label: 'Resources',
          value: contentHeroStats.resources,
          badge: `${contentResources.length} total`,
          helper: 'Public resources currently visible in this content workspace',
        },
        {
          label: 'FAQ Items',
          value: contentHeroStats.faqs,
          badge: `${contentFaqs.length} total`,
          helper: 'Frequently asked questions currently visible in the content lane',
        },
        {
          label: 'Categories',
          value: contentHeroStats.categories,
          badge: contentHeroStats.scope,
          helper: 'Distinct content categories represented after current filtering',
        },
        {
          label: 'Search Scope',
          value: normalizedExternalSearch ? 'Filtered' : 'All content',
          badge: normalizedExternalSearch || 'No external filter',
          helper: 'Hero counts now follow the same search scope as the content panel',
        },
      ];
    }

    if (tab === 'ussd') {
      return [
        {
          label: 'USSD Service',
          value: ussdHeroStatus,
          badge: ussdHealthHero?.service || 'Backend check',
          helper: ussdHealthHero?.timestamp ? `Checked ${toDateString(ussdHealthHero.timestamp)}` : 'Awaiting latest health check',
        },
        {
          label: 'AI Status',
          value: aiHealthHero?.status || 'unknown',
          badge: aiHealthHero?.provider || 'AI provider',
          helper: aiHealthHero?.model ? `Model ${aiHealthHero.model}` : 'AI model will appear after health check',
        },
        {
          label: 'Callback Paths',
          value: 2,
          badge: '/ussd/callback',
          helper: 'Both classic and enhanced callback flows are available for testing',
        },
        {
          label: 'Simulator State',
          value: 'Ready',
          badge: 'v1 + v2',
          helper: 'Run live backend simulations from the USSD workspace',
        },
      ];
    }

    return [
      {
        label: 'Total Users',
        value: overviewCards.totalUsers,
        badge: `${userStatistics?.activeUsers ?? userSegmentStats.active} active`,
        helper: `${recentUsersQuery.data?.pagination?.total || overviewCards.totalUsers} user records loaded`,
      },
      {
        label: 'Total Farms',
        value: overviewCards.totalFarms,
        badge: `${farmStatistics?.activeFarms ?? farmSegmentStats.active} active`,
        helper: `${typeof (farmStatistics?.totalAreaHectares ?? farmSegmentStats.totalAreaHectares) === 'number' ? Number(farmStatistics?.totalAreaHectares ?? farmSegmentStats.totalAreaHectares).toFixed(1) : '0.0'} ha recorded`,
      },
      {
        label: 'Total Sensors',
        value: overviewCards.totalSensors,
        badge: `${analytics?.metrics?.sensorReadings ?? 0} reads`,
        helper: 'Sensor activity in the current analytics window',
      },
      {
        label: 'Pending Alerts',
        value: overviewCards.pendingAlerts,
        badge: `${activeRecommendations.length} active`,
        helper: `${globalRecommendations.length} recent recommendations loaded`,
      },
    ];
  }, [
    activeRecommendations.length,
    adminMapFarmMarkers.length,
    mapViewOutbreak?.byDistrict?.length,
    adminMapOutbreakMarkers.length,
    aiHealthHero?.model,
    aiHealthHero?.provider,
    aiHealthHero?.status,
    analytics?.metrics?.errors,
    analytics?.metrics?.messagesSent,
    analytics?.metrics?.recommendationsGenerated,
    analytics?.metrics?.sensorReadings,
    auditLogsQuery.data?.pagination?.total,
    auditPage,
    auditSegmentStats.latestTimestamp,
    auditSegmentStats.topActions.length,
    auditSegmentStats.topEntities.length,
    auditSegmentStats.total,
    auditSegmentStats.uniqueActions,
    auditSegmentStats.uniqueEntities,
    broadcastSegmentStats.channel,
    broadcastSegmentStats.englishLength,
    broadcastSegmentStats.hasDraft,
    broadcastSegmentStats.kinyarwandaLength,
    broadcastSegmentStats.targetRole,
    broadcastSegmentStats.totalLength,
    configSegmentStats.active,
    configSegmentStats.categories,
    configSegmentStats.inactive,
    configSegmentStats.topCategories.length,
    configSegmentStats.total,
    contentFaqs.length,
    contentHeroStats.categories,
    contentHeroStats.faqs,
    contentHeroStats.resources,
    contentHeroStats.scope,
    contentResources.length,
    deviceSegmentStats.active,
    deviceSegmentStats.inactive,
    deviceSegmentStats.revoked,
    deviceSegmentStats.topStatuses.length,
    deviceSegmentStats.total,
    devicesQuery.data?.pagination?.total,
    districts.length,
    effectiveSearch,
    farmDistrictFilter,
    farmSegmentStats.active,
    farmSegmentStats.averageAreaHectares,
    farmSegmentStats.inactive,
    farmSegmentStats.topDistricts.length,
    farmSegmentStats.total,
    farmSegmentStats.totalAreaHectares,
    farmStatistics?.activeFarms,
    farmStatistics?.totalAreaHectares,
    flattenedConfigs.length,
    filteredFailedMessages.length,
    filteredQueuedMessages.length,
    generateReportMutation.isPending,
    globalRecommendations.length,
    monitoringSegmentStats.activeSensors,
    monitoringSegmentStats.avgBatteryLevel,
    monitoringSegmentStats.errors,
    monitoringSegmentStats.faultySensors,
    monitoringSegmentStats.healthCheckedAt,
    monitoringSegmentStats.healthStatus,
    monitoringSegmentStats.inactiveSensors,
    monitoringSegmentStats.maintenanceRequired,
    monitoringSegmentStats.recommendationsGenerated,
    monitoringSegmentStats.sensorReadings,
    monitoringSegmentStats.totalSensors,
    mapViewFarms.length,
    normalizedExternalSearch,
    notificationQueueSnapshot?.counts?.failed,
    notificationQueueSnapshot?.counts?.queued,
    overviewCards.pendingAlerts,
    overviewCards.totalFarms,
    overviewCards.totalSensors,
    overviewCards.totalUsers,
    processNotificationQueueMutation.isPending,
    recentUsersQuery.data?.pagination?.total,
    reportSegmentStats.format,
    reportSegmentStats.hasDateWindow,
    reportSegmentStats.type,
    reportSegmentStats.windowLabel,
    resourceFarms.length,
    selectedUser,
    sensorHealth?.healthy,
    sensorHealth?.total,
    health?.status,
    tab,
    userSegmentStats.active,
    userSegmentStats.inactive,
    userSegmentStats.roleBreakdown.admin,
    userSegmentStats.roleBreakdown.expert,
    userSegmentStats.roleBreakdown.farmer,
    userSegmentStats.total,
    userStatistics?.activeUsers,
    ussdHealthHero?.service,
    ussdHealthHero?.status,
    ussdHealthHero?.timestamp,
    ussdHeroStatus,
  ]);
  const sectionTitleClass = 'text-base md:text-lg font-extrabold tracking-tight';
  const sectionDescriptionClass = 'text-xs md:text-sm text-muted-foreground/90';

  if (tab === 'overview' && overviewQuery.isLoading) {
    return <LoadingState text="Loading system overview..." />;
  }

  if (tab === 'overview' && overviewQuery.error) {
    return (
      <ErrorState
        title="Failed to load admin overview"
        message="Please retry."
        onRetry={overviewQuery.refetch}
      />
    );
  }

  return (
    <div className="dashboard-page dash-section-stack mx-auto w-full max-w-[1600px] px-1 animate-fade-in">
      <div className="dash-hero-panel animate-fade-in [animation-delay:40ms] [animation-fill-mode:both]">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-700/85 dark:text-sky-300/85">{currentHeroMeta.eyebrow}</p>
            <h2 className="text-[2rem] md:text-[2.55rem] font-extrabold tracking-tight text-slate-900 dark:text-white">{currentHeroMeta.title}</h2>
            <p className="mt-2 text-[15px] text-slate-500 dark:text-slate-400">{currentHeroMeta.description}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              className={roundedSelectClass}
              value={tabExportFormat}
              onChange={(event) => setTabExportFormat(event.target.value as 'csv' | 'json')}
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
            <Button variant="outline" size="sm" className={actionButtonClass} onClick={handleExportCurrentTab}>
              Export Tab
            </Button>
            <Button variant="outline" size="sm" className={actionButtonClass} onClick={handleRefreshTab}>
              <RefreshCw size={14} className="mr-2" />
              Refresh Tab
            </Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {adminQuickStats.map((stat, index) => (
            <div
              key={stat.label}
              className={`${index === 0 ? 'dash-kpi-card dash-kpi-card-accent' : 'dash-kpi-card'} animate-fade-in [animation-fill-mode:both]`}
              style={{ animationDelay: `${80 + index * 50}ms` }}
            >
              <p className={`text-[11px] font-bold uppercase tracking-[0.14em] ${index === 0 ? 'text-white/85' : 'text-slate-500 dark:text-slate-400'}`}>{stat.label}</p>
              <p className={`mt-3 text-[2.2rem] font-extrabold tracking-tight ${index === 0 ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{stat.value}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold ${index === 0 ? 'bg-white/15 text-white' : 'bg-sky-50 text-sky-700 dark:bg-sky-900/25 dark:text-sky-300'}`}>
                  {stat.badge}
                </span>
                <span className={`text-[11px] font-medium ${index === 0 ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                  {stat.helper}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="dash-filter-bar animate-fade-in [animation-delay:95ms] [animation-fill-mode:both]">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <span className="dash-pill bg-sky-100 text-sky-800 dark:bg-sky-900/35 dark:text-sky-300">
              Active Tab: {tab}
            </span>
            <span className="dash-pill bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              User Role Filter: {roleFilter}
            </span>
            <span className="dash-pill bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              User Status Filter: {statusFilter}
            </span>
            <span className="dash-pill bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Farm Status: {farmStatusFilter}
            </span>
            {effectiveSearch && (
              <span className="dash-pill bg-sky-100 text-sky-800 dark:bg-sky-900/35 dark:text-sky-300">
                Search: "{effectiveSearch}"
              </span>
            )}
            {effectiveSearch && <SearchScopePills items={adminSearchScopeItems} accent="sky" />}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="dash-action-btn-sm self-start md:self-auto"
            onClick={() => {
              setSearch('');
              setRoleFilter('all');
              setStatusFilter('all');
              setFarmStatusFilter('all');
              setFarmDistrictFilter('');
            }}
          >
            Clear Filters
          </Button>
        </div>
      </div>

      {tab === 'overview' && (
        <div className={`${workspaceGridClass} animate-fade-in [animation-delay:115ms] [animation-fill-mode:both]`}>
          <div className={workspaceMainClass}>
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
          <Card className="dash-mini-action-card h-full animate-fade-in [animation-delay:130ms] [animation-fill-mode:both]">
            <CardContent className="p-4 lg:p-5 h-full flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">Control Sync</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Refresh overview routes and verify current operational totals.</p>
                </div>
                <div className="dash-icon-box">
                  <RefreshCw size={16} className="text-emerald-700 dark:text-emerald-300" />
                </div>
              </div>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ops lane - Reconcile counters</p>
              <Button className="dash-action-btn mt-auto w-full focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2" onClick={handleRefreshTab}>
                Sync Overview
              </Button>
            </CardContent>
          </Card>

          <Card className="dash-mini-action-card h-full animate-fade-in [animation-delay:190ms] [animation-fill-mode:both]">
            <CardContent className="p-4 lg:p-5 h-full flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">Reporting Pulse</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Export the active tab instantly for ops and stakeholder handoff.</p>
                </div>
                <div className="dash-icon-box">
                  <FileSpreadsheet size={16} className="text-emerald-700 dark:text-emerald-300" />
                </div>
              </div>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reporting lane - Export snapshot</p>
              <Button variant="outline" className="dash-action-btn mt-auto w-full focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2" onClick={handleExportCurrentTab}>
                Export Current Tab
              </Button>
            </CardContent>
          </Card>

          <Card className="dash-mini-action-card h-full animate-fade-in [animation-delay:250ms] [animation-fill-mode:both]">
            <CardContent className="p-4 lg:p-5 h-full flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700 dark:text-slate-200">Governance Focus</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Track unresolved recommendations and keep intervention backlog controlled.</p>
                </div>
                <div className="dash-icon-box">
                  <Shield size={16} className="text-slate-700 dark:text-slate-200" />
                </div>
              </div>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Governance lane - Backlog pressure</p>
              <p className="mt-auto text-2xl font-black text-slate-900 dark:text-white">{overviewCards.pendingAlerts}</p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending recommendations</p>
            </CardContent>
          </Card>
          </div>
          </div>

          <Card className="lg:col-span-4 self-start dash-panel xl:sticky xl:top-28">
            <CardHeader className="pb-2">
              <CardTitle className={sectionTitleClass}>Quick Actions</CardTitle>
              <CardDescription className={sectionDescriptionClass}>High-frequency admin operations from a single action rail</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 lg:space-y-3">
              <Button variant="outline" className="dash-action-btn w-full justify-start" onClick={handleRefreshTab}>
                <RefreshCw size={14} className="mr-2" />
                Refresh Active Tab
              </Button>
              <Button variant="outline" className="dash-action-btn w-full justify-start" onClick={handleExportCurrentTab}>
                <FileSpreadsheet size={14} className="mr-2" />
                Export Active Tab
              </Button>
              <Button
                variant="outline"
                className="dash-action-btn w-full justify-start"
                onClick={() => {
                  setSearch('');
                  setRoleFilter('all');
                  setStatusFilter('all');
                  setFarmStatusFilter('all');
                  setFarmDistrictFilter('');
                }}
              >
                Clear Dashboard Filters
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'overview' && (
        <>
          <div className={workspaceGridClass}>
            <Card className="lg:col-span-4 dash-panel">
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Dashboard Route Snapshot</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Loaded from the primary analytics dashboard route without a farm filter</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboardSummaryQuery.isLoading ? (
                  <LoadingState text="Loading dashboard snapshot..." size="sm" />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className={centeredMetricTileClass}>
                      <p className="text-xs text-muted-foreground uppercase">Users</p>
                      <p className="text-xl font-semibold">{dashboardSummary?.users?.total ?? 0}</p>
                    </div>
                    <div className={centeredMetricTileClass}>
                      <p className="text-xs text-muted-foreground uppercase">Farms</p>
                      <p className="text-xl font-semibold">{dashboardSummary?.farms?.total ?? 0}</p>
                    </div>
                    <div className={centeredMetricTileClass}>
                      <p className="text-xs text-muted-foreground uppercase">Recommendations</p>
                      <p className="text-xl font-semibold">{dashboardSummary?.recommendations?.total ?? 0}</p>
                    </div>
                    <div className={centeredMetricTileClass}>
                      <p className="text-xs text-muted-foreground uppercase">Pest Detections</p>
                      <p className="text-xl font-semibold">{dashboardSummary?.pestDetections?.total ?? 0}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-4 dash-panel">
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>User Statistics</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Dedicated backend user metrics from the admin statistics endpoint</CardDescription>
              </CardHeader>
              <CardContent>
                {userStatisticsQuery.isLoading ? (
                  <LoadingState text="Loading user statistics..." size="sm" />
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className={centeredMetricTileClass}>
                        <p className="text-xs text-muted-foreground uppercase">Total Users</p>
                        <p className="text-xl font-semibold">{userStatistics?.totalUsers ?? 0}</p>
                      </div>
                      <div className={centeredMetricTileClass}>
                        <p className="text-xs text-muted-foreground uppercase">Active Users</p>
                        <p className="text-xl font-semibold">{userStatistics?.activeUsers ?? 0}</p>
                      </div>
                      <div className={centeredMetricTileClass}>
                        <p className="text-xs text-muted-foreground uppercase">New This Month</p>
                        <p className="text-xl font-semibold">{userStatistics?.newUsersThisMonth ?? 0}</p>
                      </div>
                      <div className={centeredMetricTileClass}>
                        <p className="text-xs text-muted-foreground uppercase">New Last Month</p>
                        <p className="text-xl font-semibold">{userStatistics?.newUsersLastMonth ?? 0}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium">By Role</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(userStatistics?.byRole || {}).length > 0 ? (
                          Object.entries(userStatistics?.byRole || {}).map(([role, count]) => (
                            <Badge key={role} variant="outline">
                              {role}: {String(count)}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No role breakdown available yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-4 dash-panel">
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Farm Statistics</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Dedicated backend farm metrics from the admin statistics endpoint</CardDescription>
              </CardHeader>
              <CardContent>
                {farmStatisticsQuery.isLoading ? (
                  <LoadingState text="Loading farm statistics..." size="sm" />
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className={centeredMetricTileClass}>
                        <p className="text-xs text-muted-foreground uppercase">Total Farms</p>
                        <p className="text-xl font-semibold">{farmStatistics?.totalFarms ?? 0}</p>
                      </div>
                      <div className={centeredMetricTileClass}>
                        <p className="text-xs text-muted-foreground uppercase">Active Farms</p>
                        <p className="text-xl font-semibold">{farmStatistics?.activeFarms ?? 0}</p>
                      </div>
                      <div className={centeredMetricTileClass}>
                        <p className="text-xs text-muted-foreground uppercase">Total Area</p>
                        <p className="text-xl font-semibold">
                          {typeof farmStatistics?.totalAreaHectares === 'number' ? farmStatistics.totalAreaHectares.toFixed(1) : '0.0'} ha
                        </p>
                      </div>
                      <div className={centeredMetricTileClass}>
                        <p className="text-xs text-muted-foreground uppercase">Average Size</p>
                        <p className="text-xl font-semibold">
                          {typeof farmStatistics?.avgSizeHectares === 'number' ? farmStatistics.avgSizeHectares.toFixed(1) : '0.0'} ha
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium">By District</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(farmStatistics?.byDistrict || {}).length > 0 ? (
                          Object.entries(farmStatistics?.byDistrict || {}).map(([district, count]) => (
                            <Badge key={district} variant="outline">
                              {district}: {String(count)}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No district farm breakdown available yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-12 border-sky-100/80 dark:border-sky-900/45">
              <CardHeader>
                <CardTitle className={sectionTitleClass}>Bulk Recommendation Generation</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Generate recommendation batches by district from the dedicated bulk endpoint</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleBulkGenerateRecommendations}>
                  <select
                    className={roundedSelectClass}
                    value={bulkGenerateDistrict}
                    onChange={(event) => setBulkGenerateDistrict(event.target.value)}
                  >
                    <option value="">All districts</option>
                    {districts.map((district: any) => (
                      <option key={district.id} value={district.name || district.id}>
                        {district.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className={roundedSelectClass}
                    value={bulkGenerateType}
                    onChange={(event) =>
                      setBulkGenerateType(
                        event.target.value as 'general' | 'irrigation' | 'fertilization' | 'pest_alert' | 'weather_alert'
                      )
                    }
                  >
                    <option value="general">General recommendations</option>
                    <option value="irrigation">Irrigation</option>
                    <option value="fertilization">Fertilization</option>
                    <option value="pest_alert">Pest alerts</option>
                    <option value="weather_alert">Weather alerts</option>
                  </select>
                  <Button type="submit" disabled={bulkGenerateRecommendationsMutation.isPending}>
                    {bulkGenerateRecommendationsMutation.isPending ? 'Generating...' : 'Generate Recommendations'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className={workspaceGridClass}>
          <Card className="lg:col-span-5 self-start dash-panel xl:sticky xl:top-28">
            <CardHeader>
              <CardTitle>Recent Users</CardTitle>
              <CardDescription>Most recent accounts in the system</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredOverviewUsers.length === 0 ? (
                <EmptyState title="No users found" message="No user records available yet." />
              ) : (
                <div className="space-y-3">
                  {filteredOverviewUsers.map((user: any) => (
                    <div key={user.id} className={`${outlineBlockClass} flex items-center justify-between gap-3`}>
                      <div>
                        <p className="font-semibold">{getUserName(user)}</p>
                        <p className="text-xs text-muted-foreground">{user.email || user.phoneNumber || user.phone || 'No contact'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{toRole(user.role)}</Badge>
                        <Badge variant={isUserActive(user) ? 'secondary' : 'outline'}>
                          {isUserActive(user) ? 'active' : 'inactive'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

            <Card className="lg:col-span-7 dash-panel">
            <CardHeader>
              <CardTitle>Admin User Directory Snapshot</CardTitle>
              <CardDescription>Loaded from the admin-scoped user list route</CardDescription>
            </CardHeader>
            <CardContent>
              {adminUsersRouteQuery.isLoading ? (
                <LoadingState text="Loading admin user directory..." size="sm" />
              ) : filteredAdminUserDirectory.length === 0 ? (
                <EmptyState title="No users found" message="The admin user directory route returned no users." />
              ) : (
                <div className="space-y-3">
                  {filteredAdminUserDirectory.map((user: any) => (
                    <div key={user.id} className={`${outlineBlockClass} flex items-center justify-between gap-3`}>
                      <div>
                        <p className="font-semibold">{getUserName(user)}</p>
                        <p className="text-xs text-muted-foreground">{user.email || user.phoneNumber || user.phone || 'No contact'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{toRole(user.role)}</Badge>
                        <Badge variant={isUserActive(user) ? 'secondary' : 'outline'}>
                          {isUserActive(user) ? 'active' : 'inactive'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          </div>

          <div className={workspaceGridClass}>
            <Card className="lg:col-span-4 dash-panel">
              <CardHeader>
                <CardTitle>Recommendation Ledger</CardTitle>
                <CardDescription>Loaded from the primary unscoped recommendations route</CardDescription>
              </CardHeader>
              <CardContent>
                {globalRecommendationsQuery.isLoading ? (
                  <LoadingState text="Loading recommendations..." size="sm" />
                ) : filteredGlobalRecommendations.length === 0 ? (
                  <EmptyState title="No recommendations" message="No recommendation records are available yet." />
                ) : (
                  <div className="space-y-3">
                    {filteredGlobalRecommendations.map((recommendation: any) => (
                      <div key={recommendation.id} className={outlineBlockClass}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-sm">{recommendation.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {recommendation.farm?.name || recommendation.farmId || 'Unknown farm'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {recommendation.description}
                            </p>
                          </div>
                          <div className="text-right space-y-1">
                            <Badge variant="outline">{recommendation.type}</Badge>
                            <div>
                              <Badge variant={recommendation.status === 'pending' ? 'default' : 'secondary'}>
                                {recommendation.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-4 dash-panel">
              <CardHeader>
                <CardTitle>Active Recommendation Watch</CardTitle>
                <CardDescription>Loaded from the primary unscoped active recommendations route</CardDescription>
              </CardHeader>
              <CardContent>
                {activeRecommendationsQuery.isLoading ? (
                  <LoadingState text="Loading active recommendations..." size="sm" />
                ) : filteredActiveRecommendations.length === 0 ? (
                  <EmptyState title="No active recommendations" message="There are no currently active recommendations." />
                ) : (
                  <div className="space-y-3">
                    {filteredActiveRecommendations.slice(0, 6).map((recommendation: any) => (
                      <div key={recommendation.id} className={outlineBlockClass}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-sm">{recommendation.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {recommendation.farm?.name || recommendation.farmId || 'Unknown farm'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {recommendation.actionRequired || recommendation.description}
                            </p>
                          </div>
                          <div className="text-right space-y-1">
                            <Badge variant="outline">{recommendation.priority || 'normal'}</Badge>
                            <div>
                              <Badge variant="secondary">{recommendation.status || 'active'}</Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-4 dash-panel">
              <CardHeader>
                <CardTitle>Pest Detection Ledger</CardTitle>
                <CardDescription>Loaded from the primary unscoped pest-detection route</CardDescription>
              </CardHeader>
              <CardContent>
                {globalPestDetectionsQuery.isLoading ? (
                  <LoadingState text="Loading pest detections..." size="sm" />
                ) : filteredGlobalPestDetections.length === 0 ? (
                  <EmptyState title="No pest detections" message="No pest detection records are available yet." />
                ) : (
                  <div className="space-y-3">
                    {filteredGlobalPestDetections.map((detection: any) => (
                      <div key={detection.id} className={outlineBlockClass}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-sm">{detection.pestType || 'Unknown pest'}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {detection.farm?.name || detection.farmId || 'Unknown farm'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {detection.isConfirmed ? 'Expert confirmed' : 'Pending expert review'}
                            </p>
                          </div>
                          <div className="text-right space-y-1">
                            <Badge variant="outline">{detection.severity || 'none'}</Badge>
                            <div>
                              <Badge variant={detection.isConfirmed ? 'secondary' : 'default'}>
                                {detection.isConfirmed ? 'confirmed' : 'pending'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className={workspaceGridClass}>
          <Card className="lg:col-span-4 dash-panel">
            <CardHeader>
              <CardTitle>30-Day Activity Snapshot</CardTitle>
              <CardDescription>Backend-generated system metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className={centeredMetricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase">Sensor Readings</p>
                  <p className="text-xl font-semibold">{analytics?.metrics?.sensorReadings ?? 0}</p>
                </div>
                <div className={centeredMetricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase">Recommendations</p>
                  <p className="text-xl font-semibold">{analytics?.metrics?.recommendationsGenerated ?? 0}</p>
                </div>
                <div className={centeredMetricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase">Messages</p>
                  <p className="text-xl font-semibold">{analytics?.metrics?.messagesSent ?? 0}</p>
                </div>
                <div className={centeredMetricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase">Errors</p>
                  <p className="text-xl font-semibold">{analytics?.metrics?.errors ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`${workspaceMainClass} dash-panel`}>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle>Recent System Activity</CardTitle>
                  <CardDescription>Recent operator-facing system activity with filters and export.</CardDescription>
                </div>
                <div className="dash-toolbar">
                  <select
                    className={compactSelectClass}
                    value={activityHours}
                    onChange={(event) => setActivityHours(Number(event.target.value) as 6 | 24 | 168)}
                  >
                    <option value={6}>Last 6 hours</option>
                    <option value={24}>Last 24 hours</option>
                    <option value={168}>Last 7 days</option>
                  </select>
                  <select
                    className={compactSelectClass}
                    value={activityType}
                    onChange={(event) =>
                      setActivityType(
                        event.target.value as 'all' | 'user' | 'farm' | 'recommendation' | 'pest_detection' | 'pest_control' | 'sensor_reading'
                      )
                    }
                  >
                    <option value="all">All types</option>
                    <option value="user">Users</option>
                    <option value="farm">Farms</option>
                    <option value="recommendation">Recommendations</option>
                    <option value="pest_detection">Pest Detections</option>
                    <option value="pest_control">Pest Control</option>
                    <option value="sensor_reading">Sensor Readings</option>
                  </select>
                  <Button size="sm" variant="outline" disabled={exportRecentActivity.isPending} onClick={() => handleExportRecentActivity('csv')}>
                    Export CSV
                  </Button>
                  <Button size="sm" variant="outline" disabled={exportRecentActivity.isPending} onClick={() => handleExportRecentActivity('json')}>
                    Export JSON
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {recentActivityQuery.isLoading ? (
                <LoadingState text="Loading recent activity..." size="sm" />
              ) : (
                <div className="space-y-4">
                  <div className="dash-summary-grid-wide">
                    <div className={centeredMetricTileClass}>
                      <p className="text-xs text-muted-foreground uppercase break-words text-balance">Users</p>
                      <p className="text-xl font-semibold">{recentActivityQuery.data?.summary?.newUsers ?? 0}</p>
                    </div>
                    <div className={centeredMetricTileClass}>
                      <p className="text-xs text-muted-foreground uppercase break-words text-balance">Farms</p>
                      <p className="text-xl font-semibold">{recentActivityQuery.data?.summary?.newFarms ?? 0}</p>
                    </div>
                    <div className={centeredMetricTileClass}>
                      <p className="text-xs text-muted-foreground uppercase break-words text-balance">Readings</p>
                      <p className="text-xl font-semibold">{recentActivityQuery.data?.summary?.sensorReadings ?? 0}</p>
                    </div>
                    <div className={centeredMetricTileClass}>
                      <p className="text-xs text-muted-foreground uppercase break-words text-balance">Recommendations</p>
                      <p className="text-xl font-semibold">{recentActivityQuery.data?.summary?.recommendations ?? 0}</p>
                    </div>
                    <div className={centeredMetricTileClass}>
                      <p className="text-xs text-muted-foreground uppercase break-words text-balance">Pest Events</p>
                      <p className="text-xl font-semibold">{recentActivityQuery.data?.summary?.pestDetections ?? 0}</p>
                    </div>
                    <div className={centeredMetricTileClass}>
                      <p className="text-xs text-muted-foreground uppercase break-words text-balance">Pest Control</p>
                      <p className="text-xl font-semibold">{recentActivityQuery.data?.summary?.pestControlActions ?? 0}</p>
                    </div>
                  </div>

                  {Array.isArray(recentActivityQuery.data?.activities) && recentActivityQuery.data.activities.length > 0 ? (
                    <div className="space-y-2">
                      {recentActivityQuery.data.activities.map((item) => (
                        <div key={item.id} className={outlineBlockClass}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-sm">{item.title}</p>
                                <Badge variant="outline">{formatActivityLabel(item.type)}</Badge>
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                            </div>
                            <div className="text-right">
                              {item.status && <Badge variant="outline">{item.status}</Badge>}
                              <p className="mt-1 text-xs text-muted-foreground">{toDateString(item.timestamp)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No recent activity"
                      message="System-wide activity events will appear here as they are recorded."
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          </div>
        </>
      )}

      {tab === 'farms' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
          {/* ── Main Column ── */}
          <div className="lg:col-span-8 min-w-0 space-y-5">
            {/* Header Card */}
            <div className="dash-panel p-5 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary shrink-0">
                    <Sprout size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold tracking-tight">Farm Management</h2>
                    <p className="text-sm text-muted-foreground">Browse and manage all registered farms</p>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Input
                  className="h-11"
                  placeholder={
                    normalizedExternalSearch
                      ? 'Using dashboard search filter'
                      : 'Search by farm name, crop, location'
                  }
                  value={effectiveSearch}
                  onChange={(event) => setSearch(event.target.value)}
                  readOnly={!!normalizedExternalSearch}
                />
                <select
                  className={roundedSelectClass}
                  value={farmDistrictFilter}
                  onChange={(event) => setFarmDistrictFilter(event.target.value)}
                >
                  <option value="">All districts</option>
                  {districts.map((district: any) => (
                    <option key={district.id} value={district.id}>
                      {district.name}
                    </option>
                  ))}
                </select>
                <select
                  className={roundedSelectClass}
                  value={farmStatusFilter}
                  onChange={(event) => setFarmStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Controls Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-4 border-t border-[hsl(var(--border))]">
                <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold">Fleet controls</p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className={compactSelectClass}
                    value={tabExportFormat}
                    onChange={(event) => setTabExportFormat(event.target.value as 'csv' | 'json')}
                  >
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                  </select>
                  <Button size="sm" variant="outline" className="h-9 rounded-full" onClick={handleExportCurrentTab}>
                    Export
                  </Button>
                  <Button size="sm" variant="outline" className="h-9 rounded-full" onClick={handleRefreshTab}>
                    <RefreshCw size={14} className="mr-1.5" />
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 rounded-full text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => {
                      setSearch('');
                      setFarmDistrictFilter('');
                      setFarmStatusFilter('all');
                      setFarmsPage(1);
                    }}
                    disabled={normalizedExternalSearch.length > 0}
                  >
                    Reset Filters
                  </Button>
                </div>
              </div>
            </div>

            {/* Farm List */}
            {farmsQuery.isLoading ? (
              <div className="dash-panel p-8 flex items-center justify-center min-h-[200px]">
                <LoadingState text="Loading farms..." />
              </div>
            ) : farmsQuery.error ? (
              <div className="dash-panel p-8 flex items-center justify-center min-h-[200px]">
                <ErrorState title="Failed to load farms" message="Please retry." onRetry={farmsQuery.refetch} />
              </div>
            ) : adminFarms.length === 0 ? (
              <div className="dash-panel p-8 flex items-center justify-center min-h-[200px]">
                <EmptyState title="No farms found" message="No farms matched your current filters." />
              </div>
            ) : (
              <div className="space-y-3">
                {adminFarms.map((farm: any) => {
                  const farmDistrictName =
                    farm.district?.name
                    || districts.find((district: any) => String(district.id) === String(farm.districtId || farm.district_id))?.name
                    || farm.district_name
                    || 'Unknown district';
                  const farmOwner =
                    [farm.user?.firstName, farm.user?.lastName].filter(Boolean).join(' ')
                    || farm.user?.email
                    || farm.user?.phoneNumber
                    || farm.user_id
                    || farm.userId
                    || 'Unknown owner';
                  const farmStatus = farm.isActive === false || farm.is_active === false ? 'inactive' : 'active';

                  return (
                    <div key={farm.id || farm._id} className="dash-detail-card p-4 md:p-5">
                      {/* Row 1: Name + Badges */}
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                        <div className="min-w-0">
                          <p className="font-semibold text-[15px] truncate">{farm.name || 'Unnamed farm'}</p>
                          <p className="text-sm text-muted-foreground mt-0.5 truncate">
                            <span className="inline-flex items-center gap-1.5">
                              <Users size={13} className="shrink-0 opacity-60" />
                              {farmOwner}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline">{farmDistrictName}</Badge>
                          <Badge variant={farmStatus === 'active' ? 'secondary' : 'outline'}>
                            {farmStatus}
                          </Badge>
                        </div>
                      </div>

                      {/* Row 2: Metadata Grid */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                        <div className={softBlockClass}>
                          <p className="text-[10.5px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">Crop</p>
                          <p className="text-sm font-medium truncate">{farm.cropVariety || farm.crop_variety || 'N/A'}</p>
                        </div>
                        <div className={softBlockClass}>
                          <p className="text-[10.5px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">Growth Stage</p>
                          <p className="text-sm font-medium truncate">{farm.currentGrowthStage || farm.current_growth_stage || 'N/A'}</p>
                        </div>
                        <div className={softBlockClass}>
                          <p className="text-[10.5px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">Size</p>
                          <p className="text-sm font-medium">
                            {typeof (farm.sizeHectares ?? farm.size_hectares) === 'number'
                              ? `${(farm.sizeHectares ?? farm.size_hectares).toFixed(1)} ha`
                              : 'N/A'}
                          </p>
                        </div>
                        <div className={softBlockClass}>
                          <p className="text-[10.5px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">Location</p>
                          <p className="text-sm font-medium truncate">{farm.locationName || farm.location_name || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Pagination */}
                <div className="flex justify-center pt-2">
                  {renderPagination(
                    farmsQuery.data?.pagination?.page || farmsPage,
                    farmsQuery.data?.pagination?.totalPages,
                    setFarmsPage
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Side Rail ── */}
          <div className="lg:col-span-4 min-w-0 space-y-5 2xl:max-h-[calc(100vh-7rem)] 2xl:overflow-y-auto 2xl:pr-1" style={{ scrollbarWidth: 'thin' }}>
            {/* Farm Fleet Snapshot */}
            <div className="dash-panel p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <Activity size={16} className="text-primary shrink-0" />
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Farm Fleet Snapshot</h3>
                  <p className="text-xs text-muted-foreground">Health and metrics for current results</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <div className="dash-soft-block text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Visible</p>
                  <p className="text-xl font-bold mt-0.5">{farmSegmentStats.total}</p>
                </div>
                <div className="dash-soft-block text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Avg Size</p>
                  <p className="text-xl font-bold mt-0.5">{farmSegmentStats.averageAreaHectares.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">ha</span></p>
                </div>
                <div className="dash-soft-block text-center" style={{ background: 'hsl(var(--primary) / 0.06)' }}>
                  <p className="text-[10px] text-primary uppercase tracking-wider font-medium">Active</p>
                  <p className="text-xl font-bold text-primary mt-0.5">{farmSegmentStats.active}</p>
                </div>
                <div className="dash-soft-block text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Inactive</p>
                  <p className="text-xl font-bold mt-0.5">{farmSegmentStats.inactive}</p>
                </div>
              </div>
              <div className="dash-outline-block text-center py-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total Visible Area</p>
                <p className="text-2xl font-bold text-primary mt-1">{farmSegmentStats.totalAreaHectares.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">ha</span></p>
              </div>
            </div>

            {/* District Concentration */}
            <div className="dash-panel p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <BarChart2 size={16} className="text-primary shrink-0" />
                <div>
                  <h3 className="text-sm font-bold tracking-tight">District Concentration</h3>
                  <p className="text-xs text-muted-foreground">Farm volumes by district</p>
                </div>
              </div>
              {farmSegmentStats.topDistricts.length === 0 ? (
                <div className="dash-dashed-block flex flex-col items-center justify-center py-6 text-center">
                  <AlertTriangle size={20} className="text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No distribution data available.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {farmSegmentStats.topDistricts.map(([districtName, count]) => (
                    <div key={districtName} className="dash-outline-block flex items-center justify-between gap-3 transition-colors hover:bg-[hsl(var(--secondary))]">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-primary/50 shrink-0" />
                        <p className="text-sm font-medium truncate">{districtName}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0">{count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className={workspaceGridClass}>
          <Card className={`${workspaceMainClass} dash-panel`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users size={20} />
                User Management
              </CardTitle>
              <CardDescription>Manage roles and account status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
                  placeholder={
                    normalizedExternalSearch
                      ? 'Using dashboard search filter'
                      : 'Search by name/email/phone'
                  }
                  value={effectiveSearch}
                  onChange={(event) => setSearch(event.target.value)}
                  readOnly={!!normalizedExternalSearch}
                />
                <select
                  className={roundedSelectClass}
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value as 'all' | UserRole)}
                >
                  <option value="all">All Roles</option>
                  <option value="farmer">Farmer</option>
                  <option value="expert">Expert</option>
                  <option value="admin">Admin</option>
                </select>
                <select
                  className={roundedSelectClass}
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className={filterBarClass}>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Directory controls</p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className={compactSelectClass}
                    value={tabExportFormat}
                    onChange={(event) => setTabExportFormat(event.target.value as 'csv' | 'json')}
                  >
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                  </select>
                  <Button size="sm" variant="outline" onClick={handleExportCurrentTab}>
                    Export
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleRefreshTab}>
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleResetUserFilters}
                    disabled={normalizedExternalSearch.length > 0}
                  >
                    Reset Filters
                  </Button>
                </div>
              </div>

              {usersQuery.isLoading ? (
                <LoadingState text="Loading users..." />
              ) : usersQuery.error ? (
                <ErrorState title="Failed to load users" message="Please retry." onRetry={usersQuery.refetch} />
              ) : users.length === 0 ? (
                <EmptyState title="No users found" message="No users matched your filters." />
              ) : (
                <div className="space-y-3">
                  {users.map((user: any) => (
                    <div key={user.id} className="dash-detail-card space-y-3">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <p className="font-semibold">{getUserName(user)}</p>
                          <p className="text-xs text-muted-foreground">{user.email || user.phoneNumber || user.phone || 'No contact'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{toRole(user.role)}</Badge>
                          <Badge variant={isUserActive(user) ? 'secondary' : 'outline'}>
                            {isUserActive(user) ? 'active' : 'inactive'}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex flex-col md:flex-row gap-2">
                        <select
                          className={compactSelectClass}
                          value={toRole(user.role)}
                          onChange={(event) => handleRoleChange(user, event.target.value as UserRole)}
                          disabled={updateUserMutation.isPending}
                        >
                          <option value="farmer">Farmer</option>
                          <option value="expert">Expert</option>
                          <option value="admin">Admin</option>
                        </select>
                        <Button
                          variant={isUserActive(user) ? 'outline' : 'default'}
                          size="sm"
                          onClick={() => handleToggleUserStatus(user)}
                          disabled={updateUserMutation.isPending}
                        >
                          {isUserActive(user) ? 'Deactivate' : 'Reactivate'}
                        </Button>
                        <Button
                          variant={selectedUserId === user.id ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedUserId(user.id)}
                        >
                          {selectedUserId === user.id ? 'Viewing Profile' : 'View Profile'}
                        </Button>
                      </div>

                      {toRole(user.role) === 'expert' && (
                        <div className="flex flex-col gap-2 md:flex-row md:items-center">
                          <span className="text-xs text-muted-foreground min-w-28">Coverage district</span>
                          <select
                            className={compactSelectClass}
                            value={getUserDistrictId(user) || ''}
                            onChange={(event) => handleExpertDistrictChange(user, event.target.value || null)}
                            disabled={updateUserMutation.isPending || districtsQuery.isLoading}
                          >
                            <option value="">Select district</option>
                            {districts.map((district: any) => (
                              <option key={district.id} value={district.id}>
                                {district.name}
                              </option>
                            ))}
                          </select>
                          <span className="text-xs text-muted-foreground">
                            Expert agronomists can only be assigned to farmers in this district.
                          </span>
                        </div>
                      )}
                    </div>
                  ))}

                  {renderPagination(
                    usersQuery.data?.pagination?.page || usersPage,
                    usersQuery.data?.pagination?.totalPages,
                    setUsersPage
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className={workspaceRailClass}>
            <Card className="dash-panel">
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Directory Snapshot</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Role and status composition from current result set</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className={centeredMetricTileClass}>
                    <p className="text-xs text-muted-foreground uppercase">Visible users</p>
                    <p className="text-xl font-semibold">{userSegmentStats.total}</p>
                  </div>
                  <div className={centeredMetricTileClass}>
                    <p className="text-xs text-muted-foreground uppercase">Active</p>
                    <p className="text-xl font-semibold">{userSegmentStats.active}</p>
                  </div>
                  <div className={centeredMetricTileClass}>
                    <p className="text-xs text-muted-foreground uppercase">Experts</p>
                    <p className="text-xl font-semibold">{userSegmentStats.roleBreakdown.expert}</p>
                  </div>
                  <div className={centeredMetricTileClass}>
                    <p className="text-xs text-muted-foreground uppercase">Farmers</p>
                    <p className="text-xl font-semibold">{userSegmentStats.roleBreakdown.farmer}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Admins: {userSegmentStats.roleBreakdown.admin}</Badge>
                  <Badge variant="outline">Inactive: {userSegmentStats.inactive}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="dash-panel">
              <CardHeader>
                <CardTitle>Selected User Profile</CardTitle>
                <CardDescription>Route-backed detail view from the single-user backend endpoint</CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedUserId ? (
                  <EmptyState title="No user selected" message="Choose a user from the list to inspect their full profile." />
                ) : selectedUserQuery.isLoading ? (
                  <LoadingState text="Loading selected user..." size="sm" />
                ) : selectedUserQuery.error ? (
                  <ErrorState title="Failed to load user" message="Please retry." onRetry={selectedUserQuery.refetch} />
                ) : selectedUser ? (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-lg font-semibold">{getUserName(selectedUser)}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{toRole(selectedUser.role)}</Badge>
                        <Badge variant={isUserActive(selectedUser) ? 'secondary' : 'outline'}>
                          {isUserActive(selectedUser) ? 'active' : 'inactive'}
                        </Badge>
                        {selectedUser.isVerified !== undefined && (
                          <Badge variant={selectedUser.isVerified ? 'secondary' : 'outline'}>
                            {selectedUser.isVerified ? 'verified' : 'unverified'}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 text-sm">
                      <div className={softBlockClass}>
                        <p className="text-xs text-muted-foreground uppercase">Email</p>
                        <p className="font-medium">{selectedUser.email || 'N/A'}</p>
                      </div>
                      <div className={softBlockClass}>
                        <p className="text-xs text-muted-foreground uppercase">Phone</p>
                        <p className="font-medium">{selectedUser.phoneNumber || selectedUser.phone || 'N/A'}</p>
                      </div>
                      <div className={softBlockClass}>
                        <p className="text-xs text-muted-foreground uppercase">Coverage District</p>
                        <p className="font-medium">
                          {districts.find((district: any) => String(district.id) === String(getUserDistrictId(selectedUser)))?.name || 'Not set'}
                        </p>
                      </div>
                      <div className={softBlockClass}>
                        <p className="text-xs text-muted-foreground uppercase">Last Login</p>
                        <p className="font-medium">{toDateString(selectedUser.lastLoginAt || selectedUser.last_login_at)}</p>
                      </div>
                      <div className={softBlockClass}>
                        <p className="text-xs text-muted-foreground uppercase">Created</p>
                        <p className="font-medium">{toDateString(selectedUser.createdAt || selectedUser.created_at)}</p>
                      </div>
                      <div className={softBlockClass}>
                        <p className="text-xs text-muted-foreground uppercase">Metadata</p>
                        <pre className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                          {JSON.stringify(selectedUser.metadata || {}, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState title="No user data" message="The selected user did not return profile details." />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className={workspaceGridClass}>
          <Card className={`${workspaceMainClass} dash-panel`}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileClock size={20} />
                    Audit Logs
                  </CardTitle>
                  <CardDescription>Recent system actions and security events</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className={compactSelectClass}
                    value={tabExportFormat}
                    onChange={(event) => setTabExportFormat(event.target.value as 'csv' | 'json')}
                  >
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                  </select>
                  <Button size="sm" variant="outline" onClick={handleExportCurrentTab}>
                    Export
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleRefreshTab}>
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {auditLogsQuery.isLoading ? (
                <LoadingState text="Loading audit logs..." />
              ) : auditLogsQuery.error ? (
                <ErrorState title="Failed to load audit logs" message="Please retry." onRetry={auditLogsQuery.refetch} />
              ) : auditLogs.length === 0 ? (
                <EmptyState title="No audit logs" message="No audit events found for this window." />
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log: any, index: number) => (
                    <div key={log.id || `${log.action}-${index}`} className={outlineBlockClass}>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div>
                          <p className="font-medium">{log.action || 'UNKNOWN_ACTION'}</p>
                          <p className="text-xs text-muted-foreground">
                            Entity: {log.entityType || log.entity_type || 'system'} | User: {log.userId || log.user_id || 'N/A'}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">{toDateString(log.createdAt || log.created_at)}</p>
                      </div>
                    </div>
                  ))}

                  {renderPagination(
                    auditLogsQuery.data?.pagination?.page || auditPage,
                    auditLogsQuery.data?.pagination?.totalPages,
                    setAuditPage
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className={workspaceRailClass}>
            <Card className="dash-panel">
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Audit Snapshot</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Current page distribution and activity mix</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className={centeredMetricTileClass}>
                    <p className="text-xs text-muted-foreground uppercase">Visible events</p>
                    <p className="text-xl font-semibold">{auditSegmentStats.total}</p>
                  </div>
                  <div className={centeredMetricTileClass}>
                    <p className="text-xs text-muted-foreground uppercase">Entity types</p>
                    <p className="text-xl font-semibold">{auditSegmentStats.uniqueEntities}</p>
                  </div>
                  <div className={centeredMetricTileClass}>
                    <p className="text-xs text-muted-foreground uppercase">Unique actions</p>
                    <p className="text-xl font-semibold">{auditSegmentStats.uniqueActions}</p>
                  </div>
                  <div className={centeredMetricTileClass}>
                    <p className="text-xs text-muted-foreground uppercase">Latest event</p>
                    <p className="text-xs font-medium">{auditSegmentStats.latestTimestamp}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="dash-panel">
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Top Event Types</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Most frequent action names in the current page</CardDescription>
              </CardHeader>
              <CardContent>
                {auditSegmentStats.topActions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No action frequencies available.</p>
                ) : (
                  <div className="space-y-2">
                    {auditSegmentStats.topActions.map(([action, count]) => (
                      <div key={action} className={`${outlineBlockClass} flex items-center justify-between gap-3`}>
                        <p className="text-sm font-medium">{action}</p>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === 'devices' && (
        <div className={workspaceGridClass}>
          <div className={workspaceMainStackClass}>
            <Card className="dash-panel">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Cpu size={20} />
                      Device Management
                    </CardTitle>
                    <CardDescription>Manage IoT device tokens and provisioning</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className={compactSelectClass}
                      value={tabExportFormat}
                      onChange={(event) => setTabExportFormat(event.target.value as 'csv' | 'json')}
                    >
                      <option value="csv">CSV</option>
                      <option value="json">JSON</option>
                    </select>
                    <Button size="sm" variant="outline" onClick={handleExportCurrentTab}>
                      Export
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleRefreshTab}>
                      Refresh
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {devicesQuery.isLoading ? (
                  <LoadingState text="Loading devices..." />
                ) : devicesQuery.error ? (
                  <ErrorState title="Failed to load devices" message="Please retry." onRetry={devicesQuery.refetch} />
                ) : devices.length === 0 ? (
                  <EmptyState title="No devices found" message="No registered devices found." />
                ) : (
                  <div className="space-y-2">
                    {devices.map((device: any, index: number) => {
                      const status = getDeviceStatus(device);
                      const deviceId = getDeviceId(device);
                      return (
                        <div key={getDeviceRenderKey(device, index)} className={outlineBlockClass}>
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                            <div>
                              <p className="font-medium">{device.device_name || device.deviceName || deviceId || 'Unknown device'}</p>
                              <p className="text-xs text-muted-foreground">
                                Farm: {device.farm_name || device.farmId || device.farm_id || 'N/A'} | Last seen: {toDateString(device.lastSeen || device.last_seen)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={getBadgeVariant(status)}>{status}</Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!deviceId}
                                onClick={() => copyToClipboard(deviceId)}
                              >
                                Copy ID
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!deviceId || revokeDeviceTokenMutation.isPending || status === 'revoked'}
                                onClick={() => {
                                  const confirmed = confirmAction(`Revoke token for device ${deviceId}?`);
                                  if (!confirmed) return;
                                  revokeDeviceTokenMutation.mutate(deviceId);
                                }}
                              >
                                Revoke
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {renderPagination(
                      devicesQuery.data?.pagination?.page || devicesPage,
                      devicesQuery.data?.pagination?.totalPages,
                      setDevicesPage
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="dash-panel">
              <CardHeader>
                <CardTitle>Generate Device Token</CardTitle>
                <CardDescription>Create a new device credential for farm ingestion</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form className="grid grid-cols-1 md:grid-cols-3 gap-3" onSubmit={handleGenerateDeviceToken}>
                  <Input
                    placeholder="Farm ID"
                    value={deviceFarmId}
                    onChange={(event) => setDeviceFarmId(event.target.value)}
                  />
                  <Input
                    placeholder="Device Name"
                    value={deviceName}
                    onChange={(event) => setDeviceName(event.target.value)}
                  />
                  <Button type="submit" disabled={generateDeviceTokenMutation.isPending}>
                    Generate Token
                  </Button>
                </form>

                {deviceTokenResult && (
                  <div className={`${softBlockClass} text-sm space-y-1`}>
                    <p><span className="font-semibold">Device ID:</span> {deviceTokenResult.deviceId}</p>
                    <p className="break-all"><span className="font-semibold">Token:</span> {deviceTokenResult.token}</p>
                    <p><span className="font-semibold">Expires:</span> {toDateString(deviceTokenResult.expiresAt)}</p>
                    {deviceTokenResult.warning && <p className="text-xs text-muted-foreground">{deviceTokenResult.warning}</p>}
                    <div className="pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(deviceTokenResult.token || '')}
                        disabled={!deviceTokenResult.token}
                      >
                        <ClipboardCopy size={14} className="mr-2" />
                        Copy Token
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className={workspaceRailClass}>
            <Card className="dash-panel">
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Device Fleet Snapshot</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Status mix from the current device page</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className={centeredMetricTileClass}>
                    <p className="text-xs text-muted-foreground uppercase">Visible devices</p>
                    <p className="text-xl font-semibold">{deviceSegmentStats.total}</p>
                  </div>
                  <div className={centeredMetricTileClass}>
                    <p className="text-xs text-muted-foreground uppercase">Active</p>
                    <p className="text-xl font-semibold">{deviceSegmentStats.active}</p>
                  </div>
                  <div className={centeredMetricTileClass}>
                    <p className="text-xs text-muted-foreground uppercase">Inactive</p>
                    <p className="text-xl font-semibold">{deviceSegmentStats.inactive}</p>
                  </div>
                  <div className={centeredMetricTileClass}>
                    <p className="text-xs text-muted-foreground uppercase">Revoked</p>
                    <p className="text-xl font-semibold">{deviceSegmentStats.revoked}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="dash-panel">
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Status Distribution</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Most frequent status categories</CardDescription>
              </CardHeader>
              <CardContent>
                {deviceSegmentStats.topStatuses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No status distribution available.</p>
                ) : (
                  <div className="space-y-2">
                    {deviceSegmentStats.topStatuses.map(([status, count]) => (
                      <div key={status} className={`${outlineBlockClass} flex items-center justify-between gap-3`}>
                        <Badge variant={getBadgeVariant(status)}>{status}</Badge>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === 'config' && (
        <div className={workspaceGridClass}>
          <Card className={`${workspaceMainClass} dash-panel`}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <SlidersHorizontal size={20} />
                    System Configuration
                  </CardTitle>
                  <CardDescription>Live configuration keys from backend</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={handleRefreshTab}>
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSearch('')}
                    disabled={normalizedExternalSearch.length > 0}
                  >
                    Clear Search
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {configsQuery.isLoading ? (
                <LoadingState text="Loading configuration..." />
              ) : configsQuery.error ? (
                <ErrorState title="Failed to load configuration" message="Please retry." onRetry={configsQuery.refetch} />
              ) : filteredConfigs.length === 0 ? (
                <EmptyState title="No configuration found" message="No configuration keys are available." />
              ) : (
                <div className="space-y-3">
                  {filteredConfigs.map((entry) => (
                    <div key={entry.key} className="dash-detail-card space-y-3">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div>
                          <p className="font-semibold">{entry.key}</p>
                          <p className="text-xs text-muted-foreground">
                            Category: {entry.category} | Updated: {toDateString(entry.updatedAt)}
                          </p>
                          {entry.description && <p className="text-xs text-muted-foreground mt-1">{entry.description}</p>}
                        </div>
                        <Badge variant={entry.isActive === false ? 'outline' : 'secondary'}>
                          {entry.isActive === false ? 'inactive' : 'active'}
                        </Badge>
                      </div>

                      <textarea
                        className={textAreaClass}
                        value={
                          configDrafts[entry.key] ??
                          (typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value, null, 2))
                        }
                        onChange={(event) =>
                          setConfigDrafts((previous) => ({ ...previous, [entry.key]: event.target.value }))
                        }
                      />
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => handleSaveConfig(entry)}
                          disabled={updateConfigMutation.isPending}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className={workspaceRailClass}>
            <Card className="dash-panel">
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Config Snapshot</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Current configuration inventory in view</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className={centeredMetricTileClass}>
                    <p className="text-xs text-muted-foreground uppercase">Visible keys</p>
                    <p className="text-xl font-semibold">{configSegmentStats.total}</p>
                  </div>
                  <div className={centeredMetricTileClass}>
                    <p className="text-xs text-muted-foreground uppercase">Categories</p>
                    <p className="text-xl font-semibold">{configSegmentStats.categories}</p>
                  </div>
                  <div className={centeredMetricTileClass}>
                    <p className="text-xs text-muted-foreground uppercase">Active</p>
                    <p className="text-xl font-semibold">{configSegmentStats.active}</p>
                  </div>
                  <div className={centeredMetricTileClass}>
                    <p className="text-xs text-muted-foreground uppercase">Inactive</p>
                    <p className="text-xl font-semibold">{configSegmentStats.inactive}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="dash-panel">
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Top Categories</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Most populated config groups in current results</CardDescription>
              </CardHeader>
              <CardContent>
                {configSegmentStats.topCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No category breakdown available.</p>
                ) : (
                  <div className="space-y-2">
                    {configSegmentStats.topCategories.map(([category, count]) => (
                      <div key={category} className={`${outlineBlockClass} flex items-center justify-between gap-3`}>
                        <p className="text-sm font-medium">{category}</p>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === 'monitoring' && (
        <div className={workspaceGridClass}>
          <div className={workspaceMainStackClass}>
            <Card className="dash-panel">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Activity size={20} />
                      Sensor Fleet Health
                    </CardTitle>
                    <CardDescription>Live operational view for the deployed sensor network</CardDescription>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleRefreshTab}>
                    Refresh Monitoring
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {sensorHealthQuery.isLoading ? (
                  <LoadingState text="Loading sensor fleet health..." />
                ) : sensorHealthQuery.error ? (
                  <ErrorState
                    title="Failed to load sensor fleet health"
                    message="Please retry."
                    onRetry={sensorHealthQuery.refetch}
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div className={centeredMetricTileClass}>
                        <p className="text-xs text-muted-foreground uppercase">Total Sensors</p>
                        <p className="text-xl font-semibold">{sensorHealth?.totalSensors ?? 0}</p>
                      </div>
                      <div className={centeredMetricTileClass}>
                        <p className="text-xs text-muted-foreground uppercase">Active</p>
                        <p className="text-xl font-semibold">{sensorHealth?.activeSensors ?? 0}</p>
                      </div>
                      <div className={centeredMetricTileClass}>
                        <p className="text-xs text-muted-foreground uppercase">Faulty</p>
                        <p className="text-xl font-semibold">{sensorHealth?.faultySensors ?? 0}</p>
                      </div>
                      <div className={centeredMetricTileClass}>
                        <p className="text-xs text-muted-foreground uppercase">Maintenance Needed</p>
                        <p className="text-xl font-semibold">{sensorHealth?.maintenanceRequired ?? 0}</p>
                      </div>
                      <div className={centeredMetricTileClass}>
                        <p className="text-xs text-muted-foreground uppercase">Avg Battery</p>
                        <p className="text-xl font-semibold">
                          {typeof sensorHealth?.avgBatteryLevel === 'number'
                            ? `${Math.round(sensorHealth.avgBatteryLevel)}%`
                            : 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">By Sensor Type</p>
                      {Object.keys(sensorHealth?.byType || {}).length === 0 ? (
                        <EmptyState
                          title="No sensor type breakdown"
                          message="No type-level health information is available yet."
                        />
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {Object.entries(sensorHealth?.byType || {}).map(([type, stats]) => {
                            const typedStats = stats as { total?: number; active?: number };
                            const total = typedStats?.total ?? 0;
                            const active = typedStats?.active ?? 0;
                            const inactive = Math.max(total - active, 0);

                            return (
                              <div key={type} className={`${outlineBlockClass} space-y-2`}>
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-medium">{formatActivityLabel(type)}</p>
                                  <Badge variant={inactive > 0 ? 'outline' : 'secondary'}>
                                    {inactive > 0 ? 'attention needed' : 'healthy'}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-sm">
                                  <div>
                                    <p className="text-xs text-muted-foreground uppercase">Total</p>
                                    <p className="font-semibold">{total}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground uppercase">Active</p>
                                    <p className="font-semibold">{active}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground uppercase">Inactive</p>
                                    <p className="font-semibold">{inactive}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="dash-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RadioTower size={20} />
                  System Health
                </CardTitle>
                <CardDescription>Real-time health checks</CardDescription>
              </CardHeader>
              <CardContent>
                {healthQuery.isLoading ? (
                  <LoadingState text="Loading health checks..." />
                ) : healthQuery.error ? (
                  <ErrorState title="Failed to load health checks" message="Please retry." onRetry={healthQuery.refetch} />
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Shield size={18} />
                      <span className="font-medium">Overall status:</span>
                      <Badge variant={getBadgeVariant(String(health?.status || 'unknown'))}>
                        {String(health?.status || 'unknown')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Checked at: {toDateString(health?.timestamp)}</p>
                    <div className="space-y-2">
                      {Object.entries(health?.checks || {}).map(([key, value]) => (
                        <div key={key} className={`${outlineBlockClass} text-sm flex items-center justify-between gap-2`}>
                          <span className="font-medium">{key}</span>
                          <span className="text-muted-foreground">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="dash-panel">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle>Operational Metrics</CardTitle>
                    <CardDescription>Backend metrics for selected window</CardDescription>
                  </div>
                  <select
                    className={compactSelectClass}
                    value={metricsPeriod}
                    onChange={(event) => setMetricsPeriod(event.target.value as '1h' | '6h' | '24h' | '7d')}
                  >
                    <option value="1h">Last 1 hour</option>
                    <option value="6h">Last 6 hours</option>
                    <option value="24h">Last 24 hours</option>
                    <option value="7d">Last 7 days</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent>
                {metricsQuery.isLoading ? (
                  <LoadingState text="Loading metrics..." />
                ) : metricsQuery.error ? (
                  <ErrorState title="Failed to load metrics" message="Please retry." onRetry={metricsQuery.refetch} />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className={centeredMetricTileClass}>
                      <p className="text-xs text-muted-foreground uppercase">Sensor Readings</p>
                      <p className="text-xl font-semibold">{metrics?.metrics?.sensorReadings ?? 0}</p>
                    </div>
                    <div className={centeredMetricTileClass}>
                      <p className="text-xs text-muted-foreground uppercase">Recommendations</p>
                      <p className="text-xl font-semibold">{metrics?.metrics?.recommendationsGenerated ?? 0}</p>
                    </div>
                    <div className={centeredMetricTileClass}>
                      <p className="text-xs text-muted-foreground uppercase">Messages</p>
                      <p className="text-xl font-semibold">{metrics?.metrics?.messagesSent ?? 0}</p>
                    </div>
                    <div className={centeredMetricTileClass}>
                      <p className="text-xs text-muted-foreground uppercase">Errors</p>
                      <p className="text-xl font-semibold">{metrics?.metrics?.errors ?? 0}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className={workspaceRailClass}>
            <Card className="dash-panel">
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Monitoring Snapshot</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Cross-source health summary for current period</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className={centeredMetricTileClass}>
                    <p className="text-xs text-muted-foreground uppercase">Sensors</p>
                    <p className="text-xl font-semibold">{monitoringSegmentStats.totalSensors}</p>
                  </div>
                  <div className={centeredMetricTileClass}>
                    <p className="text-xs text-muted-foreground uppercase">Active</p>
                    <p className="text-xl font-semibold">{monitoringSegmentStats.activeSensors}</p>
                  </div>
                  <div className={centeredMetricTileClass}>
                    <p className="text-xs text-muted-foreground uppercase">Faulty</p>
                    <p className="text-xl font-semibold">{monitoringSegmentStats.faultySensors}</p>
                  </div>
                  <div className={centeredMetricTileClass}>
                    <p className="text-xs text-muted-foreground uppercase">Maintenance</p>
                    <p className="text-xl font-semibold">{monitoringSegmentStats.maintenanceRequired}</p>
                  </div>
                </div>
                <div className={`${outlineBlockClass} space-y-2`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground uppercase">System status</p>
                    <Badge variant={getBadgeVariant(monitoringSegmentStats.healthStatus)}>
                      {monitoringSegmentStats.healthStatus}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Checked: {monitoringSegmentStats.healthCheckedAt}</p>
                  <p className="text-xs text-muted-foreground">
                    Avg battery: {monitoringSegmentStats.avgBatteryLevel !== null ? `${monitoringSegmentStats.avgBatteryLevel}%` : 'N/A'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="dash-panel">
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Metrics Window</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Operational totals for selected period</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className={`${outlineBlockClass} flex items-center justify-between gap-3`}>
                  <p className="text-sm">Sensor Readings</p>
                  <span className="font-medium">{monitoringSegmentStats.sensorReadings}</span>
                </div>
                <div className={`${outlineBlockClass} flex items-center justify-between gap-3`}>
                  <p className="text-sm">Recommendations</p>
                  <span className="font-medium">{monitoringSegmentStats.recommendationsGenerated}</span>
                </div>
                <div className={`${outlineBlockClass} flex items-center justify-between gap-3`}>
                  <p className="text-sm">Messages</p>
                  <span className="font-medium">{monitoringSegmentStats.messagesSent}</span>
                </div>
                <div className={`${outlineBlockClass} flex items-center justify-between gap-3`}>
                  <p className="text-sm">Errors</p>
                  <span className="font-medium">{monitoringSegmentStats.errors}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === 'reports' && (
        <div className={workspaceGridClass}>
          <Card className={`${workspaceMainClass} dash-panel`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet size={20} />
                Reports
              </CardTitle>
              <CardDescription>Generate exportable system reports</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleGenerateReport}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select
                    className={roundedSelectClass}
                    value={reportType}
                    onChange={(event) =>
                      setReportType(
                        event.target.value as 'summary' | 'users' | 'farms' | 'sensors' | 'recommendations' | 'farm-issues' | 'pest-detections' | 'pest-control'
                      )
                    }
                  >
                    <option value="summary">Summary</option>
                    <option value="users">Users</option>
                    <option value="farms">Farms</option>
                    <option value="sensors">Sensors</option>
                    <option value="recommendations">Recommendations</option>
                    <option value="farm-issues">Farm Issues</option>
                    <option value="pest-detections">Pest Detections</option>
                    <option value="pest-control">Pest Control</option>
                  </select>
                  <select
                    className={roundedSelectClass}
                    value={reportFormat}
                    onChange={(event) => setReportFormat(event.target.value as 'json' | 'csv')}
                  >
                    <option value="json">JSON</option>
                    <option value="csv">CSV</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input type="date" value={reportStartDate} onChange={(event) => setReportStartDate(event.target.value)} />
                  <Input type="date" value={reportEndDate} onChange={(event) => setReportEndDate(event.target.value)} />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={generateReportMutation.isPending}>
                    {generateReportMutation.isPending ? 'Generating...' : 'Generate Report'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setReportType('summary');
                      setReportFormat('json');
                      setReportStartDate('');
                      setReportEndDate('');
                    }}
                  >
                    Reset Report Options
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className={workspaceRailClass}>
            <Card className="dash-panel">
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Report Snapshot</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Current export configuration before generation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className={outlineBlockClass}>
                  <p className="text-xs text-muted-foreground uppercase">Type</p>
                  <p className="font-medium capitalize">{reportSegmentStats.type.replace('-', ' ')}</p>
                </div>
                <div className={outlineBlockClass}>
                  <p className="text-xs text-muted-foreground uppercase">Format</p>
                  <p className="font-medium uppercase">{reportSegmentStats.format}</p>
                </div>
                <div className={outlineBlockClass}>
                  <p className="text-xs text-muted-foreground uppercase">Window</p>
                  <p className="text-sm font-medium">{reportSegmentStats.windowLabel}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === 'broadcast' && (
        <div className={workspaceGridClass}>
          <div className={workspaceMainStackClass}>
            <Card className="dash-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send size={20} />
                  Broadcast Message
                </CardTitle>
                <CardDescription>Send operational updates to a chosen role or to every active user at once</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleSendBroadcast}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <select
                      className={roundedSelectClass}
                      value={broadcastRole}
                      onChange={(event) => setBroadcastRole(event.target.value as 'all' | UserRole)}
                    >
                      <option value="all">All roles</option>
                      <option value="farmer">Farmers</option>
                      <option value="expert">Experts</option>
                      <option value="admin">Admins</option>
                    </select>
                    <select
                      className={roundedSelectClass}
                      value={broadcastChannel}
                      onChange={(event) => setBroadcastChannel(event.target.value as 'sms' | 'push' | 'email' | 'all')}
                    >
                      <option value="sms">SMS</option>
                      <option value="push">Push</option>
                      <option value="email">Email</option>
                      <option value="all">All channels</option>
                    </select>
                  </div>

                  <textarea
                    className={textAreaClass}
                    placeholder="Message (English)"
                    value={broadcastMessage}
                    onChange={(event) => setBroadcastMessage(event.target.value)}
                  />
                  <textarea
                    className={textAreaClass}
                    placeholder="Message (Kinyarwanda, optional)"
                    value={broadcastMessageRw}
                    onChange={(event) => setBroadcastMessageRw(event.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={sendBroadcastMutation.isPending || !broadcastMessage.trim()}>
                      {sendBroadcastMutation.isPending ? 'Queueing...' : 'Queue Broadcast'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleProcessNotificationQueue}
                      disabled={processNotificationQueueMutation.isPending}
                    >
                      {processNotificationQueueMutation.isPending ? 'Processing queue...' : 'Process Queue Now'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setBroadcastMessage('');
                        setBroadcastMessageRw('');
                        setBroadcastRole('all');
                        setBroadcastChannel('sms');
                      }}
                    >
                      Reset Broadcast Draft
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="dash-panel">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className={sectionTitleClass}>Delivery Queue Inspector</CardTitle>
                    <CardDescription className={sectionDescriptionClass}>
                      Review queued and failed outbound messages for SMS and email delivery.
                    </CardDescription>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => notificationQueueQuery.refetch()}>
                    Refresh Queue
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {notificationQueueQuery.isLoading ? (
                  <LoadingState text="Loading notification queue..." />
                ) : notificationQueueQuery.error ? (
                  <ErrorState
                    title="Failed to load delivery queue"
                    message="Please retry."
                    onRetry={notificationQueueQuery.refetch}
                  />
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="space-y-3 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold">Queued Outbound Messages</h3>
                          <p className="text-xs text-muted-foreground">Waiting for SMS or email processing.</p>
                        </div>
                        <Badge variant="outline">{notificationQueueSnapshot?.counts?.queued ?? 0}</Badge>
                      </div>
                      {filteredQueuedMessages.length === 0 ? (
                        <div className={outlineBlockClass}>
                          <p className="text-sm font-medium">No queued outbound messages</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            New SMS or email broadcasts will appear here until the queue processor runs.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredQueuedMessages.map((message: any) => (
                            <div key={message.id} className={outlineBlockClass}>
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="space-y-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" className="uppercase">{message.channel}</Badge>
                                    <span className="text-xs text-muted-foreground break-all">{message.recipient}</span>
                                  </div>
                                  <p className="text-sm font-medium break-words">
                                    {truncateText(message.subject || message.content || 'Queued notification')}
                                  </p>
                                  <p className="text-xs text-muted-foreground break-words">
                                    {truncateText(message.content || 'No content preview available', 120)}
                                  </p>
                                </div>
                                <div className="text-right text-xs text-muted-foreground">
                                  <p>{toDateString(message.createdAt)}</p>
                                  <p>Retries: {message.retryCount}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold">Failed Delivery Candidates</h3>
                          <p className="text-xs text-muted-foreground">Retryable failures returned by the backend queue view.</p>
                        </div>
                        <Badge variant="destructive">{notificationQueueSnapshot?.counts?.failed ?? 0}</Badge>
                      </div>
                      {filteredFailedMessages.length === 0 ? (
                        <div className={outlineBlockClass}>
                          <p className="text-sm font-medium">No retryable failed messages</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Failed SMS or email items with retries remaining will appear here.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredFailedMessages.map((message: any) => (
                            <div key={message.id} className={outlineBlockClass}>
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="space-y-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="destructive" className="uppercase">{message.channel}</Badge>
                                    <span className="text-xs text-muted-foreground break-all">{message.recipient}</span>
                                  </div>
                                  <p className="text-sm font-medium break-words">
                                    {truncateText(message.subject || message.content || 'Failed notification')}
                                  </p>
                                  <p className="text-xs text-rose-600 dark:text-rose-300 break-words">
                                    {truncateText(message.failedReason || 'Delivery failed without a detailed reason.', 120)}
                                  </p>
                                </div>
                                <div className="text-right text-xs text-muted-foreground">
                                  <p>{toDateString(message.createdAt)}</p>
                                  <p>Retries: {message.retryCount}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className={workspaceRailClass}>
            <Card className="dash-panel">
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Broadcast Snapshot</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Live preview of target and draft payload size</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className={outlineBlockClass}>
                  <p className="text-xs text-muted-foreground uppercase">Target role</p>
                  <p className="font-medium capitalize">{broadcastSegmentStats.targetRole}</p>
                </div>
                <div className={outlineBlockClass}>
                  <p className="text-xs text-muted-foreground uppercase">Channel</p>
                  <p className="font-medium uppercase">{broadcastSegmentStats.channel}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className={centeredMetricTileClass}>
                    <p className="text-xs text-muted-foreground uppercase">EN chars</p>
                    <p className="text-xl font-semibold">{broadcastSegmentStats.englishLength}</p>
                  </div>
                  <div className={centeredMetricTileClass}>
                    <p className="text-xs text-muted-foreground uppercase">RW chars</p>
                    <p className="text-xl font-semibold">{broadcastSegmentStats.kinyarwandaLength}</p>
                  </div>
                </div>
                <div className={outlineBlockClass}>
                  <p className="text-xs text-muted-foreground uppercase">Total payload</p>
                  <p className="text-xl font-semibold">{broadcastSegmentStats.totalLength}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {broadcastSegmentStats.hasDraft ? 'Draft ready to queue' : 'No message drafted yet'}
                  </p>
                </div>
                <div className={outlineBlockClass}>
                  <p className="text-xs text-muted-foreground uppercase">Queue runner</p>
                  {notificationQueueResult ? (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        Processed {notificationQueueResult.processed}, sent {notificationQueueResult.sent}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Failed {notificationQueueResult.failed}, retried {notificationQueueResult.retried}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Use this when SMS or email broadcasts are queued and local scheduled tasks are disabled.
                    </p>
                  )}
                </div>
                <div className={outlineBlockClass}>
                  <p className="text-xs text-muted-foreground uppercase">Queue snapshot</p>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className={centeredMetricTileClass}>
                      <p className="text-xs text-muted-foreground uppercase">Queued</p>
                      <p className="text-xl font-semibold">{notificationQueueSnapshot?.counts?.queued ?? 0}</p>
                    </div>
                    <div className={centeredMetricTileClass}>
                      <p className="text-xs text-muted-foreground uppercase">Failed</p>
                      <p className="text-xl font-semibold">{notificationQueueSnapshot?.counts?.failed ?? 0}</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className={softBlockClass}>
                      <p className="text-xs text-muted-foreground uppercase">Queued by channel</p>
                      <p className="mt-1 text-sm font-medium break-words">
                        {Object.entries(notificationQueueSnapshot?.counts?.queuedByChannel || {})
                          .map(([channel, count]) => `${channel}: ${count}`)
                          .join(' • ') || 'No queued outbound items'}
                      </p>
                    </div>
                    <div className={softBlockClass}>
                      <p className="text-xs text-muted-foreground uppercase">Failed by channel</p>
                      <p className="mt-1 text-sm font-medium break-words">
                        {Object.entries(notificationQueueSnapshot?.counts?.failedByChannel || {})
                          .map(([channel, count]) => `${channel}: ${count}`)
                          .join(' • ') || 'No retryable failures'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      {/* ===== Analytics Tab ===== */}
      {tab === 'analytics' && (
        <AdminAnalyticsPanel searchQuery={normalizedExternalSearch} />
      )}

      {/* ===== Irrigation Tab ===== */}
      {tab === 'irrigation' && (
        <section className={sectionShellClass}>
          <ScheduleInsightsPanel
            resource="irrigation"
            role="admin"
            farms={resourceFarms}
            title="Platform Irrigation"
            description="Water usage is grouped by district so administrators can compare irrigation load across the platform."
            emptyTitle="No irrigation schedules available"
            emptyMessage="No irrigation schedules are available yet across the current admin farm scope."
            maxFarms={100}
          />
        </section>
      )}

      {/* ===== Fertilization Tab ===== */}
      {tab === 'fertilization' && (
        <section className={sectionShellClass}>
          <ScheduleInsightsPanel
            resource="fertilization"
            role="admin"
            farms={resourceFarms}
            title="Platform Fertilization"
            description="Fertilizer usage is grouped by district so administrators can compare nutrient activity across the platform."
            emptyTitle="No fertilization schedules available"
            emptyMessage="No fertilization schedules are available yet across the current admin farm scope."
            maxFarms={100}
          />
        </section>
      )}

      {/* ===== Map View Tab ===== */}
      {tab === 'map-view' && (
        <AdminMapViewPanel
          farms={mapViewFarms}
          pagination={mapViewFarmPagination}
          isLoading={mapViewFarmsQuery.isLoading}
        />
      )}

      {/* ===== Content Tab ===== */}
      {tab === 'content' && (
        <AdminContentPanel searchQuery={normalizedExternalSearch} />
      )}

      {/* ===== USSD Monitor Tab ===== */}
      {tab === 'ussd' && (
        <AdminUssdPanel />
      )}
    </div>
  );
}

function AdminMapViewPanel({
  farms,
  pagination,
  isLoading,
}: {
  farms: any[];
  pagination?: {
    page?: number;
    totalPages?: number;
    total?: number;
    limit?: number;
  };
  isLoading: boolean;
}) {
  const [allFarms, setAllFarms] = useState<any[]>(farms);
  const [allFarmsLoading, setAllFarmsLoading] = useState(false);
  const [sensorCoordinateFallbacks, setSensorCoordinateFallbacks] = useState<Record<string, { lat: number; lng: number }>>({});
  const [sensorCoordinateLoading, setSensorCoordinateLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const totalPages = Number(pagination?.totalPages || 1);

    if (!Number.isFinite(totalPages) || totalPages <= 1) {
      setAllFarms(farms);
      setAllFarmsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setAllFarmsLoading(true);

    void (async () => {
      try {
        const remainingPages = Array.from({ length: totalPages - 1 }, (_, index) => index + 2);
        const responses = await Promise.all(
          remainingPages.map((page) => adminService.getAllFarms({ page, limit: 100 }))
        );

        if (cancelled) return;

        const mergedFarms = [farms, ...responses.map((response) => response.data || [])].flat();
        const dedupedFarms = Array.from(
          new Map(
            mergedFarms
              .filter((farm: any) => farm?.id)
              .map((farm: any) => [String(farm.id), farm])
          ).values()
        );

        setAllFarms(dedupedFarms);
      } catch {
        if (cancelled) return;
        setAllFarms(farms);
      } finally {
        if (!cancelled) {
          setAllFarmsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [farms, pagination?.totalPages]);

  useEffect(() => {
    let cancelled = false;

    const farmsNeedingFallback = allFarms.filter((farm: any) => !getFarmMapCoordinates(farm) && farm?.id);

    if (!farmsNeedingFallback.length) {
      setSensorCoordinateFallbacks({});
      setSensorCoordinateLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setSensorCoordinateLoading(true);

    void (async () => {
      const fallbackEntries = await Promise.all(
        farmsNeedingFallback.map(async (farm: any) => {
          try {
            const response = await sensorService.getByFarm(String(farm.id));
            const sensors = Array.isArray(response.data) ? response.data : [];
            const mappedSensor = sensors.find(
              (sensor) =>
                (typeof sensor.coordinates?.lat === 'number' && typeof sensor.coordinates?.lng === 'number')
                || (typeof (sensor as any).latitude === 'number' && typeof (sensor as any).longitude === 'number')
            );
            const fallbackCoordinates =
              typeof mappedSensor?.coordinates?.lat === 'number' && typeof mappedSensor?.coordinates?.lng === 'number'
                ? mappedSensor.coordinates
                : typeof (mappedSensor as any)?.latitude === 'number' && typeof (mappedSensor as any)?.longitude === 'number'
                  ? { lat: (mappedSensor as any).latitude, lng: (mappedSensor as any).longitude }
                  : undefined;

            return fallbackCoordinates ? [String(farm.id), fallbackCoordinates] as const : null;
          } catch {
            return null;
          }
        })
      );

      if (cancelled) return;

      setSensorCoordinateFallbacks(
        Object.fromEntries(
          fallbackEntries.filter(
            (entry): entry is readonly [string, { lat: number; lng: number }] => Array.isArray(entry)
          )
        )
      );
      setSensorCoordinateLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [allFarms]);

  const farmMarkers = useMemo<MapboxMarkerData[]>(
    () =>
      allFarms.flatMap((farm: any) => {
        const coordinates = getFarmMapCoordinates(farm) || sensorCoordinateFallbacks[String(farm.id)];
        const latitude = coordinates?.lat;
        const longitude = coordinates?.lng;

        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
          return [];
        }

        return [{
          id: `farm-${farm.id}`,
          latitude,
          longitude,
          label: farm.name || 'Farm',
          badge: farm.cropVariety || 'Farm',
          description: farm.locationName || farm.district?.name || 'Mapped farm',
          tone: 'success',
        }];
      }),
    [allFarms, sensorCoordinateFallbacks]
  );
  const outbreakMap: any = null;
  const outbreakMarkers = useMemo<MapboxMarkerData[]>(
    () =>
      (outbreakMap?.detections || []).flatMap((detection: any) => {
        const latitude = detection.coordinates?.lat;
        const longitude = detection.coordinates?.lng;

        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
          return [];
        }

        const severity = String(detection.severity || 'low');
        const tone: MapboxMarkerTone =
          severity === 'severe' || severity === 'high'
            ? 'danger'
            : severity === 'medium'
              ? 'warning'
              : 'success';

        return [{
          id: `outbreak-${detection.id}`,
          latitude,
          longitude,
          label: detection.pestType || 'Outbreak detection',
          badge: `${severity} severity`,
          description: `${detection.farm?.name || detection.locationDescription || 'Unknown location'} • ${new Date(detection.createdAt).toLocaleDateString()}`,
          tone,
        }];
      }),
    [outbreakMap?.detections]
  );
  const combinedMarkers = [...farmMarkers, ...outbreakMarkers];
  const districtCoverage = useMemo(() => {
    return new Set(
      allFarms
        .map((farm: any) => farm.district?.name || farm.districtId || farm.district_id)
        .filter(Boolean)
    ).size;
  }, [allFarms]);
  const topDistricts = useMemo(() => {
    const districtCounts = new Map<string, number>();

    allFarms.forEach((farm: any) => {
      const districtName = farm.district?.name || farm.districtId || farm.district_id;
      if (!districtName) return;
      districtCounts.set(districtName, (districtCounts.get(districtName) || 0) + 1);
    });

    return Array.from(districtCounts.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4);
  }, [allFarms]);

  const nationwideMapLoading = isLoading || allFarmsLoading || sensorCoordinateLoading;

  return (
    <div className={workspaceGridClass}>
      <Card className={`${workspaceMainClass} dash-panel`}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart2 size={20} className="text-primary" />
            National Farmer Map
          </CardTitle>
          <CardDescription>Review all mapped farmer locations across the country from one admin workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          {nationwideMapLoading ? (
            <LoadingState text="Resolving farm and sensor locations for the national map..." />
          ) : (
            <MapboxMap
              markers={farmMarkers}
              fitToMarkers={farmMarkers.length > 0}
              mapClassName="h-[500px]"
              emptyTitle="No mapped farmer records yet"
              emptyMessage="No farm or sensor coordinates were returned for the current admin farm list."
              tokenMissingMessage="Add VITE_MAPBOX_ACCESS_TOKEN to enable the admin map workspace."
            />
          )}
        </CardContent>
      </Card>

      <div className={workspaceRailClass}>
        <Card className="dash-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Map Snapshot</CardTitle>
            <CardDescription>Current nationwide farm coverage and coordinate readiness</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className={outlineBlockClass}>
              <p className="text-xs text-muted-foreground uppercase">Mapped farms</p>
              <p className="text-lg font-semibold">{farmMarkers.length}</p>
            </div>
            <div className={outlineBlockClass}>
              <p className="text-xs text-muted-foreground uppercase">Unmapped farms</p>
              <p className="text-lg font-semibold">{Math.max(allFarms.length - farmMarkers.length, 0)}</p>
            </div>
            <div className={outlineBlockClass}>
              <p className="text-xs text-muted-foreground uppercase">District coverage</p>
              <p className="text-lg font-semibold">{districtCoverage}</p>
            </div>
            {nationwideMapLoading ? (
              <LoadingState text="Loading platform map coverage..." size="sm" />
            ) : topDistricts.length ? (
              <div className="space-y-2">
                {topDistricts.map(([district, farmCount]) => (
                  <div key={district} className="dash-outline-block flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{district}</p>
                      <p className="text-xs text-muted-foreground">Mapped farmer records in this district</p>
                    </div>
                    <Badge variant="outline">{farmCount}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No mapped districts yet" message="No farm or sensor coordinates are available right now." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------- Admin Analytics Panel ----------
function AdminAnalyticsPanel({ searchQuery = '' }: { searchQuery?: string }) {
  const { data: systemStats, isLoading: systemLoading } = useSystemAnalytics();
  const { data: districts, isLoading: districtsLoading } = useAllDistrictsAnalytics();
  const exportAnalyticsData = useExportAnalyticsData();
  const recommendationWindowStart = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString();
  }, []);
  const [analyticsExportType, setAnalyticsExportType] = useState<'farms' | 'sensors' | 'recommendations' | 'pest-detections'>('recommendations');
  const [analyticsExportFormat, setAnalyticsExportFormat] = useState<'json' | 'csv'>('json');
  const [analyticsExportStartDate, setAnalyticsExportStartDate] = useState('');
  const [analyticsExportEndDate, setAnalyticsExportEndDate] = useState('');
  const { data: alertStats, isLoading: alertStatsLoading } = useAlertStatistics({
    startDate: recommendationWindowStart,
  });
  const districtsQuery = useDistricts(true);
  const { data: pestControlActivity, isLoading: pestControlActivityLoading } = useRecentActivityAnalytics({
    hours: 168,
    limit: 12,
    type: 'pest_control',
  });
  const expertUsersQuery = useUsers(
    {
      page: 1,
      limit: 100,
      role: 'expert',
      status: 'active',
    },
    true
  );
  const [issueStatusFilter, setIssueStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('open');
  const [issuePage, setIssuePage] = useState(1);
  const [selectedIssueId, setSelectedIssueId] = useState('');
  const [issueAssignments, setIssueAssignments] = useState<Record<string, string>>({});
  const { data: recommendationStats, isLoading: recommendationStatsLoading } = useRecommendationStatistics({
    startDate: recommendationWindowStart,
  });
  const { data: outbreakMap, isLoading: outbreakMapLoading } = usePestOutbreakMap({ days: 30 });
  const {
    data: allFarmIssuesResponse,
    isLoading: farmIssuesLoading,
    refetch: refetchFarmIssues,
  } = useAllFarmIssues({
    page: issuePage,
    limit: 12,
    status: issueStatusFilter === 'all' ? undefined : issueStatusFilter,
  });
  const selectedIssueQuery = useFarmIssue(selectedIssueId, !!selectedIssueId);
  const updateFarmIssue = useUpdateFarmIssue();
  const s = systemStats as any;
  const farmIssues = allFarmIssuesResponse?.data || [];
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const selectedIssue = selectedIssueQuery.data as any;
  const assignableExperts = expertUsersQuery.data?.data || [];
  const assignmentDistricts = districtsQuery.data || [];
  const districtNameById = useMemo(
    () =>
      new Map(
        assignmentDistricts.map((district: any) => [String(district.id), district.name])
      ),
    [assignmentDistricts]
  );
  const filteredAnalyticsDistricts = useMemo(() => {
    const source = Array.isArray(districts) ? districts : [];
    if (!normalizedSearch) return source;
    return source.filter((district: any) =>
      matchesSearchTerm(normalizedSearch, [
        district.district,
        district.name,
        district.region,
      ])
    );
  }, [districts, normalizedSearch]);
  const filteredFarmIssues = useMemo(() => {
    if (!normalizedSearch) return farmIssues;
    return farmIssues.filter((issue) =>
      matchesSearchTerm(normalizedSearch, [
        issue.title,
        issue.description,
        issue.category,
        issue.severity,
        issue.status,
        issue.farm?.name,
        issue.assignee?.firstName,
        issue.assignee?.email,
      ])
    );
  }, [farmIssues, normalizedSearch]);
  const issueSummary = useMemo(() => {
    return filteredFarmIssues.reduce(
      (acc, issue) => {
        acc.total += 1;
        acc.byStatus[issue.status] = (acc.byStatus[issue.status] || 0) + 1;
        acc.bySeverity[issue.severity] = (acc.bySeverity[issue.severity] || 0) + 1;
        return acc;
      },
      {
        total: 0,
        byStatus: {} as Record<string, number>,
        bySeverity: {} as Record<string, number>,
      }
    );
  }, [filteredFarmIssues]);
  useEffect(() => {
    if (!selectedIssueId && filteredFarmIssues.length > 0) {
      setSelectedIssueId(filteredFarmIssues[0].id);
      return;
    }
    if (selectedIssueId && filteredFarmIssues.length > 0 && !filteredFarmIssues.some((issue) => issue.id === selectedIssueId)) {
      setSelectedIssueId(filteredFarmIssues[0].id);
    }
  }, [filteredFarmIssues, selectedIssueId]);
  const pestControlSummary = useMemo(() => {
    return (pestControlActivity?.activities || []).reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.title === 'Pest Control Executed' || item.status === 'executed') {
          acc.executed += 1;
        } else {
          acc.scheduled += 1;
        }
        return acc;
      },
      { total: 0, scheduled: 0, executed: 0 }
    );
  }, [pestControlActivity]);
  const outbreakSummary = useMemo(() => {
    const districts = (outbreakMap?.byDistrict || []).filter((district: any) =>
      matchesSearchTerm(normalizedSearch, [district.district])
    );
    const severeSignals = districts.reduce(
      (total, item) => total + Number(item.severity?.high || 0) + Number(item.severity?.severe || 0),
      0
    );
    return {
      totalDetections: outbreakMap?.detections?.length || 0,
      affectedDistricts: districts.length,
      topDistrict: districts[0]?.district || 'N/A',
      severeSignals,
    };
  }, [normalizedSearch, outbreakMap]);
  const outbreakMarkers = useMemo<MapboxMarkerData[]>(
    () =>
      (outbreakMap?.detections || []).flatMap((detection: any) => {
        const latitude = detection.coordinates?.lat;
        const longitude = detection.coordinates?.lng;

        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
          return [];
        }

        const severity = String(detection.severity || 'low');
        const tone: MapboxMarkerTone =
          severity === 'severe' || severity === 'high'
            ? 'danger'
            : severity === 'medium'
              ? 'warning'
              : 'success';

        return [{
          id: detection.id,
          latitude,
          longitude,
          label: detection.pestType || 'Pest detection',
          badge: `${severity} severity`,
          description: `${detection.farm?.name || detection.locationDescription || 'Unknown location'} • ${new Date(detection.createdAt).toLocaleDateString()}`,
          tone,
        }];
      }),
    [outbreakMap?.detections]
  );

  const analyticsSnapshot = useMemo(() => {
    return {
      totalUsers: s?.userCount ?? s?.totalUsers ?? 0,
      totalFarms: s?.farmCount ?? s?.totalFarms ?? 0,
      totalSensors: s?.sensorCount ?? s?.totalSensors ?? 0,
      recommendations: s?.recommendationCount ?? s?.totalRecommendations ?? 0,
      openIssues: issueSummary.byStatus.open || 0,
      severeSignals: outbreakSummary.severeSignals,
      districtsTracked: filteredAnalyticsDistricts.length,
    };
  }, [filteredAnalyticsDistricts.length, issueSummary.byStatus.open, outbreakSummary.severeSignals, s]);
  const analyticsSearchScopeItems: SearchScopeItem[] = normalizedSearch
    ? [
        { label: 'Issues', value: filteredFarmIssues.length, total: farmIssues.length },
        {
          label: 'Districts',
          value: filteredAnalyticsDistricts.length,
          total: Array.isArray(districts) ? districts.length : 0,
        },
        {
          label: 'Outbreak Rows',
          value: outbreakSummary.affectedDistricts,
          total: Array.isArray(outbreakMap?.byDistrict) ? outbreakMap.byDistrict.length : 0,
        },
      ]
    : [];

  const handleIssueUpdate = async (
    issue: any,
    updates: {
      status?: 'in_progress' | 'resolved' | 'closed';
      assignedTo?: string;
      expertNotes?: string;
      resolutionNotes?: string;
    }
  ) => {
    try {
      await updateFarmIssue.mutateAsync({
        id: issue.id,
        farmId: issue.farmId,
        data: {
          status: updates.status,
          assignedTo: updates.assignedTo,
          expertNotes: updates.expertNotes,
          resolutionNotes: updates.resolutionNotes,
        },
      });
      if (updates.assignedTo) {
        setIssueAssignments((current) => ({
          ...current,
          [issue.id]: updates.assignedTo || '',
        }));
      }
    } catch {
      // Mutation hook surfaces the error.
    }
  };

  const handleExportAnalytics = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const blob = await exportAnalyticsData.mutateAsync({
        type: analyticsExportType,
        format: analyticsExportFormat,
        startDate: analyticsExportStartDate || undefined,
        endDate: analyticsExportEndDate || undefined,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `admin-${analyticsExportType}-analytics.${analyticsExportFormat}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Error notification handled in mutation hook.
    }
  };

  return (
    <div className={workspaceGridClass}>
      {normalizedSearch && (
        <div className="lg:col-span-12">
          <div className={filterBarClass}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="dash-pill bg-sky-100 text-sky-800 dark:bg-sky-900/35 dark:text-sky-300">
                Analytics Filter: "{searchQuery.trim()}"
              </span>
              <SearchScopePills items={analyticsSearchScopeItems} accent="sky" />
            </div>
          </div>
        </div>
      )}
      <div className={workspaceMainWideStackClass}>
      <Card className="dash-panel">
        <CardHeader>
          <CardTitle className="text-base">Analytics Export</CardTitle>
          <CardDescription>Use the general analytics export endpoint for summary dataset downloads</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleExportAnalytics}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <select
                className={roundedSelectClass}
                value={analyticsExportType}
                onChange={(event) =>
                  setAnalyticsExportType(
                    event.target.value as 'farms' | 'sensors' | 'recommendations' | 'pest-detections'
                  )
                }
              >
                <option value="farms">Farms</option>
                <option value="sensors">Sensors</option>
                <option value="recommendations">Recommendations</option>
                <option value="pest-detections">Pest Detections</option>
              </select>
              <select
                className={roundedSelectClass}
                value={analyticsExportFormat}
                onChange={(event) => setAnalyticsExportFormat(event.target.value as 'json' | 'csv')}
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
              <Input
                type="date"
                value={analyticsExportStartDate}
                onChange={(event) => setAnalyticsExportStartDate(event.target.value)}
              />
              <Input
                type="date"
                value={analyticsExportEndDate}
                onChange={(event) => setAnalyticsExportEndDate(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={exportAnalyticsData.isPending}>
              {exportAnalyticsData.isPending ? 'Exporting...' : 'Export Analytics Summary'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="dash-panel">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart2 size={20} className="text-primary" />
            System-Wide Analytics
          </CardTitle>
          <CardDescription>Aggregated data across all farms, users, and sensors</CardDescription>
        </CardHeader>
        <CardContent>
          {systemLoading ? (
            <LoadingState text="Loading system analytics..." size="sm" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Users', value: s?.userCount ?? s?.totalUsers ?? '--' },
                { label: 'Total Farms', value: s?.farmCount ?? s?.totalFarms ?? '--' },
                { label: 'Total Sensors', value: s?.sensorCount ?? s?.totalSensors ?? '--' },
                { label: 'Recommendations', value: s?.recommendationCount ?? s?.totalRecommendations ?? '--' },
              ].map((stat, index) => (
                <div 
                  key={stat.label} 
                  className={`${index === 0 ? 'dash-metric-tile dash-metric-tile-accent' : 'dash-metric-tile'} flex flex-col justify-center p-4 sm:p-5`}
                >
                  <p className={`text-3xl font-bold ${index === 0 ? '' : 'text-slate-900 dark:text-white'}`}>
                    {String(stat.value)}
                  </p>
                  <p className={`text-xs mt-1 font-medium ${index === 0 ? 'text-white/80' : 'text-slate-500'}`}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="dash-panel">
        <CardHeader>
          <CardTitle className="text-base">Recommendation Response Overview</CardTitle>
          <CardDescription>System-wide farmer response behavior over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          {recommendationStatsLoading ? (
            <LoadingState text="Loading recommendation response analytics..." size="sm" />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-4">
                <div className="dash-metric-tile text-center">
                  <p className="text-2xl font-bold">{recommendationStats?.total ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Recommendations</p>
                </div>
                <div className="dash-metric-tile text-center">
                  <p className="text-2xl font-bold">
                    {typeof recommendationStats?.responseRate === 'number'
                      ? `${Math.round(recommendationStats.responseRate)}%`
                      : '0%'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Response Rate</p>
                </div>
                <div className="dash-metric-tile text-center">
                  <p className="text-2xl font-bold">
                    {typeof recommendationStats?.acceptanceRate === 'number'
                      ? `${Math.round(recommendationStats.acceptanceRate)}%`
                      : '0%'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Acceptance Rate</p>
                </div>
                <div className="dash-metric-tile text-center">
                  <p className="text-2xl font-bold">
                    {typeof recommendationStats?.avgResponseTime === 'number'
                      ? `${recommendationStats.avgResponseTime}h`
                      : 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Avg Response Time</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="dash-detail-card">
                  <p className="font-medium">Response Channels</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(recommendationStats?.byChannel || {}).length > 0 ? (
                      Object.entries(recommendationStats?.byChannel || {}).map(([channel, count]) => (
                        <Badge key={channel} variant="outline">
                          {channel}: {count}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No response channels recorded yet.</p>
                    )}
                  </div>
                </div>

                <div className="dash-detail-card">
                  <p className="font-medium">Status Breakdown</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(recommendationStats?.byStatus || {}).length > 0 ? (
                      Object.entries(recommendationStats?.byStatus || {}).map(([status, count]) => (
                        <Badge key={status} variant="outline">
                          {status}: {count}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No recommendation activity recorded yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="dash-panel">
        <CardHeader>
          <CardTitle className="text-base">Pest Outbreak Watch</CardTitle>
          <CardDescription>System-wide outbreak signals from the backend outbreak-map endpoint</CardDescription>
        </CardHeader>
        <CardContent>
          {outbreakMapLoading ? (
            <LoadingState text="Loading outbreak signals..." size="sm" />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-4">
                <div className="dash-metric-tile text-center">
                  <p className="text-2xl font-bold">{outbreakSummary.totalDetections}</p>
                  <p className="text-xs text-muted-foreground mt-1">Detections</p>
                </div>
                <div className="dash-metric-tile text-center">
                  <p className="text-2xl font-bold">{outbreakSummary.affectedDistricts}</p>
                  <p className="text-xs text-muted-foreground mt-1">Districts Affected</p>
                </div>
                <div className="dash-metric-tile text-center">
                  <p className="text-2xl font-bold">{outbreakSummary.severeSignals}</p>
                  <p className="text-xs text-muted-foreground mt-1">High + Severe Signals</p>
                </div>
                <div className="dash-metric-tile text-center">
                  <p className="text-lg font-bold">{outbreakSummary.topDistrict}</p>
                  <p className="text-xs text-muted-foreground mt-1">Top District</p>
                </div>
              </div>

              <MapboxMap
                markers={outbreakMarkers}
                mapClassName="h-[340px]"
                emptyTitle="No mapped outbreak detections"
                emptyMessage="Outbreak detections need coordinates before they can be plotted on the admin map."
                tokenMissingMessage="Add VITE_MAPBOX_ACCESS_TOKEN to render the system outbreak map."
              />

              {outbreakMap?.byDistrict?.length ? (
                <div className="space-y-2">
                  {outbreakMap.byDistrict.slice(0, 5).map((district) => (
                    <div key={district.district} className="dash-subtile flex items-center justify-between">
                      <div>
                        <p className="font-medium">{district.district}</p>
                        <p className="text-xs text-muted-foreground">
                          High + severe: {(district.severity?.high || 0) + (district.severity?.severe || 0)}
                        </p>
                      </div>
                      <Badge variant="outline">{district.count} detections</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No outbreak activity"
                  message="No outbreak-map detections were returned in the current reporting window."
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="dash-panel">
        <CardHeader>
          <CardTitle className="text-base">Pest Control Operations</CardTitle>
          <CardDescription>System-wide pest-control follow-through over the last 7 days.</CardDescription>
        </CardHeader>
        <CardContent>
          {pestControlActivityLoading ? (
            <LoadingState text="Loading pest control operations..." size="sm" />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-3">
                <div className="dash-metric-tile text-center">
                  <p className="text-2xl font-bold">{pestControlSummary.total}</p>
                  <p className="text-xs text-muted-foreground mt-1">Logged Operations</p>
                </div>
                <div className="dash-metric-tile text-center">
                  <p className="text-2xl font-bold">{pestControlSummary.scheduled}</p>
                  <p className="text-xs text-muted-foreground mt-1">Scheduled</p>
                </div>
                <div className="dash-metric-tile text-center">
                  <p className="text-2xl font-bold">{pestControlSummary.executed}</p>
                  <p className="text-xs text-muted-foreground mt-1">Executed</p>
                </div>
              </div>

              {Array.isArray(pestControlActivity?.activities) && pestControlActivity.activities.length > 0 ? (
                <div className="space-y-2">
                  {pestControlActivity.activities.slice(0, 5).map((item) => (
                    <div key={item.id} className="dash-subtile">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-sm">{item.title}</p>
                            <Badge variant="outline">{formatActivityLabel(item.type)}</Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                        </div>
                        <div className="text-right">
                          {item.status && <Badge variant="outline">{item.status}</Badge>}
                          <p className="mt-1 text-xs text-muted-foreground">{toDateString(item.timestamp)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No pest-control activity"
                  message="Scheduled and executed pest-control operations will appear here once farms start using the workflow."
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="dash-panel">
        <CardHeader>
          <CardTitle className="text-base">Alert Statistics</CardTitle>
          <CardDescription>Backend alert metrics over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          {alertStatsLoading ? (
            <LoadingState text="Loading alert statistics..." size="sm" />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-4">
                <div className="dash-metric-tile text-center">
                  <p className="text-2xl font-bold">{alertStats?.totalAlerts ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total Alerts</p>
                </div>
                <div className="dash-metric-tile text-center">
                  <p className="text-2xl font-bold">{alertStats?.criticalAlerts ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Critical Alerts</p>
                </div>
                <div className="dash-metric-tile text-center">
                  <p className="text-2xl font-bold">{alertStats?.resolvedAlerts ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Resolved Alerts</p>
                </div>
                <div className="dash-metric-tile text-center">
                  <p className="text-2xl font-bold">
                    {typeof alertStats?.avgResolutionTime === 'number' ? `${alertStats.avgResolutionTime}h` : 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Avg Resolution</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="dash-detail-card">
                  <p className="font-medium">By Type</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(alertStats?.byType || {}).length > 0 ? (
                      Object.entries(alertStats?.byType || {}).map(([type, count]) => (
                        <Badge key={type} variant="outline">
                          {type}: {count}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No alert type data recorded yet.</p>
                    )}
                  </div>
                </div>

                <div className="dash-detail-card">
                  <p className="font-medium">By District</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(alertStats?.byDistrict || {}).length > 0 ? (
                      Object.entries(alertStats?.byDistrict || {}).map(([district, count]) => (
                        <Badge key={district} variant="outline">
                          {district}: {count}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No district alert data recorded yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="dash-panel">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Farm Issue Oversight</CardTitle>
              <CardDescription>System-wide review queue for farmer-reported issues.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <select
                className={compactSelectClass}
                value={issueStatusFilter}
                onChange={(event) => {
                  setIssueStatusFilter(event.target.value as typeof issueStatusFilter);
                  setIssuePage(1);
                }}
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  refetchFarmIssues();
                  if (selectedIssueId) {
                    selectedIssueQuery.refetch();
                  }
                }}
              >
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {farmIssuesLoading ? (
            <LoadingState text="Loading farm issues..." size="sm" />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-4">
                <div className="dash-metric-tile text-center">
                  <p className="text-2xl font-bold">{allFarmIssuesResponse?.pagination?.total || issueSummary.total}</p>
                  <p className="text-xs text-muted-foreground mt-1">Visible Issues</p>
                </div>
                <div className="dash-metric-tile text-center">
                  <p className="text-2xl font-bold">{issueSummary.byStatus.open || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Open</p>
                </div>
                <div className="dash-metric-tile text-center">
                  <p className="text-2xl font-bold">{issueSummary.byStatus.in_progress || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">In Progress</p>
                </div>
                <div className="dash-metric-tile text-center">
                  <p className="text-2xl font-bold">{(issueSummary.bySeverity.high || 0) + (issueSummary.bySeverity.urgent || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">High / Urgent</p>
                </div>
              </div>

              <Card className="dash-panel">
                <CardHeader>
                  <CardTitle className="text-sm">Selected Issue Detail</CardTitle>
                  <CardDescription>Route-backed detail from the single farm-issue endpoint</CardDescription>
                </CardHeader>
                <CardContent>
                  {!selectedIssueId ? (
                    <EmptyState title="No issue selected" message="Choose an issue from the queue to inspect its full details." />
                  ) : selectedIssueQuery.isLoading ? (
                    <LoadingState text="Loading selected issue..." size="sm" />
                  ) : selectedIssueQuery.error ? (
                    <ErrorState title="Failed to load issue" message="Please retry." onRetry={selectedIssueQuery.refetch} />
                  ) : selectedIssue ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{selectedIssue.title}</p>
                        <Badge variant="outline">{selectedIssue.status}</Badge>
                        <Badge variant="outline">{selectedIssue.category}</Badge>
                        <Badge variant="outline">{selectedIssue.severity}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{selectedIssue.description}</p>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className={softBlockClass}>
                          <p className="text-xs text-muted-foreground uppercase">Farm</p>
                          <p className="font-medium">{selectedIssue.farm?.name || selectedIssue.farmId || 'N/A'}</p>
                        </div>
                        <div className={softBlockClass}>
                          <p className="text-xs text-muted-foreground uppercase">Reporter</p>
                          <p className="font-medium">
                            {selectedIssue.reporter?.firstName || selectedIssue.reporter?.email || selectedIssue.reportedBy || 'N/A'}
                          </p>
                        </div>
                        <div className={softBlockClass}>
                          <p className="text-xs text-muted-foreground uppercase">Location</p>
                          <p className="font-medium">{selectedIssue.locationDescription || 'N/A'}</p>
                        </div>
                        <div className={softBlockClass}>
                          <p className="text-xs text-muted-foreground uppercase">Source Channel</p>
                          <p className="font-medium">{selectedIssue.sourceChannel || 'N/A'}</p>
                        </div>
                        <div className={softBlockClass}>
                          <p className="text-xs text-muted-foreground uppercase">Created</p>
                          <p className="font-medium">{toDateString(selectedIssue.createdAt)}</p>
                        </div>
                        <div className={softBlockClass}>
                          <p className="text-xs text-muted-foreground uppercase">Updated</p>
                          <p className="font-medium">{toDateString(selectedIssue.updatedAt)}</p>
                        </div>
                      </div>
                      {selectedIssue.expertNotes && (
                        <div className={softBlockClass}>
                          <p className="text-xs text-muted-foreground uppercase">Expert Notes</p>
                          <p className="font-medium">{selectedIssue.expertNotes}</p>
                        </div>
                      )}
                      {selectedIssue.resolutionNotes && (
                        <div className={softBlockClass}>
                          <p className="text-xs text-muted-foreground uppercase">Resolution Notes</p>
                          <p className="font-medium">{selectedIssue.resolutionNotes}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <EmptyState title="No issue data" message="The selected issue did not return detail data." />
                  )}
                </CardContent>
              </Card>

              {filteredFarmIssues.length === 0 ? (
                <EmptyState
                  title={normalizedSearch ? 'No matching farm issues' : 'No farm issues'}
                  message={
                    normalizedSearch
                      ? `No farmer-reported issues match "${searchQuery}".`
                      : 'No farmer-reported issues match the selected status filter.'
                  }
                />
              ) : (
                <div className="space-y-3">
                  {filteredFarmIssues.map((issue) => {
                    const farmDistrictId = getFarmDistrictId(issue);
                    const issueDistrictName =
                      issue.farm?.district?.name
                      || (farmDistrictId ? districtNameById.get(String(farmDistrictId)) : undefined)
                      || 'Unknown district';
                    const sameDistrictExperts = assignableExperts.filter((expert: User) => {
                      const expertDistrictId = getUserDistrictId(expert);
                      return !!expertDistrictId && String(expertDistrictId) === String(farmDistrictId || '');
                    });

                    return (
                    <div key={issue.id} className="dash-detail-card">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{issue.title}</p>
                            <Badge variant="outline">{issue.status}</Badge>
                            <Badge variant="outline">{issue.category}</Badge>
                            <Badge
                              className={
                                issue.severity === 'urgent'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                  : issue.severity === 'high'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                    : issue.severity === 'medium'
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                      : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              }
                            >
                              {issue.severity}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{issue.description}</p>
                          <p className="text-xs text-muted-foreground">District: {issueDistrictName}</p>
                          <p className="text-xs text-muted-foreground">
                            Farm: {issue.farm?.name || issue.farmId} - Reported {toDateString(issue.createdAt)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Assignee: {issue.assignee?.firstName || issue.assignee?.email || issue.assignedTo || 'Unassigned'}
                          </p>
                          {issue.expertNotes && (
                            <p className="text-xs text-muted-foreground">Expert note: {issue.expertNotes}</p>
                          )}
                          {issue.resolutionNotes && (
                            <p className="text-xs text-muted-foreground">Resolution: {issue.resolutionNotes}</p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <select
                            className={compactSelectClass}
                            value={issueAssignments[issue.id] ?? issue.assignedTo ?? ''}
                            onChange={(event) =>
                              setIssueAssignments((current) => ({
                                ...current,
                                [issue.id]: event.target.value,
                              }))
                            }
                            disabled={updateFarmIssue.isPending || expertUsersQuery.isLoading}
                          >
                            <option value="">
                              {sameDistrictExperts.length > 0 ? 'Select district expert' : 'No expert in this district'}
                            </option>
                            {sameDistrictExperts.map((expert: User) => (
                              <option key={expert.id} value={expert.id}>
                                {expert.firstName || expert.email || expert.id}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedIssueId(issue.id)}
                          >
                            {selectedIssueId === issue.id ? 'Viewing Details' : 'View Details'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              updateFarmIssue.isPending
                              || sameDistrictExperts.length === 0
                              || !(issueAssignments[issue.id] ?? issue.assignedTo)
                              || (issueAssignments[issue.id] ?? issue.assignedTo) === issue.assignedTo
                            }
                            onClick={() =>
                              handleIssueUpdate(issue, {
                                assignedTo: issueAssignments[issue.id] ?? issue.assignedTo,
                                expertNotes: issue.expertNotes || 'Assigned from admin oversight queue.',
                              })
                            }
                          >
                            Assign
                          </Button>
                          {issue.status === 'open' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updateFarmIssue.isPending}
                              onClick={() =>
                                handleIssueUpdate(issue, {
                                  status: 'in_progress',
                                  expertNotes: 'Picked up by admin oversight queue.',
                                })
                              }
                            >
                              Start Review
                            </Button>
                          )}
                          {issue.status !== 'resolved' && issue.status !== 'closed' && (
                            <Button
                              size="sm"
                              disabled={updateFarmIssue.isPending}
                              onClick={() =>
                                handleIssueUpdate(issue, {
                                  status: 'resolved',
                                  expertNotes: 'Resolved through admin issue oversight.',
                                  resolutionNotes: 'Marked resolved by admin.',
                                })
                              }
                            >
                              Resolve
                            </Button>
                          )}
                          {issue.status !== 'closed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updateFarmIssue.isPending}
                              onClick={() =>
                                handleIssueUpdate(issue, {
                                  status: 'closed',
                                  expertNotes: 'Closed from admin issue oversight.',
                                  resolutionNotes: issue.resolutionNotes || 'Closed after admin review.',
                                })
                              }
                            >
                              Close
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={(allFarmIssuesResponse?.pagination?.page || issuePage) <= 1}
                      onClick={() => setIssuePage((current) => Math.max(1, current - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Page {allFarmIssuesResponse?.pagination?.page || issuePage} of {allFarmIssuesResponse?.pagination?.totalPages || 1}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={(allFarmIssuesResponse?.pagination?.page || issuePage) >= (allFarmIssuesResponse?.pagination?.totalPages || 1)}
                      onClick={() => setIssuePage((current) => current + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="dash-panel">
        <CardHeader>
          <CardTitle className="text-base">District Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {districtsLoading ? (
            <LoadingState text="Loading district data..." size="sm" />
          ) : filteredAnalyticsDistricts.length > 0 ? (
            <div className="space-y-2">
              {filteredAnalyticsDistricts.map((d: any) => (
                <div key={d.district} className={`${outlineBlockClass} flex items-center justify-between gap-4`}>
                  <p className="font-medium">{d.district}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{d.farmCount ?? 0} farms</span>
                    <span>{d.sensorCount ?? 0} sensors</span>
                    {d.avgSoilMoisture != null && <span>Moisture: {Number(d.avgSoilMoisture).toFixed(1)}%</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title={normalizedSearch ? 'No matching district data' : 'No district data'}
              message={
                normalizedSearch
                  ? `No district analytics match "${searchQuery}".`
                  : 'No district analytics available.'
              }
            />
          )}
        </CardContent>
      </Card>

      </div>

      <div className={workspaceRailClass}>
        <Card className="dash-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Analytics Snapshot</CardTitle>
            <CardDescription>Cross-surface summary from active analytics feeds</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className={centeredMetricTileClass}>
                <p className="text-xs text-muted-foreground uppercase">Users</p>
                <p className="text-xl font-semibold">{analyticsSnapshot.totalUsers}</p>
              </div>
              <div className={centeredMetricTileClass}>
                <p className="text-xs text-muted-foreground uppercase">Farms</p>
                <p className="text-xl font-semibold">{analyticsSnapshot.totalFarms}</p>
              </div>
              <div className={centeredMetricTileClass}>
                <p className="text-xs text-muted-foreground uppercase">Sensors</p>
                <p className="text-xl font-semibold">{analyticsSnapshot.totalSensors}</p>
              </div>
              <div className={centeredMetricTileClass}>
                <p className="text-xs text-muted-foreground uppercase">Recs</p>
                <p className="text-xl font-semibold">{analyticsSnapshot.recommendations}</p>
              </div>
            </div>
            <div className={`${outlineBlockClass} space-y-2`}>
              <div className="flex items-center justify-between">
                <p className="text-sm">Open Issues</p>
                <Badge variant="outline">{analyticsSnapshot.openIssues}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm">Severe Signals</p>
                <Badge variant="outline">{analyticsSnapshot.severeSignals}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm">District Rows</p>
                <Badge variant="outline">{analyticsSnapshot.districtsTracked}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------- Admin Content Panel ----------
function AdminContentPanel({ searchQuery = '' }: { searchQuery?: string }) {
  const { data: resourcesData, isLoading: resLoading } = useContentResources();
  const { data: faqData, isLoading: faqLoading } = useContentFAQ();
  const [activeSection, setActiveSection] = useState<'resources' | 'faq'>('resources');

  const resources = (resourcesData as any)?.items ?? [];
  const faqs = (faqData as any)?.items ?? [];
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredResources = useMemo(() => {
    if (!normalizedSearch) return resources;
    return resources.filter((resource: any) =>
      matchesSearchTerm(normalizedSearch, [
        resource.title,
        resource.category,
        resource.type,
        resource.desc,
        resource.url,
      ])
    );
  }, [normalizedSearch, resources]);
  const filteredFaqs = useMemo(() => {
    if (!normalizedSearch) return faqs;
    return faqs.filter((faq: any) =>
      matchesSearchTerm(normalizedSearch, [
        faq.question,
        faq.answer,
        faq.category,
      ])
    );
  }, [faqs, normalizedSearch]);
  const contentStats = useMemo(() => {
    const categories = new Set<string>();
    filteredResources.forEach((resource: any) => {
      if (resource?.category) categories.add(String(resource.category));
    });
    return {
      resources: filteredResources.length,
      faqs: filteredFaqs.length,
      categories: categories.size,
      activeSection,
    };
  }, [activeSection, filteredFaqs.length, filteredResources, normalizedSearch]);
  const contentSearchScopeItems: SearchScopeItem[] = normalizedSearch
    ? [
        { label: 'Resources', value: filteredResources.length, total: resources.length },
        { label: 'FAQ', value: filteredFaqs.length, total: faqs.length },
      ]
    : [];

  return (
    <div className={workspaceGridClass}>
      {normalizedSearch && (
        <div className="lg:col-span-12">
          <div className={filterBarClass}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="dash-pill bg-sky-100 text-sky-800 dark:bg-sky-900/35 dark:text-sky-300">
                Content Filter: "{searchQuery.trim()}"
              </span>
              <SearchScopePills items={contentSearchScopeItems} accent="sky" />
            </div>
          </div>
        </div>
      )}
      <Card className={`${workspaceMainClass} dash-panel`}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen size={20} className="text-primary" />
            Content Management
          </CardTitle>
          <CardDescription>View and manage public-facing content (resources, FAQ)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={activeSection === 'resources' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSection('resources')}
            >
              Resources ({filteredResources.length})
            </Button>
            <Button
              variant={activeSection === 'faq' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSection('faq')}
            >
              FAQ ({filteredFaqs.length})
            </Button>
          </div>

          {activeSection === 'resources' && (
            resLoading ? <LoadingState text="Loading resources..." size="sm" /> :
            filteredResources.length === 0 ? (
              <EmptyState
                title={normalizedSearch ? 'No matching resources' : 'No resources'}
                message={
                  normalizedSearch
                    ? `No content resources match "${searchQuery}".`
                    : 'No content resources found.'
                }
              />
            ) :
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredResources.map((r: any, i: number) => (
                <div key={r.id ?? i} className={outlineBlockClass}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.category} - {r.type || 'article'}</p>
                      <p className="text-sm mt-1 text-muted-foreground line-clamp-2">{r.desc}</p>
                    </div>
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary underline flex-shrink-0">View</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'faq' && (
            faqLoading ? <LoadingState text="Loading FAQ..." size="sm" /> :
            filteredFaqs.length === 0 ? (
              <EmptyState
                title={normalizedSearch ? 'No matching FAQ items' : 'No FAQ'}
                message={
                  normalizedSearch
                    ? `No FAQ items match "${searchQuery}".`
                    : 'No FAQ items found.'
                }
              />
            ) :
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredFaqs.map((f: any, i: number) => (
                <div key={f.id ?? i} className={outlineBlockClass}>
                  <p className="font-medium text-sm">{f.question}</p>
                  <p className="text-sm text-muted-foreground mt-1">{f.answer}</p>
                  <span className="mt-1 inline-block text-xs bg-muted px-2 py-0.5 rounded-full">{f.category}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className={workspaceRailClass}>
        <Card className="dash-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Content Snapshot</CardTitle>
            <CardDescription>Current content inventory and active workspace section</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className={centeredMetricTileClass}>
                <p className="text-xs text-muted-foreground uppercase">Resources</p>
                <p className="text-xl font-semibold">{contentStats.resources}</p>
              </div>
              <div className={centeredMetricTileClass}>
                <p className="text-xs text-muted-foreground uppercase">FAQ</p>
                <p className="text-xl font-semibold">{contentStats.faqs}</p>
              </div>
            </div>
            <div className={outlineBlockClass}>
              <p className="text-xs text-muted-foreground uppercase">Resource categories</p>
              <p className="text-xl font-semibold">{contentStats.categories}</p>
            </div>
            <div className={outlineBlockClass}>
              <p className="text-xs text-muted-foreground uppercase">Active section</p>
              <p className="font-medium capitalize">{contentStats.activeSection}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------- Admin USSD Panel ----------
function AdminUssdPanel() {
  const { data: aiHealth, isLoading: aiLoading } = useAiHealth();
  const { data: ussdHealth, isLoading: ussdLoading, refetch: refetchUssdHealth } = useUssdHealth();
  const ussdCallback = useUssdCallback();
  const ussdCallbackV2 = useUssdCallbackV2();
  const [useEnhancedFlow, setUseEnhancedFlow] = useState(true);
  const [sessionId, setSessionId] = useState(() => `admin-test-${Date.now()}`);
  const [serviceCode, setServiceCode] = useState('*483*88#');
  const [phoneNumber, setPhoneNumber] = useState('0788000001');
  const [text, setText] = useState('');
  const [networkCode, setNetworkCode] = useState('63801');
  const [responsePreview, setResponsePreview] = useState('');
  const [lastEndpoint, setLastEndpoint] = useState<'v1' | 'v2'>('v2');
  const h = aiHealth as any;
  const u = ussdHealth as any;
  const ussdStatus = u?.status === 'ok' ? 'healthy' : 'degraded';
  const isSimulating = ussdCallback.isPending || ussdCallbackV2.isPending;
  const ussdPanelStats = useMemo(() => {
    return {
      endpoint: lastEndpoint.toUpperCase(),
      hasResponse: Boolean(responsePreview),
      responseLength: responsePreview.length,
      flow: useEnhancedFlow ? 'v2' : 'v1',
      healthStatus: ussdStatus,
      aiStatus: h?.status || 'unknown',
    };
  }, [h?.status, lastEndpoint, responsePreview, ussdStatus, useEnhancedFlow]);

  const handleSimulate = async () => {
    const payload = {
      sessionId,
      serviceCode,
      phoneNumber,
      text,
      ...(useEnhancedFlow ? { networkCode } : {}),
    };

    const response = useEnhancedFlow
      ? await ussdCallbackV2.mutateAsync(payload)
      : await ussdCallback.mutateAsync({
          sessionId,
          serviceCode,
          phoneNumber,
          text,
        });

    setLastEndpoint(useEnhancedFlow ? 'v2' : 'v1');
    setResponsePreview(response);
  };

  return (
    <div className={workspaceGridClass}>
      <Card className={`${workspaceMainClass} dash-panel`}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare size={20} className="text-primary" />
            USSD Service Monitor
          </CardTitle>
          <CardDescription>Monitor the USSD integration status and AI service health</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="dash-detail-card space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">USSD Service</p>
              {ussdLoading ? (
                <span className="text-sm text-muted-foreground">Checking...</span>
              ) : (
                <span className="flex items-center gap-1.5 text-sm">
                  <span className={`inline-block w-2 h-2 rounded-full ${ussdStatus === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`} />
                  {u?.status || 'unknown'}{u?.service ? ` (${u.service})` : ''}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Callback endpoints are exposed at <code className="bg-muted px-1 rounded text-xs">/ussd/callback</code> and{' '}
              <code className="bg-muted px-1 rounded text-xs">/ussd/callback/v2</code>. This panel now checks the live backend
              health endpoint instead of assuming the service is up.
            </p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Last checked: {u?.timestamp ? toDateString(u.timestamp) : 'N/A'}</span>
              <Button size="sm" variant="outline" onClick={() => refetchUssdHealth()}>
                <RefreshCw size={14} className="mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          <div className="dash-detail-card space-y-3">
            <p className="font-medium">AI Service Health</p>
            {aiLoading ? (
              <LoadingState text="Checking AI status..." size="sm" />
            ) : h ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className={h.status === 'healthy' ? 'text-green-500' : 'text-green-500'} />
                  <span className="font-medium capitalize">{h.status}</span>
                  <span className="text-xs text-muted-foreground">({h.provider} - {h.model ?? 'default model'})</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Last checked: {h.lastChecked ? new Date(h.lastChecked).toLocaleString() : 'N/A'}
                </p>
              </div>
            ) : (
              <EmptyState title="Unavailable" message="Could not retrieve AI health status." />
            )}
          </div>

          <div className="dash-detail-card space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">USSD Session Simulator</p>
                <p className="text-sm text-muted-foreground">
                  Test the real backend USSD flow from the frontend. Use a registered phone number if you want to see
                  real recommendation, farm, and weather menu responses.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={useEnhancedFlow ? 'default' : 'outline'}
                  onClick={() => setUseEnhancedFlow(true)}
                >
                  v2
                </Button>
                <Button
                  size="sm"
                  variant={!useEnhancedFlow ? 'default' : 'outline'}
                  onClick={() => setUseEnhancedFlow(false)}
                >
                  v1
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Session ID</label>
                <Input value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Service code</label>
                <Input value={serviceCode} onChange={(e) => setServiceCode(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone number</label>
                <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Network code</label>
                <Input
                  value={networkCode}
                  onChange={(e) => setNetworkCode(e.target.value)}
                  disabled={!useEnhancedFlow}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">USSD text payload</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Leave empty for the first menu, or enter values like 1 or 1*2"
                className={textAreaClass}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleSimulate} disabled={isSimulating || !sessionId || !serviceCode || !phoneNumber}>
                {isSimulating ? 'Running simulation...' : `Simulate ${useEnhancedFlow ? 'v2' : 'v1'} session`}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setText('');
                  setResponsePreview('');
                  setSessionId(`admin-test-${Date.now()}`);
                }}
              >
                Reset session
              </Button>
            </div>

            <div className={`${softBlockClass} space-y-2`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Latest backend response</p>
                <Badge variant="outline">{lastEndpoint.toUpperCase()}</Badge>
              </div>
              {responsePreview ? (
                <pre className="whitespace-pre-wrap break-words text-xs text-foreground">{responsePreview}</pre>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No simulation run yet. Start with an empty text payload to open the first menu.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className={workspaceRailClass}>
        <Card className="dash-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">USSD Snapshot</CardTitle>
            <CardDescription>Live simulator and service status summary</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className={outlineBlockClass}>
              <p className="text-xs text-muted-foreground uppercase">Service health</p>
              <div className="mt-1">
                <Badge variant={ussdPanelStats.healthStatus === 'healthy' ? 'secondary' : 'destructive'}>
                  {ussdPanelStats.healthStatus}
                </Badge>
              </div>
            </div>
            <div className={outlineBlockClass}>
              <p className="text-xs text-muted-foreground uppercase">AI status</p>
              <p className="font-medium capitalize">{ussdPanelStats.aiStatus}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className={centeredMetricTileClass}>
                <p className="text-xs text-muted-foreground uppercase">Flow</p>
                <p className="font-medium uppercase">{ussdPanelStats.flow}</p>
              </div>
              <div className={centeredMetricTileClass}>
                <p className="text-xs text-muted-foreground uppercase">Endpoint</p>
                <p className="font-medium">{ussdPanelStats.endpoint}</p>
              </div>
            </div>
            <div className={outlineBlockClass}>
              <p className="text-xs text-muted-foreground uppercase">Latest response</p>
              <p className="text-sm font-medium">
                {ussdPanelStats.hasResponse ? `${ussdPanelStats.responseLength} chars` : 'No response yet'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ConnectedAdminDashboard;

