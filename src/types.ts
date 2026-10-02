export type AppRole = 'driver' | 'admin'
export type ThemePreference = 'light' | 'dark' | 'system'
export type ColorScheme = 'forest' | 'blue' | 'purple' | 'rust'
export type Profile = { id: string; full_name: string; avatar_url: string | null; phone: string | null; role: AppRole; is_active: boolean; theme_preference: ThemePreference; color_scheme: ColorScheme; extreme_confetti: boolean }

export type AssignmentDisplay = {
  id: string
  full_name: string
  role: AppRole | 'external'
  external: boolean
}

export type AvailabilityShow = {
  id: string
  name: string
  starts_on: string
  ends_on: string
  city: string
  state: string | null
  address: string | null
  event_type: 'show' | 'signing'
  artist: string | null
  venue_name: string | null
  signing_at: string | null
  setup_at: string | null
  is_test: boolean
  contract_id: string
  contract_kind: 'setup' | 'teardown'
  service_date: string
  service_time: string | null
  contract_pay: number | null
  bonus_pay: number | null
}

export type PublishedAvailabilityRow = {
  batch_id: string | null
  batch_released_at: string
  release_item_id: string
  item_status: 'open' | 'assigned' | 'withdrawn'
  shows: AvailabilityShow[]
  response_status: 'available' | 'unavailable' | null
  responded_at: string | null
  available_at: string | null
  assignees: AssignmentDisplay[]
}

export type AvailabilityOpportunity = {
  id: string
  batch_id: string | null
  batch_released_at: string
  status: 'open' | 'assigned' | 'withdrawn'
  shows: AvailabilityShow[]
  response_status: 'available' | 'unavailable' | null
  responded_at: string | null
  available_at: string | null
  assignees: AssignmentDisplay[]
}

export type AvailabilityBatch = {
  id: string | null
  released_at: string
  opportunities: AvailabilityOpportunity[]
}

export type PublishableOpportunity = {
  opportunity_id: string
  show_ids: string[]
  title: string
  event_type: 'show' | 'signing'
  location: string | null
  work_at: string
  contract_kind: 'setup' | 'teardown'
  contract_pay: number | null
  bonus_pay: number | null
}

export type AvailabilityResponsePerson = {
  profile_id: string
  full_name: string
  role: AppRole
  phone: string | null
  response_status: 'available' | 'unavailable' | null
  responded_at: string | null
  available_at: string | null
  response_rank: number | null
  assigned: boolean
}
