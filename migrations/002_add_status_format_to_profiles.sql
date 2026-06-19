-- Migration to add status and format columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS format TEXT DEFAULT 'Digital',
ADD COLUMN IF NOT EXISTS module_test TEXT DEFAULT 'CS';
