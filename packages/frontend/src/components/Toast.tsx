import React from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onClose }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={18} className="toast-icon success" style={{ color: '#10b981' }} />;
      case 'error':
        return <AlertCircle size={18} className="toast-icon error" style={{ color: '#ef4444' }} />;
      case 'warning':
        return <AlertTriangle size={18} className="toast-icon warning" style={{ color: '#f59e0b' }} />;
      default:
        return <Info size={18} className="toast-icon info" style={{ color: '#38bdf8' }} />;
    }
  };

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-item ${toast.type}`}>
          {getIcon(toast.type)}
          <div className="toast-body">
            <span className="toast-title">{toast.title}</span>
            <span className="toast-desc">{toast.description}</span>
          </div>
          <button className="toast-close" onClick={() => onClose(toast.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
