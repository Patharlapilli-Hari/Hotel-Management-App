import React, { useEffect, useState } from 'react';
import { ShieldAlert, Send } from 'lucide-react';

interface Category {
  id: number;
  name: string;
}

interface User {
  id: number;
  username: string;
  role: string;
  full_name: string;
}

interface ComplaintSubmitProps {
  currentUser: User | null;
  addToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc: string) => void;
  navigateTo: (page: string) => void;
}

export const ComplaintSubmit: React.FC<ComplaintSubmitProps> = ({
  currentUser,
  addToast,
  navigateTo,
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/complaint-categories')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch categories');
        return res.json();
      })
      .then((data) => {
        setCategories(data);
        setLoading(false);
      })
      .catch((err) => {
        addToast('error', 'Category Loading Error', err.message);
        setLoading(false);
      });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      addToast('error', 'Authentication Error', 'No active user session detected.');
      return;
    }

    if (!selectedCategoryId) {
      addToast('error', 'Validation Error', 'Please select a complaint category.');
      return;
    }

    if (!description.trim() || description.length < 10) {
      addToast('error', 'Validation Error', 'Please write a description (minimum 10 characters).');
      return;
    }

    setSubmitting(true);
    fetch('/api/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: currentUser.id,
        category_id: parseInt(selectedCategoryId, 10),
        description: `[Priority: ${priority}] ${description}`,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to submit complaint.');
        return data;
      })
      .then(() => {
        addToast(
          'success',
          'Complaint Registered',
          'Your complaint was logged in the SQLite registry. Maintenance staff have been updated.'
        );
        setSelectedCategoryId('');
        setDescription('');
        setSubmitting(false);
        navigateTo('tracking'); // Redirect to tracking timeline
      })
      .catch((err) => {
        addToast('error', 'Submission Failed', err.message);
        setSubmitting(false);
      });
  };

  if (loading) {
    return (
      <div className="empty-state">
        <ShieldAlert size={40} className="animate-pulse" style={{ color: '#6366f1' }} />
        <h4>Configuring Submission Environment</h4>
        <p>Loading complaint category references...</p>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '640px' }}>
      <div className="header-area">
        <div className="header-title">
          <h1>Submit Maintenance Request</h1>
          <p>Encountered an issue in your room? File a ticket to alert our wardens and maintenance team.</p>
        </div>
      </div>

      <div className="content-card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Category of Issue</label>
            <select
              className="form-control"
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              disabled={submitting}
            >
              <option value="">-- Choose category --</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Priority Severity Level</label>
            <select
              className="form-control"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              disabled={submitting}
            >
              <option value="Low">Low - Cosmetic, minor convenience</option>
              <option value="Medium">Medium - Standard repair required</option>
              <option value="High">High - Critical failure (e.g. water pipe leak, total blackout)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Detailed Description</label>
            <textarea
              className="form-control"
              placeholder="Provide exact details of the fault. If the issue is in your room bathroom or balcony, please specify. Minimum 10 characters."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div style={{ marginTop: '24px' }}>
            <button type="submit" className="btn" style={{ width: '100%' }} disabled={submitting}>
              <Send size={16} />
              {submitting ? 'Lodging Request...' : 'Lodge Complaint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
