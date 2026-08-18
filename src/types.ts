export type AppRole = 'driver' | 'admin'
export type Profile = { id: string; full_name: string; avatar_url: string | null; role: AppRole; is_active: boolean }
