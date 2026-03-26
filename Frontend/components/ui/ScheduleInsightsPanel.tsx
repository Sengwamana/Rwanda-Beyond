import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, Clock3, Droplets, Sprout } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './Card';
import { Badge } from './Badge';
import { EmptyState, ErrorState, LoadingState } from './Spinner';
import { farmService } from '../../services/farms';
import type { Farm, FertilizationSchedule, IrrigationSchedule } from '../../types';

type ResourceKind = 'irrigation' | 'fertilization';
type ResourceRole = 'farmer' | 'expert' | 'admin';

type ScheduleEntry = {
  farm: Farm;
  usageValue: number;
  schedule: IrrigationSchedule | FertilizationSchedule;
};

type UsageChartPoint = {
  label: string;
  value: number;
  count: number;
};

interface ScheduleInsightsPanelProps {
  resource: ResourceKind;
  role: ResourceRole;
  farms: Farm[];
  selectedFarmId?: string;
  title: string;
  description: string;
  emptyTitle?: string;
  emptyMessage?: string;
  maxFarms?: number;
}

const workspaceGridClass = 'dash-workspace-grid-lg';
const workspaceMainClass = 'dash-workspace-main-lg';
const workspaceRailClass = 'dash-workspace-rail-lg';
const centeredMetricTileClass = 'dash-metric-tile text-center min-h-[112px] flex flex-col justify-center';
const outlineBlockClass = 'dash-outline-block';

const getResourceIcon = (resource: ResourceKind) => (
  resource === 'irrigation' ? <Droplets size={18} className="text-primary" /> : <Sprout size={18} className="text-primary" />
);

const getResourceUnit = (resource: ResourceKind) => (resource === 'irrigation' ? 'L' : 'kg');

const getUsageValue = (resource: ResourceKind, schedule: IrrigationSchedule | FertilizationSchedule) => {
  if (resource === 'irrigation') {
    const irrigation = schedule as IrrigationSchedule;
    return irrigation.actualWaterVolume ?? irrigation.waterVolumeLiters ?? 0;
  }

  const fertilization = schedule as FertilizationSchedule;
  return (
    fertilization.actualQuantityKg
    ?? fertilization.totalQuantityKg
    ?? ((fertilization.nitrogenKg || 0) + (fertilization.phosphorusKg || 0) + (fertilization.potassiumKg || 0))
  );
};

const getScheduleDateValue = (schedule: IrrigationSchedule | FertilizationSchedule) =>
  schedule.executedAt || schedule.scheduledDate || schedule.createdAt;

