import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Input } from './ui/Input';
import { SelectableOptionCard } from './ui/SelectableOptionCard';

export type UserRole = 'admin' | 'parent' | 'child' | 'guest' | 'operator';

export interface UserRoleOption {
  value: UserRole;
  label: string;
  description: string;
}

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
  roleOptions: UserRoleOption[];
  username: string;
  password: string;
  role: UserRole;
  error: string;
  /** Room and expiry choices, shown only for the roles that can be limited. */
  accessFields?: React.ReactNode;
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
  accessFields,
  onUsernameChange,
  onPasswordChange,
  onRoleChange,
  onCancel,
  onSubmit
}) => (
  <Card className="animate-in fade-in slide-in-from-top-4 duration-300">
    <CardHeader className="border-b bg-muted/30">
      <CardTitle className="flex items-center gap-2">
        <Plus className="w-4 h-4 text-primary" />
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-6">
    <form className="flex flex-col gap-6" onSubmit={onSubmit}>
      {error && <p role="alert" className="text-danger text-body font-medium">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label={usernameLabel}
          type="text"
          value={username}
          onChange={event => onUsernameChange(event.target.value)}
          placeholder={usernamePlaceholder}
          maxLength={40}
          required
        />
        <Input
          label={passwordLabel}
          type="password"
          value={password}
          onChange={event => onPasswordChange(event.target.value)}
          placeholder={passwordPlaceholder}
          helperText={passwordHint}
          required
        />
      </div>

      <fieldset className="min-w-0 space-y-2">
        <legend className="text-body font-semibold">{roleLabel}</legend>
        <div role="radiogroup" aria-label={roleLabel} className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {roleOptions.map(option => (
            <SelectableOptionCard
              key={option.value}
              title={option.label}
              description={option.description}
              checked={role === option.value}
              onClick={() => onRoleChange(option.value)}
            />
          ))}
        </div>
      </fieldset>

      {accessFields}

      <div className="flex justify-end gap-3 mt-2 pt-4 border-t">
        <Button
          type="button"
          onClick={onCancel}
          variant="secondary"
          size="sm"
        >
          {cancelLabel}
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={!username || !password}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
    </CardContent>
  </Card>
);
