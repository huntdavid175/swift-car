import { createClient } from '@supabase/supabase-js'

// Create a single supabase client for interacting with your database
export const supabase = createClient(
  'https://gjnewypwvhquuvawewhn.supabase.co',
  'sb_publishable_1TTq3jOBjmfoGZIv8fKrOQ_DtQnFuGB'
)