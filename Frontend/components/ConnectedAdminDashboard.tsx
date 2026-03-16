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
import { User, UserRole } from '../types';

type AdminTab =
  | 'overview'
  | 'users'
  | 'farms'
  | 'audit'
  | 'devices'
  | 'config'
  | 'monitoring'
  | 'reports'
  | 'broadcast'
  | 'analytics'
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
  'config',
  'monitoring',
  'reports',
  'broadcast',
  'analytics',
  'content',
  'ussd',
];

const workspaceGridClass = 'grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5';
const workspaceMainClass = 'lg:col-span-8';
const workspaceMainStackClass = 'lg:col-span-8 space-y-4';
const workspaceMainWideStackClass = 'lg:col-span-8 space-y-6';
const workspaceRailClass = 'lg:col-span-4 space-y-4 lg:sticky lg:top-24 self-start';

const normalizeTab = (value?: string): AdminTab =>
  ADMIN_TABS.includes((value || 'overview') as AdminTab) ? (value as AdminTab) : 'overview';

const toDateString = (value?: string | number) => {
  if (!value) return 'N/A';
  const parsed = typeof value === 'number' ? new Date(value) : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleString();
};

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

export function ConnectedAdminDashboard({ activeTab = 'overview', searchQuery = '' }: ConnectedAdminDashboardProps) {
  const tab = normalizeTab(activeTab);

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
  const [bulkGenerateDistrict, setBulkGenerateDistrict] = useState('');
  const [bulkGenerateType, setBulkGenerateType] = useState<'general' | 'irrigation' | 'fertilization' | 'pest_alert' | 'weather_alert'>('general');
  const [tabExportFormat, setTabExportFormat] = useState<'csv' | 'json'>('csv');
  const normalizedExternalSearch = searchQuery.trim();
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
  const analyticsQuery = useAdminAnalytics({ period: '30d' }, tab === 'overview' || tab === 'monitoring');
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
  const districtsQuery = useDistricts(tab === 'users' || tab === 'overview' || tab === 'analytics' || tab === 'farms');
  const auditLogsQuery = useAuditLogs({ page: auditPage, limit: 30 }, tab === 'audit');
  const devicesQuery = useAdminDevices({ page: devicesPage, limit: 20 }, tab === 'devices');
  const configsQuery = useAdminConfigs(tab === 'config');
  const sensorHealthQuery = useAdminSensorHealth(tab === 'monitoring');
  const healthQuery = useSystemHealth(tab === 'monitoring');
  const metricsQuery = useSystemMetrics({ period: metricsPeriod }, tab === 'monitoring');

  const updateUserMutation = useUpdateUser();
  const updateConfigMutation = useUpdateSystemConfig();
  const generateDeviceTokenMutation = useGenerateDeviceToken();
  const revokeDeviceTokenMutation = useRevokeDeviceToken();
  const sendBroadcastMutation = useSendBroadcast();
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
  const users = usersQuery.data?.data || [];
  const selectedUser = selectedUserQuery.data as any;
  const adminFarms = farmsQuery.data?.data || [];
  const districts = districtsQuery.data || [];
  const auditLogs = auditLogsQuery.data?.data || [];
  const devices = devicesQuery.data?.data || [];
  const sensorHealth = sensorHealthQuery.data as any;
  const health = healthQuery.data as any;
  const metrics = metricsQuery.data as any;

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

    return {
      total: auditLogs.length,
      uniqueEntities: Object.keys(byEntity).length,
      uniqueActions: Object.keys(byAction).length,
      topEntities,
      topActions,
      latestTimestamp: auditLogs[0] ? toDateString(auditLogs[0].createdAt || auditLogs[0].created_at) : 'N/A',
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

  const adminQuickStats: Array<{ label: string; value: string | number }> = [
    { label: 'Total Users', value: overviewCards.totalUsers },
    { label: 'Total Farms', value: overviewCards.totalFarms },
    { label: 'Total Sensors', value: overviewCards.totalSensors },
    { label: 'Pending Alerts', value: overviewCards.pendingAlerts },
  ];
  const sectionTitleClass = 'text-base md:text-lg font-extrabold tracking-tight';
  const sectionDescriptionClass = 'text-xs md:text-sm text-muted-foreground/90';

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 md:space-y-6 animate-fade-in">
      <div className="rounded-3xl border border-sky-200/55 dark:border-sky-900/45 bg-gradient-to-br from-sky-500/12 via-white to-white dark:from-sky-500/18 dark:via-slate-900 dark:to-slate-900 p-4 md:p-6 shadow-[0_20px_45px_-32px_rgba(2,132,199,0.62)] animate-fade-in [animation-delay:40ms] [animation-fill-mode:both]">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700/85 dark:text-sky-300/85">Administration Bridge</p>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">System Operations Hub</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">Manage users, farms, devices, monitoring, and platform-level controls from one console.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={tabExportFormat}
              onChange={(event) => setTabExportFormat(event.target.value as 'csv' | 'json')}
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
            <Button variant="outline" size="sm" className="h-9 rounded-xl" onClick={handleExportCurrentTab}>
              Export Tab
            </Button>
            <Button variant="outline" size="sm" className="h-9 rounded-xl" onClick={handleRefreshTab}>
              <RefreshCw size={14} className="mr-2" />
              Refresh Tab
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {adminQuickStats.map((stat, index) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-sky-100/80 dark:border-sky-900/45 bg-white/90 dark:bg-slate-900/80 px-3 py-2.5 shadow-[0_14px_30px_-26px_rgba(2,132,199,0.6)] animate-fade-in [animation-fill-mode:both]"
              style={{ animationDelay: `${80 + index * 50}ms` }}
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{stat.label}</p>
              <p className="mt-1 text-xl font-black text-slate-900 dark:text-white">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-sky-100/80 dark:border-sky-900/45 bg-white/85 dark:bg-slate-900/75 px-3 md:px-4 py-3 animate-fade-in [animation-delay:95ms] [animation-fill-mode:both]">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.14em] bg-sky-100 text-sky-800 dark:bg-sky-900/35 dark:text-sky-300">
              Active Tab: {tab}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.14em] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              User Role Filter: {roleFilter}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.14em] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              User Status Filter: {statusFilter}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.14em] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Farm Status: {farmStatusFilter}
            </span>
            {effectiveSearch && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.14em] bg-sky-100 text-sky-800 dark:bg-sky-900/35 dark:text-sky-300">
                Search: "{effectiveSearch}"
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-lg self-start md:self-auto"
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 animate-fade-in [animation-delay:115ms] [animation-fill-mode:both]">
          <div className={workspaceMainClass}>
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
          <Card className="h-full border-sky-100/80 dark:border-sky-900/45 bg-gradient-to-br from-sky-50/85 to-white dark:from-sky-950/20 dark:to-slate-900 shadow-[0_18px_34px_-30px_rgba(2,132,199,0.85)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_42px_-28px_rgba(2,132,199,0.95)] animate-fade-in [animation-delay:130ms] [animation-fill-mode:both]">
            <CardContent className="p-4 lg:p-5 h-full flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-300">Control Sync</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Refresh overview routes and verify current operational totals.</p>
                </div>
                <RefreshCw size={16} className="text-sky-700 dark:text-sky-300" />
              </div>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ops lane - Reconcile counters</p>
              <Button className="mt-auto h-9 w-full rounded-xl focus-visible:ring-2 focus-visible:ring-sky-500/70 focus-visible:ring-offset-2" onClick={handleRefreshTab}>
                Sync Overview
              </Button>
            </CardContent>
          </Card>

          <Card className="h-full border-sky-100/80 dark:border-sky-900/45 bg-gradient-to-br from-emerald-50/85 to-white dark:from-emerald-950/20 dark:to-slate-900 shadow-[0_18px_34px_-30px_rgba(5,150,105,0.8)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_42px_-28px_rgba(5,150,105,0.95)] animate-fade-in [animation-delay:190ms] [animation-fill-mode:both]">
            <CardContent className="p-4 lg:p-5 h-full flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">Reporting Pulse</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Export the active tab instantly for ops and stakeholder handoff.</p>
                </div>
                <FileSpreadsheet size={16} className="text-emerald-700 dark:text-emerald-300" />
              </div>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reporting lane - Export snapshot</p>
              <Button variant="outline" className="mt-auto h-9 w-full rounded-xl focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2" onClick={handleExportCurrentTab}>
                Export Current Tab
              </Button>
            </CardContent>
          </Card>

          <Card className="h-full border-sky-100/80 dark:border-sky-900/45 bg-gradient-to-br from-violet-50/85 to-white dark:from-violet-950/20 dark:to-slate-900 shadow-[0_18px_34px_-30px_rgba(124,58,237,0.8)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_42px_-28px_rgba(124,58,237,0.95)] animate-fade-in [animation-delay:250ms] [animation-fill-mode:both]">
            <CardContent className="p-4 lg:p-5 h-full flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">Governance Focus</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Track unresolved recommendations and keep intervention backlog controlled.</p>
                </div>
                <Shield size={16} className="text-violet-700 dark:text-violet-300" />
              </div>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Governance lane - Backlog pressure</p>
              <p className="mt-auto text-2xl font-black text-slate-900 dark:text-white">{overviewCards.pendingAlerts}</p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending recommendations</p>
            </CardContent>
          </Card>
          </div>
          </div>

          <Card className="lg:col-span-4 lg:sticky lg:top-24 self-start border-sky-100/80 dark:border-sky-900/45 bg-white/90 dark:bg-slate-900/80 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.45)]">
            <CardHeader className="pb-2">
              <CardTitle className={sectionTitleClass}>Quick Actions</CardTitle>
              <CardDescription className={sectionDescriptionClass}>High-frequency admin operations from a single action rail</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 lg:space-y-3">
              <Button variant="outline" className="h-9 lg:h-10 w-full justify-start rounded-xl" onClick={handleRefreshTab}>
                <RefreshCw size={14} className="mr-2" />
                Refresh Active Tab
              </Button>
              <Button variant="outline" className="h-9 lg:h-10 w-full justify-start rounded-xl" onClick={handleExportCurrentTab}>
                <FileSpreadsheet size={14} className="mr-2" />
                Export Active Tab
              </Button>
              <Button
                variant="outline"
                className="h-9 lg:h-10 w-full justify-start rounded-xl"
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
            <Card className="lg:col-span-4">
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Dashboard Route Snapshot</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Loaded from the primary analytics dashboard route without a farm filter</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboardSummaryQuery.isLoading ? (
                  <LoadingState text="Loading dashboard snapshot..." size="sm" />
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground uppercase">Users</p>
                      <p className="text-xl font-semibold">{dashboardSummary?.users?.total ?? 0}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground uppercase">Farms</p>
                      <p className="text-xl font-semibold">{dashboardSummary?.farms?.total ?? 0}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground uppercase">Recommendations</p>
                      <p className="text-xl font-semibold">{dashboardSummary?.recommendations?.total ?? 0}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground uppercase">Pest Detections</p>
                      <p className="text-xl font-semibold">{dashboardSummary?.pestDetections?.total ?? 0}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-4">
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>User Statistics</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Dedicated backend user metrics from the admin statistics endpoint</CardDescription>
              </CardHeader>
              <CardContent>
                {userStatisticsQuery.isLoading ? (
                  <LoadingState text="Loading user statistics..." size="sm" />
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground uppercase">Total Users</p>
                        <p className="text-xl font-semibold">{userStatistics?.totalUsers ?? 0}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground uppercase">Active Users</p>
                        <p className="text-xl font-semibold">{userStatistics?.activeUsers ?? 0}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground uppercase">New This Month</p>
                        <p className="text-xl font-semibold">{userStatistics?.newUsersThisMonth ?? 0}</p>
                      </div>
                      <div className="rounded-lg border p-3">
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

            <Card className="lg:col-span-4">
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Farm Statistics</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Dedicated backend farm metrics from the admin statistics endpoint</CardDescription>
              </CardHeader>
              <CardContent>
                {farmStatisticsQuery.isLoading ? (
                  <LoadingState text="Loading farm statistics..." size="sm" />
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground uppercase">Total Farms</p>
                        <p className="text-xl font-semibold">{farmStatistics?.totalFarms ?? 0}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground uppercase">Active Farms</p>
                        <p className="text-xl font-semibold">{farmStatistics?.activeFarms ?? 0}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground uppercase">Total Area</p>
                        <p className="text-xl font-semibold">
                          {typeof farmStatistics?.totalAreaHectares === 'number' ? farmStatistics.totalAreaHectares.toFixed(1) : '0.0'} ha
                        </p>
                      </div>
                      <div className="rounded-lg border p-3">
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
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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
          <Card className="lg:col-span-5 lg:sticky lg:top-24 self-start">
            <CardHeader>
              <CardTitle>Recent Users</CardTitle>
              <CardDescription>Most recent accounts in the system</CardDescription>
            </CardHeader>
            <CardContent>
              {(recentUsersQuery.data?.data || []).length === 0 ? (
                <EmptyState title="No users found" message="No user records available yet." />
              ) : (
                <div className="space-y-3">
                  {(recentUsersQuery.data?.data || []).map((user: any) => (
                    <div key={user.id} className="flex items-center justify-between rounded-lg border p-3">
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

            <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle>Admin User Directory Snapshot</CardTitle>
              <CardDescription>Loaded from the admin-scoped user list route</CardDescription>
            </CardHeader>
            <CardContent>
              {adminUsersRouteQuery.isLoading ? (
                <LoadingState text="Loading admin user directory..." size="sm" />
              ) : adminUsersRoute.length === 0 ? (
                <EmptyState title="No users found" message="The admin user directory route returned no users." />
              ) : (
                <div className="space-y-3">
                  {adminUsersRoute.map((user: any) => (
                    <div key={user.id} className="flex items-center justify-between rounded-lg border p-3">
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
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>Recommendation Ledger</CardTitle>
                <CardDescription>Loaded from the primary unscoped recommendations route</CardDescription>
              </CardHeader>
              <CardContent>
                {globalRecommendationsQuery.isLoading ? (
                  <LoadingState text="Loading recommendations..." size="sm" />
                ) : globalRecommendations.length === 0 ? (
                  <EmptyState title="No recommendations" message="No recommendation records are available yet." />
                ) : (
                  <div className="space-y-3">
                    {globalRecommendations.map((recommendation: any) => (
                      <div key={recommendation.id} className="rounded-lg border p-3">
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

            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>Active Recommendation Watch</CardTitle>
                <CardDescription>Loaded from the primary unscoped active recommendations route</CardDescription>
              </CardHeader>
              <CardContent>
                {activeRecommendationsQuery.isLoading ? (
                  <LoadingState text="Loading active recommendations..." size="sm" />
                ) : activeRecommendations.length === 0 ? (
                  <EmptyState title="No active recommendations" message="There are no currently active recommendations." />
                ) : (
                  <div className="space-y-3">
                    {activeRecommendations.slice(0, 6).map((recommendation: any) => (
                      <div key={recommendation.id} className="rounded-lg border p-3">
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

            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>Pest Detection Ledger</CardTitle>
                <CardDescription>Loaded from the primary unscoped pest-detection route</CardDescription>
              </CardHeader>
              <CardContent>
                {globalPestDetectionsQuery.isLoading ? (
                  <LoadingState text="Loading pest detections..." size="sm" />
                ) : globalPestDetections.length === 0 ? (
                  <EmptyState title="No pest detections" message="No pest detection records are available yet." />
                ) : (
                  <div className="space-y-3">
                    {globalPestDetections.map((detection: any) => (
                      <div key={detection.id} className="rounded-lg border p-3">
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
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>30-Day Activity Snapshot</CardTitle>
              <CardDescription>Backend-generated system metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground uppercase">Sensor Readings</p>
                  <p className="text-xl font-semibold">{analytics?.metrics?.sensorReadings ?? 0}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground uppercase">Recommendations</p>
                  <p className="text-xl font-semibold">{analytics?.metrics?.recommendationsGenerated ?? 0}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground uppercase">Messages</p>
                  <p className="text-xl font-semibold">{analytics?.metrics?.messagesSent ?? 0}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground uppercase">Errors</p>
                  <p className="text-xl font-semibold">{analytics?.metrics?.errors ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={workspaceMainClass}>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle>Recent System Activity</CardTitle>
                  <CardDescription>Recent operator-facing system activity with filters and export.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={activityHours}
                    onChange={(event) => setActivityHours(Number(event.target.value) as 6 | 24 | 168)}
                  >
                    <option value={6}>Last 6 hours</option>
                    <option value={24}>Last 24 hours</option>
                    <option value={168}>Last 7 days</option>
                  </select>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
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
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground uppercase">Users</p>
                      <p className="text-xl font-semibold">{recentActivityQuery.data?.summary?.newUsers ?? 0}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground uppercase">Farms</p>
                      <p className="text-xl font-semibold">{recentActivityQuery.data?.summary?.newFarms ?? 0}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground uppercase">Readings</p>
                      <p className="text-xl font-semibold">{recentActivityQuery.data?.summary?.sensorReadings ?? 0}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground uppercase">Recommendations</p>
                      <p className="text-xl font-semibold">{recentActivityQuery.data?.summary?.recommendations ?? 0}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground uppercase">Pest Events</p>
                      <p className="text-xl font-semibold">{recentActivityQuery.data?.summary?.pestDetections ?? 0}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground uppercase">Pest Control</p>
                      <p className="text-xl font-semibold">{recentActivityQuery.data?.summary?.pestControlActions ?? 0}</p>
                    </div>
                  </div>

                  {Array.isArray(recentActivityQuery.data?.activities) && recentActivityQuery.data.activities.length > 0 ? (
                    <div className="space-y-2">
                      {recentActivityQuery.data.activities.map((item) => (
                        <div key={item.id} className="rounded-lg border p-3">
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
        <div className={workspaceGridClass}>
          <Card className={workspaceMainClass}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sprout size={20} />
                Farm Management
              </CardTitle>
              <CardDescription>Browse all farms through the dedicated admin farm listing endpoint</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
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
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
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
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={farmStatusFilter}
                  onChange={(event) => setFarmStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Fleet controls</p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
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

              {farmsQuery.isLoading ? (
                <LoadingState text="Loading farms..." />
              ) : farmsQuery.error ? (
                <ErrorState title="Failed to load farms" message="Please retry." onRetry={farmsQuery.refetch} />
              ) : adminFarms.length === 0 ? (
                <EmptyState title="No farms found" message="No farms matched your filters." />
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
                      <div key={farm.id || farm._id} className="rounded-lg border p-4 space-y-3">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div>
                            <p className="font-semibold">{farm.name || 'Unnamed farm'}</p>
                            <p className="text-xs text-muted-foreground">
                              Owner: {farmOwner}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{farmDistrictName}</Badge>
                            <Badge variant={farmStatus === 'active' ? 'secondary' : 'outline'}>
                              {farmStatus}
                            </Badge>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-4 text-sm">
                          <div className="rounded-lg bg-muted/30 p-3">
                            <p className="text-xs text-muted-foreground uppercase">Crop</p>
                            <p className="font-medium">{farm.cropVariety || farm.crop_variety || 'N/A'}</p>
                          </div>
                          <div className="rounded-lg bg-muted/30 p-3">
                            <p className="text-xs text-muted-foreground uppercase">Growth Stage</p>
                            <p className="font-medium">{farm.currentGrowthStage || farm.current_growth_stage || 'N/A'}</p>
                          </div>
                          <div className="rounded-lg bg-muted/30 p-3">
                            <p className="text-xs text-muted-foreground uppercase">Size</p>
                            <p className="font-medium">
                              {typeof (farm.sizeHectares ?? farm.size_hectares) === 'number'
                                ? `${(farm.sizeHectares ?? farm.size_hectares).toFixed(1)} ha`
                                : 'N/A'}
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted/30 p-3">
                            <p className="text-xs text-muted-foreground uppercase">Location</p>
                            <p className="font-medium">{farm.locationName || farm.location_name || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {renderPagination(
                    farmsQuery.data?.pagination?.page || farmsPage,
                    farmsQuery.data?.pagination?.totalPages,
                    setFarmsPage
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className={workspaceRailClass}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Farm Fleet Snapshot</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Current result set health and distribution</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Visible farms</p>
                    <p className="text-xl font-semibold">{farmSegmentStats.total}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Active</p>
                    <p className="text-xl font-semibold">{farmSegmentStats.active}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Inactive</p>
                    <p className="text-xl font-semibold">{farmSegmentStats.inactive}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Avg size</p>
                    <p className="text-xl font-semibold">{farmSegmentStats.averageAreaHectares.toFixed(1)} ha</p>
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground uppercase">Total visible area</p>
                  <p className="text-xl font-semibold">{farmSegmentStats.totalAreaHectares.toFixed(1)} ha</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>District Concentration</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Highest farm volumes in current filters</CardDescription>
              </CardHeader>
              <CardContent>
                {farmSegmentStats.topDistricts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No district distribution available for the selected farms.</p>
                ) : (
                  <div className="space-y-2">
                    {farmSegmentStats.topDistricts.map(([districtName, count]) => (
                      <div key={districtName} className="flex items-center justify-between rounded-lg border p-2.5">
                        <p className="text-sm font-medium">{districtName}</p>
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

      {tab === 'users' && (
        <div className={workspaceGridClass}>
          <Card className={workspaceMainClass}>
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
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value as 'all' | UserRole)}
                >
                  <option value="all">All Roles</option>
                  <option value="farmer">Farmer</option>
                  <option value="expert">Expert</option>
                  <option value="admin">Admin</option>
                </select>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Directory controls</p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
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
                    <div key={user.id} className="rounded-lg border p-4 space-y-3">
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
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
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
                            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
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
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Directory Snapshot</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Role and status composition from current result set</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Visible users</p>
                    <p className="text-xl font-semibold">{userSegmentStats.total}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Active</p>
                    <p className="text-xl font-semibold">{userSegmentStats.active}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Experts</p>
                    <p className="text-xl font-semibold">{userSegmentStats.roleBreakdown.expert}</p>
                  </div>
                  <div className="rounded-lg border p-3">
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

            <Card>
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
                      <div className="rounded-lg bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground uppercase">Email</p>
                        <p className="font-medium">{selectedUser.email || 'N/A'}</p>
                      </div>
                      <div className="rounded-lg bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground uppercase">Phone</p>
                        <p className="font-medium">{selectedUser.phoneNumber || selectedUser.phone || 'N/A'}</p>
                      </div>
                      <div className="rounded-lg bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground uppercase">Coverage District</p>
                        <p className="font-medium">
                          {districts.find((district: any) => String(district.id) === String(getUserDistrictId(selectedUser)))?.name || 'Not set'}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground uppercase">Last Login</p>
                        <p className="font-medium">{toDateString(selectedUser.lastLoginAt || selectedUser.last_login_at)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground uppercase">Created</p>
                        <p className="font-medium">{toDateString(selectedUser.createdAt || selectedUser.created_at)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/30 p-3">
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
          <Card className={workspaceMainClass}>
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
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
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
                    <div key={log.id || `${log.action}-${index}`} className="rounded-lg border p-3">
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
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Audit Snapshot</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Current page distribution and activity mix</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Visible events</p>
                    <p className="text-xl font-semibold">{auditSegmentStats.total}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Entity types</p>
                    <p className="text-xl font-semibold">{auditSegmentStats.uniqueEntities}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Unique actions</p>
                    <p className="text-xl font-semibold">{auditSegmentStats.uniqueActions}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Latest event</p>
                    <p className="text-xs font-medium">{auditSegmentStats.latestTimestamp}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
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
                      <div key={action} className="flex items-center justify-between rounded-lg border p-2.5">
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
            <Card>
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
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
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
                        <div key={deviceId || device.createdAt || `device-${index}`} className="rounded-lg border p-3">
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

            <Card>
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
                  <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm space-y-1">
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
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Device Fleet Snapshot</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Status mix from the current device page</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Visible devices</p>
                    <p className="text-xl font-semibold">{deviceSegmentStats.total}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Active</p>
                    <p className="text-xl font-semibold">{deviceSegmentStats.active}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Inactive</p>
                    <p className="text-xl font-semibold">{deviceSegmentStats.inactive}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Revoked</p>
                    <p className="text-xl font-semibold">{deviceSegmentStats.revoked}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
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
                      <div key={status} className="flex items-center justify-between rounded-lg border p-2.5">
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
          <Card className={workspaceMainClass}>
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
                    <div key={entry.key} className="rounded-lg border p-4 space-y-3">
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
                        className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
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
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Config Snapshot</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Current configuration inventory in view</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Visible keys</p>
                    <p className="text-xl font-semibold">{configSegmentStats.total}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Categories</p>
                    <p className="text-xl font-semibold">{configSegmentStats.categories}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Active</p>
                    <p className="text-xl font-semibold">{configSegmentStats.active}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Inactive</p>
                    <p className="text-xl font-semibold">{configSegmentStats.inactive}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
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
                      <div key={category} className="flex items-center justify-between rounded-lg border p-2.5">
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
            <Card>
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
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground uppercase">Total Sensors</p>
                        <p className="text-xl font-semibold">{sensorHealth?.totalSensors ?? 0}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground uppercase">Active</p>
                        <p className="text-xl font-semibold">{sensorHealth?.activeSensors ?? 0}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground uppercase">Faulty</p>
                        <p className="text-xl font-semibold">{sensorHealth?.faultySensors ?? 0}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground uppercase">Maintenance Needed</p>
                        <p className="text-xl font-semibold">{sensorHealth?.maintenanceRequired ?? 0}</p>
                      </div>
                      <div className="rounded-lg border p-3">
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
                              <div key={type} className="rounded-lg border p-3 space-y-2">
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

            <Card>
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
                        <div key={key} className="rounded border p-2 text-sm flex items-center justify-between gap-2">
                          <span className="font-medium">{key}</span>
                          <span className="text-muted-foreground">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle>Operational Metrics</CardTitle>
                    <CardDescription>Backend metrics for selected window</CardDescription>
                  </div>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
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
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground uppercase">Sensor Readings</p>
                      <p className="text-xl font-semibold">{metrics?.metrics?.sensorReadings ?? 0}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground uppercase">Recommendations</p>
                      <p className="text-xl font-semibold">{metrics?.metrics?.recommendationsGenerated ?? 0}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground uppercase">Messages</p>
                      <p className="text-xl font-semibold">{metrics?.metrics?.messagesSent ?? 0}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground uppercase">Errors</p>
                      <p className="text-xl font-semibold">{metrics?.metrics?.errors ?? 0}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className={workspaceRailClass}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Monitoring Snapshot</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Cross-source health summary for current period</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Sensors</p>
                    <p className="text-xl font-semibold">{monitoringSegmentStats.totalSensors}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Active</p>
                    <p className="text-xl font-semibold">{monitoringSegmentStats.activeSensors}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Faulty</p>
                    <p className="text-xl font-semibold">{monitoringSegmentStats.faultySensors}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Maintenance</p>
                    <p className="text-xl font-semibold">{monitoringSegmentStats.maintenanceRequired}</p>
                  </div>
                </div>
                <div className="rounded-lg border p-3 space-y-2">
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

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Metrics Window</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Operational totals for selected period</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border p-2.5">
                  <p className="text-sm">Sensor Readings</p>
                  <span className="font-medium">{monitoringSegmentStats.sensorReadings}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-2.5">
                  <p className="text-sm">Recommendations</p>
                  <span className="font-medium">{monitoringSegmentStats.recommendationsGenerated}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-2.5">
                  <p className="text-sm">Messages</p>
                  <span className="font-medium">{monitoringSegmentStats.messagesSent}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-2.5">
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
          <Card className={workspaceMainClass}>
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
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
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
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
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
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Report Snapshot</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Current export configuration before generation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground uppercase">Type</p>
                  <p className="font-medium capitalize">{reportSegmentStats.type.replace('-', ' ')}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground uppercase">Format</p>
                  <p className="font-medium uppercase">{reportSegmentStats.format}</p>
                </div>
                <div className="rounded-lg border p-3">
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
          <Card className={workspaceMainClass}>
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
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={broadcastRole}
                    onChange={(event) => setBroadcastRole(event.target.value as 'all' | UserRole)}
                  >
                    <option value="all">All roles</option>
                    <option value="farmer">Farmers</option>
                    <option value="expert">Experts</option>
                    <option value="admin">Admins</option>
                  </select>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
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
                  className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Message (English)"
                  value={broadcastMessage}
                  onChange={(event) => setBroadcastMessage(event.target.value)}
                />
                <textarea
                  className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
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

          <div className={workspaceRailClass}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className={sectionTitleClass}>Broadcast Snapshot</CardTitle>
                <CardDescription className={sectionDescriptionClass}>Live preview of target and draft payload size</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground uppercase">Target role</p>
                  <p className="font-medium capitalize">{broadcastSegmentStats.targetRole}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground uppercase">Channel</p>
                  <p className="font-medium uppercase">{broadcastSegmentStats.channel}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">EN chars</p>
                    <p className="text-xl font-semibold">{broadcastSegmentStats.englishLength}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">RW chars</p>
                    <p className="text-xl font-semibold">{broadcastSegmentStats.kinyarwandaLength}</p>
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground uppercase">Total payload</p>
                  <p className="text-xl font-semibold">{broadcastSegmentStats.totalLength}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {broadcastSegmentStats.hasDraft ? 'Draft ready to queue' : 'No message drafted yet'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      {/* ===== Analytics Tab ===== */}
      {tab === 'analytics' && (
        <AdminAnalyticsPanel />
      )}

      {/* ===== Content Tab ===== */}
      {tab === 'content' && (
        <AdminContentPanel />
      )}

      {/* ===== USSD Monitor Tab ===== */}
      {tab === 'ussd' && (
        <AdminUssdPanel />
      )}
    </div>
  );
}

// ---------- Admin Analytics Panel ----------
function AdminAnalyticsPanel() {
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
  const issueSummary = useMemo(() => {
    return farmIssues.reduce(
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
  }, [farmIssues]);
  useEffect(() => {
    if (!selectedIssueId && farmIssues.length > 0) {
      setSelectedIssueId(farmIssues[0].id);
      return;
    }
    if (selectedIssueId && farmIssues.length > 0 && !farmIssues.some((issue) => issue.id === selectedIssueId)) {
      setSelectedIssueId(farmIssues[0].id);
    }
  }, [farmIssues, selectedIssueId]);
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
    const districts = outbreakMap?.byDistrict || [];
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
  }, [outbreakMap]);

  const analyticsSnapshot = useMemo(() => {
    return {
      totalUsers: s?.userCount ?? s?.totalUsers ?? 0,
      totalFarms: s?.farmCount ?? s?.totalFarms ?? 0,
      totalSensors: s?.sensorCount ?? s?.totalSensors ?? 0,
      recommendations: s?.recommendationCount ?? s?.totalRecommendations ?? 0,
      openIssues: issueSummary.byStatus.open || 0,
      severeSignals: outbreakSummary.severeSignals,
      districtsTracked: Array.isArray(districts) ? districts.length : 0,
    };
  }, [districts, issueSummary.byStatus.open, outbreakSummary.severeSignals, s]);

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
      <div className={workspaceMainWideStackClass}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Analytics Export</CardTitle>
          <CardDescription>Use the general analytics export endpoint for summary dataset downloads</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleExportAnalytics}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
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
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
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

      <Card>
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
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">{String(stat.value)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recommendation Response Overview</CardTitle>
          <CardDescription>System-wide farmer response behavior over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          {recommendationStatsLoading ? (
            <LoadingState text="Loading recommendation response analytics..." size="sm" />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">{recommendationStats?.total ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Recommendations</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">
                    {typeof recommendationStats?.responseRate === 'number'
                      ? `${Math.round(recommendationStats.responseRate)}%`
                      : '0%'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Response Rate</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">
                    {typeof recommendationStats?.acceptanceRate === 'number'
                      ? `${Math.round(recommendationStats.acceptanceRate)}%`
                      : '0%'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Acceptance Rate</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">
                    {typeof recommendationStats?.avgResponseTime === 'number'
                      ? `${recommendationStats.avgResponseTime}h`
                      : 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Avg Response Time</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-4">
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

                <div className="rounded-lg border p-4">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pest Outbreak Watch</CardTitle>
          <CardDescription>System-wide outbreak signals from the backend outbreak-map endpoint</CardDescription>
        </CardHeader>
        <CardContent>
          {outbreakMapLoading ? (
            <LoadingState text="Loading outbreak signals..." size="sm" />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">{outbreakSummary.totalDetections}</p>
                  <p className="text-xs text-muted-foreground mt-1">Detections</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">{outbreakSummary.affectedDistricts}</p>
                  <p className="text-xs text-muted-foreground mt-1">Districts Affected</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">{outbreakSummary.severeSignals}</p>
                  <p className="text-xs text-muted-foreground mt-1">High + Severe Signals</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-lg font-bold">{outbreakSummary.topDistrict}</p>
                  <p className="text-xs text-muted-foreground mt-1">Top District</p>
                </div>
              </div>

              {outbreakMap?.byDistrict?.length ? (
                <div className="space-y-2">
                  {outbreakMap.byDistrict.slice(0, 5).map((district) => (
                    <div key={district.district} className="flex items-center justify-between rounded-lg border p-3">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pest Control Operations</CardTitle>
          <CardDescription>System-wide pest-control follow-through over the last 7 days.</CardDescription>
        </CardHeader>
        <CardContent>
          {pestControlActivityLoading ? (
            <LoadingState text="Loading pest control operations..." size="sm" />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">{pestControlSummary.total}</p>
                  <p className="text-xs text-muted-foreground mt-1">Logged Operations</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">{pestControlSummary.scheduled}</p>
                  <p className="text-xs text-muted-foreground mt-1">Scheduled</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">{pestControlSummary.executed}</p>
                  <p className="text-xs text-muted-foreground mt-1">Executed</p>
                </div>
              </div>

              {Array.isArray(pestControlActivity?.activities) && pestControlActivity.activities.length > 0 ? (
                <div className="space-y-2">
                  {pestControlActivity.activities.slice(0, 5).map((item) => (
                    <div key={item.id} className="rounded-lg border p-3">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alert Statistics</CardTitle>
          <CardDescription>Backend alert metrics over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          {alertStatsLoading ? (
            <LoadingState text="Loading alert statistics..." size="sm" />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">{alertStats?.totalAlerts ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total Alerts</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">{alertStats?.criticalAlerts ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Critical Alerts</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">{alertStats?.resolvedAlerts ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Resolved Alerts</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">
                    {typeof alertStats?.avgResolutionTime === 'number' ? `${alertStats.avgResolutionTime}h` : 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Avg Resolution</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-4">
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

                <div className="rounded-lg border p-4">
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Farm Issue Oversight</CardTitle>
              <CardDescription>System-wide review queue for farmer-reported issues.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
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
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">{allFarmIssuesResponse?.pagination?.total || issueSummary.total}</p>
                  <p className="text-xs text-muted-foreground mt-1">Visible Issues</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">{issueSummary.byStatus.open || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Open</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">{issueSummary.byStatus.in_progress || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">In Progress</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">{(issueSummary.bySeverity.high || 0) + (issueSummary.bySeverity.urgent || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">High / Urgent</p>
                </div>
              </div>

              <Card className="border-dashed">
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
                        <div className="rounded-lg bg-muted/30 p-3">
                          <p className="text-xs text-muted-foreground uppercase">Farm</p>
                          <p className="font-medium">{selectedIssue.farm?.name || selectedIssue.farmId || 'N/A'}</p>
                        </div>
                        <div className="rounded-lg bg-muted/30 p-3">
                          <p className="text-xs text-muted-foreground uppercase">Reporter</p>
                          <p className="font-medium">
                            {selectedIssue.reporter?.firstName || selectedIssue.reporter?.email || selectedIssue.reportedBy || 'N/A'}
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/30 p-3">
                          <p className="text-xs text-muted-foreground uppercase">Location</p>
                          <p className="font-medium">{selectedIssue.locationDescription || 'N/A'}</p>
                        </div>
                        <div className="rounded-lg bg-muted/30 p-3">
                          <p className="text-xs text-muted-foreground uppercase">Source Channel</p>
                          <p className="font-medium">{selectedIssue.sourceChannel || 'N/A'}</p>
                        </div>
                        <div className="rounded-lg bg-muted/30 p-3">
                          <p className="text-xs text-muted-foreground uppercase">Created</p>
                          <p className="font-medium">{toDateString(selectedIssue.createdAt)}</p>
                        </div>
                        <div className="rounded-lg bg-muted/30 p-3">
                          <p className="text-xs text-muted-foreground uppercase">Updated</p>
                          <p className="font-medium">{toDateString(selectedIssue.updatedAt)}</p>
                        </div>
                      </div>
                      {selectedIssue.expertNotes && (
                        <div className="rounded-lg bg-muted/30 p-3">
                          <p className="text-xs text-muted-foreground uppercase">Expert Notes</p>
                          <p className="font-medium">{selectedIssue.expertNotes}</p>
                        </div>
                      )}
                      {selectedIssue.resolutionNotes && (
                        <div className="rounded-lg bg-muted/30 p-3">
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

              {farmIssues.length === 0 ? (
                <EmptyState title="No farm issues" message="No farmer-reported issues match the selected status filter." />
              ) : (
                <div className="space-y-3">
                  {farmIssues.map((issue) => {
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
                    <div key={issue.id} className="rounded-lg border p-4">
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
                            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">District Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {districtsLoading ? (
            <LoadingState text="Loading district data..." size="sm" />
          ) : Array.isArray(districts) && districts.length > 0 ? (
            <div className="space-y-2">
              {(districts as any[]).map((d) => (
                <div key={d.district} className="flex items-center justify-between rounded-lg border px-4 py-2">
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
            <EmptyState title="No district data" message="No district analytics available." />
          )}
        </CardContent>
      </Card>

      </div>

      <div className={workspaceRailClass}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Analytics Snapshot</CardTitle>
            <CardDescription>Cross-surface summary from active analytics feeds</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground uppercase">Users</p>
                <p className="text-xl font-semibold">{analyticsSnapshot.totalUsers}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground uppercase">Farms</p>
                <p className="text-xl font-semibold">{analyticsSnapshot.totalFarms}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground uppercase">Sensors</p>
                <p className="text-xl font-semibold">{analyticsSnapshot.totalSensors}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground uppercase">Recs</p>
                <p className="text-xl font-semibold">{analyticsSnapshot.recommendations}</p>
              </div>
            </div>
            <div className="rounded-lg border p-3 space-y-2">
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
function AdminContentPanel() {
  const { data: resourcesData, isLoading: resLoading } = useContentResources();
  const { data: faqData, isLoading: faqLoading } = useContentFAQ();
  const [activeSection, setActiveSection] = useState<'resources' | 'faq'>('resources');

  const resources = (resourcesData as any)?.items ?? [];
  const faqs = (faqData as any)?.items ?? [];
  const contentStats = useMemo(() => {
    const categories = new Set<string>();
    resources.forEach((resource: any) => {
      if (resource?.category) categories.add(String(resource.category));
    });
    return {
      resources: resources.length,
      faqs: faqs.length,
      categories: categories.size,
      activeSection,
    };
  }, [activeSection, faqs.length, resources]);

  return (
    <div className={workspaceGridClass}>
      <Card className={workspaceMainClass}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen size={20} className="text-primary" />
            Content Management
          </CardTitle>
          <CardDescription>View and manage public-facing content (resources, FAQ)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={activeSection === 'resources' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSection('resources')}
            >
              Resources ({resources.length})
            </Button>
            <Button
              variant={activeSection === 'faq' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSection('faq')}
            >
              FAQ ({faqs.length})
            </Button>
          </div>

          {activeSection === 'resources' && (
            resLoading ? <LoadingState text="Loading resources..." size="sm" /> :
            resources.length === 0 ? <EmptyState title="No resources" message="No content resources found." /> :
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {resources.map((r: any, i: number) => (
                <div key={r.id ?? i} className="rounded-lg border p-3">
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
            faqs.length === 0 ? <EmptyState title="No FAQ" message="No FAQ items found." /> :
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {faqs.map((f: any, i: number) => (
                <div key={f.id ?? i} className="rounded-lg border p-3">
                  <p className="font-medium text-sm">{f.question}</p>
                  <p className="text-sm text-muted-foreground mt-1">{f.answer}</p>
                  <span className="mt-1 inline-block text-xs bg-muted px-2 py-0.5 rounded">{f.category}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className={workspaceRailClass}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Content Snapshot</CardTitle>
            <CardDescription>Current content inventory and active workspace section</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground uppercase">Resources</p>
                <p className="text-xl font-semibold">{contentStats.resources}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground uppercase">FAQ</p>
                <p className="text-xl font-semibold">{contentStats.faqs}</p>
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground uppercase">Resource categories</p>
              <p className="text-xl font-semibold">{contentStats.categories}</p>
            </div>
            <div className="rounded-lg border p-3">
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
      <Card className={workspaceMainClass}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare size={20} className="text-primary" />
            USSD Service Monitor
          </CardTitle>
          <CardDescription>Monitor the USSD integration status and AI service health</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">USSD Service</p>
              {ussdLoading ? (
                <span className="text-sm text-muted-foreground">Checking...</span>
              ) : (
                <span className="flex items-center gap-1.5 text-sm">
                  <span className={`inline-block w-2 h-2 rounded-full ${ussdStatus === 'healthy' ? 'bg-green-500' : 'bg-green-500'}`} />
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

          <div className="rounded-lg border p-4 space-y-3">
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

          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">USSD Session Simulator</p>
                <p className="text-sm text-muted-foreground">
                  Test the real backend USSD flow from the frontend. Use a registered phone number if you want to see
                  real recommendation, farm, and weather menu responses.
                </p>
              </div>
              <div className="flex gap-2">
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
                className="min-h-[88px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
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

            <div className="rounded-lg bg-muted/40 p-3 space-y-2">
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
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">USSD Snapshot</CardTitle>
            <CardDescription>Live simulator and service status summary</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground uppercase">Service health</p>
              <div className="mt-1">
                <Badge variant={ussdPanelStats.healthStatus === 'healthy' ? 'secondary' : 'destructive'}>
                  {ussdPanelStats.healthStatus}
                </Badge>
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground uppercase">AI status</p>
              <p className="font-medium capitalize">{ussdPanelStats.aiStatus}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground uppercase">Flow</p>
                <p className="font-medium uppercase">{ussdPanelStats.flow}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground uppercase">Endpoint</p>
                <p className="font-medium">{ussdPanelStats.endpoint}</p>
              </div>
            </div>
            <div className="rounded-lg border p-3">
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


