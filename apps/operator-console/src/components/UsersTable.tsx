import { DoorOpen, KeyRound, Power, SlidersHorizontal, UserMinus } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { canRestrictAccess, type AccessScope } from '../lib/userAccess';
import { cn } from '../lib/utils';
import { ActionMenu, type ActionMenuItem } from './ui/ActionMenu';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Heading } from './ui/Heading';
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
  moreActions: string;
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

const ROLE_ORDER: Record<UserRole, number> = { admin: 0, parent: 1, child: 2, guest: 3 };

export function UserAccessCard({
  user, labels, roleOptions, getRoleLabel, getRoleDescription, getAccessText, getExpiry,
  onToggleActive, onChangeRole, onEditAccess, onRevokeSessions, onResetPassword, currentUserId,
}: Omit<UsersTableProps, 'users'> & { user: PublicUserDto }) {
  const expiry = getExpiry(user);
  // An account that still carries the old operator role keeps showing it until an administrator picks another one.
  const options = roleOptions.some(option => option.value === user.role)
    ? roleOptions
    : [...roleOptions, { value: user.role, label: getRoleLabel(user.role) }];
  const menu: ActionMenuItem[] = [
    { label: user.isActive ? labels.suspendTitle : labels.restoreTitle, icon: Power, onSelect: () => onToggleActive(user), danger: user.isActive },
    { label: labels.revokeTitle, icon: UserMinus, onSelect: () => onRevokeSessions(user), disabled: !user.hasActiveSessions },
    ...(user.id !== currentUserId ? [{ label: labels.resetPasswordTitle, icon: KeyRound, onSelect: () => onResetPassword(user) }] : []),
  ];
  return <Card as="article" aria-label={user.displayName || user.username} variant="flat" className={cn('flex flex-col gap-3 p-3', !user.isActive && 'opacity-75')}>
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative shrink-0">
        <div className="flex size-12 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
          {user.avatarDataUri ? <img src={user.avatarDataUri.startsWith('/') ? `${API_BASE_URL}${user.avatarDataUri}` : user.avatarDataUri} alt="" className="size-full object-cover" />
            : <span className="text-caption font-semibold uppercase">{user.username.substring(0, 2)}</span>}
        </div>
        {user.hasActiveSessions && <span role="img" aria-label={labels.live} title={labels.live} className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-card bg-success" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Heading variant="item">{user.displayName || user.username}</Heading>
          {!user.isActive && <StatusPill variant="danger" size="sm">{labels.suspended}</StatusPill>}
        </div>
        <p className="break-all text-caption text-muted-foreground">@{user.username}</p>
      </div>
      <ActionMenu label={labels.moreActions} items={menu} compact />
    </div>
    <div className="flex min-w-0 flex-col gap-1 [&_label]:sr-only">
      <SearchableSelectField value={user.role} options={options} label={labels.access}
        title={labels.swapRoleTitle(user.role)} className="min-w-0 flex-1"
        onChange={selected => {
          const role = options.find(option => option.value === selected)?.value;
          if (role && role !== user.role) onChangeRole(user, role);
        }} />
      <p className="text-caption text-muted-foreground">{getRoleDescription(user.role)}</p>
    </div>
    <div className="mt-auto flex min-w-0 items-start justify-between gap-3 text-caption">
      <div className="flex min-w-0 items-start gap-2">
        <DoorOpen aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 space-y-0.5">
          <p className="break-words font-medium">{getAccessText(user)}</p>
          {expiry && <p className={expiry.expired ? 'font-medium text-danger' : 'text-muted-foreground'}>{expiry.text}</p>}
        </div>
      </div>
      {canRestrictAccess(user.role) && <Button type="button" size="sm" variant="secondary" className="shrink-0" onClick={() => onEditAccess(user)}><SlidersHorizontal aria-hidden="true" className="size-4" />{labels.editAccessTitle}</Button>}
    </div>
  </Card>;
}

export function UsersTable({ users, ...props }: UsersTableProps) {
  const ordered = [...users].sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9)
    || (a.displayName || a.username).localeCompare(b.displayName || b.username));
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-3">
    {ordered.map(user => <UserAccessCard key={user.id} user={user} {...props} />)}
  </div>;
}
