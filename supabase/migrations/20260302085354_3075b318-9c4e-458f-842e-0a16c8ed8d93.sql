
-- Fix sessions: public can insert/select/update own session, admins can delete
DROP POLICY "Anyone can manage sessions" ON public.sessions;
CREATE POLICY "Anyone can create sessions" ON public.sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view sessions" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can update sessions" ON public.sessions FOR UPDATE USING (true);
CREATE POLICY "Admins can delete sessions" ON public.sessions FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Fix answers: public can insert/select only
DROP POLICY "Anyone can manage answers" ON public.answers;
CREATE POLICY "Anyone can create answers" ON public.answers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view answers" ON public.answers FOR SELECT USING (true);

-- Fix results: public can insert/select, admins can delete
DROP POLICY "Anyone can manage results" ON public.results;
CREATE POLICY "Anyone can create results" ON public.results FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view results" ON public.results FOR SELECT USING (true);
CREATE POLICY "Admins can delete results" ON public.results FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
