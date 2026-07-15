import React from 'react';
import { Activity, KeyRound, Power, Shield, ShieldCheck, UserMinus } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { Card } from './ui/Card';
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
  resetPasswordTitle: string;
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
  onResetPassword: (user: PublicUserDto) => void;
  currentUserId: string | null;
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
  onRevokeSessions,
  onResetPassword,
  currentUserId,
}) => (
  <Card className="rounded-panel">
    <div className="grid gap-3 p-3 sm:grid-cols-2 xl:hidden">
      {users.map((user) => (
        <article key={user.id} className="flex min-w-0 flex-col gap-4 rounded-card border border-border/60 bg-background/45 p-4 shadow-depth-1">
          <div className="flex min-w-0 items-start gap-3">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-primary/20 bg-primary/10 text-primary shadow-sm">
              {user.avatarDataUri
                ? <img
                    src={user.avatarDataUri.startsWith('/') ? `${API_BASE_URL}${user.avatarDataUri}` : user.avatarDataUri}
                    alt={user.username}
                    className="h-full w-full object-cover"
                  />
                : <span className="flex h-full w-full items-center justify-center text-caption font-bold uppercase">{user.username.substring(0, 2)}</span>
              }
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">{user.displayName || user.username}</p>
              <p className="truncate text-micro font-mono text-muted-foreground/60">@{user.username}</p>
              <span className={`mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-label font-bold ${getRoleClassName(user.role)}`}>
                {user.role === 'admin' ? <ShieldCheck className="h-3 w-3 shrink-0" /> : <Shield className="h-3 w-3 shrink-0" />}
                <span className="whitespace-normal leading-tight">{getRoleLabel(user.role)}</span>
              </span>
            </div>
            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${user.isActive ? 'status-dot-synced' : 'status-dot-error'}`} title={user.isActive ? labels.active : labels.suspended} />
          </div>

          <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-2">
            <SelectField
              variant="small"
              className="w-full min-w-0 min-[430px]:col-span-2"
              value={user.role}
              onChange={(selectedRole) => {
                const role = selectedRole as UserRole;
                if (role !== user.role) onChangeRole(user, role);
              }}
              options={roleOptions}
              title={labels.swapRoleTitle(user.role)}
            />
            <button
              onClick={() => onToggleActive(user)}
              className="flex min-w-0 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-micro font-bold text-muted-foreground transition-colors hover:text-foreground"
            >
              <Power className="h-4 w-4 shrink-0" />
              <span className="truncate">{user.isActive ? labels.suspendTitle : labels.restoreTitle}</span>
            </button>
            <button
              onClick={() => onRevokeSessions(user)}
              disabled={!user.hasActiveSessions}
              className="flex min-w-0 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-micro font-bold text-muted-foreground transition-colors disabled:opacity-35"
            >
              <UserMinus className="h-4 w-4 shrink-0" />
              <span className="truncate">{labels.revokeTitle}</span>
            </button>
            {user.id !== currentUserId && (
              <button
                onClick={() => onResetPassword(user)}
                className="flex min-w-0 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-micro font-bold text-primary min-[430px]:col-span-2"
              >
                <KeyRound className="h-4 w-4 shrink-0" />
                <span className="truncate">{labels.resetPasswordTitle}</span>
              </button>
            )}
          </div>
        </article>
      ))}
    </div>

    <div className="hidden overflow-x-auto xl:block">
      <table className="w-full min-w-data-table whitespace-nowrap text-left text-body">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className="px-5 py-3.5 font-semibold text-muted-foreground uppercase text-micro tracking-wider">{labels.identity}</th>
            <th className="px-5 py-3.5 font-semibold text-muted-foreground uppercase text-micro tracking-wider">{labels.access}</th>
            <th className="px-5 py-3.5 font-semibold text-muted-foreground uppercase text-micro tracking-wider">{labels.status}</th>
            <th className="px-5 py-3.5 font-semibold text-muted-foreground uppercase text-micro tracking-wider text-right">{labels.controls}</th>
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
                      : <span className="font-bold text-caption uppercase">{user.username.substring(0, 2)}</span>
                    }
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">{user.displayName || user.username}</span>
                    <span className="text-micro text-muted-foreground font-mono opacity-60">@{user.username}</span>
                  </div>
                </div>
              </td>
              <td className="px-5 py-4">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-label font-bold border ${getRoleClassName(user.role)}`}>
                  {user.role === 'admin' ? <ShieldCheck className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                  {getRoleLabel(user.role)}
                </span>
              </td>
              <td className="px-5 py-4">
                <div className="flex flex-col gap-1.5 items-start">
                  <span className={`flex items-center text-label font-bold ${user.isActive ? 'text-success' : 'text-danger'}`}>
                    <span className={`w-2 h-2 rounded-full mr-2 ${user.isActive ? 'status-dot-synced animate-pulse' : 'status-dot-error shrink-0'}`} />
                    {user.isActive ? labels.active : labels.suspended}
                  </span>
                  {user.hasActiveSessions && (
                    <span className="inline-flex items-center gap-1.5 text-micro bg-muted/80 px-2 py-0.5 rounded border text-muted-foreground font-bold italic">
                      <Activity className="w-3 h-3 text-primary" /> {labels.live}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-5 py-4 text-right">
                <div className="flex flex-wrap items-center justify-end gap-2 transition-all">
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
                    className="w-44"
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

                  {user.id !== currentUserId && (
                    <button
                      onClick={() => onResetPassword(user)}
                      className="rounded-lg border border-border bg-background p-2 text-muted-foreground shadow-sm transition-all hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                      title={labels.resetPasswordTitle}
                    >
                      <KeyRound className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Card>
);
