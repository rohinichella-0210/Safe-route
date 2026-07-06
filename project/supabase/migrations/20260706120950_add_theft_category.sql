/*
# Add theft category to incident_reports

1. Changes
- Alter check constraint to include 'theft' category
*/

ALTER TABLE incident_reports DROP CONSTRAINT IF EXISTS incident_reports_category_check;

ALTER TABLE incident_reports ADD CONSTRAINT incident_reports_category_check
  CHECK (category IN ('harassment', 'poor_lighting', 'suspicious_activity', 'unsafe_area', 'road_obstruction', 'broken_streetlight', 'public_disturbance', 'theft', 'stalking', 'other'));
