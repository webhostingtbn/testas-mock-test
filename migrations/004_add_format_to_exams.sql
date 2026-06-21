-- Migration to add format column to exams table
ALTER TABLE public.exams 
ADD COLUMN IF NOT EXISTS format TEXT NOT NULL DEFAULT 'Digital' CHECK (format IN ('Digital', 'Paper'));
