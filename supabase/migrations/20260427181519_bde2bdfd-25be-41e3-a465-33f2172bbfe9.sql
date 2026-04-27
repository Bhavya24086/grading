
-- Roles enum and table
CREATE TYPE public.app_role AS ENUM ('teacher', 'student');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  due_date TIMESTAMPTZ NOT NULL,
  max_points INTEGER NOT NULL DEFAULT 100,
  file_url TEXT,
  file_name TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  grade NUMERIC,
  feedback TEXT,
  graded_at TIMESTAMPTZ,
  graded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(assignment_id, student_id)
);

-- Security definer role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Auto-create profile + student role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'student')
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- profiles policies
CREATE POLICY "Users view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- user_roles policies
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Teachers view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'teacher'));

-- assignments policies
CREATE POLICY "Authenticated view assignments" ON public.assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers insert assignments" ON public.assignments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'teacher') AND auth.uid() = created_by);
CREATE POLICY "Teachers update assignments" ON public.assignments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Teachers delete assignments" ON public.assignments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'teacher'));

-- submissions policies
CREATE POLICY "Students view own submissions" ON public.submissions FOR SELECT TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "Teachers view all submissions" ON public.submissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Students create own submissions" ON public.submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id AND public.has_role(auth.uid(), 'student'));
CREATE POLICY "Students update own ungraded submissions" ON public.submissions FOR UPDATE TO authenticated USING (auth.uid() = student_id AND grade IS NULL);
CREATE POLICY "Teachers grade submissions" ON public.submissions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'teacher'));

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('assignments', 'assignments', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('submissions', 'submissions', false);

-- assignments bucket: public read, teachers upload
CREATE POLICY "Public read assignment files" ON storage.objects FOR SELECT USING (bucket_id = 'assignments');
CREATE POLICY "Teachers upload assignment files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'assignments' AND public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Teachers delete assignment files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'assignments' AND public.has_role(auth.uid(), 'teacher'));

-- submissions bucket: students upload to own folder, students read own, teachers read all
CREATE POLICY "Students upload own submission files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'submissions' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Students read own submission files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'submissions' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Teachers read all submission files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'submissions' AND public.has_role(auth.uid(), 'teacher'));