const formatShortDate = (value?: string) => {
  if (!value) return 'Unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const formatNumber = (value: number, resource: ResourceKind) =>
  `${Math.round(value).toLocaleString()} ${getResourceUnit(resource)}`;

export function ScheduleInsightsPanel({
  resource,
  role,
  farms,
  selectedFarmId,
  title,
  description,
  emptyTitle,
  emptyMessage,
  maxFarms = 24,
}: ScheduleInsightsPanelProps) {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const scopedFarms = useMemo(() => {
    const deduped = Array.from(
      new Map(
        (Array.isArray(farms) ? farms : [])
          .filter((farm) => farm?.id)
          .map((farm) => [String(farm.id), farm])
      ).values()
    );

    if (role === 'farmer') {
      if (selectedFarmId) {
        return deduped.filter((farm) => String(farm.id) === String(selectedFarmId));
      }

      return deduped.slice(0, 1);
    }

    return deduped.slice(0, maxFarms);
  }, [farms, maxFarms, role, selectedFarmId]);

  useEffect(() => {
    let cancelled = false;

    if (!scopedFarms.length) {
      setEntries([]);
      setIsLoading(false);
      setHasError(false);
      return () => {
        cancelled = true;
      };
    }

    setIsLoading(true);
    setHasError(false);

    void (async () => {
      try {
        const results = await Promise.all(
          scopedFarms.map(async (farm) => {
            try {
              const response =
                resource === 'irrigation'
                  ? await farmService.getIrrigationSchedules(farm.id)
                  : await farmService.getFertilizationSchedules(farm.id);

              return (response.data || []).map((schedule) => ({
                farm,
                schedule,
                usageValue: getUsageValue(resource, schedule),
              }));
            } catch {
              return [];
            }
          })
        );

        if (cancelled) return;

        setEntries(results.flat());
      } catch {
        if (cancelled) return;
        setEntries([]);
        setHasError(true);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resource, scopedFarms]);

  const chartData = useMemo<UsageChartPoint[]>(() => {
    const grouped = new Map<string, UsageChartPoint>();

    entries.forEach((entry) => {
      const key =
        role === 'farmer'
          ? formatShortDate(getScheduleDateValue(entry.schedule))
          : role === 'expert'
            ? entry.farm.name || 'Unknown farm'
            : entry.farm.district?.name || entry.farm.locationName || entry.farm.name || 'Unknown area';

      const current = grouped.get(key) || { label: key, value: 0, count: 0 };
      current.value += entry.usageValue;
      current.count += 1;
      grouped.set(key, current);
    });

    const values = Array.from(grouped.values());

    if (role === 'farmer') {
      return values.slice(-7);
    }

    return values.sort((left, right) => right.value - left.value).slice(0, 8);
  }, [entries, role]);

  const executedCount = useMemo(
    () => entries.filter((entry) => Boolean((entry.schedule as IrrigationSchedule | FertilizationSchedule).isExecuted)).length,
    [entries]
  );

  const totalUsage = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.usageValue, 0),
    [entries]
  );

  const recentEntries = useMemo(
    () =>
      [...entries]
        .sort(
          (left, right) =>
            new Date(getScheduleDateValue(right.schedule)).getTime() - new Date(getScheduleDateValue(left.schedule)).getTime()
        )
        .slice(0, 6),
    [entries]
  );

  const breakdownLabel =
    role === 'farmer'
      ? 'Usage by date'
      : role === 'expert'
        ? 'Usage by assigned farm'
        : 'Usage by district';

  const fallbackEmptyTitle = emptyTitle || `No ${resource} records yet`;
  const fallbackEmptyMessage =
    emptyMessage
    || `No ${resource} schedules are available for the current ${role} workspace.`;

  return (
    <div className={workspaceGridClass}>
      <Card className={`${workspaceMainClass} dash-panel`}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {getResourceIcon(resource)}
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <LoadingState text={`Loading ${resource} insights...`} />
          ) : hasError ? (
            <ErrorState
              title={`Failed to load ${resource} insights`}
              message={`The ${resource} workspace could not load schedule data right now.`}
            />
          ) : entries.length === 0 ? (
            <EmptyState title={fallbackEmptyTitle} message={fallbackEmptyMessage} />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className={centeredMetricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase">Schedules</p>
                  <p className="text-xl font-semibold">{entries.length}</p>
                </div>
                <div className={centeredMetricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase">Executed</p>
                  <p className="text-xl font-semibold">{executedCount}</p>
                </div>
                <div className={centeredMetricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase">Total Usage</p>
                  <p className="text-xl font-semibold">{formatNumber(totalUsage, resource)}</p>
                </div>
                <div className={centeredMetricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase">Coverage</p>
                  <p className="text-xl font-semibold">{scopedFarms.length} farms</p>
                </div>
              </div>

              <div className="dash-soft-block">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <BarChart3 size={16} className="text-primary" />
                      {breakdownLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {role === 'farmer'
                        ? `Trend for ${scopedFarms[0]?.name || 'the selected farm'}`
                        : role === 'expert'
                          ? 'Aggregate usage across expert-accessible farms'
                          : 'Aggregate usage across the admin farm scope'}
                    </p>
                  </div>
                  <Badge variant="outline">{getResourceUnit(resource)} usage</Badge>
                </div>

                <div className="mt-4 h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} />
                      <Tooltip
                        formatter={(value: number) => [formatNumber(Number(value), resource), 'Usage']}
                        labelFormatter={(label) => `${label}`}
                      />
                      <Bar dataKey="value" fill={resource === 'irrigation' ? '#059669' : '#65a30d'} radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className={workspaceRailClass}>
        <Card className="dash-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Recent Activity</CardTitle>
            <CardDescription>Latest {resource} schedules in this workspace</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <LoadingState text={`Loading ${resource} activity...`} size="sm" />
            ) : recentEntries.length ? (
              recentEntries.map((entry) => (
                <div
                  key={`${entry.farm.id}-${entry.schedule.id}`}
                  className={`${outlineBlockClass} flex items-start justify-between gap-3`}
                >
                  <div>
                    <p className="font-medium">{entry.farm.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatShortDate(getScheduleDateValue(entry.schedule))} · {formatNumber(entry.usageValue, resource)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {entry.farm.district?.name || entry.farm.locationName || 'Location not set'}
                    </p>
                  </div>
                  <Badge variant={entry.schedule.isExecuted ? 'secondary' : 'outline'}>
                    {entry.schedule.isExecuted ? (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        Executed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Clock3 size={12} />
                        Planned
                      </span>
                    )}
                  </Badge>
                </div>
              ))
            ) : (
              <EmptyState title={fallbackEmptyTitle} message={fallbackEmptyMessage} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ScheduleInsightsPanel;
