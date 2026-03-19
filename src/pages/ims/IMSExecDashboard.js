import React, { useState, useEffect, useCallback } from 'react';
import { Spinner, Alert, Button, Collapse } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import usePageTitle from '../../hooks/usePageTitle';
import BarChart from '../../components/charts/BarChart';
import PieChart from '../../components/charts/PieChart';
import DoughnutChart from '../../components/charts/DoughnutChart';
import LineChart from '../../components/charts/LineChart';
import '../../styles/dashboard.css';
import './IMSExecDashboardStyles.css';

// Danh sách API tổng quan hệ thống (GET) – dùng để hiển thị "tất cả dữ liệu API đang trả về"
const API_LIST = [
  { key: 'database_size', path: '/system/database-size', label: 'Dung lượng database' },
  { key: 'tickets_stats', path: '/tickets/stats', label: 'Thống kê Tickets' },
  { key: 'modules_status', path: '/modules/status', label: 'Trạng thái modules' },
  { key: 'sessions_stats', path: '/sessions/stats', label: 'Thống kê Sessions' },
  { key: 'dashboard_stats', path: '/dashboard/stats', label: 'Thống kê Dashboard (Điểm danh)' },
  { key: 'tasks_stats', path: '/tasks/stats', label: 'Thống kê Tasks (HR)' },
  { key: 'activity_logs_stats', path: '/activity/logs/stats', label: 'Thống kê Activity Logs' },
  { key: 'quality_assurance', path: '/quality-assurance/dashboard/stats', label: 'Đảm bảo chất lượng' },
  { key: 'medical_records', path: '/medical-records/stats/dashboard', label: 'Hồ sơ bệnh án' },
  { key: 'absence_requests', path: '/absence-requests/stats', label: 'Thống kê Xin nghỉ' },
];

// Màu pastel nhẹ (chart + KPI)
const PASTEL = {
  blue: '#7dd3fc',
  teal: '#5eead4',
  green: '#86efac',
  amber: '#fcd34d',
  rose: '#fda4af',
  violet: '#c4b5fd',
  slate: '#94a3b8',
};

const PIE_COLORS = [
  '#7dd3fc',
  '#5eead4',
  '#86efac',
  '#fcd34d',
  '#fda4af',
  '#c4b5fd',
  '#a5b4fc',
  '#94a3b8',
];

/**
 * Chuyển response từng API thành cấu hình chart (bar / pie / doughnut / line).
 * result = { status, data } với data là body response (có thể { success, data: {...} hoặc { summary, modules }).
 */
