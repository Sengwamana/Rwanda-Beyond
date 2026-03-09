import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Sprout, Bug, Activity, RefreshCw, CheckCircle2, XCircle, Clock3, BarChart2, Bot } from 'lucide-react';
import {
  useFarms,
  usePestStatistics,
  useRecommendations,
  usePendingReviews,
  useRespondToRecommendation,
  useReviewPestDetection,
  useGenerateRecommendations,
  useAllDistrictsAnalytics,
  useDistrictAnalytics,
  useAiAdvice,
} from '../hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { LoadingState, ErrorState, EmptyState, Spinner } from './ui/Spinner';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { FormattedAiResponse } from './ui/FormattedAiResponse';

interface ConnectedExpertDashboardProps {
  searchQuery?: string;
  activeTab?: string;
}

const recommendationPriorityClass: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
};

const confirmAction = (message: string): boolean => {
  if (typeof window === 'undefined') return true;
  return window.confirm(message);
};

export function ConnectedExpertDashboard({ searchQuery = '', activeTab = 'overview' }: ConnectedExpertDashboardProps) {
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [recommendationTypeFilter, setRecommendationTypeFilter] = useState<'all' | string>('all');
  const [reviewSeverityFilter, setReviewSeverityFilter] = useState<'all' | string>('all');
  const [recommendationPage, setRecommendationPage] = useState(1);
  const [pendingReviewPage, setPendingReviewPage] = useState(1);

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
  } = useRecommendations({ page: recommendationPage, limit: 20, status: 'pending' });
  const {
    data: pendingReviewsResponse,
    isLoading: pendingReviewsLoading,
    refetch: refetchPendingReviews,
  } = usePendingReviews({ page: pendingReviewPage, limit: 20 });

  const respondToRecommendation = useRespondToRecommendation();
  const reviewPestDetection = useReviewPestDetection();
  const generateRecommendations = useGenerateRecommendations();

  const farms = farmsResponse?.data || [];
  const recommendations = recommendationsResponse?.data || [];
  const pendingReviews = pendingReviewsResponse?.data || [];

  const normalizedSearch = searchQuery.trim().toLowerCase();

  useEffect(() => {
    setRecommendationPage(1);
  }, [selectedFarmId, recommendationTypeFilter, normalizedSearch]);

  useEffect(() => {
    setPendingReviewPage(1);
  }, [selectedFarmId, reviewSeverityFilter, normalizedSearch]);

  const filteredFarms = useMemo(() => {
    if (!normalizedSearch) return farms;
    return farms.filter((farm) => {
      const haystack = [farm.name, farm.locationName, farm.district?.name, farm.currentGrowthStage]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [farms, normalizedSearch]);

  const selectedFarm = farms.find((farm) => farm.id === selectedFarmId) || null;

  const filteredRecommendations = useMemo(() => {
    return recommendations.filter((recommendation) => {
      if (selectedFarmId && recommendation.farmId !== selectedFarmId) return false;
      if (recommendationTypeFilter !== 'all' && recommendation.type !== recommendationTypeFilter) return false;
      if (!normalizedSearch) return true;

      const haystack = [
        recommendation.title,
        recommendation.description,
        recommendation.type,
        recommendation.priority,
        recommendation.farm?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [recommendations, selectedFarmId, normalizedSearch, recommendationTypeFilter]);

  const filteredPendingReviews = useMemo(() => {
    return pendingReviews.filter((review) => {
      if (selectedFarmId && review.farmId !== selectedFarmId) return false;
      if (reviewSeverityFilter !== 'all' && review.severity !== reviewSeverityFilter) return false;
      if (!normalizedSearch) return true;

      const haystack = [
        review.pestType,
        review.severity,
        review.locationDescription,
        review.farm?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [pendingReviews, selectedFarmId, normalizedSearch, reviewSeverityFilter]);

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
  const pendingRecommendationCount =
    recommendationsResponse?.pagination?.total || recommendations.length;
  const pendingReviewCount = pestStats?.pendingReviewCount || pendingReviewsResponse?.pagination?.total || 0;
  const severePestCount = (pestStats?.bySeverity?.severe || 0) + (pestStats?.bySeverity?.high || 0);

  const isAnyActionPending =
    respondToRecommendation.isPending || reviewPestDetection.isPending || generateRecommendations.isPending;

  const handleRefreshAll = () => {
    refetchFarms();
    refetchPestStats();
    refetchRecommendations();
    refetchPendingReviews();
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
    defaultSeverity?: string
  ) => {
    reviewPestDetection.mutate({
      id: detectionId,
      data: {
        isConfirmed: verdict === 'confirm',
        pestType: verdict === 'confirm' ? defaultPestType || 'unclassified' : 'none',
        severity: verdict === 'confirm' ? defaultSeverity || 'moderate' : 'none',
        expertNotes:
          verdict === 'confirm'
            ? 'Confirmed by expert dashboard review.'
            : 'Rejected by expert dashboard review.',
      },
    });
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

  const exportRowsAsCsv = (headers: string[], rows: Array<Array<string | number>>) => {
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `expert-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
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

  if (farmsLoading) {
    return <LoadingState text="Loading expert dashboard..." />;
  }

  if (farmsError) {
    return (
      <ErrorState
        title="Failed to load expert dashboard"
        message="Please retry."
        onRetry={refetchFarms}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Expert Operations</h2>
          <p className="text-sm text-muted-foreground">
            Review recommendations, validate pest detections, and assist farms.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefreshAll}>
            <RefreshCw size={14} className="mr-2" />
            Refresh
          </Button>
          <Button onClick={handleGenerateForFarm} disabled={!selectedFarmId || generateRecommendations.isPending}>
            {generateRecommendations.isPending ? <Spinner size="sm" /> : 'Generate for Farm'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Sprout className="text-primary" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Assigned Farms</p>
                <p className="text-2xl font-bold">{farmCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Activity className="text-primary" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending Advice</p>
                <p className="text-2xl font-bold">{recommendationsLoading ? '--' : pendingRecommendationCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Bug className="text-primary" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending Pest Review</p>
                <p className="text-2xl font-bold">{pestStatsLoading ? '--' : pendingReviewCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">High/Severe Pest Cases</p>
                <p className="text-2xl font-bold">{pestStatsLoading ? '--' : severePestCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Farm Queue</CardTitle>
          <CardDescription>Select a farm to focus recommendation and pest review tasks</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredFarms.length ? (
            <div className="space-y-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
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

              <div className="space-y-2">
                {filteredFarms.slice(0, 8).map((farm) => (
                  <div key={farm.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-semibold">{farm.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {farm.locationName || farm.district?.name || 'Unknown location'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Pending Recommendations</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportRecommendationsCsv}
                disabled={filteredRecommendations.length === 0}
              >
                Export CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRejectVisibleRecommendations}
                disabled={isAnyActionPending || filteredRecommendations.length === 0}
              >
                Reject Visible
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAcceptVisibleRecommendations}
                disabled={isAnyActionPending || filteredRecommendations.length === 0}
              >
                Accept Visible
              </Button>
            </div>
          </div>
          <CardDescription>
            {selectedFarm ? `Showing recommendations for ${selectedFarm.name}` : 'Showing recommendations for all farms'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex items-center justify-end">
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
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
            <div className="space-y-3">
              {filteredRecommendations.map((recommendation) => (
                <div key={recommendation.id} className="rounded-lg border p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="font-semibold">{recommendation.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{recommendation.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
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
                    <div className="flex gap-2">
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Pending Pest Reviews</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportReviewsCsv}
                disabled={filteredPendingReviews.length === 0}
              >
                Export CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleMarkVisiblePestClean}
                disabled={isAnyActionPending || filteredPendingReviews.length === 0}
              >
                Mark Visible Clean
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleConfirmVisiblePestReviews}
                disabled={isAnyActionPending || filteredPendingReviews.length === 0}
              >
                Confirm Visible
              </Button>
            </div>
          </div>
          <CardDescription>Validate AI detections and complete expert adjudication</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex items-center justify-end">
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
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
                <div key={review.id} className="rounded-lg border p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="font-semibold">{review.pestType || 'Unclassified detection'}</p>
                      <p className="text-xs text-muted-foreground">
                        Severity: {review.severity} | Farm: {review.farm?.name || review.farmId}
                      </p>
                      {review.locationDescription && (
                        <p className="text-xs text-muted-foreground mt-0.5">{review.locationDescription}</p>
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
                    <div className="flex items-center gap-2">
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
      {/* Pest Review Panel (overview only) */}
      {activeTab === 'overview' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bug size={20} className="text-primary" />
              Pending Pest Reviews
            </CardTitle>
            <CardDescription>Review submitted pest images</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingReviewsLoading ? (
              <LoadingState text="Loading pending reviews..." size="sm" />
            ) : filteredPendingReviews.length === 0 ? (
              <EmptyState title="No pending pest reviews" message="All pest submissions have been reviewed." />
            ) : (
              <div className="space-y-4">
                {filteredPendingReviews.map((review: any) => (
                  <div key={review.id} className="rounded-lg border p-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <p className="font-semibold">{review.pestType || 'Unknown pest'}</p>
                        <p className="text-sm text-muted-foreground">
                          Farm: {(farmsResponse as any)?.data?.find((f: any) => f.id === review.farmId)?.name || review.farmId?.slice(0, 8)}
                        </p>
                        {review.severity && <p className="text-xs">Severity: {review.severity}</p>}
                        {review.imageUrl && (
                          <a href={review.imageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                            View Image
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" disabled={isAnyActionPending}
                          onClick={() => handlePestReview(review.id, 'reject', review.pestType, review.severity)}>
                          <XCircle size={14} className="mr-1" /> Mark Clean
                        </Button>
                        <Button size="sm" disabled={isAnyActionPending}
                          onClick={() => handlePestReview(review.id, 'confirm', review.pestType, review.severity)}>
                          <CheckCircle2 size={14} className="mr-1" /> Confirm Pest
                        </Button>
                      </div>
                    </div>
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
      )}

      {/* ===== District Analytics Tab ===== */}
      {activeTab === 'district-analytics' && (
        <DistrictAnalyticsPanel />
      )}

      {/* ===== AI Advice Tab ===== */}
      {activeTab === 'ai-advice' && (
        <ExpertAiAdvicePanel />
      )}
    </div>
  );
}

// ---------- District Analytics Panel ----------
function DistrictAnalyticsPanel() {
  const { data: districts, isLoading } = useAllDistrictsAnalytics();
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const districtList = Array.isArray(districts) ? districts : [];

  useEffect(() => {
    if (districtList.length > 0 && !selectedDistrict) {
      setSelectedDistrict((districtList[0] as any)?.district || '');
    }
  }, [districtList]);

  const { data: districtData, isLoading: districtLoading } = useDistrictAnalytics(selectedDistrict);

  if (isLoading) return <LoadingState text="Loading districts..." />;

  const d = districtData as any;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart2 size={20} className="text-primary" />
            District Analytics
          </CardTitle>
          <CardDescription>Aggregated farm and sensor data by district</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {districtList.map((dist: any) => (
              <option key={dist.district} value={dist.district}>{dist.district}</option>
            ))}
          </select>

          {districtLoading ? (
            <LoadingState text="Loading district data..." size="sm" />
          ) : d ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Farms', value: d.farmCount ?? '--' },
                { label: 'Sensors', value: d.sensorCount ?? '--' },
                { label: 'Avg Moisture', value: d.avgSoilMoisture != null ? `${Number(d.avgSoilMoisture).toFixed(1)}%` : '--' },
                { label: 'Active Alerts', value: d.alertCount ?? '--' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border p-3 text-center">
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot size={20} className="text-primary" />
            AI Agricultural Advice
          </CardTitle>
          <CardDescription>Ask the AI expert system for agricultural guidance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What are the best practices for late blight management in maize?"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px]"
          />
          <Button onClick={handleSubmit} disabled={adviceMutation.isPending || !question.trim()} className="w-full">
            {adviceMutation.isPending ? 'Getting advice...' : 'Get Expert AI Advice'}
          </Button>

          {adviceMutation.data && (
            <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
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
                    <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t}</span>
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
