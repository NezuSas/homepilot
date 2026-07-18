import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Input } from './ui/Input';
import { SearchableSelectField } from './ui/SearchableSelectField';

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
  <Card className="animate-in fade-in slide-in-from-top-4 duration-300">
    <CardHeader className="border-b bg-muted/30">
      <CardTitle className="flex items-center gap-2">
        <Plus className="w-4 h-4 text-primary" />
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-6">
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      {error && <p className="text-danger text-body font-medium">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1">
          <Input
            label={usernameLabel}
            type="text"
            value={username}
            onChange={event => onUsernameChange(event.target.value)}
            placeholder={usernamePlaceholder}
            required
          />
        </div>
        <div className="col-span-1">
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
        <div className="col-span-1">
          <SearchableSelectField
            label={roleLabel}
            value={role}
            onChange={value => onRoleChange(value as UserRole)}
            options={roleOptions}
          />
        </div>
      </div>
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
