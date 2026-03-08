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
  useUsers,
  useAdminAnalytics,
  useUpdateUser,
  useAuditLogs,
  useAdminDevices,
  useAdminConfigs,
  useUpdateSystemConfig,
  useGenerateDeviceToken,
  useRevokeDeviceToken,
  useSystemHealth,
  useSystemMetrics,
  useSendBroadcast,
  useGenerateAdminReport,
  useSystemAnalytics,
  useAllDistrictsAnalytics,
  useContentResources,
  useContentFAQ,
  useAiHealth,
} from '../hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { LoadingState, ErrorState, EmptyState } from './ui/Spinner';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { UserRole } from '../types';

type AdminTab =
  | 'overview'
  | 'users'
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

const normalizeTab = (value?: string): AdminTab =>
  ADMIN_TABS.includes((value || 'overview') as AdminTab) ? (value as AdminTab) : 'overview';

const toDateString = (value?: string | number) => {
  if (!value) return 'N/A';
  const parsed = typeof value === 'number' ? new Date(value) : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleString();
};

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
  const [auditPage, setAuditPage] = useState(1);
  const [devicesPage, setDevicesPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [metricsPeriod, setMetricsPeriod] = useState<'1h' | '6h' | '24h' | '7d'>('24h');
  const [reportType, setReportType] = useState<'summary' | 'users' | 'farms' | 'sensors' | 'recommendations' | 'pest-detections'>('summary');
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
  const [tabExportFormat, setTabExportFormat] = useState<'csv' | 'json'>('csv');
  const normalizedExternalSearch = searchQuery.trim();
  const effectiveSearch = normalizedExternalSearch || search;

  useEffect(() => {
    setUsersPage(1);
  }, [effectiveSearch, roleFilter, statusFilter]);

  useEffect(() => {
    if (tab === 'users') return;
    setUsersPage(1);
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
  const recentUsersQuery = useUsers({ page: 1, limit: 5 }, tab === 'overview');
  const analyticsQuery = useAdminAnalytics({ period: '30d' }, tab === 'overview' || tab === 'monitoring');

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
  const auditLogsQuery = useAuditLogs({ page: auditPage, limit: 30 }, tab === 'audit');
  const devicesQuery = useAdminDevices({ page: devicesPage, limit: 20 }, tab === 'devices');
  const configsQuery = useAdminConfigs(tab === 'config');
  const healthQuery = useSystemHealth(tab === 'monitoring');
  const metricsQuery = useSystemMetrics({ period: metricsPeriod }, tab === 'monitoring');

  const updateUserMutation = useUpdateUser();
  const updateConfigMutation = useUpdateSystemConfig();
  const generateDeviceTokenMutation = useGenerateDeviceToken();
  const revokeDeviceTokenMutation = useRevokeDeviceToken();
  const sendBroadcastMutation = useSendBroadcast();
  const generateReportMutation = useGenerateAdminReport();

  const overview = overviewQuery.data as any;
  const analytics = analyticsQuery.data as any;
  const users = usersQuery.data?.data || [];
  const auditLogs = auditLogsQuery.data?.data || [];
  const devices = devicesQuery.data?.data || [];
  const health = healthQuery.data as any;
  const metrics = metricsQuery.data as any;

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

  const handleRoleChange = (user: any, role: UserRole) => {
    updateUserMutation.mutate({ id: user.id, data: { role } });
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
        targetRole: broadcastRole === 'all' ? 'all' : broadcastRole,
        priority: 'normal',
      });
      setBroadcastMessage('');
      setBroadcastMessageRw('');
    } catch {
      // Error notification is handled in the mutation hook.
    }
  };

  const handleRefreshTab = () => {
    if (tab === 'overview') {
      overviewQuery.refetch();
      recentUsersQuery.refetch();
      analyticsQuery.refetch();
      return;
    }
    if (tab === 'users') {
      usersQuery.refetch();
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

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={tabExportFormat}
          onChange={(event) => setTabExportFormat(event.target.value as 'csv' | 'json')}
        >
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </select>
        <Button variant="outline" size="sm" onClick={handleExportCurrentTab}>
          Export Tab
        </Button>
        <Button variant="outline" size="sm" onClick={handleRefreshTab}>
          <RefreshCw size={14} className="mr-2" />
          Refresh Tab
        </Button>
      </div>

      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <Users className="text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Users</p>
                    <p className="text-2xl font-bold">{overviewCards.totalUsers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <Sprout className="text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Farms</p>
                    <p className="text-2xl font-bold">{overviewCards.totalFarms}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <Activity className="text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Sensors</p>
                    <p className="text-2xl font-bold">{overviewCards.totalSensors}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="text-red-500" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending Recommendations</p>
                    <p className="text-2xl font-bold">{overviewCards.pendingAlerts}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
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

          <Card>
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
        </>
      )}

      {tab === 'users' && (
        <Card>
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
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={handleResetUserFilters}
                disabled={normalizedExternalSearch.length > 0}
              >
                Reset Filters
              </Button>
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
                    </div>
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
      )}

      {tab === 'audit' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileClock size={20} />
              Audit Logs
            </CardTitle>
            <CardDescription>Recent system actions and security events</CardDescription>
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
      )}

      {tab === 'devices' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu size={20} />
                Device Management
              </CardTitle>
              <CardDescription>Manage IoT device tokens and provisioning</CardDescription>
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
                <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm space-y-1">
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
      )}

      {tab === 'config' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SlidersHorizontal size={20} />
              System Configuration
            </CardTitle>
            <CardDescription>Live configuration keys from backend</CardDescription>
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
      )}

      {tab === 'monitoring' && (
        <div className="space-y-6">
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
              <CardTitle>Operational Metrics</CardTitle>
              <CardDescription>Backend metrics for selected window</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-end">
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
      )}

      {tab === 'reports' && (
        <Card>
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
                      event.target.value as 'summary' | 'users' | 'farms' | 'sensors' | 'recommendations' | 'pest-detections'
                    )
                  }
                >
                  <option value="summary">Summary</option>
                  <option value="users">Users</option>
                  <option value="farms">Farms</option>
                  <option value="sensors">Sensors</option>
                  <option value="recommendations">Recommendations</option>
                  <option value="pest-detections">Pest Detections</option>
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

              <Button type="submit" disabled={generateReportMutation.isPending}>
                Generate Report
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {tab === 'broadcast' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send size={20} />
              Broadcast Message
            </CardTitle>
            <CardDescription>Send operational updates to selected user groups</CardDescription>
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
              <Button type="submit" disabled={sendBroadcastMutation.isPending || !broadcastMessage.trim()}>
                Queue Broadcast
              </Button>
            </form>
          </CardContent>
        </Card>
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
  const s = systemStats as any;

  return (
    <div className="space-y-6">
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
  );
}

