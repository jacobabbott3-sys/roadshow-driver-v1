export type AppRole = 'driver' | 'admin'
export type ThemePreference = 'light' | 'dark' | 'system'
export type ColorScheme = 'forest' | 'blue' | 'purple' | 'rust'
export type Profile = { id: string; full_name: string; avatar_url: string | null; phone: string | null; role: AppRole; is_active: boolean; theme_preference: ThemePreference; color_scheme: ColorScheme; extreme_confetti: boolean }
