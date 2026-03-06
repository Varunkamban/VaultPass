import { Request } from 'express';

export type ItemType = 'login' | 'note' | 'card' | 'identity' | 'ssh_key';
export type AccountStatus = 'active' | 'locked' | 'suspended' | 'deleted';
export type OrgRole = 'owner' | 'admin' | 'member';
export type SharePermission = 'read' | 'write';

export interface User {
  id: string;
  email: string;
  auth_hash: string;
  encrypted_symmetric_key: Buffer | null;
  kdf_salt: string;
  kdf_iterations: number;
  mfa_enabled: boolean;
  mfa_secret_encrypted: Buffer | null;
  recovery_codes_hash: string[] | null;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
  account_status: AccountStatus;
  is_admin: boolean;
}

export interface VaultItem {
  id: string;
  user_id: string;
  item_type: ItemType;
  encrypted_data: string;
  nonce: string;
  folder_id: string | null;
  favorite: boolean;
  reprompt: boolean;
  revision: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface Folder {
  id: string;
  user_id: string;
  name_encrypted: string;
  parent_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Tag {
  id: string;
  user_id: string;
  name_encrypted: string;
  created_at: Date;
}

export interface Session {
  id: string;
  user_id: string;
  token_hash: string;
  device_info: Record<string, unknown> | null;
  expires_at: Date;
  revoked: boolean;
  created_at: Date;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  timestamp: Date;
}

export interface Organization {
  id: string;
  name: string;
  plan: string;
  settings_json: Record<string, unknown> | null;
  created_at: Date;
}

export interface OrgMember {
  org_id: string;
  user_id: string;
  role: OrgRole;
  invited_at: Date;
  accepted_at: Date | null;
}

export interface SharedVaultItem {
  id: string;
  item_id: string;
  shared_by: string;
  shared_with: string;
  encrypted_key: string | null;
  permissions: SharePermission;
  created_at: Date;
}

export interface BreachAlert {
  id: string;
  user_id: string;
  vault_item_id: string | null;
  source: string | null;
  detected_at: Date;
  acknowledged: boolean;
}

export interface JwtPayload {
  userId: string;
  email: string;
  isAdmin: boolean;
  type: 'access' | 'refresh';
}

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    isAdmin: boolean;
  };
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface VaultItemFilter {
  type?: ItemType;
  folder_id?: string;
  favorite?: boolean;
  search?: string;
  deleted?: boolean;
  tag_id?: string;
}

export interface CreateVaultItemDto {
  item_type: ItemType;
  encrypted_data: string;
  nonce: string;
  folder_id?: string;
  favorite?: boolean;
  reprompt?: boolean;
}

export interface UpdateVaultItemDto {
  encrypted_data?: string;
  nonce?: string;
  folder_id?: string | null;
  favorite?: boolean;
  reprompt?: boolean;
  revision: number;
}

export interface CreateFolderDto {
  name_encrypted: string;
  parent_id?: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  kdf_salt?: string;
}

export interface LoginDto {
  email: string;
  password: string;
  mfa_token?: string;
}
