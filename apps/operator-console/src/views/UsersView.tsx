import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, ShieldAlert, UserMinus, Plus, ShieldCheck, Power, RefreshCcw, Activity } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface PublicUserDto {
  id: string;
  username: string;
  role: 'admin' | 'operator';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  hasActiveSessions: boolean;
}

export function UsersView() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<PublicUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Create User Form State
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'operator' | 'admin'>('operator');
  const [createError, setCreateError] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/users`);
      if (!res.ok) {
        throw new Error(t('users.errors.fetch_failed'));
      }
      const data = await res.json();
      setUsers(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (newPassword.length < 8) {
      return setCreateError(t('change_password.error_length'));
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: newUsername, passwordPlain: newPassword, role: newRole })
      });
      if (!res.ok) {
        const err = await res.json();
        const msg = err.error?.message || (typeof err.error === 'string' ? err.error : t('users.errors.create_failed'));
        throw new Error(msg);
      }
      setShowCreate(false);
      setNewUsername('');
      setNewPassword('');
      setNewRole('operator');
      await fetchUsers();
    } catch (e: any) {
      setCreateError(e.message);
    }
  };

  const handleAction = async (actionFn: () => Promise<Response>, confirmMsg: string) => {
    if (!window.confirm(confirmMsg)) return;
    try {
      setError('');
      const res = await actionFn();
      if (!res.ok) {
        const errData = await res.json();
        const msg = errData.error?.message || (typeof errData.error === 'string' ? errData.error : t('common.errors.operation_failed'));
        throw new Error(msg);
      }
      await fetchUsers();
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <Activity className="w-8 h-8 animate-pulse text-muted-foreground mr-3" />
        <span className="text-muted-foreground font-medium">{t('users.loading')}</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-8 pb-10">
      
      {error && (
      <div className="bg-danger/10 border border-danger/20 text-danger px-4 py-3 rounded-lg text-sm flex items-center">
          <ShieldAlert className="w-5 h-5 mr-3 shrink-0" />
          {error}
        </div>
      )}

      {/* CREATE FORM */}
      {showCreate ? (
        <div className="bg-card border rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="border-b px-5 py-4 bg-muted/30">
            <h3 className="font-semibold flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              {t('users.create_form.title')}
            </h3>
          </div>
          <form className="px-5 py-4 flex flex-col gap-4" onSubmit={handleCreateUser}>
            {createError && <p className="text-danger text-sm font-medium">{createError}</p>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="col-span-1">
                <label className="text-sm font-medium mb-1.5 block">{t('users.create_form.username')}</label>
                <input 
                  type="text" 
                  value={newUsername} 
                  onChange={e => setNewUsername(e.target.value)} 
                  className="w-full bg-background border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder={t('users.create_form.username_placeholder')}
                  required 
                />
              </div>
              <div className="col-span-1">
                <label className="text-sm font-medium mb-1.5 block">{t('users.create_form.password')}</label>
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  className="w-full bg-background border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder={t('common.password_mask')}
                  required 
                />
                <p className="text-[10px] text-muted-foreground mt-1 text-right">{t('users.create_form.password_hint')}</p>
              </div>
              <div className="col-span-1">
                <label className="text-sm font-medium mb-1.5 block">{t('users.create_form.role')}</label>
                <select 
                  className="w-full bg-background border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as any)}
                >
                  <option value="operator">{t('users.create_form.operator_desc')}</option>
                  <option value="admin">{t('users.create_form.admin_desc')}</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-2 pt-4 border-t">
                <button 
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 rounded-lg transition-colors border"
                >
                  {t('common.cancel')}
                </button>
              <button 
                type="submit"
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors shadow-sm"
                disabled={!newUsername || !newPassword}
              >
                {t('users.create_form.submit')}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{t('users.header.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('users.header.subtitle')}</p>
          </div>
          <button 
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            {t('users.header.add_button')}
          </button>
        </div>
      )}

      {/* TABLE */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
         <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-5 py-3.5 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">{t('users.table.identity')}</th>
                  <th className="px-5 py-3.5 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">{t('users.table.access')}</th>
                  <th className="px-5 py-3.5 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">{t('users.table.status')}</th>
                  <th className="px-5 py-3.5 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider text-right">{t('users.table.controls')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {Array.isArray(users) && users.map(u => (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                          <span className="font-bold text-xs uppercase">{u.username.substring(0, 2)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">{u.username}</span>
                          <span className="text-[10px] text-muted-foreground font-mono opacity-60">ID: {u.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                        u.role === 'admin'
                          ? 'bg-warning/10 text-warning border-warning/20'
                          : 'bg-primary/10 text-primary border-primary/20'
                      }`}>
                        {u.role === 'admin' ? <ShieldCheck className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                        {t('common.roles.' + u.role).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        <span className={`flex items-center text-[11px] font-bold ${u.isActive ? 'text-success' : 'text-danger'}`}>
                          <span className={`w-2 h-2 rounded-full mr-2 ${u.isActive ? 'status-dot-synced animate-pulse' : 'status-dot-error shrink-0'}`}></span>
                          {u.isActive ? t('users.status.active') : t('users.status.suspended')}
                        </span>
                        {u.hasActiveSessions && (
                          <span className="inline-flex items-center gap-1.5 text-[10px] bg-muted/80 px-2 py-0.5 rounded border text-muted-foreground font-bold italic">
                            <Activity className="w-3 h-3 text-primary" /> {t('users.status.live')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        {/* TOGGLE ACTIVE */}
                        <button
                          onClick={() => handleAction(
                            () => fetch(`${API_BASE_URL}/api/v1/admin/users/${u.id}/active`, { 
                              method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !u.isActive }) 
                            }),
                            u.isActive ? t('users.actions.confirm_suspend') : t('users.actions.confirm_restore')
                          )}
                          className={`p-2 rounded-lg border transition-all ${
                            u.isActive
                              ? 'bg-background hover:bg-danger/10 border-border hover:border-danger/30 hover:text-danger text-muted-foreground shadow-sm'
                              : 'bg-background hover:bg-success/10 border-border hover:border-success/30 hover:text-success text-muted-foreground shadow-sm'
                          }`}
                          title={u.isActive ? t('users.actions.suspend_title') : t('users.actions.restore_title')}
                        >
                          <Power className="w-4 h-4" />
                        </button>

                        {/* CHANGE ROLE */}
                        <button
                          onClick={() => handleAction(
                            () => fetch(`${API_BASE_URL}/api/v1/admin/users/${u.id}/role`, { 
                              method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: u.role === 'admin' ? 'operator' : 'admin' }) 
                            }),
                            t('users.actions.confirm_role', { username: u.username })
                          )}
                          className="p-2 bg-background border border-border text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-all shadow-sm"
                          title={t('users.actions.swap_role_title', { role: u.role })}
                        >
                          <RefreshCcw className="w-4 h-4" />
                        </button>

                        {/* REVOKE SESSIONS */}
                        <button
                          onClick={() => handleAction(
                            () => fetch(`${API_BASE_URL}/api/v1/admin/users/${u.id}/revoke-sessions`, { 
                              method: 'POST'
                            }),
                            t('users.actions.confirm_revoke', { username: u.username })
                          )}
                          className="p-2 bg-background border border-border text-muted-foreground hover:bg-warning/10 hover:border-warning/30 hover:text-warning rounded-lg transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
                          disabled={!u.hasActiveSessions}
                          title={t('users.actions.revoke_title')}
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
         </div>
      </div>

      <div className="bg-muted/30 border border-dashed rounded-xl p-6 text-center">
        <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
          <ShieldAlert className="w-4 h-4 inline-block mr-1 mb-0.5" />
          {t('users.protection_rule')}
        </p>
      </div>
    </div>
  );
}
