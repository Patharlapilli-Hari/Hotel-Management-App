import React, { useEffect, useState } from 'react';
import { Home, ShieldAlert, CheckCircle2, TrendingUp, HelpCircle } from 'lucide-react';

interface DashboardStats {
  rooms: {
    total: number;
    occupied: number;
    capacity: number;
    allocated_students: number;
    occupancy_rate: number;
  };
  complaints: {
    total: number;
    pending: number;
    resolved: number;
    closed: number;
  };
  categories: Array<{ category: string; count: number }>;
  blocks: Array<{ block_name: string; total_rooms: number; total_capacity: number; active_students: number }>;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dashboard/summary')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load dashboard metrics');
        return res.json();
      })
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="empty-state">
        <TrendingUp size={48} className="animate-pulse" style={{ color: '#6366f1' }} />
        <h4>Loading Dashboard Metrics</h4>
        <p>Crunching live numbers from database...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="empty-state" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
        <ShieldAlert size={48} style={{ color: '#ef4444' }} />
        <h4>Failed to Load Analytics</h4>
        <p>{error || 'An unexpected error occurred.'}</p>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div className="header-area">
        <div className="header-title">
          <h1>Analytics Dashboard</h1>
          <p>Real-time telemetry and overview of your hostel rooms and complaints.</p>
        </div>
      </div>

      {/* Primary Metrics Row */}
      <div className="summary-grid">
        <div className="stat-card primary">
          <div className="stat-header">
            <span className="stat-label">Total Rooms</span>
            <div className="stat-icon"><Home size={20} /></div>
          </div>
          <div className="stat-value">{stats.rooms.total}</div>
          <div className="stat-meta">
            <span>{stats.rooms.occupied} / {stats.rooms.total} Occupied</span>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-header">
            <span className="stat-label">Room Occupancy</span>
            <div className="stat-icon"><TrendingUp size={20} /></div>
          </div>
          <div className="stat-value">{stats.rooms.occupancy_rate}%</div>
          <div className="stat-meta">
            <span>{stats.rooms.allocated_students} Residents in {stats.rooms.capacity} Slots</span>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-header">
            <span className="stat-label">Pending Complaints</span>
            <div className="stat-icon"><ShieldAlert size={20} /></div>
          </div>
          <div className="stat-value">{stats.complaints.pending}</div>
          <div className="stat-meta">
            <span>Requires Action</span>
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-header">
            <span className="stat-label">Resolved Issues</span>
            <div className="stat-icon"><CheckCircle2 size={20} /></div>
          </div>
          <div className="stat-value">{stats.complaints.resolved}</div>
          <div className="stat-meta">
            <span>{stats.complaints.closed} Closed Archives</span>
          </div>
        </div>
      </div>

      {/* Dual Column Graph breakdown */}
      <div className="analytics-grid">
        <div className="content-card">
          <div className="card-title">
            <h3>Block-Wise Occupancy Statistics</h3>
          </div>
          <div className="occupancy-chart">
            {stats.blocks.map((block, idx) => {
              const rate = block.total_capacity ? Math.round((block.active_students / block.total_capacity) * 100) : 0;
              const fillColors = ['purple', 'indigo', 'emerald'];
              const fillColor = fillColors[idx % fillColors.length];

              return (
                <div key={block.block_name} className="chart-bar-item">
                  <div className="bar-labels">
                    <span style={{ color: '#ffffff', fontWeight: 700 }}>{block.block_name}</span>
                    <span style={{ color: '#a1a1aa' }}>
                      {block.active_students} / {block.total_capacity} Slots ({rate}%)
                    </span>
                  </div>
                  <div className="bar-track">
                    <div className={`bar-fill ${fillColor}`} style={{ width: `${rate}%` }} />
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', marginTop: '2px' }}>
                    Total rooms: {block.total_rooms}
                  </div>
                </div>
              );
            })}
            {stats.blocks.length === 0 && (
              <div className="empty-state" style={{ padding: '24px' }}>
                <HelpCircle size={28} />
                <p>No hostel blocks registered.</p>
              </div>
            )}
          </div>
        </div>

        <div className="content-card">
          <div className="card-title">
            <h3>Complaints by Category</h3>
          </div>
          <div className="category-pills">
            {stats.categories.map((cat) => (
              <div key={cat.category} className="category-pill">
                <span className="category-name">
                  <span className={`category-dot ${cat.category}`} />
                  {cat.category}
                </span>
                <span className="category-count">{cat.count}</span>
              </div>
            ))}
            {stats.categories.length === 0 && (
              <div className="empty-state" style={{ padding: '24px' }}>
                <HelpCircle size={28} />
                <p>No complaint categories loaded.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
