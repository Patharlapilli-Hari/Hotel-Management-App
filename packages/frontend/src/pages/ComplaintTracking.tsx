import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, Filter, Clock, Calendar, Wrench } from 'lucide-react';

interface Log {
  id: number;
  complaint_id: number;
  staff_id: number;
  status_before: string;
  status_after: string;
  action_taken: string;
  logged_at: string;
  staff_name: string;
  staff_email: string;
}

interface Complaint {
  id: number;
  student_id: number;
  category_id: number;
  description: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  created_at: string;
  updated_at: string;
  student_name: string;
  student_email: string;
  category_name: string;
  room_number?: string;
  block_name?: string;
  logs?: Log[];
}

interface User {
  id: number;
  username: string;
  role: string;
}

interface ComplaintTrackingProps {
  currentUser: User | null;
  addToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc: string) => void;
}

export const ComplaintTracking: React.FC<ComplaintTrackingProps> = ({
  currentUser,
  addToast,
}) => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState('');

  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);
    let url = `/api/complaints?student_id=${currentUser.id}`;
    if (selectedStatus) url += `&status=${selectedStatus}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load complaints');
        return res.json();
      })
      .then((data) => {
        setComplaints(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        addToast('error', 'Sync Failed', err.message);
        setLoading(false);
      });
  }, [currentUser, selectedStatus, addToast]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Open':
        return <span className="badge secondary">Open</span>;
      case 'In Progress':
        return <span className="badge warning">In Progress</span>;
      case 'Resolved':
        return <span className="badge success">Resolved</span>;
      case 'Closed':
        return <span className="badge info">Closed</span>;
      default:
        return <span className="badge secondary">{status}</span>;
    }
  };

  const getTimelineNodes = (complaint: Complaint) => {
    const statuses = ['Open', 'In Progress', 'Resolved', 'Closed'];
    const currentIdx = statuses.indexOf(complaint.status);

    return (
      <div className="timeline">
        {statuses.map((step, idx) => {
          let nodeClass = 'timeline-node';
          let desc = '';

          if (idx < currentIdx) {
            nodeClass += ' completed';
            desc = `Milestone accomplished. Status updated to ${step}.`;
          } else if (idx === currentIdx) {
            nodeClass += ' active';
            desc = `Current Status: Complaint is currently registered as ${step}.`;
          } else {
            desc = `Awaiting subsequent escalation to ${step}.`;
          }

          // Search in logs if there are descriptions matching this state
          const logForStep = complaint.logs?.find((l) => l.status_after === step);
          if (logForStep) {
            desc = `${logForStep.action_taken} (by ${logForStep.staff_name} on ${logForStep.logged_at})`;
          }

          return (
            <div key={step} className={nodeClass}>
              <div className="timeline-header">
                <span className="timeline-status">{step}</span>
                <span className="timeline-date">
                  {logForStep ? logForStep.logged_at : idx === 0 ? complaint.created_at.split('T')[0] : ''}
                </span>
              </div>
              <div className="timeline-desc">{desc}</div>
            </div>
          );
        })}
      </div>
    );
  };

  if (!currentUser) {
    return (
      <div className="empty-state">
        <ShieldAlert size={40} style={{ color: '#ef4444' }} />
        <h4>Not Logged In</h4>
        <p>Please select a Student role to inspect active complaint tickets.</p>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div className="header-area">
        <div className="header-title">
          <h1>Track Complaints</h1>
          <p>Inspect status progressions, communication trails, and resolution activities.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'hsl(var(--text-muted))', fontSize: '0.9rem', fontWeight: 600 }}>
          <Filter size={16} />
          <span>FILTER BY STATUS:</span>
        </div>
        <select
          className="filter-select"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          <option value="">All Tickets</option>
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Resolved">Resolved</option>
          <option value="Closed">Closed</option>
        </select>
      </div>

      {/* Complaint Tickets List */}
      {loading ? (
        <div className="empty-state">
          <Clock size={40} className="animate-pulse" style={{ color: '#6366f1' }} />
          <h4>Querying Complaint Registries</h4>
          <p>Compiling historical maintenance records...</p>
        </div>
      ) : error ? (
        <div className="empty-state" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
          <ShieldAlert size={40} style={{ color: '#ef4444' }} />
          <h4>Synchronization Error</h4>
          <p>{error}</p>
        </div>
      ) : complaints.length === 0 ? (
        <div className="empty-state">
          <ShieldCheck size={40} style={{ color: '#10b981' }} />
          <h4>No Active Tickets Found</h4>
          <p>Excellent! There are no unresolved maintenance issues recorded for your profile.</p>
        </div>
      ) : (
        <div className="complaint-list">
          {complaints.map((comp) => (
            <div key={comp.id} className="complaint-card">
              <div className="complaint-header">
                <div className="complaint-title-area">
                  <span className="complaint-id">#{comp.id}</span>
                  <span className="complaint-category">{comp.category_name} Issue</span>
                  <span className="complaint-date">
                    <Calendar size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                    Raised: {comp.created_at.split('T')[0]}
                  </span>
                </div>
                {getStatusBadge(comp.status)}
              </div>

              <div className="complaint-body">
                {comp.description}
                {comp.room_number && (
                  <span style={{ display: 'block', fontSize: '0.82rem', color: '#6366f1', fontWeight: 700, marginTop: '8px' }}>
                    🏨 Location: {comp.block_name} - Room {comp.room_number}
                  </span>
                )}
              </div>

              {/* Progress Timeline Section */}
              <div className="complaint-timeline-title">
                <Wrench size={12} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                REPAIR PROGRESSION TIMELINE
              </div>
              {getTimelineNodes(comp)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
