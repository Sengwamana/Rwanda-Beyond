import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Sprout, Bug, Activity, RefreshCw, CheckCircle2, XCircle, Clock3, BarChart2, Bot, Cloud } from 'lucide-react';
import {
  useFarms,
  useFarmIssues,
  usePestStatistics,
  usePestOutbreakMap,
  useRecommendationHistoryList,
  usePendingRecommendations,
  useRecommendation,
  usePendingReviews,
  usePestDetection,
  useRespondToRecommendation,
  useReviewPestDetection,
  useReanalyzePestDetection,
  useGenerateRecommendations,
  useCreateManualRecommendation,
  useAllDistrictsAnalytics,
  useDistrictAnalytics,
  useDistrictWeather,
  useWeatherByCoordinates,
  useRecommendationHistoryAnalytics,
  useFarmActivityAnalytics,
  usePestControlSchedules,
  useSensorHealth,
  useRecentActivityAnalytics,
  useExportFarmActivity,
  useExportRecentActivity,
  useUpdateFarmIssue,
  useAiAdvice,
} from '../hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { LoadingState, ErrorState, EmptyState, Spinner } from './ui/Spinner';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { FormattedAiResponse } from './ui/FormattedAiResponse';
import { MapboxMap, type MapboxMarkerData, type MapboxMarkerTone } from './ui/MapboxMap';
import { ScheduleInsightsPanel } from './ui/ScheduleInsightsPanel';
import { useAuthStore } from '../store';
import type { Farm } from '../types';

interface ConnectedExpertDashboardProps {
  searchQuery?: string;
  activeTab?: string;
}

const DASH_CONTROL_CLASS = 'dash-control';
const DASH_CONTROL_COMPACT_CLASS = 'dash-control-compact';
const DASH_TEXTAREA_CLASS = 'dash-textarea';
const DASH_ACTION_CLASS = 'dash-action-btn';
const DASH_ACTION_SM_CLASS = 'dash-action-btn-sm';
const DASH_ACTION_LG_CLASS = 'dash-action-btn-lg';
const controlClass = DASH_CONTROL_CLASS;
const compactControlClass = DASH_CONTROL_COMPACT_CLASS;
const textAreaClass = DASH_TEXTAREA_CLASS;
const actionClass = DASH_ACTION_CLASS;
const actionSmClass = DASH_ACTION_SM_CLASS;
const actionLgClass = DASH_ACTION_LG_CLASS;

const recommendationPriorityClass: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
};

const confirmAction = (message: string): boolean => {
  if (typeof window === 'undefined') return true;
  return window.confirm(message);
};

const getSensorStatusBadgeVariant = (status?: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'healthy' || normalized === 'active' || normalized === 'online') return 'secondary';
  if (normalized === 'warning') return 'default';
  if (normalized === 'critical' || normalized === 'offline' || normalized === 'faulty') return 'destructive';
  return 'outline';
};

const matchesSearchTerm = (term: string, values: Array<unknown>) => {
  if (!term) return true;
  return values
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(term);
};

const normalizeLocationKey = (value: unknown) => String(value || '').trim().toLowerCase();

const getUserDistrictKeys = (user: any) =>
  Array.from(
    new Set(
      [
        user?.districtId,
        user?.district_id,
        user?.metadata?.districtId,
        user?.metadata?.district_id,
      ]
        .map(normalizeLocationKey)
        .filter(Boolean)
    )
  );

const getFarmDistrictKeys = (farm?: Partial<Farm> | null) =>
  Array.from(
    new Set(
      [
        farm?.districtId,
        (farm as any)?.district_id,
        farm?.district?.id,
        farm?.district?.name,
      ]
        .map(normalizeLocationKey)
        .filter(Boolean)
    )
  );

const getFarmMapCoordinates = (farm?: Partial<Farm> | null) => {
  if (typeof farm?.coordinates?.lat === 'number' && typeof farm?.coordinates?.lng === 'number') {
    return farm.coordinates;
  }

  const sensorCoordinates = farm?.sensors?.find(
    (sensor) => typeof sensor.coordinates?.lat === 'number' && typeof sensor.coordinates?.lng === 'number'
  )?.coordinates;

  return typeof sensorCoordinates?.lat === 'number' && typeof sensorCoordinates?.lng === 'number'
    ? sensorCoordinates
    : undefined;
};

type SearchScopeItem = {
  label: string;
  value: number;
  total?: number;
};

function SearchScopePills({ items }: { items: SearchScopeItem[] }) {
  if (!items.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <span
          key={item.label}
          className="dash-pill bg-green-100 text-green-800 dark:bg-green-900/35 dark:text-green-300"
        >
          {item.label}: {item.value}
          {typeof item.total === 'number' ? `/${item.total}` : ''}
        </span>
      ))}
    </div>
  );
}

type ExpertFarmActivityExportType =
  | 'all'
  | 'recommendation'
  | 'irrigation'
  | 'fertilization'
  | 'pest_control'
  | 'pest_detection'
  | 'farm_issue';