function getChartConfig(apiKey, result) {
  if (!result || result.status !== 'ok' || !result.data) return null;
  const body = result.data;
  const inner = body.data; // nhiều API trả về { success, data: {...} }

  switch (apiKey) {
    case 'health': {
      const modules = body.modules || [];
      if (modules.length === 0) {
        return { chartType: 'doughnut', labels: ['OK'], data: [1], colors: [PASTEL.green] };
      }
      return {
        chartType: 'bar',
        labels: modules.map((m) => m.name || `Port ${m.port}`),
        data: modules.map(() => 1),
        colors: [PASTEL.blue],
      };
    }
    case 'database_size': {
      const d = body.data || body;
      const sizeMb = Number(d.size_mb);
      if (sizeMb < 0 || Number.isNaN(sizeMb)) return null;
      return {
        chartType: 'bar',
        labels: ['Database (MB)'],
        data: [Math.round(sizeMb * 10) / 10],
        colors: [PASTEL.teal],
      };
    }
    case 'modules_status': {
      const s = body.summary || {};
      const onl = Number(s.online) || 0;
      const off = Number(s.offline) || 0;
      if (onl + off === 0) return null;
      return {
        chartType: 'doughnut',
        labels: ['Online', 'Offline'],
        data: [onl, off],
        colors: [PASTEL.teal, PASTEL.rose],
      };
    }
    case 'tickets_stats': {
      const t = inner || body;
      const labels = ['Mới', 'Đã giao', 'Đang xử lý', 'Đã xử lý', 'Đóng'];
      const keys = ['new_count', 'assigned_count', 'in_progress_count', 'resolved_count', 'closed_count'];
      const data = keys.map((k) => Number(t[k]) || 0).filter((n) => n > 0);
      const usedLabels = labels.filter((_, i) => (Number(t[keys[i]]) || 0) > 0);
      if (data.length === 0) return null;
      return { chartType: 'pie', labels: usedLabels, data, colors: PIE_COLORS };
    }
    case 'dashboard_stats': {
      const d = inner || body;
      const entries = [
        ['Tổng SV', d.totalStudents],
        ['Buổi học', d.totalSessions],
        ['Buổi đang diễn ra', d.activeSessions],
        ['Đi muộn', d.lateStudentsCount],
        ['Vắng', d.absentStudentsCount],
      ].filter(([, v]) => v != null && Number(v) >= 0);
      if (entries.length === 0) return null;
      return {
        chartType: 'bar',
        labels: entries.map(([l]) => l),
        data: entries.map(([, v]) => Number(v)),
        colors: [PASTEL.blue],
      };
    }
    case 'tasks_stats': {
      const t = inner || body;
      const labels = ['Chờ', 'Đang làm', 'Hoàn thành', 'Hủy'];
      const keys = ['pending', 'in_progress', 'completed', 'cancelled'];
      const data = keys.map((k) => Number(t[k]) || 0).filter((n) => n > 0);
      const usedLabels = labels.filter((_, i) => (Number(t[keys[i]]) || 0) > 0);
      if (data.length === 0) return null;
      return { chartType: 'pie', labels: usedLabels, data, colors: PIE_COLORS };
    }
    case 'sessions_stats': {
      const d = inner || body;
      const entries = [
        ['Buổi đang diễn ra', d.activeSessions],
        ['Tổng SV', d.totalStudents],
        ['Nhóm', d.totalGroups],
        ['Tổng buổi', d.totalSessions],
      ].filter(([, v]) => v != null && Number(v) >= 0);
      if (entries.length === 0) return null;
      return {
        chartType: 'bar',
        labels: entries.map(([l]) => l),
        data: entries.map(([, v]) => Number(v)),
        colors: [PASTEL.violet],
      };
    }
    case 'activity_logs_stats': {
      const dataObj = inner || body;
      const rows = dataObj.eventTypeStats || [];
      if (!rows.length) {
        const tot = dataObj.total || {};
        if (tot.total_activities != null || tot.unique_users != null) {
          const labels = ['Tổng hoạt động', 'User', 'Session', 'Ngày'];
          const data = [
            Number(tot.total_activities) || 0,
            Number(tot.unique_users) || 0,
            Number(tot.unique_sessions) || 0,
            Number(tot.active_days) || 0,
          ].filter((n) => n > 0);
          if (data.length > 0) {
            return { chartType: 'bar', labels: labels.slice(0, data.length), data, colors: [PASTEL.teal] };
          }
        }
        return null;
      }
      const labels = rows.map((r) => r.event_type || 'N/A').slice(0, 10);
      const data = rows.map((r) => Number(r.count) || 0).slice(0, 10);
      return { chartType: 'bar', labels, data, colors: [PASTEL.amber] };
    }
    case 'quality_assurance': {
      const q = inner || body;
      if (q.totalCategories != null && q.totalAssignments != null && q.totalSubmissions != null) {
        return {
          chartType: 'bar',
          labels: ['Danh mục', 'Giao việc', 'Nộp minh chứng'],
          data: [Number(q.totalCategories), Number(q.totalAssignments), Number(q.totalSubmissions)],
          colors: [PASTEL.violet],
        };
      }
      const byStatus = q.submissionsByStatus || q.mySubmissions || (Array.isArray(q) ? q : []);
      if (byStatus.length > 0) {
        const labels = byStatus.map((s) => s.status || 'N/A');
        const data = byStatus.map((s) => Number(s.count) || 0);
        return { chartType: 'doughnut', labels, data, colors: PIE_COLORS };
      }
      if (q.totalAssigned != null || q.pendingCount != null) {
        return {
          chartType: 'bar',
          labels: ['Được giao', 'Chờ xử lý'],
          data: [Number(q.totalAssigned) || 0, Number(q.pendingCount) || 0],
          colors: [PASTEL.violet],
        };
      }
      return null;
    }
    case 'medical_records': {
      const m = inner || body;
      const statusCounts = m.filterOptions?.statusCounts || m.statusCounts || m.stats?.statusCounts || {};
      const labels = ['Tổng', 'SV đang TH', 'CI chưa chấm', 'CI đã chấm'];
      const keys = ['all', 'sv_dang_thuc_hien', 'ci_chua_cham', 'ci_da_cham'];
      const data = keys.map((k) => Number(statusCounts[k]) || 0).filter((n) => n > 0);
      const usedLabels = labels.filter((_, i) => (Number(statusCounts[keys[i]]) || 0) > 0);
      if (data.length > 0) {
        return { chartType: 'bar', labels: usedLabels, data, colors: [PASTEL.blue] };
      }
      const total = Number(m.total) ?? Number(m.stats?.total);
      if (total >= 0) {
        return { chartType: 'bar', labels: ['Hồ sơ'], data: [total], colors: [PASTEL.blue] };
      }
      if (m.byStatus && m.byStatus.length > 0) {
        return {
          chartType: 'bar',
          labels: m.byStatus.map((s) => s.trang_thai_text || 'N/A').slice(0, 8),
          data: m.byStatus.map((s) => Number(s.count) || 0).slice(0, 8),
          colors: [PASTEL.blue],
        };
      }
      return null;
    }
    case 'absence_requests': {
      const a = inner || body;
      const labels = ['Tổng', 'Chờ duyệt', 'Đã duyệt', 'Từ chối'];
      const keys = ['total_requests', 'pending_requests', 'approved_requests', 'rejected_requests'];
      const data = keys.map((k) => Number(a[k]) || 0).filter((n) => n > 0);
      const usedLabels = labels.filter((_, i) => (Number(a[keys[i]]) || 0) > 0);
      if (data.length === 0) return null;
      return { chartType: 'doughnut', labels: usedLabels, data, colors: PIE_COLORS };
    }
    default:
      return null;
  }
}

