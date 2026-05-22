import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Home, UserCheck, ShieldAlert, AlertTriangle, Hammer } from 'lucide-react';
import { Toast, ToastMessage } from './components/Toast';
import { Dashboard } from './pages/Dashboard';
import { RoomsList } from './pages/RoomsList';
import { Allocations } from './pages/Allocations';
import { ComplaintSubmit } from './pages/ComplaintSubmit';
import { ComplaintTracking } from './pages/ComplaintTracking';
import { MaintenancePortal } from './pages/MaintenancePortal';

interface User {
  id: number;
  username: string;
  role: string;
  full_name: string;
  email: string;
  academic_details: string;
}

export const App: React.FC = () => {
  // Navigation & Role State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentRole, setCurrentRole] = useState<'student' | 'warden' | 'maintenance' | 'admin'>('admin');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Database Users Directory
  const [usersDirectory, setUsersDirectory] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Global Toasts State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Function to push new notifications
  const addToast = (type: 'success' | 'error' | 'warning' | 'info', title: string, description: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, title, description }]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  // Fetch SQLite users on boot
  useEffect(() => {
    fetch('/api/users')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load user directory');
        return res.json();
      })
      .then((data: User[]) => {
        setUsersDirectory(data);
        setLoadingUsers(false);
        
        // Auto-assign default Admin account first
        const adminUser = data.find((u) => u.role === 'admin');
        if (adminUser) setCurrentUser(adminUser);
      })
      .catch((err) => {
        console.error('Error loading users registry:', err);
        setLoadingUsers(false);
      });
  }, []);

  // Update current logged-in user whenever role is switched
  const handleRoleChange = (role: 'student' | 'warden' | 'maintenance' | 'admin') => {
    setCurrentRole(role);
    addToast('info', 'Session Shifted', `Switched active login session to ${role.toUpperCase()}`);

    const matchedUser = usersDirectory.find((u) => u.role === role);
    if (matchedUser) {
      setCurrentUser(matchedUser);
    } else {
      setCurrentUser(null);
    }

    // Smart Navigation Redirect
    if (role === 'student') {
      setActiveTab('dashboard');
    } else if (role === 'maintenance') {
      setActiveTab('maintenance');
    } else {
      setActiveTab('dashboard');
    }
  };

  // Dynamic Content Router
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'rooms':
        return <RoomsList currentRole={currentRole} addToast={addToast} />;
      case 'allocations':
        return <Allocations currentRole={currentRole} addToast={addToast} />;
      case 'submit-complaint':
        return (
          <ComplaintSubmit
            currentUser={currentUser}
            addToast={addToast}
            navigateTo={(page) => setActiveTab(page)}
          />
        );
      case 'tracking':
        return <ComplaintTracking currentUser={currentUser} addToast={addToast} />;
      case 'maintenance':
        return <MaintenancePortal currentUser={currentUser} addToast={addToast} />;
      default:
        return <Dashboard />;
    }
  };

  // Navigation schema based on role
  const getNavItems = () => {
    const items = [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, roles: ['student', 'warden', 'maintenance', 'admin'] },
      { id: 'rooms', label: 'Hostel Rooms', icon: <Home size={18} />, roles: ['student', 'warden', 'maintenance', 'admin'] },
      { id: 'allocations', label: 'Room Allocations', icon: <UserCheck size={18} />, roles: ['student', 'warden', 'admin'] },
      { id: 'submit-complaint', label: 'Lodge Complaint', icon: <AlertTriangle size={18} />, roles: ['student'] },
      { id: 'tracking', label: 'Track Complaints', icon: <ShieldAlert size={18} />, roles: ['student'] },
      { id: 'maintenance', label: 'Maintenance Portal', icon: <Hammer size={18} />, roles: ['maintenance', 'admin'] },
    ];
    return items.filter((item) => item.roles.includes(currentRole));
  };

  return (
    <div className="app-container">
      {/* Floating Demo Switcher Widget for Evaluators */}
      <div className="role-switcher-bar">
        <span className="switcher-label">Role Switcher:</span>
        <button
          className={`switcher-btn ${currentRole === 'student' ? 'active student' : ''}`}
          onClick={() => handleRoleChange('student')}
        >
          Student
        </button>
        <button
          className={`switcher-btn ${currentRole === 'warden' ? 'active warden' : ''}`}
          onClick={() => handleRoleChange('warden')}
        >
          Warden
        </button>
        <button
          className={`switcher-btn ${currentRole === 'maintenance' ? 'active maintenance' : ''}`}
          onClick={() => handleRoleChange('maintenance')}
        >
          Maintenance
        </button>
        <button
          className={`switcher-btn ${currentRole === 'admin' ? 'active admin' : ''}`}
          onClick={() => handleRoleChange('admin')}
        >
          Admin
        </button>
      </div>

      {/* Side Navigation panel */}
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <span>HostelHub 🏨</span>
        </div>

        {/* User Card */}
        {currentUser && (
          <div className="sidebar-role-indicator">
            <span className={`role-dot ${currentRole}`} />
            <div className="role-info">
              <span className="role-name">{currentUser.full_name}</span>
              <span className="role-user">Role: {currentRole}</span>
            </div>
          </div>
        )}

        <nav className="sidebar-nav">
          {getNavItems().map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '16px' }}>
          <span>Powered by SQLite Database</span>
        </div>
      </aside>

      {/* Main viewport area */}
      <main className="app-content">
        {loadingUsers ? (
          <div className="empty-state" style={{ height: '100%' }}>
            <LayoutDashboard size={48} className="animate-pulse" style={{ color: '#6366f1' }} />
            <h4>Launching HostelHub Systems</h4>
            <p>Initializing API gateways and user session scopes...</p>
          </div>
        ) : (
          renderContent()
        )}
      </main>

      {/* Banners display */}
      <Toast toasts={toasts} onClose={removeToast} />
    </div>
  );
};

export default App;
