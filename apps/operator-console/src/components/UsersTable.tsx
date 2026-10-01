import { Activity, KeyRound, Power, UserMinus } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { IconButton } from './ui/IconButton';
import { SearchableSelectField } from './ui/SearchableSelectField';
import { StatusPill } from './ui/StatusPill';
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


export function UserAccessCard({ user, labels, roleOptions, onToggleActive, onChangeRole, onRevokeSessions, onResetPassword, currentUserId }: Omit<UsersTableProps, 'users' | 'getRoleLabel'> & { user: PublicUserDto }) {
  return <article aria-label={user.displayName || user.username} className="min-w-0 space-y-3 rounded-control border border-border bg-card p-3">
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
        {user.avatarDataUri ? <img src={user.avatarDataUri.startsWith('/') ? `${API_BASE_URL}${user.avatarDataUri}` : user.avatarDataUri} alt="" className="size-full object-cover" />
          : <span className="text-caption font-semibold uppercase">{user.username.substring(0, 2)}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="break-words text-body-compact font-semibold">{user.displayName || user.username}</h3>
        <p className="break-all text-caption text-muted-foreground">@{user.username}</p>
      </div>
      {user.hasActiveSessions && <Activity className="size-4 shrink-0 text-primary" aria-label={labels.live} role="img" />}
    </div>
    <div className="flex min-w-0 items-center gap-2">
      <SearchableSelectField value={user.role} options={roleOptions} label={labels.access}
        title={labels.swapRoleTitle(user.role)} className="min-w-0 flex-1"
        onChange={selected => {
          const role = roleOptions.find(option => option.value === selected)?.value;
          if (role && role !== user.role) onChangeRole(user, role);
        }} />
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <StatusPill variant={user.isActive ? 'success' : 'danger'}>{user.isActive ? labels.active : labels.suspended}</StatusPill>
      <div className="flex items-center gap-1">
        <IconButton size="lg" icon={Power} label={user.isActive ? labels.suspendTitle : labels.restoreTitle} onClick={() => onToggleActive(user)} />
        <IconButton size="lg" icon={UserMinus} label={labels.revokeTitle} disabled={!user.hasActiveSessions} onClick={() => onRevokeSessions(user)} />
        {user.id !== currentUserId && <IconButton size="lg" icon={KeyRound} label={labels.resetPasswordTitle} onClick={() => onResetPassword(user)} />}
      </div>
    </div>
  </article>;
}

export function UsersTable({ users, ...props }: UsersTableProps) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-3">
    {users.map(user => <UserAccessCard key={user.id} user={user} {...props} />)}
  </div>;
}
