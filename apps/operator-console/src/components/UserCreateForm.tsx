import React from 'react';
import { Plus } from 'lucide-react';
import { SelectField } from './ui/SelectField';

export type UserRole = 'admin' | 'parent' | 'child' | 'guest' | 'operator';

interface UserCreateFormProps {
  title: string;
  usernameLabel: string;
  usernamePlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  passwordHint: string;
  roleLabel: string;
  cancelLabel: string;
  submitLabel: string;
  roleOptions: { value: UserRole; label: string }[];
  username: string;
  password: string;
  role: UserRole;
  error: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRoleChange: (role: UserRole) => void;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent) => void;
}

export const UserCreateForm: React.FC<UserCreateFormProps> = ({
  title,
  usernameLabel,
  usernamePlaceholder,
  passwordLabel,
  passwordPlaceholder,
  passwordHint,
  roleLabel,
  cancelLabel,
  submitLabel,
  roleOptions,
  username,
  password,
  role,
  error,
  onUsernameChange,
  onPasswordChange,
  onRoleChange,
  onCancel,
  onSubmit
}) => (
  <div className="bg-card border rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
    <div className="border-b px-5 py-4 bg-muted/30">
      <h3 className="font-semibold flex items-center gap-2">
        <Plus className="w-4 h-4 text-primary" />
        {title}
      </h3>
    </div>
    <form className="px-5 py-4 flex flex-col gap-4" onSubmit={onSubmit}>
      {error && <p className="text-danger text-sm font-medium">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1">
          <label className="text-sm font-medium mb-1.5 block">{usernameLabel}</label>
          <input
            type="text"
            value={username}
            onChange={event => onUsernameChange(event.target.value)}
            className="w-full bg-background border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            placeholder={usernamePlaceholder}
            required
          />
        </div>
        <div className="col-span-1">
          <label className="text-sm font-medium mb-1.5 block">{passwordLabel}</label>
          <input
            type="password"
            value={password}
            onChange={event => onPasswordChange(event.target.value)}
            className="w-full bg-background border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            placeholder={passwordPlaceholder}
            required
          />
          <p className="text-[10px] text-muted-foreground mt-1 text-right">{passwordHint}</p>
        </div>
        <div className="col-span-1">
          <SelectField
            label={roleLabel}
            value={role}
            onChange={value => onRoleChange(value as UserRole)}
            options={roleOptions}
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-2 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 rounded-lg transition-colors border"
        >
          {cancelLabel}
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors shadow-sm"
          disabled={!username || !password}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  </div>
);
