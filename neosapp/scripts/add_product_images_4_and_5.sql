-- Run in Supabase SQL Editor before deploying the app changes.
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS imagen_url4 text,
  ADD COLUMN IF NOT EXISTS imagen_url5 text;
