export type ItemType = 'login' | 'note' | 'card' | 'identity' | 'ssh_key';
export type AccountStatus = 'active' | 'locked' | 'suspended' | 'deleted';

export interface User {
  id: string;
  email: string;
  mfa_enabled: boolean;
  is_admin: boolean;
  created_at: string;
  last_login_at: string | null;
  account_status: AccountStatus;
  kdf_salt: string;
  kdf_iterations: number;
  auth_provider: 'local' | 'microsoft';
}

export interface VaultItem {
  id: string;
  item_type: ItemType;
  encrypted_data: string;
  nonce: string;
  folder_id: string | null;
  favorite: boolean;
  reprompt: boolean;
  revision: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  decrypted?: DecryptedItem;
}

export interface DecryptedItem {
  name: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  // Card
  cardNumber?: string;
  cardHolder?: string;
  expiry?: string;
  cvv?: string;
  // Identity
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  // SSH Key
  privateKey?: string;
  publicKey?: string;
  passphrase?: string;
}

export interface Folder {
  id: string;
  name_encrypted: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  name?: string; // client-side decrypted
}

export interface Tag {
  id: string;
  name_encrypted: string;
  created_at: string;
  name?: string; // client-side decrypted
}

export interface AuditLog {
  id: string;
  user_id: string;
  email?: string;
  action: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  timestamp: string;
}

export interface AdminUser {
  id: string;
  email: string;
  mfa_enabled: boolean;
  is_admin: boolean;
  created_at: string;
  last_login_at: string | null;
  account_status: AccountStatus;
  vault_item_count?: number;
}

export interface PasswordGeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export type ViewMode = 'all' | 'favorites' | 'trash' | 'folder' | 'tag';
