-- Migration: 20261023143500_fix_passage_body_markdown_depiction_paths.sql
-- Description: Normalizes depiction storage folder typo in passages.body_markdown (/depiction/ -> /depictions/)

UPDATE passages 
SET body_markdown = regexp_replace(body_markdown, '/depiction/([^/\s)]+)\.(webp|png|jpe?g)', '/depictions/\1.webp', 'g')
WHERE body_markdown LIKE '%/depiction/%';