export function ConnectedExpertDashboard({ searchQuery = '', activeTab = 'overview' }: ConnectedExpertDashboardProps) {
  const { user } = useAuthStore();
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [reviewStrategyDrafts, setReviewStrategyDrafts] = useState<
    Record<string, { expertNotes: string; treatmentText: string }>
  >({});
  const [manualRecommendationType, setManualRecommendationType] = useState<'general' | 'irrigation' | 'fertilization' | 'pest_alert' | 'weather_alert'>('general');
  const [manualRecommendationPriority, setManualRecommendationPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [manualRecommendationTitle, setManualRecommendationTitle] = useState('');
  const [manualRecommendationDescription, setManualRecommendationDescription] = useState('');
  const [manualRecommendationAction, setManualRecommendationAction] = useState('');
  const [manualRecommendationValidUntil, setManualRecommendationValidUntil] = useState(() => {
    const nextDay = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return nextDay.toISOString().slice(0, 16);
  });
  const [recommendationTypeFilter, setRecommendationTypeFilter] = useState<'all' | string>('all');
  const [reviewSeverityFilter, setReviewSeverityFilter] = useState<'all' | string>('all');
  const [issueStatusFilter, setIssueStatusFilter] = useState<'all' | string>('all');
  const [activityHours, setActivityHours] = useState<6 | 24 | 168>(24);
  const [activityType, setActivityType] = useState<'all' | 'user' | 'farm' | 'recommendation' | 'pest_detection' | 'pest_control' | 'sensor_reading'>('all');
  const [recommendationPage, setRecommendationPage] = useState(1);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState('');
  const [pendingReviewPage, setPendingReviewPage] = useState(1);
  const [selectedReviewId, setSelectedReviewId] = useState('');
  const [issuePage, setIssuePage] = useState(1);
  const isSnapshotTab = activeTab === 'overview';
  const isFarmCoordinationTab = activeTab === 'farm-coordination';
  const isFieldSupportTab = activeTab === 'field-support';
  const isIrrigationTab = activeTab === 'irrigation';
  const isFertilizationTab = activeTab === 'fertilization';
  const isExpertGuidanceTab = activeTab === 'expert-guidance';
  const isIssueOversightTab = activeTab === 'issue-oversight';
  const isReviewLanesTab = activeTab === 'review-lanes';
  const isDistrictAnalyticsTab = activeTab === 'district-analytics';
  const isMapViewTab = activeTab === 'map-view';
  const isAiAdviceTab = activeTab === 'ai-advice';
  const showExpertWorkspaceChrome =
    isSnapshotTab
    || isFarmCoordinationTab
    || isFieldSupportTab
    || isIrrigationTab
    || isFertilizationTab
    || isExpertGuidanceTab
    || isIssueOversightTab
    || isReviewLanesTab
    || isMapViewTab;

  const {
    data: farmsResponse,
    isLoading: farmsLoading,
    error: farmsError,
    refetch: refetchFarms,
  } = useFarms({ page: 1, limit: 100 });
  const {
    data: pestStats,
    isLoading: pestStatsLoading,
    refetch: refetchPestStats,
  } = usePestStatistics();
  const {
    data: recommendationsResponse,
    isLoading: recommendationsLoading,
    refetch: refetchRecommendations,
  } = usePendingRecommendations({ page: recommendationPage, limit: 20 });
  const {
    data: selectedRecommendation,
    isLoading: selectedRecommendationLoading,
    refetch: refetchSelectedRecommendation,
  } = useRecommendation(selectedRecommendationId);
  const {
    data: pendingReviewsResponse,
    isLoading: pendingReviewsLoading,
    refetch: refetchPendingReviews,
  } = usePendingReviews({ page: pendingReviewPage, limit: 20 });
  const {
    data: selectedReview,
    isLoading: selectedReviewLoading,
    refetch: refetchSelectedReview,
  } = usePestDetection(selectedReviewId);
  const {
    data: farmIssuesResponse,
    isLoading: farmIssuesLoading,
    refetch: refetchFarmIssues,
  } = useFarmIssues(
    selectedFarmId || '',
    {
      page: issuePage,
      limit: 10,
      status: issueStatusFilter === 'all' ? undefined : issueStatusFilter,
    },
    !!selectedFarmId
  );

  const respondToRecommendation = useRespondToRecommendation();
  const reviewPestDetection = useReviewPestDetection();
  const reanalyzePestDetection = useReanalyzePestDetection();
  const generateRecommendations = useGenerateRecommendations();
  const createManualRecommendation = useCreateManualRecommendation();
  const updateFarmIssue = useUpdateFarmIssue();
  const exportFarmActivity = useExportFarmActivity();
  const exportRecentActivity = useExportRecentActivity();

  const farms = farmsResponse?.data || [];
  const recommendations = recommendationsResponse?.data || [];
  const pendingReviews = pendingReviewsResponse?.data || [];
  const farmIssues = farmIssuesResponse?.data || [];

  const normalizedSearch = searchQuery.trim().toLowerCase();

  useEffect(() => {
    setRecommendationPage(1);
  }, [selectedFarmId, recommendationTypeFilter, normalizedSearch]);

  useEffect(() => {
    if (!selectedRecommendationId && recommendationsResponse?.data?.length) {
      setSelectedRecommendationId(recommendationsResponse.data[0].id);
      return;
    }
    if (
      selectedRecommendationId
      && recommendationsResponse?.data?.length
      && !recommendationsResponse.data.some((recommendation) => recommendation.id === selectedRecommendationId)
    ) {
      setSelectedRecommendationId(recommendationsResponse.data[0].id);
    }
  }, [recommendationsResponse?.data, selectedRecommendationId]);

  useEffect(() => {
    setPendingReviewPage(1);
  }, [selectedFarmId, reviewSeverityFilter, normalizedSearch]);

  useEffect(() => {
    if (!selectedReviewId && pendingReviewsResponse?.data?.length) {
      setSelectedReviewId(pendingReviewsResponse.data[0].id);
      return;
    }
    if (
      selectedReviewId
      && pendingReviewsResponse?.data?.length
      && !pendingReviewsResponse.data.some((review) => review.id === selectedReviewId)
    ) {
      setSelectedReviewId(pendingReviewsResponse.data[0].id);
    }
  }, [pendingReviewsResponse?.data, selectedReviewId]);

  useEffect(() => {
    setIssuePage(1);
  }, [selectedFarmId, issueStatusFilter, normalizedSearch]);

  const filteredFarms = useMemo(() => {
    if (!normalizedSearch) return farms;
    return farms.filter((farm) => {
      return matchesSearchTerm(normalizedSearch, [farm.name, farm.locationName, farm.district?.name, farm.currentGrowthStage]);
    });
  }, [farms, normalizedSearch]);

  const selectedFarm = farms.find((farm) => farm.id === selectedFarmId) || null;
  const expertMapDistrictKeys = useMemo(
    () => Array.from(new Set([...getFarmDistrictKeys(selectedFarm), ...getUserDistrictKeys(user)])),
    [selectedFarm, user]
  );
  const districtScopedFarms = useMemo(() => {
    if (!expertMapDistrictKeys.length) return filteredFarms;

    const matchingDistrictFarms = filteredFarms.filter((farm) =>
      getFarmDistrictKeys(farm).some((districtKey) => expertMapDistrictKeys.includes(districtKey))
    );

    return matchingDistrictFarms.length ? matchingDistrictFarms : filteredFarms;
  }, [expertMapDistrictKeys, filteredFarms]);
  const expertMapDistrictLabel =
    selectedFarm?.district?.name
    || districtScopedFarms.find((farm) => farm.district?.name)?.district?.name
    || (expertMapDistrictKeys.length ? 'Assigned district' : 'All assigned districts');
  const {
    data: responseHistory,
    isLoading: responseHistoryLoading,
  } = useRecommendationHistoryAnalytics(selectedFarm?.id || '', { days: 30 });
  const {
    data: recommendationHistoryFeed,
    isLoading: recommendationHistoryFeedLoading,
  } = useRecommendationHistoryList(
    {
      farmId: selectedFarm?.id || undefined,
      page: 1,
      limit: 6,
    },
    isFarmCoordinationTab
  );
  const {
    data: selectedFarmActivity,
    isLoading: selectedFarmActivityLoading,
  } = useFarmActivityAnalytics(selectedFarm?.id || '', { days: 30, limit: 20 });
  const {
    data: pestControlSchedules = [],
    isLoading: pestControlSchedulesLoading,
  } = usePestControlSchedules(selectedFarm?.id || '');
  const {
    data: sensorHealth,
    isLoading: sensorHealthLoading,
    refetch: refetchSensorHealth,
  } = useSensorHealth(selectedFarm?.id || undefined, isFarmCoordinationTab);
  const {
    data: recentActivity,
    isLoading: recentActivityLoading,
  } = useRecentActivityAnalytics({ hours: activityHours, limit: 6, type: activityType }, isExpertGuidanceTab);
  const { data: expertMapOutbreak } = usePestOutbreakMap({ days: 30 }, false);
  const filteredRecommendations = useMemo(() => {
    return recommendations.filter((recommendation) => {
      if (selectedFarmId && recommendation.farmId !== selectedFarmId) return false;
      if (recommendationTypeFilter !== 'all' && recommendation.type !== recommendationTypeFilter) return false;
      if (!normalizedSearch) return true;
      return matchesSearchTerm(normalizedSearch, [
        recommendation.title,
        recommendation.description,
        recommendation.type,
        recommendation.priority,
        recommendation.farm?.name,
      ]);
    });
  }, [recommendations, selectedFarmId, normalizedSearch, recommendationTypeFilter]);

  const filteredPendingReviews = useMemo(() => {
    return pendingReviews.filter((review) => {
      if (selectedFarmId && review.farmId !== selectedFarmId) return false;
      if (reviewSeverityFilter !== 'all' && review.severity !== reviewSeverityFilter) return false;
      if (!normalizedSearch) return true;
      return matchesSearchTerm(normalizedSearch, [
        review.pestType,
        review.severity,
        review.locationDescription,
        review.farm?.name,
      ]);
    });
  }, [pendingReviews, selectedFarmId, normalizedSearch, reviewSeverityFilter]);

  const filteredFarmIssues = useMemo(() => {
    return farmIssues.filter((issue) => {
      if (!normalizedSearch) return true;
      return matchesSearchTerm(normalizedSearch, [
        issue.title,
        issue.description,
        issue.category,
        issue.severity,
        issue.status,
        issue.farm?.name,
      ]);
    });
  }, [farmIssues, normalizedSearch]);
  const filteredRecommendationHistoryFeed = useMemo(() => {
    const items = recommendationHistoryFeed?.data || [];
    if (!normalizedSearch) return items;
    return items.filter((item) =>
      matchesSearchTerm(normalizedSearch, [
        item.title,
        item.type,
        item.status,
        item.recommendedAction,
        item.farm?.name,
        item.farmId,
      ])
    );
  }, [normalizedSearch, recommendationHistoryFeed?.data]);
  const pendingPestControlSchedules = useMemo(
    () => pestControlSchedules.filter((schedule) => !schedule.isExecuted),
    [pestControlSchedules]
  );
  const completedPestControlSchedules = useMemo(
    () =>
      pestControlSchedules
        .filter((schedule) => schedule.isExecuted)
        .sort((left, right) => new Date(right.executedAt || right.updatedAt).getTime() - new Date(left.executedAt || left.updatedAt).getTime()),
    [pestControlSchedules]
  );
  const pestControlActivity = useMemo(
    () =>
      (selectedFarmActivity?.activity || [])
        .filter((item) => item.type === 'pest_control')
        .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()),
    [selectedFarmActivity]
  );
  const filteredPendingPestControlSchedules = useMemo(() => {
    if (!normalizedSearch) return pendingPestControlSchedules;
    return pendingPestControlSchedules.filter((schedule) =>
      matchesSearchTerm(normalizedSearch, [
        schedule.controlMethod,
        schedule.notes,
        schedule.scheduledDate,
        schedule.scheduledTime,
        schedule.triggerSource,
      ])
    );
  }, [normalizedSearch, pendingPestControlSchedules]);
  const filteredCompletedPestControlSchedules = useMemo(() => {
    if (!normalizedSearch) return completedPestControlSchedules;
    return completedPestControlSchedules.filter((schedule) =>
      matchesSearchTerm(normalizedSearch, [
        schedule.controlMethod,
        schedule.notes,
        schedule.scheduledDate,
        schedule.executedAt,
        schedule.actualOutcome,
      ])
    );
  }, [completedPestControlSchedules, normalizedSearch]);
  const filteredPestControlActivity = useMemo(() => {
    if (!normalizedSearch) return pestControlActivity;
    return pestControlActivity.filter((item) =>
      matchesSearchTerm(normalizedSearch, [
        item.title,
        item.description,
        item.type,
        item.action,
        item.status,
      ])
    );
  }, [normalizedSearch, pestControlActivity]);
  const formatActivityLabel = (value: string) =>
    value
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
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
  const handleExportRecentActivity = async (format: 'csv' | 'json') => {
    try {
      const blob = await exportRecentActivity.mutateAsync({
        hours: activityHours,
        limit: 100,
        type: activityType,
        format,
      });
      downloadBlob(blob, `expert-system-activity.${format}`);
    } catch {
      // Error notification handled in mutation hook.
    }
  };
  const handleExportFarmActivity = async (
    format: 'csv' | 'json',
    type: ExpertFarmActivityExportType = 'all'
  ) => {
    if (!selectedFarm) return;

    try {
      const blob = await exportFarmActivity.mutateAsync({
        farmId: selectedFarm.id,
        params: {
          days: 30,
          limit: 100,
          type,
          format,
        },
      });
      const suffix = type === 'all' ? 'activity' : `${type}-activity`;
      downloadBlob(blob, `expert-farm-${selectedFarm.id}-${suffix}.${format}`);
    } catch {
      // Error notification handled in mutation hook.
    }
  };

  const recommendationTypes = useMemo(
    () =>
      Array.from(new Set(recommendations.map((recommendation) => recommendation.type).filter(Boolean))).sort(),
    [recommendations]
  );

  const reviewSeverities = useMemo(
    () =>
      Array.from(new Set(pendingReviews.map((review) => review.severity).filter(Boolean))).sort(),
    [pendingReviews]
  );

  const farmCount = farmsResponse?.pagination?.total || farms.length;
  const filteredRecentActivityItems = useMemo(() => {
    const items = Array.isArray(recentActivity?.activities) ? recentActivity.activities : [];
    if (!normalizedSearch) return items;
    return items.filter((item) =>
      matchesSearchTerm(normalizedSearch, [
        item.title,
        item.description,
        item.type,
        item.status,
      ])
    );
  }, [normalizedSearch, recentActivity?.activities]);
  const expertSearchScopeItems = useMemo<SearchScopeItem[]>(() => {
    if (!normalizedSearch) return [];

    return [
      { label: 'Farms', value: filteredFarms.length, total: farms.length },
      { label: 'Recommendations', value: filteredRecommendations.length, total: recommendations.length },
      { label: 'Reviews', value: filteredPendingReviews.length, total: pendingReviews.length },
      { label: 'Issues', value: filteredFarmIssues.length, total: farmIssues.length },
      {
        label: 'History',
        value: filteredRecommendationHistoryFeed.length,
        total: Array.isArray(recommendationHistoryFeed?.data) ? recommendationHistoryFeed.data.length : 0,
      },
      {
        label: 'Activity',
        value: filteredRecentActivityItems.length,
        total: Array.isArray(recentActivity?.activities) ? recentActivity.activities.length : 0,
      },
    ];
  }, [
    farmIssues.length,
    farms.length,
    filteredFarms.length,
    filteredFarmIssues.length,
    filteredPendingReviews.length,
    filteredRecommendationHistoryFeed.length,
    filteredRecommendations.length,
    filteredRecentActivityItems.length,
    normalizedSearch,
    pendingReviews.length,
    recentActivity?.activities,
    recommendationHistoryFeed?.data,
    recommendations.length,
  ]);
  const pendingRecommendationCount =
    recommendationsResponse?.pagination?.total || recommendations.length;
  const pendingReviewCount = pestStats?.pendingReviewCount || pendingReviewsResponse?.pagination?.total || 0;
  const severePestCount = (pestStats?.bySeverity?.severe || 0) + (pestStats?.bySeverity?.high || 0);
  const expertDistrictCount = useMemo(() => {
    return new Set(
      farms.map((farm) => farm.district?.name || farm.districtId || 'Unknown district')
    ).size;
  }, [farms]);
  const issueStatusCounts = useMemo(() => {
    return filteredFarmIssues.reduce(
      (counts, issue) => {
        const status = issue.status || 'open';
        if (status === 'open') counts.open += 1;
        if (status === 'in_progress') counts.inProgress += 1;
        if (status === 'resolved') counts.resolved += 1;
        if (status === 'closed') counts.closed += 1;
        return counts;
      },
      { open: 0, inProgress: 0, resolved: 0, closed: 0 }
    );
  }, [filteredFarmIssues]);
  const expertMapFarmMarkers = useMemo<MapboxMarkerData[]>(
    () =>
      districtScopedFarms.flatMap((farm) => {
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
          label: farm.name,
          badge: farm.cropVariety || 'Farm',
          description: farm.locationName || farm.district?.name || 'Assigned farm',
          tone: selectedFarm?.id === farm.id ? 'info' : 'success',
        }];
      }),
    [districtScopedFarms, selectedFarm?.id]
  );
  const expertMapOutbreakMarkers = useMemo<MapboxMarkerData[]>(
    () =>
      (expertMapOutbreak?.detections || []).flatMap((detection: any) => {
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
    [expertMapOutbreak?.detections]
  );

  const isAnyActionPending =
    respondToRecommendation.isPending
    || reviewPestDetection.isPending
    || reanalyzePestDetection.isPending
    || generateRecommendations.isPending
    || createManualRecommendation.isPending
    || updateFarmIssue.isPending;

  const handleRefreshAll = () => {
    refetchFarms();
    refetchPestStats();
    refetchRecommendations();
    if (selectedRecommendationId) {
      refetchSelectedRecommendation();
    }
    refetchPendingReviews();
    if (selectedReviewId) {
      refetchSelectedReview();
    }
    refetchFarmIssues();
    refetchSensorHealth();
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

  const handleGenerateForFarm = () => {
    if (!selectedFarmId) return;
    generateRecommendations.mutate(selectedFarmId);
  };

  const resetManualRecommendationForm = () => {
    setManualRecommendationType('general');
    setManualRecommendationPriority('medium');
    setManualRecommendationTitle('');
    setManualRecommendationDescription('');
    setManualRecommendationAction('');
    const nextDay = new Date(Date.now() + 24 * 60 * 60 * 1000);
    setManualRecommendationValidUntil(nextDay.toISOString().slice(0, 16));
  };

  const handleCreateManualRecommendation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFarmId) return;
    if (!manualRecommendationTitle.trim() || !manualRecommendationDescription.trim() || !manualRecommendationAction.trim()) {
      return;
    }

    try {
      await createManualRecommendation.mutateAsync({
        farmId: selectedFarmId,
        type: manualRecommendationType,
        priority: manualRecommendationPriority,
        title: manualRecommendationTitle.trim(),
        description: manualRecommendationDescription.trim(),
        actionRequired: manualRecommendationAction.trim(),
        validUntil: manualRecommendationValidUntil
          ? new Date(manualRecommendationValidUntil).toISOString()
          : undefined,
      });
      setRecommendationPage(1);
      resetManualRecommendationForm();
    } catch {
      // Error notification handled in mutation hook.
    }
  };

  const handleRecommendationResponse = (recommendationId: string, status: 'accepted' | 'rejected') => {
    respondToRecommendation.mutate({ id: recommendationId, data: { status } });
  };

  const handleRecommendationDefer = (recommendationId: string) => {
    const deferUntil = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    respondToRecommendation.mutate({
      id: recommendationId,
      data: { status: 'deferred', deferredUntil: deferUntil },
    });
  };

  const handlePestReview = (
    detectionId: string,
    verdict: 'confirm' | 'reject',
    defaultPestType?: string,
    defaultSeverity?: string,
    strategy?: { expertNotes?: string; treatmentRecommendations?: string[] }
  ) => {
    reviewPestDetection.mutate({
      id: detectionId,
      data: {
        isConfirmed: verdict === 'confirm',
        pestType: verdict === 'confirm' ? defaultPestType || 'unclassified' : 'none',
        severity: verdict === 'confirm' ? defaultSeverity || 'moderate' : 'none',
        expertNotes:
          strategy?.expertNotes
          || (verdict === 'confirm'
            ? 'Confirmed by expert dashboard review.'
            : 'Rejected by expert dashboard review.'),
        treatmentRecommendations: strategy?.treatmentRecommendations,
      },
    });
  };

  const getAiTreatmentSuggestions = (review: any): string[] => {
    const suggestions = review?.detectionMetadata?.analysis?.recommendations;
    return Array.isArray(suggestions) ? suggestions.filter(Boolean) : [];
  };

  const openReviewStrategyEditor = (review: any) => {
    const existingDraft = reviewStrategyDrafts[review.id];
    if (!existingDraft) {
      const suggestedTreatments = review?.treatmentRecommendations?.length
        ? review.treatmentRecommendations
        : getAiTreatmentSuggestions(review);
      setReviewStrategyDrafts((current) => ({
        ...current,
        [review.id]: {
          expertNotes: review.expertNotes || '',
          treatmentText: suggestedTreatments.join('\n'),
        },
      }));
    }
    setEditingReviewId(review.id);
  };

  const updateReviewStrategyDraft = (
    reviewId: string,
    key: 'expertNotes' | 'treatmentText',
    value: string
  ) => {
    setReviewStrategyDrafts((current) => ({
      ...current,
      [reviewId]: {
        expertNotes: current[reviewId]?.expertNotes || '',
        treatmentText: current[reviewId]?.treatmentText || '',
        [key]: value,
      },
    }));
  };

  const closeReviewStrategyEditor = (reviewId: string) => {
    setEditingReviewId((current) => (current === reviewId ? null : current));
  };

  const handlePestStrategyReview = async (review: any, verdict: 'confirm' | 'reject') => {
    const draft = reviewStrategyDrafts[review.id] || { expertNotes: '', treatmentText: '' };
    const treatmentRecommendations = draft.treatmentText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      await reviewPestDetection.mutateAsync({
        id: review.id,
        data: {
          isConfirmed: verdict === 'confirm',
          pestType: verdict === 'confirm' ? review.pestType || 'unclassified' : 'none',
          severity: verdict === 'confirm' ? review.severity || 'moderate' : 'none',
          expertNotes:
            draft.expertNotes.trim()
            || (verdict === 'confirm'
              ? 'Confirmed by expert dashboard review.'
              : 'Rejected by expert dashboard review.'),
          treatmentRecommendations: verdict === 'confirm' ? treatmentRecommendations : [],
        },
      });
      setEditingReviewId((current) => (current === review.id ? null : current));
    } catch {
      // Error notification handled in mutation hook.
    }
  };

  const handleReanalyzeDetection = async (detectionId: string) => {
    try {
      await reanalyzePestDetection.mutateAsync(detectionId);
      if (selectedReviewId === detectionId) {
        refetchSelectedReview();
      }
      refetchPendingReviews();
      refetchPestStats();
    } catch {
      // Error notification handled in mutation hook.
    }
  };

  const handleAcceptVisibleRecommendations = async () => {
    if (filteredRecommendations.length === 0) return;
    const confirmed = confirmAction(`Accept ${filteredRecommendations.length} visible recommendation(s)?`);
    if (!confirmed) return;

    for (const recommendation of filteredRecommendations) {
      try {
        await respondToRecommendation.mutateAsync({
          id: recommendation.id,
          data: { status: 'accepted' },
        });
      } catch {
        // Error notification handled in mutation hook.
      }
    }
  };

  const handleConfirmVisiblePestReviews = async () => {
    if (filteredPendingReviews.length === 0) return;
    const confirmed = confirmAction(`Confirm pest for ${filteredPendingReviews.length} visible review(s)?`);
    if (!confirmed) return;

    for (const review of filteredPendingReviews) {
      try {
        await reviewPestDetection.mutateAsync({
          id: review.id,
          data: {
            isConfirmed: true,
            pestType: review.pestType || 'unclassified',
            severity: review.severity || 'moderate',
            expertNotes: 'Bulk confirmed by expert dashboard.',
          },
        });
      } catch {
        // Error notification handled in mutation hook.
      }
    }
  };

  const handleRejectVisibleRecommendations = async () => {
    if (filteredRecommendations.length === 0) return;
    const confirmed = confirmAction(`Reject ${filteredRecommendations.length} visible recommendation(s)?`);
    if (!confirmed) return;

    for (const recommendation of filteredRecommendations) {
      try {
        await respondToRecommendation.mutateAsync({
          id: recommendation.id,
          data: { status: 'rejected' },
        });
      } catch {
        // Error notification handled in mutation hook.
      }
    }
  };

  const handleMarkVisiblePestClean = async () => {
    if (filteredPendingReviews.length === 0) return;
    const confirmed = confirmAction(`Mark ${filteredPendingReviews.length} visible review(s) as clean?`);
    if (!confirmed) return;

    for (const review of filteredPendingReviews) {
      try {
        await reviewPestDetection.mutateAsync({
          id: review.id,
          data: {
            isConfirmed: false,
            pestType: 'none',
            severity: 'none',
            expertNotes: 'Bulk marked clean by expert dashboard.',
          },
        });
      } catch {
        // Error notification handled in mutation hook.
      }
    }
  };

  const handleIssueStatusUpdate = async (
    issue: any,
    nextStatus: 'in_progress' | 'resolved' | 'closed',
    defaults?: { expertNotes?: string; resolutionNotes?: string }
  ) => {
    if (!selectedFarmId) return;
    const assignedToCurrentExpert = !issue.assignedTo || issue.assignedTo === user?.id;
    if (!assignedToCurrentExpert) return;

    try {
      await updateFarmIssue.mutateAsync({
        id: issue.id,
        farmId: selectedFarmId,
        data: {
          status: nextStatus,
          ...(user?.id && !issue.assignedTo
            ? { assignedTo: user.id }
            : {}),
          expertNotes: defaults?.expertNotes,
          resolutionNotes: defaults?.resolutionNotes,
        },
      });
    } catch {
      // Error notification handled in mutation hook.
    }
  };

  const exportRowsAsCsv = (headers: string[], rows: Array<Array<string | number>>) => {
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `expert-export-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleExportRecommendationsCsv = () => {
    if (filteredRecommendations.length === 0) return;
    const headers = ['id', 'farmId', 'title', 'type', 'priority', 'status', 'createdAt'];
    const rows = filteredRecommendations.map((recommendation) => [
      recommendation.id,
      recommendation.farmId,
      recommendation.title,
      recommendation.type,
      recommendation.priority,
      recommendation.status,
      recommendation.createdAt,
    ]);
    exportRowsAsCsv(headers, rows);
  };

  const handleExportReviewsCsv = () => {
    if (filteredPendingReviews.length === 0) return;
    const headers = ['id', 'farmId', 'pestType', 'severity', 'locationDescription', 'createdAt'];
    const rows = filteredPendingReviews.map((review) => [
      review.id,
      review.farmId,
      review.pestType || '',
      review.severity || '',
      review.locationDescription || '',
      review.createdAt,
    ]);
    exportRowsAsCsv(headers, rows);
  };

  const expertHeroStats = useMemo<Array<{ label: string; value: string | number; badge: string; helper: string }>>(() => {
    const responseRateLabel =
      typeof responseHistory?.stats?.responseRate === 'number'
        ? `${Math.round(responseHistory.stats.responseRate)}%`
        : '--';
    const averageResponseTimeLabel =
      typeof responseHistory?.stats?.averageResponseTime === 'number'
        ? `${responseHistory.stats.averageResponseTime}h avg`
        : 'Avg response pending';
    const visibleQueueCount = filteredRecommendations.length + filteredPendingReviews.length;

    if (activeTab === 'farm-coordination') {
      return [
        {
          label: 'Farm Queue',
          value: filteredFarms.length,
          badge: `${farmCount} assigned`,
          helper: selectedFarm ? `Focused on ${selectedFarm.name}` : 'Select a farm to inspect coordination details',
        },
        {
          label: 'Response Rate',
          value: responseRateLabel,
          badge: `${responseHistory?.stats?.total ?? 0} interactions`,
          helper: `${responseHistory?.stats?.byStatus?.responded ?? 0} responded • ${averageResponseTimeLabel}`,
        },
        {
          label: 'History Feed',
          value: filteredRecommendationHistoryFeed.length,
          badge: `${recommendationHistoryFeed?.data?.length ?? 0} recent updates`,
          helper: selectedFarm ? `Latest farmer actions for ${selectedFarm.name}` : 'Recent farmer actions across accessible farms',
        },
        {
          label: 'Healthy Sensors',
          value: sensorHealthLoading ? '--' : sensorHealth?.healthy ?? 0,
          badge: `${sensorHealth?.total ?? 0} tracked`,
          helper: `${sensorHealth?.warning ?? 0} warning • ${sensorHealth?.critical ?? 0} critical`,
        },
      ];
    }

    if (activeTab === 'field-support') {
      return [
        {
          label: 'Scheduled Actions',
          value: pestControlSchedules.length,
          badge: selectedFarm?.name || 'No farm selected',
          helper: 'Total pest-control work linked to the active farm',
        },
        {
          label: 'Pending Execution',
          value: filteredPendingPestControlSchedules.length,
          badge: `${filteredCompletedPestControlSchedules.length} completed`,
          helper: 'Open field tasks still waiting on execution',
        },
        {
          label: 'Completed Actions',
          value: filteredCompletedPestControlSchedules.length,
          badge: `${filteredPendingPestControlSchedules.length} pending`,
          helper: 'Recently completed pest-control work',
        },
        {
          label: 'Logged Activity',
          value: filteredPestControlActivity.length,
          badge: `${selectedFarmActivity?.activity?.length ?? 0} farm events`,
          helper: 'Recent field activity captured in the farm timeline',
        },
      ];
    }

    if (activeTab === 'irrigation') {
      return [
        {
          label: 'Visible Farms',
          value: filteredFarms.length,
          badge: `${selectedFarm?.name || 'All assigned farms'}`,
          helper: 'Assigned farms contributing irrigation records to this workspace',
        },
        {
          label: 'Due Irrigation',
          value: pendingPestControlSchedules.length,
          badge: `${completedPestControlSchedules.length} completed field actions`,
          helper: 'Use this lane to compare farm readiness with active execution load',
        },
        {
          label: 'Open Issues',
          value: filteredFarmIssues.length,
          badge: `${issueStatusCounts.open} open`,
          helper: 'Issue pressure that could affect irrigation execution planning',
        },
        {
          label: 'Recent Field Activity',
          value: filteredPestControlActivity.length,
          badge: `${activityHours}h window`,
          helper: 'Operational activity across expert-accessible farms',
        },
      ];
    }

    if (activeTab === 'fertilization') {
      return [
        {
          label: 'Visible Farms',
          value: filteredFarms.length,
          badge: `${selectedFarm?.name || 'All assigned farms'}`,
          helper: 'Assigned farms contributing fertilization records to this workspace',
        },
        {
          label: 'Pending Advice',
          value: recommendationsLoading ? '--' : pendingRecommendationCount,
          badge: `${filteredRecommendations.length} visible`,
          helper: 'Recommendation pressure tied to current nutrient planning',
        },
        {
          label: 'Open Issues',
          value: filteredFarmIssues.length,
          badge: `${issueStatusCounts.open} open`,
          helper: 'Reported issues that can affect nutrient follow-through',
        },
        {
          label: 'District Scope',
          value: expertDistrictCount,
          badge: `${filteredFarms.length} farms`,
          helper: 'District coverage represented in this nutrient workspace',
        },
      ];
    }

    if (activeTab === 'expert-guidance') {
      return [
        {
          label: 'Visible Advice',
          value: filteredRecommendations.length,
          badge: `${pendingRecommendationCount} queued`,
          helper: 'Recommendation work available in the current guidance lane',
        },
        {
          label: 'Visible Reviews',
          value: filteredPendingReviews.length,
          badge: `${pendingReviewCount} pending`,
          helper: 'Pest review items competing for expert attention',
        },
        {
          label: 'Visible Issues',
          value: filteredFarmIssues.length,
          badge: `${farmIssuesResponse?.pagination?.total || farmIssues.length} tracked`,
          helper: 'Farmer-reported issues that can inform direct recommendations',
        },
        {
          label: 'Recent Events',
          value: filteredRecentActivityItems.length,
          badge: `${activityHours}h window`,
          helper: `Activity type: ${activityType}`,
        },
      ];
    }

    if (activeTab === 'issue-oversight') {
      return [
        {
          label: 'Visible Issues',
          value: filteredFarmIssues.length,
          badge: `${issueStatusFilter} filter`,
          helper: 'Current issue queue after status and search filters',
        },
        {
          label: 'Open Issues',
          value: issueStatusCounts.open,
          badge: `${issueStatusCounts.inProgress} in progress`,
          helper: 'New issue reports that still need triage',
        },
        {
          label: 'In Progress',
          value: issueStatusCounts.inProgress,
          badge: `${issueStatusCounts.open} open`,
          helper: 'Active issue resolutions underway',
        },
        {
          label: 'Resolved / Closed',
          value: issueStatusCounts.resolved + issueStatusCounts.closed,
          badge: `${issueStatusCounts.resolved} resolved`,
          helper: `${issueStatusCounts.closed} fully closed`,
        },
      ];
    }

    if (activeTab === 'review-lanes') {
      return [
        {
          label: 'Pending Advice',
          value: recommendationsLoading ? '--' : pendingRecommendationCount,
          badge: `${filteredRecommendations.length} visible`,
          helper: `${recommendationTypeFilter} recommendation filter`,
        },
        {
          label: 'Pending Reviews',
          value: pestStatsLoading ? '--' : pendingReviewCount,
          badge: `${filteredPendingReviews.length} visible`,
          helper: `${reviewSeverityFilter} severity filter`,
        },
        {
          label: 'High/Severe Cases',
          value: pestStatsLoading ? '--' : severePestCount,
          badge: `${pestStats?.totalDetections ?? pendingReviews.length} detections`,
          helper: `${pestStats?.pendingReviewCount ?? pendingReviewCount} still awaiting expert action`,
        },
        {
          label: 'Visible Queue',
          value: visibleQueueCount,
          badge: `${filteredRecommendations.length} advice • ${filteredPendingReviews.length} reviews`,
          helper: 'Combined decision load across both review lanes',
        },
      ];
    }

    if (activeTab === 'district-analytics') {
      return [
        {
          label: 'Visible Farms',
          value: filteredFarms.length,
          badge: `${expertDistrictCount} districts`,
          helper: 'Farm coverage that feeds the current analytics workspace',
        },
        {
          label: 'Open Issues',
          value: filteredFarmIssues.length,
          badge: `${farmIssues.length} tracked`,
          helper: 'Issue volume that could influence district performance',
        },
        {
          label: 'Pending Reviews',
          value: pestStatsLoading ? '--' : pendingReviewCount,
          badge: `${filteredPendingReviews.length} visible`,
          helper: 'Review queue still affecting regional risk signals',
        },
        {
          label: 'High/Severe Cases',
          value: pestStatsLoading ? '--' : severePestCount,
          badge: `${pestStats?.totalDetections ?? pendingReviews.length} detections`,
          helper: 'Serious detections that need district-level awareness',
        },
      ];
    }

    if (activeTab === 'map-view') {
      return [
        {
          label: 'District Farms',
          value: expertMapFarmMarkers.length,
          badge: `${districtScopedFarms.length} in scope`,
          helper: `${Math.max(districtScopedFarms.length - expertMapFarmMarkers.length, 0)} farms still need coordinates`,
        },
        {
          label: 'District Scope',
          value: expertMapDistrictLabel,
          badge: `${expertDistrictCount} districts available`,
          helper: 'Map view narrows to the farms in the current expert district context',
        },
        {
          label: 'Focus Farm',
          value: selectedFarm?.name || 'No farm selected',
          badge: selectedFarm?.cropVariety || 'Select a farm',
          helper: selectedFarm?.locationName || selectedFarm?.district?.name || 'Pick a farm marker to inspect it',
        },
        {
          label: 'Growth Context',
          value: selectedFarm?.currentGrowthStage?.replace(/_/g, ' ') || 'Not set',
          badge: selectedFarm?.cropVariety || 'Crop not set',
          helper: selectedFarm ? 'Current agronomy context for the focused farm' : 'Select a farm marker to inspect crop context',
        },
      ];
    }

    if (activeTab === 'ai-advice') {
      return [
        {
          label: 'Reachable Farms',
          value: filteredFarms.length,
          badge: `${expertDistrictCount} districts`,
          helper: 'Farm context the AI answers can draw from',
        },
        {
          label: 'Pending Advice',
          value: recommendationsLoading ? '--' : pendingRecommendationCount,
          badge: `${filteredRecommendations.length} visible`,
          helper: 'Recommendation queue you can reference in prompts',
        },
        {
          label: 'Pending Reviews',
          value: pestStatsLoading ? '--' : pendingReviewCount,
          badge: `${filteredPendingReviews.length} visible`,
          helper: 'Review load that can shape AI guidance priorities',
        },
        {
          label: 'Open Issues',
          value: filteredFarmIssues.length,
          badge: selectedFarm?.name || 'All farms',
          helper: 'Operational issue context for the current expert focus',
        },
      ];
    }

    return [
      {
        label: 'Assigned Farms',
        value: farmCount,
        badge: `${filteredFarms.length} visible`,
        helper: selectedFarm ? `Focused on ${selectedFarm.name}` : 'Across all accessible farms',
      },
      {
        label: 'Pending Advice',
        value: recommendationsLoading ? '--' : pendingRecommendationCount,
        badge: `${filteredRecommendations.length} visible`,
        helper: `${recommendationsResponse?.pagination?.total || recommendations.length} queued from records`,
      },
      {
        label: 'Pending Reviews',
        value: pestStatsLoading ? '--' : pendingReviewCount,
        badge: `${filteredPendingReviews.length} visible`,
        helper: `${pendingReviewsResponse?.pagination?.total || pendingReviews.length} detections awaiting review`,
      },
      {
        label: 'High/Severe Cases',
        value: pestStatsLoading ? '--' : severePestCount,
        badge: `${pestStats?.totalDetections ?? pendingReviews.length} detections`,
        helper: `${pestStats?.pendingReviewCount ?? pendingReviewCount} still awaiting expert action`,
      },
    ];
  }, [
    activeTab,
    activityHours,
    activityType,
    districtScopedFarms.length,
    expertDistrictCount,
    expertMapDistrictLabel,
    expertMapFarmMarkers.length,
    expertMapOutbreak?.byDistrict?.length,
    expertMapOutbreakMarkers.length,
    farmCount,
    farmIssues.length,
    farmIssuesResponse?.pagination?.total,
    filteredFarmIssues.length,
    filteredPendingPestControlSchedules.length,
    filteredPendingReviews.length,
    filteredPestControlActivity.length,
    filteredRecommendationHistoryFeed.length,
    filteredRecommendations.length,
    filteredRecentActivityItems.length,
    issueStatusCounts.closed,
    issueStatusCounts.inProgress,
    issueStatusCounts.open,
    issueStatusCounts.resolved,
    issueStatusFilter,
    pendingRecommendationCount,
    pendingReviewCount,
    pendingReviews.length,
    pendingReviewsResponse?.pagination?.total,
    pestControlSchedules.length,
    pestStats?.pendingReviewCount,
    pestStats?.totalDetections,
    pestStatsLoading,
    recommendationHistoryFeed?.data?.length,
    recommendationTypeFilter,
    recommendations.length,
    recommendationsLoading,
    recommendationsResponse?.pagination?.total,
    responseHistory?.stats?.averageResponseTime,
    responseHistory?.stats?.byStatus?.responded,
    responseHistory?.stats?.responseRate,
    responseHistory?.stats?.total,
    reviewSeverityFilter,
    selectedFarm?.name,
    selectedFarmActivity?.activity?.length,
    sensorHealth?.critical,
    sensorHealth?.healthy,
    sensorHealth?.total,
    sensorHealth?.warning,
    sensorHealthLoading,
    severePestCount,
  ]);
  const sectionTitleClass = 'text-base md:text-lg font-extrabold tracking-tight';
  const sectionDescriptionClass = 'text-xs md:text-sm text-muted-foreground/90';
  const metricTileClass = 'dash-metric-tile min-h-[112px] flex flex-col justify-center';
  const centeredMetricTileClass = 'dash-metric-tile text-center min-h-[112px] flex flex-col justify-center';
  const outlineBlockClass = 'dash-outline-block';
  const softBlockClass = 'dash-soft-block';
  const dashedBlockClass = 'dash-dashed-block';
  const workspaceGridClass = 'dash-workspace-grid-lg';
  const workspaceMainClass = 'dash-workspace-main-lg';
  const workspaceRailClass = 'lg:col-span-4 min-w-0 space-y-4 self-start';
  const sectionShellClass = 'dash-workspace-section';
  const controlClass = DASH_CONTROL_CLASS;
  const compactControlClass = DASH_CONTROL_COMPACT_CLASS;
  const textAreaClass = DASH_TEXTAREA_CLASS;
  const renderSectionIntro = (eyebrow: string, title: string, description: string) => (
    <div className="space-y-2 px-1">
      <div className="flex items-center gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{eyebrow}</p>
        <div className="h-px flex-1 bg-gradient-to-r from-green-200/70 to-transparent dark:from-green-900/50" />
      </div>
      <div className="max-w-3xl">
        <p className="text-lg md:text-[1.35rem] font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
  const renderSubsectionIntro = (title: string, description: string, className = 'lg:col-span-12') => (
    <div className={className}>
      <div className="dash-soft-block space-y-1.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
  const activeWorkspaceMeta: Record<string, { eyebrow: string; title: string; description: string }> = {
    overview: {
      eyebrow: 'Overview Workspace',
      title: 'Expert Snapshot',
      description: 'Review your live workload, jump into the right expert lane, and keep the current farm focus in view.',
    },
    'farm-coordination': {
      eyebrow: 'Operational Context',
      title: 'Farm Coordination',
      description: 'Select a farm, monitor farmer response, and inspect recent monitoring history in one place.',
    },
    'field-support': {
      eyebrow: 'Field Support',
      title: 'Field Support',
      description: 'Track pest-control execution and field follow-through for the active farm.',
    },
    irrigation: {
      eyebrow: 'Water Operations',
      title: 'Irrigation',
      description: 'Monitor irrigation schedules and water usage across the farms assigned to this expert scope.',
    },
    fertilization: {
      eyebrow: 'Nutrient Operations',
      title: 'Fertilization',
      description: 'Review fertilization schedules and nutrient usage across the farms assigned to this expert scope.',
    },
    'expert-guidance': {
      eyebrow: 'Execution Workbench',
      title: 'Expert Guidance',
      description: 'Create direct expert advice and watch recent multi-farm activity while you work.',
    },
    'issue-oversight': {
      eyebrow: 'Issue Oversight',
      title: 'Issue Oversight',
      description: 'Handle reported farm issues in their own support lane without mixing them into other queues.',
    },
    'review-lanes': {
      eyebrow: 'Decision Lanes',
      title: 'Review Lanes',
      description: 'Process recommendation decisions and pest adjudications in separate, focused review lanes.',
    },
    'district-analytics': {
      eyebrow: 'District Intelligence',
      title: 'District Analytics',
      description: 'Compare district performance, outbreak activity, and weather conditions from the analytics routes.',
    },
    'map-view': {
      eyebrow: 'Spatial Workspace',
      title: 'Map View',
      description: 'Navigate assigned farms and outbreak detections on one interactive expert map.',
    },
    'ai-advice': {
      eyebrow: 'AI Expert System',
      title: 'AI Advice',
      description: 'Ask the AI expert system for agricultural guidance and formatted response suggestions.',
    },
  };
  const currentWorkspaceMeta = activeWorkspaceMeta[activeTab] || activeWorkspaceMeta.overview;

  if (showExpertWorkspaceChrome && farmsLoading) {
    return <LoadingState text="Loading expert dashboard..." />;
  }

  if (showExpertWorkspaceChrome && farmsError) {
    return (
      <ErrorState
        title="Failed to load expert dashboard"
        message="Please retry."
        onRetry={refetchFarms}
      />
    );
  }

  return (
    <div className="dashboard-page dash-section-stack mx-auto w-full max-w-[1600px] px-1 animate-fade-in">
      <div className="dash-hero-panel animate-fade-in [animation-delay:40ms] [animation-fill-mode:both]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-green-700/85 dark:text-green-300/85">{currentWorkspaceMeta.eyebrow}</p>
            <h2 className="text-[2rem] md:text-[2.55rem] font-extrabold tracking-tight text-slate-900 dark:text-white">{currentWorkspaceMeta.title}</h2>
            <p className="mt-2 text-[15px] text-slate-500 dark:text-slate-400">
              {currentWorkspaceMeta.description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {showExpertWorkspaceChrome && (
              <Badge variant="outline">Focus Farm: {selectedFarm?.name || 'All farms'}</Badge>
            )}
            {isReviewLanesTab && <Badge variant="outline">Recommendation Type: {recommendationTypeFilter}</Badge>}
            {isReviewLanesTab && <Badge variant="outline">Review Severity: {reviewSeverityFilter}</Badge>}
            {isIssueOversightTab && <Badge variant="outline">Issue Status: {issueStatusFilter}</Badge>}
            {isExpertGuidanceTab && <Badge variant="outline">Window: {activityHours}h</Badge>}
            {isExpertGuidanceTab && <Badge variant="outline">Activity: {activityType}</Badge>}
          </div>
        </div>

        {expertHeroStats.length > 0 && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {expertHeroStats.map((stat, index) => (
              <div
                key={stat.label}
                className={`${index === 0 ? 'dash-kpi-card dash-kpi-card-accent' : 'dash-kpi-card'} animate-fade-in [animation-fill-mode:both]`}
                style={{ animationDelay: `${80 + index * 50}ms` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[13px] font-semibold ${index === 0 ? 'text-white/88' : 'text-slate-600 dark:text-slate-300'}`}>
                    {stat.label}
                  </span>
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full ${index === 0 ? 'bg-white text-primary' : 'border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17l9.2-9.2M17 17V7H7"/></svg>
                  </div>
                </div>
                <div className="flex flex-col mt-6">
                  <span className={`text-[2.55rem] font-extrabold tracking-tight ${index === 0 ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                    {stat.value}
                  </span>
                  <div className="mt-4 flex items-center gap-2">
                    <div className={`flex items-center justify-center px-2 py-1 rounded-full text-[10px] font-bold ${index === 0 ? 'bg-white/15 text-white' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'}`}>
                      {stat.badge}
                    </div>
                    <span className={`text-[11px] font-medium ${index === 0 ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>{stat.helper}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showExpertWorkspaceChrome && (
        <div className="dash-filter-bar animate-fade-in [animation-delay:95ms] [animation-fill-mode:both]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span className="uppercase tracking-[0.14em]">Focus Farm</span>
                <select
                  className={`${controlClass} min-w-[220px] font-medium`}
                  value={selectedFarmId}
                  onChange={(event) => setSelectedFarmId(event.target.value)}
                >
                  <option value="">All farms</option>
                  {filteredFarms.map((farm) => (
                    <option key={farm.id} value={farm.id}>
                      {farm.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <span className="dash-pill bg-green-100 text-green-800 dark:bg-green-900/35 dark:text-green-300">
                  Focus Farm: {selectedFarm?.name || 'All farms'}
                </span>
                {isReviewLanesTab && (
                  <>
                    <span className="dash-pill bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      Recommendation Type: {recommendationTypeFilter}
                    </span>
                    <span className="dash-pill bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      Review Severity: {reviewSeverityFilter}
                    </span>
                  </>
                )}
                {isIssueOversightTab && (
                  <span className="dash-pill bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    Issue Status: {issueStatusFilter}
                  </span>
                )}
                {isExpertGuidanceTab && (
                  <>
                    <span className="dash-pill bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      Window: {activityHours}h
                    </span>
                    <span className="dash-pill bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      Activity: {activityType}
                    </span>
                  </>
                )}
                {normalizedSearch && (
                  <span className="dash-pill bg-green-100 text-green-800 dark:bg-green-900/35 dark:text-green-300">
                    Filter: "{searchQuery.trim()}"
                  </span>
                )}
                {normalizedSearch && <SearchScopePills items={expertSearchScopeItems} />}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className={`${actionSmClass} self-start xl:self-auto`}
              onClick={() => {
                setRecommendationTypeFilter('all');
                setReviewSeverityFilter('all');
                setIssueStatusFilter('all');
              }}
            >
              Clear Filters
            </Button>
          </div>
        </div>
      )}

      {isSnapshotTab && (
      <section className={sectionShellClass}>
      {renderSectionIntro(
        'Overview Workspace',
        'Expert Snapshot',
        'Review your live workload, current farm focus, and fast expert actions from one opening section.'
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 animate-fade-in [animation-delay:115ms] [animation-fill-mode:both]">
        <div className={workspaceMainClass}>
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
        <Card className="dash-mini-action-card h-full min-h-[230px] animate-fade-in [animation-delay:130ms] [animation-fill-mode:both]">
          <CardContent className="p-5 h-full flex flex-col pt-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200">Review Queue</p>
                <p className="mt-1.5 text-[13px] text-slate-500 dark:text-slate-400">Pending pest reviews waiting for expert confirmation.</p>
              </div>
              <div className="dash-icon-box">
                <Bug size={18} className="text-slate-600 dark:text-slate-300" />
              </div>
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Triage lane - Confirm severity</p>
            <p className="mt-6 text-3xl font-black text-slate-900 dark:text-white">{pendingReviewCount}</p>
            <Button variant="outline" className={`mt-auto w-full ${actionLgClass}`} onClick={() => setReviewSeverityFilter('all')}>
              Reset Severity Filter
            </Button>
          </CardContent>
        </Card>

        <Card className="dash-mini-action-card h-full min-h-[230px] animate-fade-in [animation-delay:190ms] [animation-fill-mode:both]">
          <CardContent className="p-5 h-full flex flex-col pt-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200">Recommendation Sprint</p>
                <p className="mt-1.5 text-[13px] text-slate-500 dark:text-slate-400">Create targeted advice for the current farm focus.</p>
              </div>
              <div className="dash-icon-box">
                <Bot size={18} className="text-slate-600 dark:text-slate-300" />
              </div>
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Execution lane - Push advice</p>
            <p className="mt-6 text-3xl font-black text-slate-900 dark:text-white">{pendingRecommendationCount}</p>
            <Button
              className={`mt-auto w-full ${actionLgClass}`}
              onClick={handleGenerateForFarm}
              disabled={!selectedFarmId || generateRecommendations.isPending}
            >
              Generate For Focus Farm
            </Button>
          </CardContent>
        </Card>

        <Card className="dash-mini-action-card h-full min-h-[230px] animate-fade-in [animation-delay:250ms] [animation-fill-mode:both]">
          <CardContent className="p-5 h-full flex flex-col pt-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200">Farmer Response</p>
                <p className="mt-1.5 text-[13px] text-slate-500 dark:text-slate-400">Watch adoption signals and reopen stale interventions.</p>
              </div>
              <div className="dash-icon-box">
                <CheckCircle2 size={18} className="text-slate-600 dark:text-slate-300" />
              </div>
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Feedback lane - Track adoption</p>
            <p className="mt-6 text-3xl font-black text-slate-900 dark:text-white">{responseHistory?.stats?.byStatus?.responded ?? 0}</p>
            <Button variant="outline" className={`mt-auto w-full ${actionLgClass}`} onClick={handleRefreshAll}>
              Sync Signals
            </Button>
          </CardContent>
        </Card>
        </div>
        </div>

        <Card className="lg:col-span-4 self-start h-fit dash-panel">
          <CardHeader className="pb-2">
            <CardTitle className={sectionTitleClass}>Quick Actions</CardTitle>
            <CardDescription className={sectionDescriptionClass}>Run frequent expert operations with one click</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 lg:space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
              <Button variant="outline" className={`${actionClass} w-full justify-start`} onClick={handleRefreshAll}>
                <RefreshCw size={14} className="mr-2" />
                Refresh All Data
              </Button>
              <Button
                className={`${actionClass} w-full justify-start`}
                onClick={handleGenerateForFarm}
                disabled={!selectedFarmId || generateRecommendations.isPending}
              >
                {generateRecommendations.isPending ? <Spinner size="sm" /> : 'Generate Recommendations'}
              </Button>
              <Button
                variant="outline"
                className={`${actionClass} w-full justify-start sm:col-span-2 lg:col-span-1`}
                onClick={() => {
                  setRecommendationTypeFilter('all');
                  setReviewSeverityFilter('all');
                  setIssueStatusFilter('all');
                }}
              >
                Reset Active Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      </section>
      )}

      {isFarmCoordinationTab && (
      <section className={sectionShellClass}>
      {renderSectionIntro(
        'Operational Context',
        'Farm Coordination',
        'Use these sections to choose a farm, inspect response signals, monitor devices, and review recent farm history.'
      )}

      <div className={`${workspaceGridClass} animate-fade-in [animation-delay:140ms] [animation-fill-mode:both]`}>
      {renderSubsectionIntro(
        'Farm Focus',
        'Select the farm you want to support first, then review how that farmer is responding to current recommendations.'
      )}
      <div className={workspaceRailClass}>
      <Card className="dash-panel">
        <CardHeader className="pb-3">
          <CardTitle className={sectionTitleClass}>Farm Queue</CardTitle>
          <CardDescription className={sectionDescriptionClass}>Select a farm to focus recommendation and pest review tasks</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredFarms.length ? (
            <div className="space-y-3">
              <div className="dash-tab-strip pb-1 lg:pb-0">
                <Button
                  variant={selectedFarmId ? 'outline' : 'default'}
                  size="sm"
                  onClick={() => setSelectedFarmId('')}
                >
                  All farms
                </Button>
                {filteredFarms.map((farm) => (
                  <Button
                    key={farm.id}
                    variant={selectedFarmId === farm.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedFarmId(farm.id)}
                  >
                    {farm.name}
                  </Button>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                Showing {Math.min(filteredFarms.length, 10)} of {filteredFarms.length} farms.
              </p>

              <div className="space-y-2 2xl:max-h-[430px] 2xl:overflow-y-auto 2xl:pr-1 custom-scrollbar">
                {filteredFarms.slice(0, 10).map((farm) => (
                  <div key={farm.id} className={`${outlineBlockClass} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:p-3.5`}>
                    <div>
                      <p className="font-semibold">{farm.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {farm.locationName || farm.district?.name || 'Unknown location'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2 text-right">
                      <p className="text-xs text-muted-foreground">{farm.currentGrowthStage || 'unknown stage'}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateRecommendations.mutate(farm.id)}
                        disabled={generateRecommendations.isPending}
                      >
                        Generate Advice
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              title={normalizedSearch ? 'No matching farms' : 'No farms found'}
              message={
                normalizedSearch
                  ? `No farms match "${searchQuery}".`
                  : 'No farms are currently assigned.'
              }
            />
          )}
        </CardContent>
      </Card>
      </div>

      <div className={workspaceMainClass}>
      <Card className="dash-panel">
        <CardHeader className="pb-3">
          <CardTitle className={sectionTitleClass}>Farmer Response Signals</CardTitle>
          <CardDescription className={sectionDescriptionClass}>
            {selectedFarm
              ? `Review how ${selectedFarm.name} has responded to recommendations over the last 30 days`
              : 'Select a farm to review farmer response patterns and channels'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedFarm ? (
            <EmptyState
              title="Select a farm"
              message="Choose a farm from the queue above to inspect response rate, channels, and recent actions."
            />
          ) : responseHistoryLoading ? (
            <LoadingState text="Loading farmer response insights..." size="sm" />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:grid-cols-4">
                <div className={metricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Recommendations</p>
                  <p className="text-2xl font-bold">{responseHistory?.stats?.total ?? 0}</p>
                </div>
                <div className={metricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Response Rate</p>
                  <p className="text-2xl font-bold">
                    {typeof responseHistory?.stats?.responseRate === 'number'
                      ? `${Math.round(responseHistory.stats.responseRate)}%`
                      : '0%'}
                  </p>
                </div>
                <div className={metricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg Response Time</p>
                  <p className="text-2xl font-bold">
                    {typeof responseHistory?.stats?.averageResponseTime === 'number'
                      ? `${responseHistory.stats.averageResponseTime}h`
                      : 'N/A'}
                  </p>
                </div>
                <div className={metricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Executed</p>
                  <p className="text-2xl font-bold">{responseHistory?.stats?.byStatus?.executed ?? 0}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Response channels</p>
                {Object.entries(responseHistory?.stats?.byChannel || {}).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(responseHistory?.stats?.byChannel || {}).map(([channel, count]) => (
                      <Badge key={channel} variant="outline">
                        {channel}: {count}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No farmer responses recorded for this farm in the current window.
                  </p>
                )}
              </div>

              {Array.isArray(responseHistory?.history) && responseHistory.history.some((item) => item.respondedAt) && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Recent responses</p>
                  <div className="space-y-2">
                    {responseHistory.history
                      .filter((item) => item.respondedAt)
                      .sort((left, right) => new Date(right.respondedAt || 0).getTime() - new Date(left.respondedAt || 0).getTime())
                      .slice(0, 3)
                      .map((item) => (
                        <div key={item.id} className={outlineBlockClass}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-sm">{item.title || 'Recommendation'}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {item.responseChannel || 'unknown channel'} - {item.status}
                              </p>
                            </div>
                            <Badge variant="outline">
                              {item.respondedAt ? new Date(item.respondedAt).toLocaleDateString() : 'Recorded'}
                            </Badge>
                          </div>
                          {item.responseNotes && (
                            <p className="text-sm text-muted-foreground mt-2">{item.responseNotes}</p>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {renderSubsectionIntro(
        'Monitoring & History',
        'Review device health and recent recommendation history as a separate expert monitoring section.',
        'lg:col-span-12 pt-1'
      )}
      <div className="lg:col-span-7 min-w-0">
      <Card className="dash-panel">
        <CardHeader className="pb-3">
          <CardTitle className={sectionTitleClass}>Sensor Health Watch</CardTitle>
          <CardDescription className={sectionDescriptionClass}>
            {selectedFarm
              ? `Monitor the live health state of sensors deployed on ${selectedFarm.name}`
              : 'Monitor live sensor status across the farms currently visible to you'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sensorHealthLoading ? (
            <LoadingState text="Loading sensor health..." size="sm" />
          ) : !sensorHealth ? (
            <ErrorState
              title="Failed to load sensor health"
              message="Please retry."
              onRetry={refetchSensorHealth}
            />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:grid-cols-5">
                <div className={metricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
                  <p className="text-2xl font-bold">{sensorHealth?.total ?? 0}</p>
                </div>
                <div className={metricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Healthy</p>
                  <p className="text-2xl font-bold">{sensorHealth?.healthy ?? 0}</p>
                </div>
                <div className={metricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Warning</p>
                  <p className="text-2xl font-bold">{sensorHealth?.warning ?? 0}</p>
                </div>
                <div className={metricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Critical</p>
                  <p className="text-2xl font-bold">{sensorHealth?.critical ?? 0}</p>
                </div>
                <div className={metricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Offline</p>
                  <p className="text-2xl font-bold">{sensorHealth?.offline ?? 0}</p>
                </div>
              </div>

              {Array.isArray(sensorHealth?.sensors) && sensorHealth.sensors.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Recent sensor status</p>
                  <div className="space-y-2">
                    {sensorHealth.sensors.slice(0, 6).map((sensor) => (
                      <div key={sensor.id} className={outlineBlockClass}>
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-medium text-sm">{sensor.name || sensor.id}</p>
                            <p className="text-xs text-muted-foreground">
                              Last reading:{' '}
                              {sensor.lastReading ? new Date(sensor.lastReading).toLocaleString() : 'No readings yet'}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant={getSensorStatusBadgeVariant(sensor.status)}>
                              {sensor.status || 'unknown'}
                            </Badge>
                            <span>Battery: {sensor.batteryLevel ?? 'N/A'}%</span>
                            <span>Signal: {sensor.signalStrength ?? 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No sensor health details"
                  message={
                    selectedFarm
                      ? 'This farm does not have sensor health details yet.'
                      : 'No sensor health records are available yet.'
                  }
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      <div className="lg:col-span-5 min-w-0">
      <Card className="dash-panel">
        <CardHeader className="pb-3">
          <CardTitle className={sectionTitleClass}>Recommendation History Feed</CardTitle>
          <CardDescription className={sectionDescriptionClass}>
            {selectedFarm
              ? `Recent recommendation history for ${selectedFarm.name} from the backend history route`
              : 'Recent recommendation history from the backend history route across accessible farms'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recommendationHistoryFeedLoading ? (
            <LoadingState text="Loading recommendation history..." size="sm" />
          ) : filteredRecommendationHistoryFeed.length ? (
            <div className="space-y-2">
              {filteredRecommendationHistoryFeed.slice(0, 5).map((item) => (
                <div key={item.id} className={outlineBlockClass}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">{item.title || 'Recommendation'}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(item.farm?.name || item.farmId || 'Unknown farm')} - {item.type} - {item.status}
                      </p>
                      {item.recommendedAction && (
                        <p className="text-sm text-muted-foreground mt-2">{item.recommendedAction}</p>
                      )}
                    </div>
                    <Badge variant="outline">{new Date(item.createdAt).toLocaleDateString()}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title={normalizedSearch ? 'No matching recommendation history' : 'No recommendation history'}
              message={
                normalizedSearch
                  ? `No recommendation history matches "${searchQuery}".`
                  : 'No recommendation records were returned from the backend history route for the current scope.'
              }
            />
          )}
        </CardContent>
      </Card>
      </div>
      </div>
      </section>
      )}

      {isFieldSupportTab && (
      <section className={sectionShellClass}>
      <div className="lg:col-span-12">
        <div className="space-y-2 px-1">
          <div className="flex items-center gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Field Support</p>
            <div className="h-px flex-1 bg-gradient-to-r from-green-200/70 to-transparent dark:from-green-900/50" />
          </div>
          <p className="text-sm text-muted-foreground">
            Track field execution and farm follow-through separately from the recommendation and review queues.
          </p>
        </div>
      </div>

      <div className="lg:col-span-12">
      <Card className="dash-panel">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className={sectionTitleClass}>Pest Control Follow-Through</CardTitle>
              <CardDescription className={sectionDescriptionClass}>
                {selectedFarm
                  ? `Track whether ${selectedFarm.name} has scheduled and completed the recommended pest-control work`
                  : 'Select a farm to monitor scheduled and executed pest-control actions'}
              </CardDescription>
            </div>
            {selectedFarm && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={exportFarmActivity.isPending}
                  onClick={() => handleExportFarmActivity('csv', 'pest_control')}
                >
                  Pest Control CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={exportFarmActivity.isPending}
                  onClick={() => handleExportFarmActivity('csv')}
                >
                  Farm CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={exportFarmActivity.isPending}
                  onClick={() => handleExportFarmActivity('json')}
                >
                  Farm JSON
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!selectedFarm ? (
            <EmptyState
              title="Select a farm"
              message="Choose a farm from the queue above to review pest-control execution and follow-through."
            />
          ) : pestControlSchedulesLoading || selectedFarmActivityLoading ? (
            <LoadingState text="Loading pest control operations..." size="sm" />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:grid-cols-4">
                <div className={metricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Scheduled Actions</p>
                  <p className="text-2xl font-bold">{pestControlSchedules.length}</p>
                </div>
                <div className={metricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending Execution</p>
                  <p className="text-2xl font-bold">{filteredPendingPestControlSchedules.length}</p>
                </div>
                <div className={metricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Completed Actions</p>
                  <p className="text-2xl font-bold">{filteredCompletedPestControlSchedules.length}</p>
                </div>
                <div className={metricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Logged Activity</p>
                  <p className="text-2xl font-bold">{filteredPestControlActivity.length}</p>
                </div>
              </div>

              {filteredPendingPestControlSchedules.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Pending field work</p>
                  {filteredPendingPestControlSchedules.slice(0, 3).map((schedule) => (
                    <div key={schedule.id} className={outlineBlockClass}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-sm">{schedule.controlMethod}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Scheduled for {new Date(schedule.scheduledDate).toLocaleDateString()}
                            {schedule.scheduledTime ? ` at ${schedule.scheduledTime}` : ''}
                          </p>
                          {schedule.notes && (
                            <p className="text-sm text-muted-foreground mt-2">{schedule.notes}</p>
                          )}
                        </div>
                        <Badge variant="secondary">Pending</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`${dashedBlockClass} p-4 text-sm text-muted-foreground`}>
                  {normalizedSearch
                    ? `No pending pest-control actions match "${searchQuery}".`
                    : 'No pending pest-control actions are currently scheduled for this farm.'}
                </div>
              )}

              {filteredPestControlActivity.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Recent pest-control activity</p>
                  {filteredPestControlActivity.slice(0, 4).map((item) => (
                    <div key={item.id} className={outlineBlockClass}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-sm">{item.title}</p>
                            <Badge variant="outline">{formatActivityLabel(item.action)}</Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                        </div>
                        <div className="text-right">
                          {item.status && <Badge variant="outline">{item.status}</Badge>}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(item.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
      </section>
      )}

      {isExpertGuidanceTab && (
      <section className={sectionShellClass}>
      {renderSectionIntro(
        'Execution Workbench',
        'Expert Guidance',
        'Create recommendations and watch recent multi-farm activity while you work the current farm focus.'
      )}

      <div className={workspaceGridClass}>
      <div className="lg:col-span-12 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="dash-subtile">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Visible Recommendations</p>
          <p className="mt-1 text-xl font-black">{filteredRecommendations.length}</p>
        </div>
        <div className="dash-subtile">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Visible Pest Reviews</p>
          <p className="mt-1 text-xl font-black">{filteredPendingReviews.length}</p>
        </div>
        <div className="dash-subtile">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Visible Farm Issues</p>
          <p className="mt-1 text-xl font-black">{filteredFarmIssues.length}</p>
        </div>
      </div>

      {renderSubsectionIntro(
        'Guidance Composer',
        'Draft and send direct expert recommendations with the current farm context.',
        'lg:col-span-12'
      )}
      <Card className="lg:col-span-8 min-w-0 dash-panel">
        <CardHeader className="pb-3">
          <CardTitle className={sectionTitleClass}>Expert Recommendation Builder</CardTitle>
          <CardDescription className={sectionDescriptionClass}>
            {selectedFarm
              ? `Send a tailored recommendation directly to ${selectedFarm.name}`
              : 'Select a farm to create an expert recommendation for that farmer'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedFarm ? (
            <EmptyState
              title="Select a farm"
              message="Choose a farm from the queue above, then create a direct expert recommendation for the farmer."
            />
          ) : (
            <form className="space-y-4" onSubmit={handleCreateManualRecommendation}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Recommendation type</span>
                  <select
                    className={controlClass}
                    value={manualRecommendationType}
                    onChange={(event) =>
                      setManualRecommendationType(
                        event.target.value as 'general' | 'irrigation' | 'fertilization' | 'pest_alert' | 'weather_alert'
                      )
                    }
                  >
                    <option value="general">General advice</option>
                    <option value="irrigation">Irrigation</option>
                    <option value="fertilization">Fertilization</option>
                    <option value="pest_alert">Pest control</option>
                    <option value="weather_alert">Weather alert</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Priority</span>
                  <select
                    className={controlClass}
                    value={manualRecommendationPriority}
                    onChange={(event) =>
                      setManualRecommendationPriority(event.target.value as 'low' | 'medium' | 'high' | 'critical')
                    }
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </label>
              </div>

              <label className="space-y-2 block">
                <span className="text-sm font-medium">Title</span>
                <input
                  className={controlClass}
                  value={manualRecommendationTitle}
                  onChange={(event) => setManualRecommendationTitle(event.target.value)}
                  placeholder="Example: Inspect signs of early nitrogen stress"
                />
              </label>

              <label className="space-y-2 block">
                <span className="text-sm font-medium">Recommendation details</span>
                <textarea
                  className={textAreaClass}
                  value={manualRecommendationDescription}
                  onChange={(event) => setManualRecommendationDescription(event.target.value)}
                  placeholder="Explain what the farmer should watch for and why this recommendation matters."
                />
              </label>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="space-y-2 block">
                  <span className="text-sm font-medium">Action required</span>
                  <textarea
                    className={textAreaClass}
                    value={manualRecommendationAction}
                    onChange={(event) => setManualRecommendationAction(event.target.value)}
                    placeholder="Example: Check 10 plants in each row and send photos of any yellow striping."
                  />
                </label>
                <label className="space-y-2 block">
                  <span className="text-sm font-medium">Valid until</span>
                  <input
                    type="datetime-local"
                    className={controlClass}
                    value={manualRecommendationValidUntil}
                    onChange={(event) => setManualRecommendationValidUntil(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    This becomes the response deadline for the farmer.
                  </p>
                </label>
              </div>

              <div className={`${dashedBlockClass} flex flex-col gap-3 md:flex-row md:items-center md:justify-between`}>
                <p className="text-sm text-muted-foreground">
                  The recommendation will be attached to {selectedFarm.name} and delivered through the normal farmer recommendation flow.
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetManualRecommendationForm}
                    disabled={createManualRecommendation.isPending}
                  >
                    Reset
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      createManualRecommendation.isPending
                      || !manualRecommendationTitle.trim()
                      || !manualRecommendationDescription.trim()
                      || !manualRecommendationAction.trim()
                    }
                  >
                    {createManualRecommendation.isPending ? <Spinner size="sm" /> : 'Send Recommendation'}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {renderSubsectionIntro(
        'System Activity Watch',
        'Track recent cross-farm events and exports as a distinct monitoring stream.',
        'lg:col-span-12'
      )}
      <Card className="lg:col-span-4 min-w-0 self-start dash-panel">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className={sectionTitleClass}>Recent System Activity</CardTitle>
              <CardDescription className={sectionDescriptionClass}>What changed across farms in the selected activity window.</CardDescription>
            </div>
            <div className="dash-toolbar w-full md:w-auto md:justify-end">
              <select
                className={`${compactControlClass} min-w-[145px]`}
                value={activityHours}
                onChange={(event) => setActivityHours(Number(event.target.value) as 6 | 24 | 168)}
              >
                <option value={6}>Last 6 hours</option>
                <option value={24}>Last 24 hours</option>
                <option value={168}>Last 7 days</option>
              </select>
              <select
                className={`${compactControlClass} min-w-[180px]`}
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
              <Button size="sm" variant="outline" className="min-w-[120px]" disabled={exportRecentActivity.isPending} onClick={() => handleExportRecentActivity('csv')}>
                Export CSV
              </Button>
              <Button size="sm" variant="outline" className="min-w-[120px]" disabled={exportRecentActivity.isPending} onClick={() => handleExportRecentActivity('json')}>
                Export JSON
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="2xl:max-h-[760px] 2xl:overflow-y-auto 2xl:pr-1 custom-scrollbar">
          {recentActivityLoading ? (
            <LoadingState text="Loading recent activity..." size="sm" />
          ) : (
            <div className="space-y-4">
              <div className="dash-summary-grid-wide">
                <div className={metricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide break-words text-balance">Users</p>
                  <p className="text-2xl font-bold">{recentActivity?.summary?.newUsers ?? 0}</p>
                </div>
                <div className={metricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide break-words text-balance">Farms</p>
                  <p className="text-2xl font-bold">{recentActivity?.summary?.newFarms ?? 0}</p>
                </div>
                <div className={metricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide break-words text-balance">Readings</p>
                  <p className="text-2xl font-bold">{recentActivity?.summary?.sensorReadings ?? 0}</p>
                </div>
                <div className={metricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide break-words text-balance">Recommendations</p>
                  <p className="text-2xl font-bold">{recentActivity?.summary?.recommendations ?? 0}</p>
                </div>
                <div className={metricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide break-words text-balance">Pest Events</p>
                  <p className="text-2xl font-bold">{recentActivity?.summary?.pestDetections ?? 0}</p>
                </div>
                <div className={metricTileClass}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide break-words text-balance">Pest Control</p>
                  <p className="text-2xl font-bold">{recentActivity?.summary?.pestControlActions ?? 0}</p>
                </div>
              </div>

              {filteredRecentActivityItems.length > 0 ? (
                <div className="space-y-2">
                  {filteredRecentActivityItems.map((item) => (
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
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(item.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={normalizedSearch ? 'No matching recent activity' : 'No recent activity'}
                  message={
                    normalizedSearch
                      ? `No recent system activity matches "${searchQuery}".`
                      : 'New user, farm, recommendation, and pest events will appear here.'
                  }
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
      </section>
      )}

      {isIssueOversightTab && (
      <section className={sectionShellClass}>
      <div className="lg:col-span-12">
        <div className="space-y-2 px-1">
          <div className="flex items-center gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Issue Oversight</p>
            <div className="h-px flex-1 bg-gradient-to-r from-green-200/70 to-transparent dark:from-green-900/50" />
          </div>
          <p className="text-sm text-muted-foreground">
            Review farmer-reported issues in their own lane so support work stays distinct from recommendation and pest decisions.
          </p>
        </div>
      </div>

      <Card className="lg:col-span-8 min-w-0 dash-panel">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className={sectionTitleClass}>Reported Farm Issues</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetchFarmIssues()}
                disabled={!selectedFarm}
              >
                Refresh Issues
              </Button>
            </div>
          </div>
          <CardDescription className={sectionDescriptionClass}>
            {selectedFarm
              ? `Triage farmer-reported issues for ${selectedFarm.name}`
              : 'Select a farm to review the reported issue queue'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedFarm ? (
            <EmptyState
              title="Select a farm"
              message="Choose a farm to review reported issues, mark them in progress, and close resolved cases."
            />
          ) : (
            <>
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  {farmIssuesResponse?.pagination?.total || filteredFarmIssues.length} tracked issue(s)
                </div>
                <select
                  className={compactControlClass}
                  value={issueStatusFilter}
                  onChange={(event) => setIssueStatusFilter(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              {farmIssuesLoading ? (
                <LoadingState text="Loading farm issues..." size="sm" />
              ) : filteredFarmIssues.length === 0 ? (
                <EmptyState
                  title={normalizedSearch ? 'No matching issues' : 'No reported issues'}
                  message={
                    normalizedSearch
                      ? `No issues match "${searchQuery}".`
                      : 'No issue reports are currently waiting on this farm.'
                  }
                />
              ) : (
                <div className="space-y-3">
                  {filteredFarmIssues.map((issue) => (
                    <div key={issue.id} className="dash-detail-card">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{issue.title}</p>
                            <Badge variant="outline">{issue.status}</Badge>
                            <Badge className={recommendationPriorityClass[
                              issue.severity === 'urgent'
                                ? 'critical'
                                : issue.severity === 'high'
                                  ? 'high'
                                  : issue.severity === 'medium'
                                    ? 'medium'
                                    : 'low'
                            ]}>
                              {issue.severity}
                            </Badge>
                            <Badge variant="outline">{issue.category}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{issue.description}</p>
                          <p className="text-xs text-muted-foreground">
                            Reported {new Date(issue.createdAt).toLocaleString()}
                            {issue.locationDescription ? ` - ${issue.locationDescription}` : ''}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Assignee: {issue.assignee?.firstName || issue.assignee?.email || (issue.assignedTo === user?.id ? 'You' : issue.assignedTo) || 'Unassigned'}
                          </p>
                          {issue.expertNotes && (
                            <p className="text-xs text-muted-foreground">Expert note: {issue.expertNotes}</p>
                          )}
                          {issue.resolutionNotes && (
                            <p className="text-xs text-muted-foreground">Resolution: {issue.resolutionNotes}</p>
                          )}
                          {!!issue.assignedTo && issue.assignedTo !== user?.id && (
                            <p className="text-xs text-green-600 dark:text-green-400">
                              This issue is currently assigned to another reviewer.
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {issue.status === 'open' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isAnyActionPending || (!!issue.assignedTo && issue.assignedTo !== user?.id)}
                              onClick={() =>
                                handleIssueStatusUpdate(issue, 'in_progress', {
                                  expertNotes: 'Issue acknowledged and moved into expert review.',
                                })
                              }
                            >
                              <Clock3 size={14} className="mr-1" />
                              Start Review
                            </Button>
                          )}
                          {issue.status !== 'resolved' && issue.status !== 'closed' && (
                            <Button
                              size="sm"
                              disabled={isAnyActionPending || (!!issue.assignedTo && issue.assignedTo !== user?.id)}
                              onClick={() =>
                                handleIssueStatusUpdate(issue, 'resolved', {
                                  expertNotes: 'Reviewed and resolved by expert dashboard.',
                                  resolutionNotes: 'Marked resolved after expert review.',
                                })
                              }
                            >
                              <CheckCircle2 size={14} className="mr-1" />
                              Resolve
                            </Button>
                          )}
                          {issue.status !== 'closed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isAnyActionPending || (!!issue.assignedTo && issue.assignedTo !== user?.id)}
                              onClick={() =>
                                handleIssueStatusUpdate(issue, 'closed', {
                                  expertNotes: 'Issue closed from expert dashboard.',
                                  resolutionNotes: issue.resolutionNotes || 'Closed after review.',
                                })
                              }
                            >
                              <XCircle size={14} className="mr-1" />
                              Close
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {renderPagination(
                    farmIssuesResponse?.pagination?.page || issuePage,
                    farmIssuesResponse?.pagination?.totalPages,
                    setIssuePage
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      </section>
      )}

      {isReviewLanesTab && (
      <section className={sectionShellClass}>
      <div className="lg:col-span-12">
        <div className="space-y-2 px-1">
          <div className="flex items-center gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Review Lanes</p>
            <div className="h-px flex-1 bg-gradient-to-r from-green-200/70 to-transparent dark:from-green-900/50" />
          </div>
          <p className="text-sm text-muted-foreground">Process recommendation decisions and pest adjudications in separate review queues with their own detail views.</p>
        </div>
      </div>

      {renderSubsectionIntro(
        'Recommendation Decisions',
        'Handle pending recommendation responses, exports, and single-record inspection here.',
        'lg:col-span-12'
      )}
      <Card className="lg:col-span-8 min-w-0 h-full dash-panel">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className={sectionTitleClass}>Pending Recommendations</CardTitle>
              <Badge variant="outline">{filteredRecommendations.length}</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full md:w-auto">
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={handleExportRecommendationsCsv}
                disabled={filteredRecommendations.length === 0}
              >
                Export CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={handleRejectVisibleRecommendations}
                disabled={isAnyActionPending || filteredRecommendations.length === 0}
              >
                Reject Visible
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={handleAcceptVisibleRecommendations}
                disabled={isAnyActionPending || filteredRecommendations.length === 0}
              >
                Accept Visible
              </Button>
            </div>
          </div>
          <CardDescription className={sectionDescriptionClass}>
            {selectedFarm ? `Showing recommendations for ${selectedFarm.name}` : 'Showing recommendations for all farms'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex items-center justify-end">
            <select
              className={compactControlClass}
              value={recommendationTypeFilter}
              onChange={(event) => setRecommendationTypeFilter(event.target.value)}
            >
              <option value="all">All types</option>
              {recommendationTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {selectedRecommendationId && (
            <div className={`mb-4 ${dashedBlockClass} p-4`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Selected Recommendation Detail</p>
                  <p className="text-xs text-muted-foreground">Loaded from the single recommendation backend route</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => refetchSelectedRecommendation()} disabled={!selectedRecommendationId}>
                  Refresh Detail
                </Button>
              </div>

              <div className="mt-4">
                {selectedRecommendationLoading ? (
                  <LoadingState text="Loading recommendation detail..." size="sm" />
                ) : selectedRecommendation ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{selectedRecommendation.title}</p>
                      <Badge className={recommendationPriorityClass[selectedRecommendation.priority] || ''}>
                        {selectedRecommendation.priority}
                      </Badge>
                      <Badge variant="outline">{selectedRecommendation.type}</Badge>
                      <Badge variant="outline">{selectedRecommendation.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{selectedRecommendation.description}</p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className={softBlockClass}>
                        <p className="text-xs text-muted-foreground uppercase">Farm</p>
                        <p className="font-medium">{selectedRecommendation.farm?.name || selectedRecommendation.farmId || 'N/A'}</p>
                      </div>
                      <div className={softBlockClass}>
                        <p className="text-xs text-muted-foreground uppercase">Action Deadline</p>
                        <p className="font-medium">
                          {selectedRecommendation.actionDeadline
                            ? new Date(selectedRecommendation.actionDeadline).toLocaleString()
                            : 'No deadline'}
                        </p>
                      </div>
                      <div className={softBlockClass}>
                        <p className="text-xs text-muted-foreground uppercase">Recommended Action</p>
                        <p className="font-medium">{selectedRecommendation.recommendedAction || 'N/A'}</p>
                      </div>
                      <div className={softBlockClass}>
                        <p className="text-xs text-muted-foreground uppercase">Created</p>
                        <p className="font-medium">{new Date(selectedRecommendation.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState title="No recommendation selected" message="Choose a recommendation below to inspect its full detail." />
                )}
              </div>
            </div>
          )}

          {recommendationsLoading ? (
            <LoadingState text="Loading recommendations..." size="sm" />
          ) : filteredRecommendations.length === 0 ? (
            <EmptyState
              title={normalizedSearch ? 'No matching recommendations' : 'No pending recommendations'}
              message={
                normalizedSearch
                  ? `No recommendations match "${searchQuery}".`
                  : 'All pending recommendations have been reviewed.'
              }
            />
          ) : (
            <div className="space-y-3 2xl:max-h-[700px] 2xl:overflow-y-auto 2xl:pr-2 custom-scrollbar">
              {filteredRecommendations.map((recommendation) => (
                <div key={recommendation.id} className="dash-detail-card">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="font-semibold">{recommendation.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{recommendation.description}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={recommendationPriorityClass[recommendation.priority] || ''}>
                        {recommendation.priority}
                      </Badge>
                      <Badge variant="outline">{recommendation.type}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mt-3">
                    <p className="text-xs text-muted-foreground">
                      Farm: {recommendation.farm?.name || recommendation.farmId}
                    </p>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedRecommendationId(recommendation.id)}
                      >
                        {selectedRecommendationId === recommendation.id ? 'Viewing Detail' : 'View Detail'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isAnyActionPending}
                        onClick={() => handleRecommendationDefer(recommendation.id)}
                      >
                        <Clock3 size={14} className="mr-1" />
                        Defer
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isAnyActionPending}
                        onClick={() => handleRecommendationResponse(recommendation.id, 'rejected')}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        disabled={isAnyActionPending}
                        onClick={() => handleRecommendationResponse(recommendation.id, 'accepted')}
                      >
                        Accept
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {renderPagination(
                recommendationsResponse?.pagination?.page || recommendationPage,
                recommendationsResponse?.pagination?.totalPages,
                setRecommendationPage
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {renderSubsectionIntro(
        'Pest Adjudication',
        'Validate detections, refresh AI detail, and update treatment strategy in a separate review lane.',
        'lg:col-span-12'
      )}
      <Card className={`${workspaceRailClass} min-w-0 h-fit dash-panel`}>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className={sectionTitleClass}>Pending Pest Reviews</CardTitle>
              <Badge variant="outline">{filteredPendingReviews.length}</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2 w-full md:w-auto lg:w-full">
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={handleExportReviewsCsv}
                disabled={filteredPendingReviews.length === 0}
              >
                Export CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={handleMarkVisiblePestClean}
                disabled={isAnyActionPending || filteredPendingReviews.length === 0}
              >
                Mark Visible Clean
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={handleConfirmVisiblePestReviews}
                disabled={isAnyActionPending || filteredPendingReviews.length === 0}
              >
                Confirm Visible
              </Button>
            </div>
          </div>
          <CardDescription className={sectionDescriptionClass}>Validate AI detections and complete expert adjudication</CardDescription>
        </CardHeader>
        <CardContent className="2xl:max-h-[760px] 2xl:overflow-y-auto 2xl:pr-1 custom-scrollbar">
          <div className="mb-3 flex items-center justify-end">
            <select
              className={compactControlClass}
              value={reviewSeverityFilter}
              onChange={(event) => setReviewSeverityFilter(event.target.value)}
            >
              <option value="all">All severities</option>
              {reviewSeverities.map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
          </div>

          {selectedReviewId && (
            <div className={`mb-4 ${dashedBlockClass} p-4`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Selected Detection Detail</p>
                  <p className="text-xs text-muted-foreground">Loaded from the single pest-detection backend route</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => refetchSelectedReview()} disabled={!selectedReviewId}>
                    Refresh Detail
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReanalyzeDetection(selectedReviewId)}
                    disabled={!selectedReviewId || isAnyActionPending}
                  >
                    {reanalyzePestDetection.isPending ? <Spinner size="sm" /> : 'Re-run AI'}
                  </Button>
                </div>
              </div>

              <div className="mt-4">
                {selectedReviewLoading ? (
                  <LoadingState text="Loading detection detail..." size="sm" />
                ) : selectedReview ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{selectedReview.pestType || 'Unclassified detection'}</p>
                      {selectedReview.severity && <Badge variant="outline">{selectedReview.severity}</Badge>}
                      <Badge variant="outline">{selectedReview.isConfirmed ? 'confirmed' : 'pending review'}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Farm: {selectedReview.farm?.name || selectedReview.farmId || 'N/A'}
                    </p>
                    {selectedReview.locationDescription && (
                      <p className="text-sm text-muted-foreground">{selectedReview.locationDescription}</p>
                    )}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className={softBlockClass}>
                        <p className="text-xs text-muted-foreground uppercase">Created</p>
                        <p className="font-medium">{new Date(selectedReview.createdAt).toLocaleString()}</p>
                      </div>
                      <div className={softBlockClass}>
                        <p className="text-xs text-muted-foreground uppercase">Review State</p>
                        <p className="font-medium">{selectedReview.isConfirmed ? 'Expert confirmed' : 'Awaiting expert confirmation'}</p>
                      </div>
                    </div>
                    {selectedReview.expertNotes && (
                      <div className={softBlockClass}>
                        <p className="text-xs text-muted-foreground uppercase">Expert Notes</p>
                        <p className="font-medium">{selectedReview.expertNotes}</p>
                      </div>
                    )}
                    {Array.isArray(selectedReview.treatmentRecommendations) && selectedReview.treatmentRecommendations.length > 0 && (
                      <div className={softBlockClass}>
                        <p className="text-xs text-muted-foreground uppercase">Treatment Recommendations</p>
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                          {selectedReview.treatmentRecommendations.map((item: string, index: number) => (
                            <li key={`${selectedReview.id}-detail-treatment-${index}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <EmptyState title="No detection selected" message="Choose a pending review below to inspect its full details." />
                )}
              </div>
            </div>
          )}

          {pendingReviewsLoading ? (
            <LoadingState text="Loading pending reviews..." size="sm" />
          ) : filteredPendingReviews.length === 0 ? (
            <EmptyState
              title={normalizedSearch ? 'No matching pest reviews' : 'No pending pest reviews'}
              message={
                normalizedSearch
                  ? `No pending pest reviews match "${searchQuery}".`
                  : 'No detections require review at the moment.'
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredPendingReviews.map((review) => (
                <div key={review.id} className="dash-detail-card">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="font-semibold">{review.pestType || 'Unclassified detection'}</p>
                      <p className="text-xs text-muted-foreground">
                        Severity: {review.severity} | Farm: {review.farm?.name || review.farmId}
                      </p>
                      {review.locationDescription && (
                        <p className="text-xs text-muted-foreground mt-0.5">{review.locationDescription}</p>
                      )}
                      {Array.isArray(review.treatmentRecommendations) && review.treatmentRecommendations.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          <p className="font-medium text-foreground">Current treatment plan</p>
                          <ul className="list-disc pl-4 mt-1 space-y-1">
                            {review.treatmentRecommendations.slice(0, 3).map((item: string, index: number) => (
                              <li key={`${review.id}-treatment-${index}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {review.imageUrl && (
                        <a
                          href={review.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-primary hover:underline mt-1 inline-block"
                        >
                          View Image
                        </a>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedReviewId(review.id)}
                      >
                        {selectedReviewId === review.id ? 'Viewing Detail' : 'View Detail'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isAnyActionPending}
                        onClick={() => openReviewStrategyEditor(review)}
                      >
                        Update Strategy
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isAnyActionPending}
                        onClick={() => handleReanalyzeDetection(review.id)}
                      >
                        {reanalyzePestDetection.isPending ? <Spinner size="sm" /> : 'Re-run AI'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isAnyActionPending}
                        onClick={() =>
                          handlePestReview(review.id, 'reject', review.pestType, review.severity)
                        }
                      >
                        <XCircle size={14} className="mr-1" />
                        Mark Clean
                      </Button>
                      <Button
                        size="sm"
                        disabled={isAnyActionPending}
                        onClick={() =>
                          handlePestReview(review.id, 'confirm', review.pestType, review.severity)
                        }
                      >
                        <CheckCircle2 size={14} className="mr-1" />
                        Confirm Pest
                      </Button>
                    </div>
                  </div>
                  {editingReviewId === review.id && (
                    <div className={`mt-4 ${dashedBlockClass} p-4 space-y-3`}>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Expert notes</p>
                          <textarea
                            className={textAreaClass}
                            value={reviewStrategyDrafts[review.id]?.expertNotes || ''}
                            onChange={(event) =>
                              updateReviewStrategyDraft(review.id, 'expertNotes', event.target.value)
                            }
                            placeholder="Summarize what the expert confirmed, what the farmer should watch, and any escalation guidance."
                          />
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Treatment strategy</p>
                          <textarea
                            className={textAreaClass}
                            value={reviewStrategyDrafts[review.id]?.treatmentText || ''}
                            onChange={(event) =>
                              updateReviewStrategyDraft(review.id, 'treatmentText', event.target.value)
                            }
                            placeholder="One action per line. Example: Spray the affected block at dawn."
                          />
                          {getAiTreatmentSuggestions(review).length > 0 && (
                            <div className={`${softBlockClass} text-xs text-muted-foreground`}>
                              <p className="font-medium text-foreground">AI suggestions</p>
                              <ul className="mt-1 list-disc pl-4 space-y-1">
                                {getAiTreatmentSuggestions(review).map((item, index) => (
                                  <li key={`${review.id}-ai-suggestion-${index}`}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isAnyActionPending}
                          onClick={() => closeReviewStrategyEditor(review.id)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isAnyActionPending}
                          onClick={() => handlePestStrategyReview(review, 'reject')}
                        >
                          Mark Clean
                        </Button>
                        <Button
                          size="sm"
                          disabled={isAnyActionPending}
                          onClick={() => handlePestStrategyReview(review, 'confirm')}
                        >
                          Confirm With Strategy
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {renderPagination(
                pendingReviewsResponse?.pagination?.page || pendingReviewPage,
                pendingReviewsResponse?.pagination?.totalPages,
                setPendingReviewPage
              )}
            </div>
          )}
        </CardContent>
      </Card>
      </section>
      )}

      {/* ===== District Analytics Tab ===== */}
      {isDistrictAnalyticsTab && (
        <DistrictAnalyticsPanel />
      )}

      {/* ===== Irrigation Tab ===== */}
      {isIrrigationTab && (
        <section className="dash-workspace-section">
          <ScheduleInsightsPanel
            resource="irrigation"
            role="expert"
            farms={filteredFarms}
            selectedFarmId={selectedFarmId}
            title="Assigned Farm Irrigation"
            description="Water usage is grouped by assigned farm so experts can compare irrigation load across their scope."
            emptyTitle="No irrigation schedules in scope"
            emptyMessage="No irrigation schedules are available yet across the farms assigned to this expert."
            maxFarms={24}
          />
        </section>
      )}

      {/* ===== Fertilization Tab ===== */}
      {isFertilizationTab && (
        <section className="dash-workspace-section">
          <ScheduleInsightsPanel
            resource="fertilization"
            role="expert"
            farms={filteredFarms}
            selectedFarmId={selectedFarmId}
            title="Assigned Farm Fertilization"
            description="Nutrient usage is grouped by assigned farm so experts can compare fertilizer activity across their scope."
            emptyTitle="No fertilization schedules in scope"
            emptyMessage="No fertilization schedules are available yet across the farms assigned to this expert."
            maxFarms={24}
          />
        </section>
      )}

      {/* ===== Map View Tab ===== */}
      {isMapViewTab && (
        <ExpertMapViewPanel
          farms={districtScopedFarms}
          selectedFarm={selectedFarm}
          onSelectFarm={(farmId) => setSelectedFarmId(farmId)}
          farmMarkers={expertMapFarmMarkers}
          districtLabel={expertMapDistrictLabel}
        />
      )}

      {/* ===== AI Advice Tab ===== */}
      {isAiAdviceTab && (
        <ExpertAiAdvicePanel />
      )}
    </div>
  );
}

function ExpertMapViewPanel({
  farms,
  selectedFarm,
  onSelectFarm,
  farmMarkers,
  districtLabel,
}: {
  farms: Farm[];
  selectedFarm: Farm | null;
  onSelectFarm: (farmId: string) => void;
  farmMarkers: MapboxMarkerData[];
  districtLabel: string;
}) {
  const mappedFarmCount = farmMarkers.length;

  return (
    <section className="dash-workspace-section">
      <div className="dash-workspace-grid-lg">
        <Card className="dash-panel dash-workspace-main-lg">
          <CardHeader>
            <CardTitle className="text-lg font-extrabold tracking-tight">District Farm Map</CardTitle>
            <CardDescription>Review all mapped farms in the current expert district and pick a farm to coordinate.</CardDescription>
          </CardHeader>
          <CardContent>
            <MapboxMap
              markers={farmMarkers}
              selectedMarkerId={selectedFarm ? `farm-${selectedFarm.id}` : null}
              onSelectMarker={(markerId) => {
                if (markerId.startsWith('farm-')) {
                  onSelectFarm(markerId.replace('farm-', ''));
                }
              }}
              center={
                (() => {
                  const focusCoordinates = getFarmMapCoordinates(selectedFarm);
                  return typeof focusCoordinates?.lat === 'number' && typeof focusCoordinates?.lng === 'number'
                    ? { lat: focusCoordinates.lat, lng: focusCoordinates.lng }
                    : undefined;
                })()
              }
              fitToMarkers={farmMarkers.length > 0}
              mapClassName="h-[460px]"
              emptyTitle="No mapped district farms yet"
              emptyMessage="Add coordinates to district farms to unlock the expert map workspace."
              tokenMissingMessage="Add VITE_MAPBOX_ACCESS_TOKEN to enable the expert map workspace."
            />
          </CardContent>
        </Card>

        <div className="lg:col-span-4 min-w-0 space-y-4 self-start">
          <Card className="dash-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-extrabold tracking-tight">Map Context</CardTitle>
              <CardDescription>Current district coverage and selected farm focus</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="dash-outline-block">
                <p className="text-xs text-muted-foreground uppercase">District scope</p>
                <p className="font-semibold">{districtLabel}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {mappedFarmCount > 0
                    ? 'Markers represent farmers in the same district as the current expert scope'
                    : 'No district farm coordinates are available yet'}
                </p>
              </div>
              <div className="dash-outline-block">
                <p className="text-xs text-muted-foreground uppercase">Focused farm</p>
                <p className="font-semibold">{selectedFarm?.name || 'No farm selected'}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedFarm?.locationName || selectedFarm?.district?.name || 'Choose a farm marker to focus it'}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="dash-outline-block">
                  <p className="text-xs text-muted-foreground uppercase">Mapped farms</p>
                  <p className="text-lg font-semibold">{mappedFarmCount}</p>
                </div>
                <div className="dash-outline-block">
                  <p className="text-xs text-muted-foreground uppercase">Unmapped farms</p>
                  <p className="text-lg font-semibold">{Math.max(farms.length - mappedFarmCount, 0)}</p>
                </div>
                <div className="dash-outline-block">
                  <p className="text-xs text-muted-foreground uppercase">Focus crop</p>
                  <p className="text-lg font-semibold">{selectedFarm?.cropVariety || 'Not set'}</p>
                </div>
                <div className="dash-outline-block">
                  <p className="text-xs text-muted-foreground uppercase">Growth stage</p>
                  <p className="text-lg font-semibold capitalize">
                    {selectedFarm?.currentGrowthStage?.replace(/_/g, ' ') || 'Not set'}
                  </p>
                </div>
              </div>
              <div className="dash-outline-block">
                <p className="text-xs text-muted-foreground uppercase">Map interaction</p>
                <p className="text-sm text-muted-foreground">
                  Select any farm marker to sync the coordination workspace with that farmer record.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

// ---------- District Analytics Panel ----------
function DistrictAnalyticsPanel() {
  const { data: districts, isLoading } = useAllDistrictsAnalytics();
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [lookupLatInput, setLookupLatInput] = useState('');
  const [lookupLonInput, setLookupLonInput] = useState('');
  const [submittedCoords, setSubmittedCoords] = useState<{ lat: number; lon: number } | null>(null);
  const panelClass = 'dash-panel';
  const sectionTitleClass = 'text-lg flex items-center gap-2 font-extrabold tracking-tight';
  const sectionDescriptionClass = 'text-sm text-muted-foreground/95';
  const centeredMetricTileClass = 'dash-metric-tile text-center';
  const outlineBlockClass = 'dash-outline-block';
  const districtList = Array.isArray(districts) ? districts : [];

  useEffect(() => {
    if (districtList.length > 0 && !selectedDistrict) {
      setSelectedDistrict((districtList[0] as any)?.district || '');
    }
  }, [districtList]);

  const { data: districtData, isLoading: districtLoading } = useDistrictAnalytics(selectedDistrict);
  const { data: districtWeather, isLoading: districtWeatherLoading } = useDistrictWeather(selectedDistrict, !!selectedDistrict);
  const { data: outbreakMap, isLoading: outbreakMapLoading } = usePestOutbreakMap({ days: 30 });
  const {
    data: coordinateWeather,
    isLoading: coordinateWeatherLoading,
    refetch: refetchCoordinateWeather,
  } = useWeatherByCoordinates(submittedCoords?.lat, submittedCoords?.lon, !!submittedCoords);

  const d = districtData as any;
  const districtWeatherData = districtWeather as any;
  const coordinateWeatherData = coordinateWeather as any;
  const selectedDistrictOutbreak = outbreakMap?.byDistrict?.find((item) => item.district === selectedDistrict);
  const districtSevereSignals = selectedDistrictOutbreak
    ? Number(selectedDistrictOutbreak.severity?.high || 0) + Number(selectedDistrictOutbreak.severity?.severe || 0)
    : 0;
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
  const coordinateLookupMarkers = submittedCoords
    ? [{
        id: 'coordinate-weather-lookup',
        latitude: submittedCoords.lat,
        longitude: submittedCoords.lon,
        label: 'Weather lookup point',
        badge: 'Selected coordinates',
        description: 'Current weather will be fetched for this point.',
        tone: 'info' as const,
      }]
    : [];

  const handleCoordinateLookup = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const lat = Number(lookupLatInput);
    const lon = Number(lookupLonInput);

    if (Number.isNaN(lat) || Number.isNaN(lon)) return;
    setSubmittedCoords({ lat, lon });
  };
  const handleCoordinateMapPick = ({ lat, lng }: { lat: number; lng: number }) => {
    setLookupLatInput(String(lat));
    setLookupLonInput(String(lng));
    setSubmittedCoords({ lat, lon: lng });
  };

  if (isLoading) return <LoadingState text="Loading districts..." />;

  return (
    <div className="dash-section-stack">
      <Card className={panelClass}>
        <CardHeader className="pb-3">
          <CardTitle className={sectionTitleClass}>
            <BarChart2 size={20} className="text-primary" />
            District Analytics
          </CardTitle>
          <CardDescription className={sectionDescriptionClass}>Aggregated farm and sensor data by district</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className={compactControlClass}
          >
            {districtList.map((dist: any) => (
              <option key={dist.district} value={dist.district}>{dist.district}</option>
            ))}
          </select>

          {districtLoading ? (
            <LoadingState text="Loading district data..." size="sm" />
          ) : d ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Farms', value: d.farmCount ?? '--' },
                { label: 'Sensors', value: d.sensorCount ?? '--' },
                { label: 'Avg Moisture', value: d.avgSoilMoisture != null ? `${Number(d.avgSoilMoisture).toFixed(1)}%` : '--' },
                { label: 'Active Alerts', value: d.alertCount ?? '--' },
              ].map((stat) => (
                <div key={stat.label} className={centeredMetricTileClass}>
                  <p className="text-xl font-bold">{String(stat.value)}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No data" message="No district analytics data available." />
          )}
        </CardContent>
      </Card>

      <Card className={panelClass}>
        <CardHeader className="pb-3">
          <CardTitle className={sectionTitleClass}>
            <AlertTriangle size={20} className="text-primary" />
            Pest Outbreak Watch
          </CardTitle>
          <CardDescription className={sectionDescriptionClass}>District outbreak signals from the backend outbreak-map route</CardDescription>
        </CardHeader>
        <CardContent>
          {outbreakMapLoading ? (
            <LoadingState text="Loading outbreak map..." size="sm" />
          ) : outbreakMap ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-4">
                <div className={centeredMetricTileClass}>
                  <p className="text-xl font-bold">{outbreakMap.detections?.length ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Detections in Window</p>
                </div>
                <div className={centeredMetricTileClass}>
                  <p className="text-xl font-bold">{outbreakMap.byDistrict?.length ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Districts Affected</p>
                </div>
                <div className={centeredMetricTileClass}>
                  <p className="text-xl font-bold">{selectedDistrictOutbreak?.count ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Selected District Cases</p>
                </div>
                <div className={centeredMetricTileClass}>
                  <p className="text-xl font-bold">{districtSevereSignals}</p>
                  <p className="text-xs text-muted-foreground">High + Severe Signals</p>
                </div>
              </div>

              <MapboxMap
                markers={outbreakMarkers}
                mapClassName="h-[320px]"
                emptyTitle="No mapped outbreak detections"
                emptyMessage="Outbreak detections need coordinates before they can be plotted on the district map."
                tokenMissingMessage="Add VITE_MAPBOX_ACCESS_TOKEN to render the expert outbreak map."
              />

              {outbreakMap.byDistrict?.length ? (
                <div className="space-y-2">
                  {outbreakMap.byDistrict.slice(0, 5).map((district) => (
                    <div key={district.district} className={`${outlineBlockClass} flex items-center justify-between gap-3`}>
                      <div>
                        <p className="font-medium">{district.district}</p>
                        <p className="text-xs text-muted-foreground">
                          Severe: {(district.severity?.high || 0) + (district.severity?.severe || 0)} cases
                        </p>
                      </div>
                      <Badge variant="outline">{district.count} detections</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No outbreak activity"
                  message="No outbreak-map detections were returned for the current reporting window."
                />
              )}
            </div>
          ) : (
            <EmptyState
              title="Outbreak map unavailable"
              message="The backend outbreak-map route did not return data for this period."
            />
          )}
        </CardContent>
      </Card>

      <Card className={panelClass}>
        <CardHeader className="pb-3">
          <CardTitle className={sectionTitleClass}>
            <Cloud size={20} className="text-primary" />
            District Weather Snapshot
          </CardTitle>
          <CardDescription className={sectionDescriptionClass}>Live district weather from the backend district weather endpoint</CardDescription>
        </CardHeader>
        <CardContent>
          {districtWeatherLoading ? (
            <LoadingState text="Loading district weather..." size="sm" />
          ) : districtWeatherData ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Temperature', value: districtWeatherData.temperature != null ? `${Math.round(Number(districtWeatherData.temperature))} C` : '--' },
                { label: 'Humidity', value: districtWeatherData.humidity != null ? `${districtWeatherData.humidity}%` : '--' },
                { label: 'Condition', value: districtWeatherData.condition || '--' },
                { label: 'Wind', value: districtWeatherData.windSpeed != null ? `${districtWeatherData.windSpeed} m/s` : '--' },
              ].map((stat) => (
                <div key={stat.label} className={centeredMetricTileClass}>
                  <p className="text-xl font-bold">{String(stat.value)}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No district weather" message="District weather is not available for the selected district." />
          )}
        </CardContent>
      </Card>

      <Card className={panelClass}>
        <CardHeader className="pb-3">
          <CardTitle className={sectionTitleClass}>
            <Cloud size={20} className="text-primary" />
            Coordinate Weather Lookup
          </CardTitle>
          <CardDescription className={sectionDescriptionClass}>Look up live weather for any coordinate using the backend location endpoint</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid grid-cols-1 gap-3 md:grid-cols-3" onSubmit={handleCoordinateLookup}>
            <input
              type="number"
              step="any"
              className={controlClass}
              placeholder="Latitude"
              value={lookupLatInput}
              onChange={(event) => setLookupLatInput(event.target.value)}
            />
            <input
              type="number"
              step="any"
              className={controlClass}
              placeholder="Longitude"
              value={lookupLonInput}
              onChange={(event) => setLookupLonInput(event.target.value)}
            />
            <Button type="submit">Lookup Weather</Button>
          </form>

          <MapboxMap
            markers={coordinateLookupMarkers}
            center={submittedCoords ? { lat: submittedCoords.lat, lng: submittedCoords.lon } : undefined}
            fitToMarkers={Boolean(submittedCoords)}
            onCoordinateSelect={handleCoordinateMapPick}
            mapClassName="h-[280px]"
            tokenMissingMessage="Add VITE_MAPBOX_ACCESS_TOKEN to enable click-to-select weather lookups."
          />

          {!submittedCoords ? (
            <EmptyState
              title="Enter coordinates"
              message="Provide latitude and longitude to check current weather for a specific location."
            />
          ) : coordinateWeatherLoading ? (
            <LoadingState text="Looking up coordinate weather..." size="sm" />
          ) : coordinateWeatherData ? (
            <div className="space-y-3">
              <div className={`${outlineBlockClass} flex flex-col gap-2 md:flex-row md:items-center md:justify-between`}>
                <div>
                  <p className="font-medium">
                    {submittedCoords.lat.toFixed(4)}, {submittedCoords.lon.toFixed(4)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Current conditions from the location-based weather route
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => refetchCoordinateWeather()}>
                  Refresh
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  {
                    label: 'Temperature',
                    value: coordinateWeatherData.temperature != null
                      ? `${Math.round(Number(coordinateWeatherData.temperature))} C`
                      : '--',
                  },
                  {
                    label: 'Humidity',
                    value: coordinateWeatherData.humidity != null
                      ? `${coordinateWeatherData.humidity}%`
                      : '--',
                  },
                  {
                    label: 'Condition',
                    value: coordinateWeatherData.condition || '--',
                  },
                  {
                    label: 'Wind',
                    value: coordinateWeatherData.windSpeed != null
                      ? `${coordinateWeatherData.windSpeed} m/s`
                      : '--',
                  },
                ].map((stat) => (
                  <div key={stat.label} className={centeredMetricTileClass}>
                    <p className="text-xl font-bold">{String(stat.value)}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ErrorState
              title="Lookup failed"
              message="We could not load weather for those coordinates."
              onRetry={refetchCoordinateWeather}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Expert AI Advice Panel ----------
function ExpertAiAdvicePanel() {
  const [question, setQuestion] = useState('');
  const adviceMutation = useAiAdvice();

  const handleSubmit = () => {
    if (!question.trim()) return;
    adviceMutation.mutate({
      question: question.trim(),
      context: { cropType: 'maize' },
    });
  };

  return (
    <div className="dash-section-stack">
      <Card className="dash-panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 font-extrabold tracking-tight">
            <Bot size={20} className="text-primary" />
            AI Agricultural Advice
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground/95">Ask the AI expert system for agricultural guidance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What are the best practices for late blight management in maize?"
            className={textAreaClass}
          />
          <Button onClick={handleSubmit} disabled={adviceMutation.isPending || !question.trim()} className="w-full">
            {adviceMutation.isPending ? 'Getting advice...' : 'Get Expert AI Advice'}
          </Button>

          {adviceMutation.data && (
            <div className="dash-soft-block space-y-3">
              <p className="font-semibold">AI Response</p>
              <FormattedAiResponse content={adviceMutation.data.answer} />
              {adviceMutation.data.suggestions?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Suggestions</p>
                  <ul className="list-disc pl-4 text-sm space-y-1">
                    {adviceMutation.data.suggestions.map((s: string, i: number) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
              {adviceMutation.data.relatedTopics?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {adviceMutation.data.relatedTopics.map((t: string, i: number) => (
                    <Badge key={i} variant="outline">{t}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ConnectedExpertDashboard;