// ---------- Admin Content Panel ----------
function AdminContentPanel() {
  const { data: resourcesData, isLoading: resLoading } = useContentResources();
  const { data: faqData, isLoading: faqLoading } = useContentFAQ();
  const [activeSection, setActiveSection] = useState<'resources' | 'faq'>('resources');

  const resources = (resourcesData as any)?.items ?? [];
  const faqs = (faqData as any)?.items ?? [];

  return (
    <div className="space-y-6">
      <Card>
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
                      <p className="text-xs text-muted-foreground">{r.category} · {r.type || 'article'}</p>
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
    </div>
  );
}

// ---------- Admin USSD Panel ----------
function AdminUssdPanel() {
  const { data: aiHealth, isLoading } = useAiHealth();
  const h = aiHealth as any;

  return (
    <div className="space-y-6">
      <Card>
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
              <span className="flex items-center gap-1.5 text-sm">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                Active (Africa's Talking)
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Callback endpoints are active at <code className="bg-muted px-1 rounded text-xs">/ussd/callback</code> and{' '}
              <code className="bg-muted px-1 rounded text-xs">/ussd/callback/v2</code>.
              The v2 endpoint includes automatic language detection (English / Kinyarwanda).
            </p>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <p className="font-medium">AI Service Health</p>
            {isLoading ? (
              <LoadingState text="Checking AI status..." size="sm" />
            ) : h ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className={h.status === 'healthy' ? 'text-green-500' : 'text-yellow-500'} />
                  <span className="font-medium capitalize">{h.status}</span>
                  <span className="text-xs text-muted-foreground">({h.provider} · {h.model ?? 'default model'})</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Last checked: {h.lastChecked ? new Date(h.lastChecked).toLocaleString() : 'N/A'}
                </p>
              </div>
            ) : (
              <EmptyState title="Unavailable" message="Could not retrieve AI health status." />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ConnectedAdminDashboard;
