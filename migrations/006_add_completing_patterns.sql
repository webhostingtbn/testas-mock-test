-- Migration to add completing_patterns to question_type ENUM
-- Run this in your Supabase SQL editor

ALTER TYPE public.question_type ADD VALUE IF NOT EXISTS 'completing_patterns';
