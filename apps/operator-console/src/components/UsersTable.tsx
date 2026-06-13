import React from 'react';
import { Activity, Power, Shield, ShieldCheck, UserMinus } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { SelectField } from './ui/SelectField';
import type { UserRole } from './UserCreateForm';

export interface PublicUserDto {
  id: string;
  username: string;
  displayName: string | null;
  avatarDataUri: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  hasActiveSessions: boolean;
}

interface UsersTableLabels {
  identity: string;
  access: string;
  status: string;
  controls: string;
  active: string;
  suspended: string;
  live: string;
  suspendTitle: string;
  restoreTitle: string;
  revokeTitle: string;
  swapRoleTitle: (role: UserRole) => string;
}

interface UsersTableProps {
  users: PublicUserDto[];
  labels: UsersTableLabels;
  roleOptions: { value: UserRole; label: string }[];
  getRoleLabel: (role: UserRole) => string;
  onToggleActive: (user: PublicUserDto) => void;
  onChangeRole: (user: PublicUserDto, role: UserRole) => void;
  onRevokeSessions: (user: PublicUserDto) => void;
}

const getRoleClassName = (role: UserRole) => {
  switch (role) {
    case 'admin':
      return 'bg-warning/10 text-warning border-warning/20';
    case 'parent':
      return 'bg-primary/10 text-primary border-primary/20';
    case 'child':
      return 'bg-foreground/10 text-foreground border-foreground/20';
    case 'guest':
      return 'bg-muted text-muted-foreground border-border';
    case 'operator':
      return 'bg-foreground/5 text-foreground/70 border-foreground/10';
  }
};

export const UsersTable: React.FC<UsersTableProps> = ({
  users,
  labels,
  roleOptions,
  getRoleLabel,
  onToggleActive,
  onChangeRole,
  onRevokeSessions
}) => (
  <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className="px-5 py-3.5 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">{labels.identity}</th>
            <th className="px-5 py-3.5 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">{labels.access}</th>
            <th className="px-5 py-3.5 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">{labels.status}</th>
            <th className="px-5 py-3.5 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider text-right">{labels.controls}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {users.map(user => (
            <tr key={user.id} className="hover:bg-muted/30 transition-colors group">
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 overflow-hidden shadow-sm">
                    {user.avatarDataUri
                      ? <img
                          src={user.avatarDataUri.startsWith('/') ? `${API_BASE_URL}${user.avatarDataUri}` : user.avatarDataUri}
                          alt={user.username}
                          className="w-full h-full object-cover"
                        />
                      : <span className="font-bold text-xs uppercase">{user.username.substring(0, 2)}</span>
                    }
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">{user.displayName || user.username}</span>
                    <span className="text-[10px] text-muted-foreground font-mono opacity-60">@{user.username}</span>
                  </div>
                </div>
              </td>
              <td className="px-5 py-4">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${getRoleClassName(user.role)}`}>
                  {user.role === 'admin' ? <ShieldCheck className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                  {getRoleLabel(user.role)}
                </span>
              </td>
              <td className="px-5 py-4">
                <div className="flex flex-col gap-1.5 items-start">
                  <span className={`flex items-center text-[11px] font-bold ${user.isActive ? 'text-success' : 'text-danger'}`}>
                    <span className={`w-2 h-2 rounded-full mr-2 ${user.isActive ? 'status-dot-synced animate-pulse' : 'status-dot-error shrink-0'}`} />
                    {user.isActive ? labels.active : labels.suspended}
                  </span>
                  {user.hasActiveSessions && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] bg-muted/80 px-2 py-0.5 rounded border text-muted-foreground font-bold italic">
                      <Activity className="w-3 h-3 text-primary" /> {labels.live}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-5 py-4 text-right">
                <div className="flex items-center justify-end gap-2 transition-all">
                  <button
                    onClick={() => onToggleActive(user)}
                    className={`p-2 rounded-lg border transition-all ${
                      user.isActive
                        ? 'bg-background hover:bg-danger/10 border-border hover:border-danger/30 hover:text-danger text-muted-foreground shadow-sm'
                        : 'bg-background hover:bg-success/10 border-border hover:border-success/30 hover:text-success text-muted-foreground shadow-sm'
                    }`}
                    title={user.isActive ? labels.suspendTitle : labels.restoreTitle}
                  >
                    <Power className="w-4 h-4" />
                  </button>

                  <SelectField
                    variant="small"
                    className="w-32"
                    value={user.role}
                    onChange={(selectedRole) => {
                      const role = selectedRole as UserRole;
                      if (role === user.role) return;
                      onChangeRole(user, role);
                    }}
                    options={roleOptions}
                    title={labels.swapRoleTitle(user.role)}
                  />

                  <button
                    onClick={() => onRevokeSessions(user)}
                    className="p-2 bg-background border border-border text-muted-foreground hover:bg-warning/10 hover:border-warning/30 hover:text-warning rounded-lg transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
                    disabled={!user.hasActiveSessions}
                    title={labels.revokeTitle}
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
);
