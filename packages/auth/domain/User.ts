export type UserRole = 'admin' | 'operator';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
