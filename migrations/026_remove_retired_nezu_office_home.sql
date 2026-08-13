-- Migration 026: Remove the explicitly retired legacy Nezu Office home
--
-- The affected Edge installation contains two historical homes. The user chose
-- to retain local-home (Oficina) and permanently retire this exact legacy home.
-- The transaction only applies when the retained home exists; other installs
-- are untouched. Dependent records are removed before the home so foreign-key
-- constraints remain valid.

DELETE FROM assistant_confirmation_tickets
WHERE home_id = 'd2765cc0-b139-4582-883e-ffe4613adf14'
  AND EXISTS (SELECT 1 FROM homes WHERE id = 'local-home');

DELETE FROM system_variables
WHERE scope = 'home'
  AND home_id = 'd2765cc0-b139-4582-883e-ffe4613adf14'
  AND EXISTS (SELECT 1 FROM homes WHERE id = 'local-home');

DELETE FROM scenes
WHERE home_id = 'd2765cc0-b139-4582-883e-ffe4613adf14'
  AND EXISTS (SELECT 1 FROM homes WHERE id = 'local-home');

DELETE FROM assistant_findings
WHERE json_valid(metadata)
  AND json_extract(metadata, '$.homeId') = 'd2765cc0-b139-4582-883e-ffe4613adf14'
  AND EXISTS (SELECT 1 FROM homes WHERE id = 'local-home');

DELETE FROM homes
WHERE id = 'd2765cc0-b139-4582-883e-ffe4613adf14'
  AND EXISTS (SELECT 1 FROM homes WHERE id = 'local-home');