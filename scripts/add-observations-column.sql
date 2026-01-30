-- Add observations column to work_center table
ALTER TABLE work_center 
ADD COLUMN observations TEXT NULL;

-- Add comment to describe the column
COMMENT ON COLUMN work_center.observations IS 'Additional notes and observations about the work center';
