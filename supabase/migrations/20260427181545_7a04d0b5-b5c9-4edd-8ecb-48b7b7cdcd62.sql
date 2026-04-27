
-- Restrict trigger function execution
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon;

-- Restrict listing of assignments bucket - only authenticated users
DROP POLICY "Public read assignment files" ON storage.objects;
CREATE POLICY "Authenticated read assignment files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'assignments');
