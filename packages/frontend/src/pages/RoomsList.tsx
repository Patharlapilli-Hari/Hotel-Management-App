import React, { useEffect, useState } from 'react';
import { Search, Plus, X, Home, ShieldAlert } from 'lucide-react';

interface Occupant {
  id: number;
  full_name: string;
  email: string;
  academic_details: string;
  allocation_date: string;
  roommate_preference?: string;
}

interface Room {
  id: number;
  room_number: string;
  block_name: string;
  capacity: number;
  room_type: 'Single' | 'Double' | 'Triple';
  occupancy_status: 'Available' | 'Full';
  current_occupancy: number;
  occupants: Occupant[];
}

interface RoomsListProps {
  currentRole: string;
  addToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc: string) => void;
}

export const RoomsList: React.FC<RoomsListProps> = ({ currentRole, addToast }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBlock, setSelectedBlock] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Create Room modal state
  const [showModal, setShowModal] = useState(false);
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newBlockName, setNewBlockName] = useState('Block A');
  const [newCapacity, setNewCapacity] = useState('2');
  const [newRoomType, setNewRoomType] = useState<'Single' | 'Double' | 'Triple'>('Double');
  const [submitting, setSubmitting] = useState(false);

  const fetchRooms = () => {
    setLoading(true);
    let url = '/api/hostel-rooms?';
    if (selectedBlock) url += `block_name=${encodeURIComponent(selectedBlock)}&`;
    if (selectedType) url += `room_type=${encodeURIComponent(selectedType)}&`;
    if (selectedStatus) url += `occupancy_status=${encodeURIComponent(selectedStatus)}&`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load rooms');
        return res.json();
      })
      .then((data) => {
        setRooms(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchRooms();
  }, [selectedBlock, selectedType, selectedStatus]);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomNumber.trim()) {
      addToast('error', 'Validation Error', 'Please enter a room number.');
      return;
    }

    setSubmitting(true);
    fetch('/api/hostel-rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_number: newRoomNumber,
        block_name: newBlockName,
        capacity: parseInt(newCapacity, 10),
        room_type: newRoomType,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create room.');
        return data;
      })
      .then(() => {
        addToast('success', 'Room Created', `Room ${newRoomNumber} in ${newBlockName} created successfully.`);
        setNewRoomNumber('');
        setShowModal(false);
        setSubmitting(false);
        fetchRooms(); // refresh list
      })
      .catch((err) => {
        addToast('error', 'Error Creating Room', err.message);
        setSubmitting(false);
      });
  };

  // Filter local listings by Search Query (Room number)
  const filteredRooms = rooms.filter((room) =>
    room.room_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canManage = currentRole === 'warden' || currentRole === 'admin';

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div className="header-area">
        <div className="header-title">
          <h1>Hostel Room Records</h1>
          <p>Browse inventory, inspect resident logs, and manage allocations.</p>
        </div>
        {canManage && (
          <button className="btn" onClick={() => setShowModal(true)}>
            <Plus size={18} />
            Create Room
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="filters-bar">
        <div className="search-input-wrapper">
          <Search size={18} />
          <input
            type="text"
            className="search-input"
            placeholder="Search room number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="filter-select"
          value={selectedBlock}
          onChange={(e) => setSelectedBlock(e.target.value)}
        >
          <option value="">All Blocks</option>
          <option value="Block A">Block A</option>
          <option value="Block B">Block B</option>
          <option value="Block C">Block C</option>
        </select>

        <select
          className="filter-select"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          <option value="">All Room Types</option>
          <option value="Single">Single</option>
          <option value="Double">Double</option>
          <option value="Triple">Triple</option>
        </select>

        <select
          className="filter-select"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="Available">Available Only</option>
          <option value="Full">Full Only</option>
        </select>
      </div>

      {/* Main Grid */}
      {loading ? (
        <div className="empty-state">
          <Home size={40} className="animate-pulse" style={{ color: '#6366f1' }} />
          <h4>Retrieving Room Records</h4>
          <p>Querying SQLite table for layout matrices...</p>
        </div>
      ) : error ? (
        <div className="empty-state" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
          <ShieldAlert size={40} style={{ color: '#ef4444' }} />
          <h4>Failed to load Rooms</h4>
          <p>{error}</p>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="empty-state">
          <Home size={40} />
          <h4>No Rooms Found</h4>
          <p>Try resetting the search filters or register a new room block.</p>
        </div>
      ) : (
        <div className="rooms-grid">
          {filteredRooms.map((room) => (
            <div key={room.id} className="room-card">
              <div className="room-header">
                <span className="room-number-label">Room {room.room_number}</span>
                <span className={`badge ${room.occupancy_status === 'Full' ? 'danger' : 'success'}`}>
                  {room.occupancy_status}
                </span>
              </div>

              <div className="room-details">
                <div className="detail-row">
                  <span>Block:</span>
                  <span className="detail-value">{room.block_name}</span>
                </div>
                <div className="detail-row">
                  <span>Type:</span>
                  <span className="detail-value">{room.room_type}</span>
                </div>
                <div className="detail-row">
                  <span>Capacity Slots:</span>
                  <span className="detail-value">
                    {room.current_occupancy} / {room.capacity} Full
                  </span>
                </div>
              </div>

              {/* Occupant slots visualizer */}
              <div>
                <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', fontWeight: 700 }}>
                  OCCUPANCY METRIC
                </span>
                <div className="occupants-slots">
                  {Array.from({ length: room.capacity }).map((_, idx) => (
                    <div
                      key={idx}
                      className={`slot-dot ${idx < room.current_occupancy ? 'filled' : ''}`}
                    />
                  ))}
                </div>
              </div>

              {/* Resident tooltip / list */}
              {room.occupants && room.occupants.length > 0 && (
                <div className="occupants-list-tooltip">
                  <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', fontWeight: 800, textTransform: 'uppercase' }}>
                    Current Residents:
                  </span>
                  <div style={{ marginTop: '8px' }}>
                    {room.occupants.map((occ) => (
                      <div key={occ.id} className="occupant-item">
                        <span style={{ color: '#ffffff', fontWeight: 600 }}>{occ.full_name}</span>
                        {occ.roommate_preference && occ.roommate_preference !== 'None' && (
                          <span style={{ fontSize: '0.7rem', color: '#6366f1', background: 'rgba(99,102,241,0.08)', padding: '1px 5px', borderRadius: '4px' }}>
                            Pref: {occ.roommate_preference}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Room Modal Popup */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create Room Record</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateRoom}>
              <div className="form-group">
                <label>Room Number</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 301, 105B"
                  value={newRoomNumber}
                  onChange={(e) => setNewRoomNumber(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label>Hostel Block</label>
                <select
                  className="form-control"
                  value={newBlockName}
                  onChange={(e) => setNewBlockName(e.target.value)}
                  disabled={submitting}
                >
                  <option value="Block A">Block A (North)</option>
                  <option value="Block B">Block B (South)</option>
                  <option value="Block C">Block C (East)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Room Type & Layout</label>
                <select
                  className="form-control"
                  value={newRoomType}
                  onChange={(e) => {
                    const val = e.target.value as 'Single' | 'Double' | 'Triple';
                    setNewRoomType(val);
                    if (val === 'Single') setNewCapacity('1');
                    else if (val === 'Double') setNewCapacity('2');
                    else if (val === 'Triple') setNewCapacity('3');
                  }}
                  disabled={submitting}
                >
                  <option value="Single">Single (1 Resident)</option>
                  <option value="Double">Double (2 Residents)</option>
                  <option value="Triple">Triple (3 Residents)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Maximum Capacity Slots</label>
                <input
                  type="number"
                  className="form-control"
                  min="1"
                  max="10"
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Register Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