const IMSExecDashboard = () => {
  usePageTitle('Bảng điều khiển IMS');
  const { api } = useAuth();

  const [apiResults, setApiResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [openApiKey, setOpenApiKey] = useState(null);
  const [hostStats, setHostStats] = useState(null);
  const [hostStatsError, setHostStatsError] = useState(null);
  const [recentActivityLogs, setRecentActivityLogs] = useState([]);
  const [recentActivityLoading, setRecentActivityLoading] = useState(false);
  const [recentActivityError, setRecentActivityError] = useState(null);
  const [totalUsersCount, setTotalUsersCount] = useState(null);
  const [loginsTodayCount, setLoginsTodayCount] = useState(null);

  const fetchAllApis = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    const results = {};
    const promises = API_LIST.map(async (item) => {
      try {
        const res = await api.get(item.path);
        return { key: item.key, status: 'ok', data: res.data };
      } catch (err) {
        const status = err.response?.status === 403 ? 'forbidden' : 'err';
        return {
          key: item.key,
          status,
          data: err.response?.data || { message: err.message },
        };
      }
    });

    const settled = await Promise.all(promises);
    settled.forEach((r) => {
      results[r.key] = { status: r.status, data: r.data };
    });

    setApiResults(results);
    setLastUpdate(new Date());
    setLoading(false);
    setRefreshing(false);
  }, [api]);

  useEffect(() => {
    fetchAllApis();
  }, [fetchAllApis]);

  // Realtime CPU, Memory, Network của máy host – poll mỗi 3s
  useEffect(() => {
    const fetchHostStats = async () => {
      try {
        const res = await api.get('/system/host-stats');
        if (res.data && res.data.success !== false) {
          setHostStats(res.data);
          setHostStatsError(null);
        } else {
          setHostStatsError(res.data?.message || 'Không có dữ liệu');
          setHostStats(null);
        }
      } catch (err) {
        setHostStatsError(err.response?.data?.message || err.message || 'Host Stats chưa chạy');
        setHostStats(null);
      }
    };
    fetchHostStats();
    const interval = setInterval(fetchHostStats, 3000);
    return () => clearInterval(interval);
  }, [api]);

  // Hoạt động gần đây (activity logs) – chỉ superadmin mới có data
  useEffect(() => {
    let cancelled = false;
    setRecentActivityLoading(true);
    setRecentActivityError(null);
    api.get('/activity/logs?limit=5&page=1')
      .then((res) => {
        if (!cancelled && res.data?.data) setRecentActivityLogs(res.data.data);
      })
      .catch((err) => {
        if (!cancelled) {
          setRecentActivityLogs([]);
          setRecentActivityError(err.response?.status === 403 ? 'Chỉ Super Admin mới xem được nhật ký hoạt động.' : (err.response?.data?.message || err.message));
        }
      })
      .finally(() => {
        if (!cancelled) setRecentActivityLoading(false);
      });
    return () => { cancelled = true; };
  }, [api]);

  // Tổng user (dashboard-counts) và phiên đăng nhập trong ngày (activity logs)
  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const loadKpiExtra = async () => {
      setTotalUsersCount(null);
      setLoginsTodayCount(null);
      try {
        const [countsRes, activityRes] = await Promise.allSettled([
          api.get('/system/dashboard-counts'),
          api.get(`/activity/logs/stats?start_date=${today}&end_date=${today}`),
        ]);
        if (cancelled) return;
        // Tổng user từ /system/dashboard-counts (auth là đủ)
        const countsData = countsRes.status === 'fulfilled' ? countsRes.value?.data : null;
        const countsPayload = countsData?.data ?? countsData;
        const totalUsers = countsPayload?.totalUsers;
        if (totalUsers != null && !Number.isNaN(Number(totalUsers))) {
          setTotalUsersCount(Number(totalUsers));
        }
        // Phiên đăng nhập hôm nay từ activity logs (chỉ superadmin mới có data)
        const activityData = activityRes.status === 'fulfilled' ? activityRes.value?.data : null;
        const activityPayload = activityData?.data ?? activityData;
        const eventTypeStats = activityPayload?.eventTypeStats;
        if (Array.isArray(eventTypeStats)) {
          const loginRow = eventTypeStats.find(
            (r) => String(r.event_type || '').toLowerCase() === 'login'
          );
          const count = loginRow ? Number(loginRow.count) : 0;
          setLoginsTodayCount(Number.isNaN(count) ? 0 : count);
        }
      } catch (_) {
        if (!cancelled) {
          setTotalUsersCount(null);
          setLoginsTodayCount(null);
        }
      }
    };
    loadKpiExtra();
    return () => { cancelled = true; };
  }, [api]);

  const getApiResult = (key) => apiResults[key];
  const tickets = getApiResult('tickets_stats')?.data?.data;
  const modulesStatus = getApiResult('modules_status')?.data;
  const dashboard = getApiResult('dashboard_stats')?.data?.data;
  const tasks = getApiResult('tasks_stats')?.data?.data;
  const dbSizeResult = getApiResult('database_size')?.data?.data;

  const openTickets =
    tickets != null
      ? Number(tickets.new_count || 0) +
        Number(tickets.assigned_count || 0) +
        Number(tickets.in_progress_count || 0)
      : null;
  const onlineModules = modulesStatus?.summary?.online ?? 0;
  const offlineModules = modulesStatus?.summary?.offline ?? 0;
  const totalModules = (onlineModules + offlineModules) || 0;

  const formatDbSize = (data) => {
    if (!data) return null;
    const mb = Number(data.size_mb);
    if (Number.isNaN(mb) || mb < 0) return null;
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(1)} MB`;
  };
  const dbSizeLabel = formatDbSize(dbSizeResult);

  const kpis = [
    {
      icon: 'fas fa-users',
      label: 'Tổng user',
      value: totalUsersCount != null ? String(totalUsersCount) : '—',
      color: PASTEL.blue,
    },
    {
      icon: 'fas fa-sign-in-alt',
      label: 'Phiên đăng nhập (hôm nay)',
      value: loginsTodayCount != null ? String(loginsTodayCount) : '—',
      color: PASTEL.green,
    },
    {
      icon: 'fas fa-ticket-alt',
      label: 'Ticket đang mở',
      value: openTickets !== null ? String(openTickets) : '—',
      color: PASTEL.rose,
      to: '/ims/tickets',
    },
    {
      icon: 'fas fa-cubes',
      label: 'Trạng thái modules',
      value: totalModules > 0 ? `${onlineModules} online / ${offlineModules} offline` : '—',
      color: PASTEL.teal,
    },
    {
      icon: 'fas fa-database',
      label: 'Kho dữ liệu',
      value: dbSizeLabel ?? '—',
      color: PASTEL.teal,
    },
    {
      icon: 'fas fa-chalkboard-teacher',
      label: 'Buổi học (Dashboard)',
      value:
        dashboard != null
          ? `${dashboard.totalSessions ?? 0} buổi`
          : '—',
      color: PASTEL.blue,
    },
  ];

  const ticketCounts = [
    Number(tickets?.new_count || 0),
    Number(tickets?.assigned_count || 0),
    Number(tickets?.in_progress_count || 0),
    Number(tickets?.resolved_count || 0),
    Number(tickets?.closed_count || 0),
  ];
  const ticketLabelsAll = ['Mới', 'Đã giao', 'Đang xử lý', 'Đã xử lý', 'Đóng'];
  const ticketPieData =
    tickets != null ? ticketCounts.filter((n) => n > 0) : [];
  const ticketPieLabels =
    tickets != null
      ? ticketLabelsAll.filter((_, i) => ticketCounts[i] > 0)
      : [];

  const modulesChartLabels = ['Online', 'Offline'];
  const modulesChartData =
    totalModules > 0 ? [onlineModules, offlineModules] : [];

  const dashboardBarLabels = [];
  const dashboardBarData = [];
  if (dashboard != null) {
    if (dashboard.totalStudents != null) {
      dashboardBarLabels.push('Sinh viên');
      dashboardBarData.push(Number(dashboard.totalStudents));
    }
    if (dashboard.totalSessions != null) {
      dashboardBarLabels.push('Buổi học');
      dashboardBarData.push(Number(dashboard.totalSessions));
    }
    if (dashboard.activeSessions != null) {
      dashboardBarLabels.push('Buổi đang diễn ra');
      dashboardBarData.push(Number(dashboard.activeSessions));
    }
    if (dashboard.lateStudentsCount != null) {
      dashboardBarLabels.push('Đi muộn');
      dashboardBarData.push(Number(dashboard.lateStudentsCount));
    }
    if (dashboard.absentStudentsCount != null) {
      dashboardBarLabels.push('Vắng');
      dashboardBarData.push(Number(dashboard.absentStudentsCount));
    }
  }

  const formatApiPayload = (data) => {
    if (data == null) return '—';
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  const getApiBadge = (key) => {
    const r = getApiResult(key);
    if (!r) return null;
    if (r.status === 'ok') return <span className="ims-exec-api-badge ok">OK</span>;
    if (r.status === 'forbidden') return <span className="ims-exec-api-badge forbidden">403</span>;
    return <span className="ims-exec-api-badge err">Lỗi</span>;
  };

  const formatBytes = (n) => {
    if (n == null || n === 0) return '0 B';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };
  const formatBytesPerSec = (n) => {
    if (n == null || n === 0) return '0 B/s';
    if (n < 1024) return `${Math.round(n)} B/s`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB/s`;
    return `${(n / 1024 / 1024).toFixed(2)} MB/s`;
  };

  const formatUptime = (seconds) => {
    if (seconds == null || seconds < 0) return '—';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d} ngày ${h} giờ`;
    if (h > 0) return `${h} giờ ${m} phút`;
    return `${m} phút`;
  };

  const getServerHealthStatus = () => {
    if (hostStatsError || !hostStats) return { label: 'Ngoại tuyến', variant: 'offline' };
    const cpu = Number(hostStats.cpu?.usagePercent ?? 0);
    const mem = Number(hostStats.memory?.usagePercent ?? 0);
    const disks = hostStats.disks || [];
    const maxDisk = disks.length ? Math.max(...disks.map(d => Number(d.usePercent) || 0)) : 0;
    const max = Math.max(cpu, mem, maxDisk);
    if (max >= 90) return { label: 'Nguy hiểm', variant: 'danger' };
    if (max >= 70) return { label: 'Cảnh báo', variant: 'warning' };
    return { label: 'Khỏe mạnh', variant: 'healthy' };
  };
  const serverHealth = getServerHealthStatus();

  /** Trả về 'danger' | 'warning' | null cho từng loại card (ngưỡng: 90 danger, 70 warning; nhiệt độ 85/70). */
  const getCardVariant = (type, valueOrPercent, diskPercent) => {
    if (type === 'cpu' || type === 'memory') {
      const v = Number(valueOrPercent ?? 0);
      if (v >= 90) return 'danger';
      if (v >= 70) return 'warning';
      return null;
    }
    if (type === 'temperature') {
      const v = Number(valueOrPercent ?? 0);
      if (v >= 85) return 'danger';
      if (v >= 70) return 'warning';
      return null;
    }
    if (type === 'disk') {
      const v = Number(diskPercent ?? 0);
      if (v >= 95) return 'danger';
      if (v >= 85) return 'warning';
      return null;
    }
    return null;
  };

  return (
    <div className="ims-exec-wrap">

      {error && (
        <Alert variant="warning" dismissible onClose={() => setError('')} className="mb-3">
          {error}
        </Alert>
      )}

      {loading && Object.keys(apiResults).length === 0 ? (
        <div className="ims-exec-loading">
          <Spinner animation="border" />
          <p className="mt-2">Đang tải dữ liệu từ tất cả API…</p>
        </div>
      ) : (
        <>
          <div className="ims-exec-kpi-grid">
            {kpis.map((k, i) => (
              <div key={i} className="ims-exec-kpi-card">
                {k.to ? (
                  <Link to={k.to}>
                    <div
                      className="ims-exec-kpi-icon"
                      style={{ background: k.color }}
                    >
                      <i className={k.icon}></i>
                    </div>
                    <div className="ims-exec-kpi-label">{k.label}</div>
                    <div className="ims-exec-kpi-value">{k.value}</div>
                  </Link>
                ) : (
                  <>
                    <div
                      className="ims-exec-kpi-icon"
                      style={{ background: k.color }}
                    >
                      <i className={k.icon}></i>
                    </div>
                    <div className="ims-exec-kpi-label">{k.label}</div>
                    <div className="ims-exec-kpi-value">{k.value}</div>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="ims-exec-two-col">
            <div className="ims-exec-server-health">
            <div className="ims-exec-server-health-header">
              <div>
                <h3 className="ims-exec-apis-title mb-0">Sức khỏe server</h3>
                {hostStats?.hostname && <p className="ims-exec-hostname mb-0 small text-muted">{hostStats.hostname}</p>}
              </div>
              <span className={`ims-exec-server-health-badge ims-exec-server-health-badge--${serverHealth.variant}`}>
                <i className={`fas ${serverHealth.variant === 'healthy' ? 'fa-check-circle' : serverHealth.variant === 'warning' ? 'fa-exclamation-triangle' : serverHealth.variant === 'danger' ? 'fa-times-circle' : 'fa-cloud'}`} />
                {serverHealth.label}
              </span>
            </div>
            {hostStatsError ? (
              <div className="ims-exec-host-stats-card ims-exec-host-stats-offline">
                <p className="mb-0">{hostStatsError}</p>
                <p className="ims-exec-host-stats-hint mb-0 small text-muted">
                  Trên máy Server đang chạy Docker, mở terminal và chạy: <code>npm run host-stats</code>
                </p>
              </div>
            ) : hostStats ? (
              <div className="ims-exec-host-stats-grid">
                {/* Hàng 1: CPU, Memory, Network */}
                <div className={`ims-exec-host-stats-card${getCardVariant('cpu', hostStats.cpu?.usagePercent) ? ` ims-exec-host-stats-card--${getCardVariant('cpu', hostStats.cpu?.usagePercent)}` : ''}`}>
                  <div className="ims-exec-host-stats-icon" style={{ background: PASTEL.rose }}><i className="fas fa-microchip" /></div>
                  <div className="ims-exec-host-stats-label">CPU</div>
                  <div className="ims-exec-host-stats-value">{Number(hostStats.cpu?.usagePercent ?? 0).toFixed(1)}%</div>
                  <div className="ims-exec-host-stats-bar"><div className="ims-exec-host-stats-fill" style={{ width: `${Math.min(100, hostStats.cpu?.usagePercent ?? 0)}%`, background: PASTEL.rose }} /></div>
                  {hostStats.cpu?.loadAverage?.length > 0 && (
                    <div className="ims-exec-host-stats-extra">Load: {hostStats.cpu.loadAverage.map((l, i) => Number(l).toFixed(2)).join(' · ')} (1/5/15 phút)</div>
                  )}
                </div>
                <div className={`ims-exec-host-stats-card${getCardVariant('memory', hostStats.memory?.usagePercent) ? ` ims-exec-host-stats-card--${getCardVariant('memory', hostStats.memory?.usagePercent)}` : ''}`}>
                  <div className="ims-exec-host-stats-icon" style={{ background: PASTEL.blue }}><i className="fas fa-memory" /></div>
                  <div className="ims-exec-host-stats-label">Memory</div>
                  <div className="ims-exec-host-stats-value">{Number(hostStats.memory?.usagePercent ?? 0).toFixed(1)}%</div>
                  <div className="ims-exec-host-stats-bar"><div className="ims-exec-host-stats-fill" style={{ width: `${Math.min(100, hostStats.memory?.usagePercent ?? 0)}%`, background: PASTEL.blue }} /></div>
                  <div className="ims-exec-host-stats-extra">{hostStats.memory?.usedMB ?? 0} / {hostStats.memory?.totalMB ?? 0} MB</div>
                  {hostStats.memory?.swapTotalBytes > 0 && (
                    <div className="ims-exec-host-stats-extra">Swap: {Number(hostStats.memory.swapPercent ?? 0).toFixed(1)}% ({formatBytes(hostStats.memory.swapUsedBytes)} / {formatBytes(hostStats.memory.swapTotalBytes)})</div>
                  )}
                </div>
                <div className="ims-exec-host-stats-card">
                  <div className="ims-exec-host-stats-icon" style={{ background: PASTEL.teal }}><i className="fas fa-network-wired" /></div>
                  <div className="ims-exec-host-stats-label">Network</div>
                  <div className="ims-exec-host-stats-value ims-exec-host-stats-network">
                    ↓ {formatBytesPerSec(hostStats.network?.rxPerSec)} / ↑ {formatBytesPerSec(hostStats.network?.txPerSec)}
                  </div>
                  <div className="ims-exec-host-stats-extra">Tổng: ↓ {formatBytes(hostStats.network?.rxBytes)} / ↑ {formatBytes(hostStats.network?.txBytes)}</div>
                </div>
                {/* Hàng 2: Nhiệt độ CPU, Ổ 1, Ổ 2 */}
                <div className={`ims-exec-host-stats-card${getCardVariant('temperature', hostStats.temperature?.mainC ?? hostStats.temperature?.maxC) ? ` ims-exec-host-stats-card--${getCardVariant('temperature', hostStats.temperature?.mainC ?? hostStats.temperature?.maxC)}` : ''}`}>
                  <div className="ims-exec-host-stats-icon" style={{ background: PASTEL.violet }}><i className="fas fa-thermometer-half" /></div>
                  <div className="ims-exec-host-stats-label">Nhiệt độ CPU</div>
                  <div className="ims-exec-host-stats-value">
                    {hostStats.temperature != null && (hostStats.temperature.mainC != null || hostStats.temperature.maxC != null)
                      ? `${(hostStats.temperature.mainC ?? hostStats.temperature.maxC ?? 0).toFixed(0)} °C`
                      : '—'}
                  </div>
                  {hostStats.temperature != null && (hostStats.temperature.mainC != null || hostStats.temperature.maxC != null) ? (
                    <div className="ims-exec-host-stats-extra">
                      {hostStats.temperature.maxC != null && hostStats.temperature.mainC !== hostStats.temperature.maxC
                        ? `Max: ${hostStats.temperature.maxC.toFixed(0)} °C`
                        : 'Nhiệt độ package'}
                    </div>
                  ) : (
                    <div className="ims-exec-host-stats-extra text-muted small">Windows: thử chạy host-stats với quyền Admin</div>
                  )}
                </div>
                {Array.isArray(hostStats.disks) && hostStats.disks.length > 0 && hostStats.disks.map((d, idx) => (
                  <div key={d.label || d.mount || idx} className={`ims-exec-host-stats-card${getCardVariant('disk', null, d.usePercent) ? ` ims-exec-host-stats-card--${getCardVariant('disk', null, d.usePercent)}` : ''}`}>
                    <div className="ims-exec-host-stats-icon" style={{ background: PASTEL.amber }}><i className="fas fa-hdd" /></div>
                    <div className="ims-exec-host-stats-label">Ổ {d.label || d.mount || `#${idx + 1}`}</div>
                    <div className="ims-exec-host-stats-value">{Number(d.usePercent ?? 0).toFixed(1)}%</div>
                    <div className="ims-exec-host-stats-bar"><div className="ims-exec-host-stats-fill" style={{ width: `${Math.min(100, d.usePercent ?? 0)}%`, background: PASTEL.amber }} /></div>
                    <div className="ims-exec-host-stats-extra">{formatBytes(d.usedBytes)} / {formatBytes(d.totalBytes)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ims-exec-host-stats-card"><Spinner animation="border" size="sm" /> <span className="ms-2">Đang tải…</span></div>
            )}
            {hostStats && (
              <p className="ims-exec-empty mt-2 mb-0 small">
                {hostStats.uptimeSeconds != null && hostStats.uptimeSeconds > 0 && <span>Uptime: {formatUptime(hostStats.uptimeSeconds)} · </span>}
                Cập nhật: {hostStats.timestamp ? new Date(hostStats.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'} · Dữ liệu từ máy Server chạy Docker
              </p>
            )}
            </div>

            <div className="ims-exec-recent-activity">
            <div className="ims-exec-recent-activity-header">
              <h3 className="ims-exec-apis-title mb-0">Hoạt động gần đây</h3>
              <Link to="/superadmin/systempage" className="ims-exec-recent-activity-link">
                Xem tất cả Activity Logs <i className="fas fa-arrow-right ms-1" />
              </Link>
            </div>
            {recentActivityLoading ? (
              <div className="ims-exec-recent-activity-card"><Spinner animation="border" size="sm" /> <span className="ms-2">Đang tải…</span></div>
            ) : recentActivityError ? (
              <div className="ims-exec-recent-activity-card ims-exec-recent-activity-error">
                <p className="mb-2">{recentActivityError}</p>
                <Link to="/superadmin/systempage" className="btn btn-sm btn-outline-primary">Mở trang Nhật ký hoạt động</Link>
              </div>
            ) : recentActivityLogs.length === 0 ? (
              <div className="ims-exec-recent-activity-card">
                <p className="ims-exec-empty mb-0">Chưa có hoạt động nào.</p>
                <Link to="/superadmin/systempage" className="small">Xem Activity Logs</Link>
              </div>
            ) : (
              <ul className="ims-exec-recent-activity-list">
                {recentActivityLogs.map((log) => (
                  <li key={log.id} className="ims-exec-recent-activity-item">
                    <span className="ims-exec-recent-activity-dot" />
                    <div className="ims-exec-recent-activity-body">
                      <span className="ims-exec-recent-activity-user">{log.username || log.user_fullname || 'Hệ thống'}</span>
                      <span className="ims-exec-recent-activity-desc">{log.description || log.event_name || log.event_type || '—'}</span>
                      <span className="ims-exec-recent-activity-time">{log.formatted_time || (log.created_at ? new Date(log.created_at).toLocaleString('vi-VN') : '')}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            </div>
          </div>

          <h3 className="ims-exec-apis-title">Dữ liệu từng API (biểu đồ)</h3>
          <p className="ims-exec-empty mb-2">
            Bấm vào card để xem JSON gốc.
          </p>
          <div className="ims-exec-api-list ims-exec-api-list-charts">
            {API_LIST.filter((item) => item.key !== 'database_size' && item.key !== 'modules_status').map((item) => {
              const r = getApiResult(item.key);
              const open = openApiKey === item.key;
              const chartConfig = getChartConfig(item.key, r);
              const payload = r ? formatApiPayload(r.data) : '—';
              return (
                <div key={item.key} className="ims-exec-api-card">
                  <div
                    className="ims-exec-api-card-header"
                    onClick={() => setOpenApiKey(open ? null : item.key)}
                    aria-expanded={open}
                  >
                    <span className="ims-exec-api-label">{item.label}</span>
                    {getApiBadge(item.key)}
                  </div>
                  <div className="ims-exec-api-chart-body">
                    {chartConfig ? (
                      <div className="ims-exec-api-chart-wrap">
                        {chartConfig.chartType === 'bar' && (
                          <BarChart
                            data={chartConfig.data}
                            labels={chartConfig.labels}
                            colors={chartConfig.colors || PIE_COLORS}
                            height={160}
                            showDataLabels
                          />
                        )}
                        {chartConfig.chartType === 'pie' && (
                          <PieChart
                            data={chartConfig.data}
                            labels={chartConfig.labels}
                            colors={chartConfig.colors || PIE_COLORS}
                            height={160}
                          />
                        )}
                        {chartConfig.chartType === 'doughnut' && (
                          <DoughnutChart
                            data={chartConfig.data}
                            labels={chartConfig.labels}
                            colors={chartConfig.colors || PIE_COLORS}
                            height={160}
                          />
                        )}
                        {chartConfig.chartType === 'line' && (
                          <LineChart
                            data={chartConfig.data}
                            labels={chartConfig.labels}
                            colors={chartConfig.colors || PIE_COLORS}
                            height={160}
                            fill
                          />
                        )}
                      </div>
                    ) : r?.status === 'ok' ? (
                      <p className="ims-exec-empty mb-0">Dữ liệu không thể vẽ chart.</p>
                    ) : r?.status === 'forbidden' ? (
                      <p className="ims-exec-empty mb-0">Bạn không có quyền truy cập API này.</p>
                    ) : (
                      <p className="ims-exec-empty mb-0">Lỗi kết nối hoặc server.</p>
                    )}
                  </div>
                  <Collapse in={open}>
                    <div className="ims-exec-api-body">
                      <pre>{payload}</pre>
                    </div>
                  </Collapse>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default IMSExecDashboard;
