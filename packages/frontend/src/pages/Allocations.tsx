import React, { useEffect, useState } from 'react';
import { Layers, Plus, RotateCw, Download, X, ShieldAlert } from 'lucide-react';

interface Allocation {
  id: number;
  student_id: number;
  room_id: number;
  allocation_date: string;
  status: 'Active' | 'Transferred' | 'Vacated';
  roommate_preference?: string;
  student_name: string;
  student_email: string;
  academic_details: string;
  room_number: string;
  block_name: string;
  room_type: string;
  capacity: number;
}

interface User {
  id: number;
  username: string;
  role: string;
  full_name: string;
  email: string;
  academic_details: string;
}

interface Room {
  id: number;
  room_number: string;
  block_name: string;
  capacity: number;
  room_type: string;
  occupancy_status: string;
  current_occupancy: number;
}

interface AllocationsProps {
  currentRole: string;
  addToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc: string) => void;
}

export const Allocations: React.FC<AllocationsProps> = ({ currentRole, addToast }) => {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Allocation Form State
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [roommatePreference, setRoommatePreference] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Transfer Form State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [activeTransferAlloc, setActiveTransferAlloc] = useState<Allocation | null>(null);
  const [transferRoomId, setTransferRoomId] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load Allocations
      const allocRes = await fetch('/api/room-allocations');
      if (!allocRes.ok) throw new Error('Failed to load allocations');
      const allocData = await allocRes.json();
      setAllocations(allocData);

      // 2. Load Students
      const studentRes = await fetch('/api/users?role=student');
      if (!studentRes.ok) throw new Error('Failed to load student directory');
      const studentData = await studentRes.json();
      setStudents(studentData);

      // 3. Load Rooms
      const roomRes = await fetch('/api/hostel-rooms');
      if (!roomRes.ok) throw new Error('Failed to load rooms list');
      const roomData = await roomRes.json();
      setRooms(roomData);

      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAllocate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !selectedRoomId) {
      addToast('error', 'Form Error', 'Please select both a student and a room.');
      return;
    }

    // Client-side verification if student already has an active allocation
    const alreadyAllocated = allocations.some(
      (a) => a.student_id === parseInt(selectedStudentId, 10) && a.status === 'Active'
    );
    if (alreadyAllocated) {
      addToast('error', 'Duplicate Allocation', 'This student already has an active room allocation.');
      return;
    }

    // Client-side verification if room is at capacity
    const room = rooms.find((r) => r.id === parseInt(selectedRoomId, 10));
    if (room && room.current_occupancy >= room.capacity) {
      addToast('error', 'Room Capacity Full', `Room ${room.room_number} is already full.`);
      return;
    }

    setSubmitting(true);
    fetch('/api/room-allocations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: parseInt(selectedStudentId, 10),
        room_id: parseInt(selectedRoomId, 10),
        roommate_preference: roommatePreference,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to allocate room.');
        return data;
      })
      .then((newAlloc) => {
        addToast(
          'success',
          'Allocation Confirmed',
          `Successfully allocated Student ${newAlloc.full_name || 'Resident'} to Room ${newAlloc.room_number}.`
        );
        setShowAllocModal(false);
        setSelectedStudentId('');
        setSelectedRoomId('');
        setRoommatePreference('');
        setSubmitting(false);
        loadData(); // reload tables
      })
      .catch((err) => {
        addToast('error', 'Allocation Failed', err.message);
        setSubmitting(false);
      });
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTransferAlloc || !transferRoomId) {
      addToast('error', 'Form Error', 'Please select a new room.');
      return;
    }

    // Verify room has capacity
    const room = rooms.find((r) => r.id === parseInt(transferRoomId, 10));
    if (room && room.current_occupancy >= room.capacity) {
      addToast('error', 'Room Capacity Full', `Target Room ${room.room_number} is already full.`);
      return;
    }

    setSubmitting(true);
    fetch(`/api/room-allocations/${activeTransferAlloc.id}/transfer`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        new_room_id: parseInt(transferRoomId, 10),
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to transfer student.');
        return data;
      })
      .then(() => {
        addToast(
          'success',
          'Transfer Complete',
          `Student ${activeTransferAlloc.student_name} was successfully transferred.`
        );
        setShowTransferModal(false);
        setActiveTransferAlloc(null);
        setTransferRoomId('');
        setSubmitting(false);
        loadData();
      })
      .catch((err) => {
        addToast('error', 'Transfer Failed', err.message);
        setSubmitting(false);
      });
  };

  // CSV Exporter for allocations report (Bonus Enhancement!)
  const exportCSV = () => {
    if (allocations.length === 0) {
      addToast('warning', 'Export Blocked', 'No allocation data available to export.');
      return;
    }

    const headers = [
      'Allocation ID',
      'Student Name',
      'Student Email',
      'Academic Details',
      'Block Name',
      'Room Number',
      'Room Type',
      'Allocation Date',
      'Status',
      'Roommate Preference',
    ];

    const rows = allocations.map((a) => [
      a.id,
      `"${a.student_name.replace(/"/g, '""')}"`,
      a.student_email,
      `"${a.academic_details.replace(/"/g, '""')}"`,
      a.block_name,
      a.room_number,
      a.room_type,
      a.allocation_date,
      a.status,
      `"${(a.roommate_preference || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `hostel_room_allocations_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('success', 'Export Completed', 'Room allocations CSV report generated and downloaded.');
  };

  const isWardenOrAdmin = currentRole === 'warden' || currentRole === 'admin';

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div className="header-area">
        <div className="header-title">
          <h1>Room Allocations</h1>
          <p>Assign hostel rooms, perform room transfers, and generate downloadable summaries.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={exportCSV}>
            <Download size={18} />
            Export CSV
          </button>
          {isWardenOrAdmin && (
            <button className="btn" onClick={() => setShowAllocModal(true)}>
              <Plus size={18} />
              Allocate Room
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          <Layers size={40} className="animate-pulse" style={{ color: '#6366f1' }} />
          <h4>Synchronizing Allocations Table</h4>
          <p>Loading database relationships...</p>
        </div>
      ) : error ? (
        <div className="empty-state" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
          <ShieldAlert size={40} style={{ color: '#ef4444' }} />
          <h4>Error Syncing Data</h4>
          <p>{error}</p>
        </div>
      ) : allocations.length === 0 ? (
        <div className="empty-state">
          <Layers size={40} />
          <h4>No Active Allocations</h4>
          <p>Begin by allocating a hostel room to a student.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Academic Credentials</th>
                <th>Hostel Block</th>
                <th>Room No</th>
                <th>Allocated At</th>
                <th>Status</th>
                {isWardenOrAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {allocations.map((alloc) => (
                <tr key={alloc.id}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 700, color: '#ffffff' }}>{alloc.student_name}</span>
                      <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))' }}>
                        {alloc.student_email}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.85rem' }}>{alloc.academic_details || 'N/A'}</span>
                  </td>
                  <td>{alloc.block_name}</td>
                  <td>
                    <span style={{ fontWeight: 700, color: '#6366f1' }}>Room {alloc.room_number}</span>
                    <span style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', display: 'block' }}>
                      {alloc.room_type} (Max {alloc.capacity})
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.85rem' }}>{alloc.allocation_date}</span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        alloc.status === 'Active'
                          ? 'success'
                          : alloc.status === 'Transferred'
                          ? 'info'
                          : 'secondary'
                      }`}
                    >
                      {alloc.status}
                    </span>
                    {alloc.roommate_preference && alloc.roommate_preference !== 'None' && (
                      <span style={{ display: 'block', fontSize: '0.7rem', color: '#c084fc', marginTop: '2px' }}>
                        Pref: {alloc.roommate_preference}
                      </span>
                    )}
                  </td>
                  {isWardenOrAdmin && (
                    <td>
                      {alloc.status === 'Active' ? (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', gap: '6px' }}
                          onClick={() => {
                            setActiveTransferAlloc(alloc);
                            setShowTransferModal(true);
                          }}
                        >
                          <RotateCw size={12} />
                          Transfer
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Archived</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Allocate Room Modal Dialog */}
      {showAllocModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Allocate Room Assignment</h3>
              <button className="modal-close" onClick={() => setShowAllocModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAllocate}>
              <div className="form-group">
                <label>Select Student</label>
                <select
                  className="form-control"
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  disabled={submitting}
                >
                  <option value="">-- Choose student account --</option>
                  {students.map((stu) => {
                    // Check if this student already has an active allocation
                    const hasActive = allocations.some((a) => a.student_id === stu.id && a.status === 'Active');
                    return (
                      <option key={stu.id} value={stu.id} disabled={hasActive}>
                        {stu.full_name} ({stu.username}) {hasActive ? '[Allocated]' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-group">
                <label>Select Target Room</label>
                <select
                  className="form-control"
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  disabled={submitting}
                >
                  <option value="">-- Choose hostel room --</option>
                  {rooms.map((room) => {
                    const isFull = room.current_occupancy >= room.capacity;
                    return (
                      <option key={room.id} value={room.id} disabled={isFull}>
                        {room.block_name} - Room {room.room_number} ({room.room_type} - {room.current_occupancy}/{room.capacity} slots) {isFull ? '[FULL]' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-group">
                <label>Roommate Preference (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. John Doe"
                  value={roommatePreference}
                  onChange={(e) => setRoommatePreference(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAllocModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={submitting}>
                  {submitting ? 'Allocating...' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Student Modal Dialog */}
      {showTransferModal && activeTransferAlloc && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Transfer Resident Room</h3>
              <button className="modal-close" onClick={() => {
                setShowTransferModal(false);
                setActiveTransferAlloc(null);
              }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleTransfer}>
              <div style={{ marginBottom: '20px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', display: 'block' }}>STUDENT</span>
                <span style={{ fontWeight: 700, color: '#ffffff' }}>{activeTransferAlloc.student_name}</span>
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', display: 'block', marginTop: '6px' }}>CURRENT ROOM</span>
                <span style={{ fontWeight: 700, color: '#f59e0b' }}>
                  {activeTransferAlloc.block_name} - Room {activeTransferAlloc.room_number}
                </span>
              </div>

              <div className="form-group">
                <label>Target Destination Room</label>
                <select
                  className="form-control"
                  value={transferRoomId}
                  onChange={(e) => setTransferRoomId(e.target.value)}
                  disabled={submitting}
                >
                  <option value="">-- Choose target room --</option>
                  {rooms
                    .filter((r) => r.id !== activeTransferAlloc.room_id)
                    .map((room) => {
                      const isFull = room.current_occupancy >= room.capacity;
                      return (
                        <option key={room.id} value={room.id} disabled={isFull}>
                          {room.block_name} - Room {room.room_number} ({room.room_type} - {room.current_occupancy}/{room.capacity} slots) {isFull ? '[FULL]' : ''}
                        </option>
                      );
                    })}
                </select>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowTransferModal(false);
                    setActiveTransferAlloc(null);
                  }}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={submitting}>
                  {submitting ? 'Processing...' : 'Approve Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
