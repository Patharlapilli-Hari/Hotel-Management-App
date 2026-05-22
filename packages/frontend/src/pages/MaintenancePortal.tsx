import React, { useEffect, useState } from 'react';
import { Wrench, ShieldAlert, CheckSquare, Download, Filter, X } from 'lucide-react';

interface Log {
  id: number;
  complaint_id: number;
  staff_id: number;
  status_before: string;
  status_after: string;
  action_taken: string;
  logged_at: string;
  staff_name: string;
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
  full_name: string;
}

interface MaintenancePortalProps {
  currentUser: User | null;
  addToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc: string) => void;
}

export const MaintenancePortal: React.FC<MaintenancePortalProps> = ({
  currentUser,
  addToast,
}) => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Status Update Action State
  const [activeComplaint, setActiveComplaint] = useState<Complaint | null>(null);
  const [targetStatus, setTargetStatus] = useState<Complaint['status']>('In Progress');
  const [actionTaken, setActionTaken] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchComplaints = () => {
    setLoading(true);
    let url = '/api/complaints?';
    if (selectedCategory) url += `category_id=${selectedCategory}&`;
    if (selectedStatus) url += `status=${selectedStatus}&`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch complaints data');
        return res.json();
      })
      .then((data) => {
        setComplaints(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchComplaints();
  }, [selectedCategory, selectedStatus]);

  const handleUpdateStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      addToast('error', 'Auth Error', 'You must be logged in to perform this action.');
      return;
    }

    if (!activeComplaint) return;

    if (!actionTaken.trim() || actionTaken.length < 5) {
      addToast('error', 'Form Error', 'Please write a brief summary of action taken (minimum 5 characters).');
      return;
    }

    setSubmitting(true);
    fetch(`/api/complaints/${activeComplaint.id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: targetStatus,
        staff_id: currentUser.id,
        action_taken: actionTaken,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update complaint.');
        return data;
      })
      .then(() => {
        addToast(
          'success',
          'Status Updated',
          `Ticket #${activeComplaint.id} marked as ${targetStatus}. Activity logged successfully.`
        );
        setShowModal(false);
        setActiveComplaint(null);
        setActionTaken('');
        setSubmitting(false);
        fetchComplaints(); // Refresh tickets list
      })
      .catch((err) => {
        addToast('error', 'Update Failed', err.message);
        setSubmitting(false);
      });
  };

  // CSV Exporter for complaints registry (Bonus Enhancement!)
  const exportCSV = () => {
    if (complaints.length === 0) {
      addToast('warning', 'Export Blocked', 'No complaints data available to export.');
      return;
    }

    const headers = [
      'Ticket ID',
      'Student Name',
      'Student Email',
      'Block Name',
      'Room Number',
      'Category',
      'Description',
      'Status',
      'Created At',
      'Updated At',
    ];

    const rows = complaints.map((c) => [
      c.id,
      `"${c.student_name.replace(/"/g, '""')}"`,
      c.student_email,
      c.block_name || 'N/A',
      c.room_number || 'N/A',
      c.category_name,
      `"${c.description.replace(/"/g, '""')}"`,
      c.status,
      c.created_at,
      c.updated_at,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `hostel_complaints_registry_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('success', 'Export Completed', 'Complaints summary CSV report generated and downloaded.');
  };

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

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div className="header-area">
        <div className="header-title">
          <h1>Maintenance Work Orders</h1>
          <p>Inspect incoming repair filings, update logs, and deploy technicians.</p>
        </div>
        <button className="btn btn-secondary" onClick={exportCSV}>
          <Download size={18} />
          Download Complaints Summary
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'hsl(var(--text-muted))', fontSize: '0.9rem', fontWeight: 600 }}>
          <Filter size={16} />
          <span>FILTER TICKETS:</span>
        </div>

        <select
          className="filter-select"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          <option value="1">Electricity</option>
          <option value="2">Water</option>
          <option value="3">Cleanliness</option>
          <option value="4">Internet</option>
          <option value="5">Maintenance</option>
        </select>

        <select
          className="filter-select"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Resolved">Resolved</option>
          <option value="Closed">Closed</option>
        </select>
      </div>

      {/* Main Complaints Grid/Table */}
      {loading ? (
        <div className="empty-state">
          <Wrench size={40} className="animate-pulse" style={{ color: '#6366f1' }} />
          <h4>Fetching Active Work Orders</h4>
          <p>Connecting to backend SQLite services...</p>
        </div>
      ) : error ? (
        <div className="empty-state" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
          <ShieldAlert size={40} style={{ color: '#ef4444' }} />
          <h4>Connection Failed</h4>
          <p>{error}</p>
        </div>
      ) : complaints.length === 0 ? (
        <div className="empty-state">
          <CheckSquare size={40} style={{ color: '#10b981' }} />
          <h4>No Complaints Recorded</h4>
          <p>All tickets are resolved and closed. Outstanding maintenance score is perfect!</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Student / Location</th>
                <th>Category</th>
                <th>Description</th>
                <th>Created</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map((comp) => (
                <tr key={comp.id}>
                  <td>
                    <span className="complaint-id">#{comp.id}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 700, color: '#ffffff' }}>{comp.student_name}</span>
                      <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600 }}>
                        {comp.block_name ? `${comp.block_name} - Room ${comp.room_number}` : 'No Room Allocated'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{comp.category_name}</span>
                  </td>
                  <td style={{ maxWidth: '300px', fontSize: '0.88rem', color: 'hsl(var(--text-main))', lineHeight: '1.4' }}>
                    {comp.description}
                  </td>
                  <td>
                    <span style={{ fontSize: '0.82rem', color: 'hsl(var(--text-muted))' }}>
                      {comp.created_at.split('T')[0]}
                    </span>
                  </td>
                  <td>{getStatusBadge(comp.status)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {comp.status === 'Open' && (
                        <button
                          className="btn"
                          style={{ padding: '6px 12px', fontSize: '0.78rem', background: '#f59e0b' }}
                          onClick={() => {
                            setActiveComplaint(comp);
                            setTargetStatus('In Progress');
                            setActionTaken(`Ticket assigned. Dispatching technician to inspect the ${comp.category_name} issue.`);
                            setShowModal(true);
                          }}
                        >
                          Acknowledge
                        </button>
                      )}
                      {comp.status === 'In Progress' && (
                        <button
                          className="btn"
                          style={{ padding: '6px 12px', fontSize: '0.78rem', background: '#10b981' }}
                          onClick={() => {
                            setActiveComplaint(comp);
                            setTargetStatus('Resolved');
                            setActionTaken('');
                            setShowModal(true);
                          }}
                        >
                          Resolve
                        </button>
                      )}
                      {comp.status === 'Resolved' && (
                        <button
                          className="btn"
                          style={{ padding: '6px 12px', fontSize: '0.78rem', background: '#38bdf8' }}
                          onClick={() => {
                            setActiveComplaint(comp);
                            setTargetStatus('Closed');
                            setActionTaken('Verified by resident. Ticket permanently closed and archived.');
                            setShowModal(true);
                          }}
                        >
                          Archive/Close
                        </button>
                      )}
                      {comp.status === 'Closed' && (
                        <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Resolved Logs</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Action Taken Modal */}
      {showModal && activeComplaint && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Action Taken Log</h3>
              <button className="modal-close" onClick={() => {
                setShowModal(false);
                setActiveComplaint(null);
                setActionTaken('');
              }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateStatus}>
              <div style={{ marginBottom: '18px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', fontSize: '0.9rem' }}>
                <span style={{ color: 'hsl(var(--text-muted))', display: 'block', fontSize: '0.78rem' }}>COMPLAINT DETAILS</span>
                <span style={{ fontWeight: 700, color: '#ffffff' }}>#{activeComplaint.id} - {activeComplaint.category_name} Issue</span>
                <p style={{ marginTop: '6px', color: 'hsl(var(--text-main))', fontStyle: 'italic', fontSize: '0.85rem' }}>
                  "{activeComplaint.description}"
                </p>
                <span style={{ color: 'hsl(var(--text-muted))', display: 'block', fontSize: '0.78rem', marginTop: '10px' }}>TRANSITION STATUS</span>
                <span style={{ fontWeight: 800, color: '#10b981' }}>
                  {activeComplaint.status} ➔ {targetStatus}
                </span>
              </div>

              <div className="form-group">
                <label>Action Taken Explanation</label>
                <textarea
                  className="form-control"
                  placeholder="Explain exactly what was found, fixed, or the status of technician ordering parts. Minimum 5 characters."
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowModal(false);
                    setActiveComplaint(null);
                    setActionTaken('');
                  }}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Save Activity & Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
