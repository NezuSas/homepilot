import React, { useState } from 'react';
import { Loader2, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void; 
}

export function ChangePasswordModal({ isOpen, onClose, onSuccess }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMode, setSuccessMode] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const resp = await fetch(`${API_BASE_URL}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      if (!resp.ok) {
        throw new Error('Incorrect current password or server error');
      }

      setSuccessMode(true);
      // Wait a moment for UX, then execute full reset
      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (e: any) {
      setError(e.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border shadow-lg rounded-xl w-full max-w-sm p-6 relative">
        <div className="flex flex-col space-y-1.5 mb-5 items-center justify-center text-center">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <KeyRound className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-semibold leading-none tracking-tight">Change Password</h2>
          <p className="text-sm text-muted-foreground">Your active sessions will be revoked.</p>
        </div>

        {successMode ? (
          <div className="flex flex-col items-center justify-center space-y-3 py-6 text-emerald-500">
            <CheckCircle2 className="w-12 h-12" />
            <p className="font-medium text-center">Password updated successfully.<br/>Please log in again.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-sm font-medium text-red-500 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Current Password</label>
              <input 
                type="password" required disabled={loading}
                value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">New Password</label>
              <input 
                type="password" required disabled={loading}
                value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Confirm New Password</label>
              <input 
                type="password" required disabled={loading}
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t mt-4">
              <button 
                type="button" 
                onClick={onClose} 
                disabled={loading}
                className="h-9 px-4 py-2 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className="h-9 px-4 py-2 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 shadow disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
