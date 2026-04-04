-- Allow tournament owners to update players
create policy "Tournament owners can update players"
  on players for update using (
    auth.uid() = (select created_by from tournaments where id = tournament_id)
  );
