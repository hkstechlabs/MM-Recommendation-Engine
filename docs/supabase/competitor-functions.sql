-- SQL functions for competitor sync operations

-- Function to increment competitor statistics
CREATE OR REPLACE FUNCTION increment_competitor_stat(
  competitor_id uuid,
  stat_name text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF stat_name = 'failed_executions' THEN
    UPDATE public.competitors 
    SET 
      failed_executions = COALESCE(failed_executions, 0) + 1,
      total_executions = COALESCE(total_executions, 0) + 1
    WHERE id = competitor_id;
  ELSIF stat_name = 'total_executions' THEN
    UPDATE public.competitors 
    SET total_executions = COALESCE(total_executions, 0) + 1
    WHERE id = competitor_id;
  END IF;
END;
$$;

-- Function to get competitor sync statistics
CREATE OR REPLACE FUNCTION get_competitor_stats(hours_back integer DEFAULT 24)
RETURNS TABLE (
  competitor_name text,
  total_executions bigint,
  successful_executions bigint,
  failed_executions bigint,
  latest_execution timestamp with time zone,
  total_data_points bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.title as competitor_name,
    COUNT(e.id) as total_executions,
    COUNT(CASE WHEN e.status = 'completed' THEN 1 END) as successful_executions,
    COUNT(CASE WHEN e.status = 'failed' THEN 1 END) as failed_executions,
    MAX(e.start_time) as latest_execution,
    COUNT(sd.id) as total_data_points
  FROM public.competitors c
  LEFT JOIN public.executions e ON c.id = e.competitor_id 
    AND e.start_time >= NOW() - INTERVAL '1 hour' * hours_back
  LEFT JOIN public.scraped_data sd ON e.id = sd.execution_id
  GROUP BY c.id, c.title
  ORDER BY c.title;
END;
$$;

-- Function to clean up old scraped data (optional, for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_scraped_data(days_to_keep integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.scraped_data 
  WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;