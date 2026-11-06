export interface ManagedUser {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  setup_token?: string;
  discord_id?: string;
  profile?: {
    first_name?: string;
    last_name?: string;
    nickname?: string;
    position?: string;
  };
}
