import { Activity, DoorOpen, KeyRound, Power, SlidersHorizontal, UserMinus } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { canRestrictAccess, type AccessScope } from '../lib/userAccess';
import { Card } from './ui/Card';
import { Heading } from './ui/Heading';
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
  /** Older answers do not carry the access fields: they mean the whole home and no expiry. */
  accessScope?: AccessScope;
  roomIds?: string[];
  expiresAt?: string | null;
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
  editAccessTitle: string;
  swapRoleTitle: (role: UserRole) => string;
}

export interface UserExpiryText {
  text: string;
  expired: boolean;
}

interface UsersTableProps {
  users: PublicUserDto[];
  labels: UsersTableLabels;
  roleOptions: { value: UserRole; label: string }[];
  getRoleLabel: (role: UserRole) => string;
  getRoleDescription: (role: UserRole) => string;
  getAccessText: (user: PublicUserDto) => string;
  getExpiry: (user: PublicUserDto) => UserExpiryText | null;
  onToggleActive: (user: PublicUserDto) => void;
  onChangeRole: (user: PublicUserDto, role: UserRole) => void;
  onEditAccess: (user: PublicUserDto) => void;
  onRevokeSessions: (user: PublicUserDto) => void;
  onResetPassword: (user: PublicUserDto) => void;
  currentUserId: string | null;
}

export function UserAccessCard({
  user, labels, roleOptions, getRoleLabel, getRoleDescription, getAccessText, getExpiry,
  onToggleActive, onChangeRole, onEditAccess, onRevokeSessions, onResetPassword, currentUserId,
}: Omit<UsersTableProps, 'users'> & { user: PublicUserDto }) {
  const expiry = getExpiry(user);
  // An account that still carries the old operator role keeps showing it until an administrator picks another one.
  const options = roleOptions.some(option => option.value === user.role)
    ? roleOptions
    : [...roleOptions, { value: user.role, label: getRoleLabel(user.role) }];
  return <Card as="article" aria-label={user.displayName || user.username} variant="flat" className="space-y-3 p-3">
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
        {user.avatarDataUri ? <img src={user.avatarDataUri.startsWith('/') ? `${API_BASE_URL}${user.avatarDataUri}` : user.avatarDataUri} alt="" className="size-full object-cover" />
          : <span className="text-caption font-semibold uppercase">{user.username.substring(0, 2)}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <Heading variant="item">{user.displayName || user.username}</Heading>
        <p className="break-all text-caption text-muted-foreground">@{user.username}</p>
      </div>
      {user.hasActiveSessions && <Activity className="size-4 shrink-0 text-primary" aria-label={labels.live} role="img" />}
    </div>
    <div className="flex min-w-0 flex-col gap-1">
      <SearchableSelectField value={user.role} options={options} label={labels.access}
        title={labels.swapRoleTitle(user.role)} className="min-w-0 flex-1"
        onChange={selected => {
          const role = options.find(option => option.value === selected)?.value;
          if (role && role !== user.role) onChangeRole(user, role);
        }} />
      <p className="text-caption text-muted-foreground">{getRoleDescription(user.role)}</p>
    </div>
    <div className="flex min-w-0 items-start gap-2 text-caption">
      <DoorOpen aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 space-y-0.5">
        <p className="break-words font-medium">{getAccessText(user)}</p>
        {expiry && <p className={expiry.expired ? 'font-medium text-danger' : 'text-muted-foreground'}>{expiry.text}</p>}
      </div>
    </div>
    <div className="flex items-center justify-between gap-2">
      <StatusPill className="min-w-0" variant={user.isActive ? 'success' : 'danger'}>{user.isActive ? labels.active : labels.suspended}</StatusPill>
      <div className="flex shrink-0 items-center gap-1">
        {canRestrictAccess(user.role) && <IconButton size="lg" icon={SlidersHorizontal} label={labels.editAccessTitle} onClick={() => onEditAccess(user)} />}
        <IconButton size="lg" icon={Power} label={user.isActive ? labels.suspendTitle : labels.restoreTitle} onClick={() => onToggleActive(user)} />
        <IconButton size="lg" icon={UserMinus} label={labels.revokeTitle} disabled={!user.hasActiveSessions} onClick={() => onRevokeSessions(user)} />
        {user.id !== currentUserId && <IconButton size="lg" icon={KeyRound} label={labels.resetPasswordTitle} onClick={() => onResetPassword(user)} />}
      </div>
    </div>
  </Card>;
}

export function UsersTable({ users, ...props }: UsersTableProps) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-3">
    {users.map(user => <UserAccessCard key={user.id} user={user} {...props} />)}
  </div>;
}
