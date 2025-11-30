# Supabase SQL Schema

Kopiere den folgenden SQL-Code und führe ihn im **SQL Editor** deines Supabase-Projekts aus, um die Datenbankstruktur zu erstellen.

```sql
-- 0. ZEITZONE EINRICHTEN
-- Zwingt die Datenbank auf deutsche Zeit (Berlin), auch wenn der Server/Container auf UTC läuft.
ALTER DATABASE postgres SET timezone TO 'Europe/Berlin';

-- 1. ENUM Typen erstellen
-- Definiert die Benutzerrollen in der Datenbank
-- Falls der Type schon existiert, wird der Fehler ignoriert (bei erneutem Ausführen)
do $$ begin
    create type user_role as enum ('admin', 'office', 'installer');
exception
    when duplicate_object then null;
end $$;

-- 2. Tabelle: user_settings (Benutzereinstellungen & Profil)
create table if not exists user_settings (
  user_id uuid references auth.users on delete cascade not null primary key,
  display_name text,
  role user_role default 'installer',
  target_hours jsonb default '{"1": 8.5, "2": 8.5, "3": 8.5, "4": 8.5, "5": 4.5, "6": 0, "0": 0}'::jsonb,
  work_config jsonb default '{"1": "07:00", "2": "07:00", "3": "07:00", "4": "07:00", "5": "07:00", "6": "07:00", "0": "07:00"}'::jsonb,
  work_config_locked boolean default false,
  vacation_days_yearly numeric default 30,
  employment_start_date date,
  initial_overtime_balance numeric default 0,
  preferences jsonb default '{"timeCardCollapsed": false}'::jsonb,
  updated_at timestamptz default now()
);

-- RLS (Row Level Security) aktivieren
alter table user_settings enable row level security;

-- HILFSFUNKTION FÜR REKURSIONS-FREIE ADMIN PRÜFUNG (SECURITY DEFINER)
-- Verhindert "Infinite recursion detected in policy" Fehler
CREATE OR REPLACE FUNCTION public.is_office_admin()
RETURNS boolean AS $$
BEGIN
  -- Diese Funktion läuft mit Admin-Rechten und umgeht RLS für diesen spezifischen Check
  RETURN EXISTS (
    SELECT 1 FROM public.user_settings 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'office')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies für user_settings
drop policy if exists "Users can view own settings" on user_settings;
create policy "Users can view own settings" on user_settings
  for select using (auth.uid() = user_id);

drop policy if exists "Users can update own settings" on user_settings;
create policy "Users can update own settings" on user_settings
  for update using (auth.uid() = user_id);

drop policy if exists "Office can view all settings" on user_settings;
create policy "Office can view all settings" on user_settings
  for select using (
    auth.uid() = user_id OR is_office_admin()
  );

drop policy if exists "Office can update all settings" on user_settings;
create policy "Office can update all settings" on user_settings
  for update using (
    is_office_admin()
  );

drop policy if exists "Office can insert settings" on user_settings;
create policy "Office can insert settings" on user_settings
  for insert with check (true);


-- 3. Tabelle: time_entries (Einzelne Projekt-Einträge)
create table if not exists time_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null,
  client_name text not null,
  hours numeric not null,
  start_time text,
  end_time text,
  note text,
  type text default 'work', -- 'work', 'break', 'company', 'overtime_reduction', etc.
  submitted boolean default false,
  confirmed_by uuid references auth.users on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz default now()
);

-- Index für schnellere Abfragen
create index if not exists idx_time_entries_user_date on time_entries(user_id, date);

-- RLS für time_entries
alter table time_entries enable row level security;

drop policy if exists "Users can view own entries" on time_entries;
create policy "Users can view own entries" on time_entries
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own entries" on time_entries;
create policy "Users can insert own entries" on time_entries
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own entries" on time_entries;
create policy "Users can update own entries" on time_entries
  for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own entries" on time_entries;
create policy "Users can delete own entries" on time_entries
  for delete using (auth.uid() = user_id);

-- Office Zugriff auf Time Entries (via is_office_admin)
drop policy if exists "Office can view all entries" on time_entries;
create policy "Office can view all entries" on time_entries FOR SELECT USING ( is_office_admin() );

drop policy if exists "Office can update all entries" on time_entries;
create policy "Office can update all entries" on time_entries FOR UPDATE USING ( is_office_admin() );

drop policy if exists "Office can insert for others" on time_entries;
create policy "Office can insert for others" on time_entries FOR INSERT WITH CHECK ( is_office_admin() );

drop policy if exists "Office can delete all entries" on time_entries;
create policy "Office can delete all entries" on time_entries FOR DELETE USING ( is_office_admin() );


-- 4. Tabelle: daily_logs (Anwesenheit Start/Ende & Pausen)
create table if not exists daily_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null,
  start_time text,
  end_time text,
  break_start text,
  break_end text,
  segments jsonb default '[]'::jsonb, -- Für multiple Zeitblöcke
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table daily_logs enable row level security;

drop policy if exists "Users can view own logs" on daily_logs;
create policy "Users can view own logs" on daily_logs for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own logs" on daily_logs;
create policy "Users can insert own logs" on daily_logs for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own logs" on daily_logs;
create policy "Users can update own logs" on daily_logs for update using (auth.uid() = user_id);

drop policy if exists "Office can view all logs" on daily_logs;
create policy "Office can view all logs" on daily_logs FOR SELECT USING ( is_office_admin() );


-- 5. Tabelle: user_absences (Urlaub, Krank, etc.)
create table if not exists user_absences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  start_date date not null,
  end_date date not null,
  type text not null, -- 'vacation', 'sick', 'holiday', 'unpaid'
  note text,
  created_at timestamptz default now()
);

-- Performance Index für Datumsbereiche (wichtig für Dashboard)
create index if not exists idx_user_absences_range on user_absences(user_id, start_date, end_date);

alter table user_absences enable row level security;

drop policy if exists "Users can view own absences" on user_absences;
create policy "Users can view own absences" on user_absences for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own absences" on user_absences;
create policy "Users can insert own absences" on user_absences for insert with check (auth.uid() = user_id);
drop policy if exists "Users can delete own absences" on user_absences;
create policy "Users can delete own absences" on user_absences for delete using (auth.uid() = user_id);

drop policy if exists "Office can view all absences" on user_absences;
create policy "Office can view all absences" on user_absences FOR SELECT USING ( is_office_admin() );

drop policy if exists "Office can manage all absences" on user_absences;
create policy "Office can manage all absences" on user_absences FOR ALL USING ( is_office_admin() );


-- 6. Tabelle: vacation_requests (Urlaubsanträge)
create table if not exists vacation_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  start_date date not null,
  end_date date not null,
  note text,
  status text default 'pending', -- 'pending', 'approved', 'rejected'
  approved_by uuid references auth.users on delete set null,
  approved_by_name text,
  created_at timestamptz default now()
);

alter table vacation_requests enable row level security;

drop policy if exists "Users can view own requests" on vacation_requests;
create policy "Users can view own requests" on vacation_requests for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own requests" on vacation_requests;
create policy "Users can insert own requests" on vacation_requests for insert with check (auth.uid() = user_id);
drop policy if exists "Users can delete own pending requests" on vacation_requests;
create policy "Users can delete own pending requests" on vacation_requests for delete using (auth.uid() = user_id and status = 'pending');

drop policy if exists "Office can view all requests" on vacation_requests;
create policy "Office can view all requests" on vacation_requests FOR SELECT USING ( is_office_admin() );

drop policy if exists "Office can update requests" on vacation_requests;
create policy "Office can update requests" on vacation_requests FOR UPDATE USING ( is_office_admin() );


-- 7. Tabelle: locked_days (Gesperrte Tage)
create table if not exists locked_days (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null,
  locked_by uuid references auth.users on delete set null,
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table locked_days enable row level security;

drop policy if exists "Users can view own locks" on locked_days;
create policy "Users can view own locks" on locked_days for select using (auth.uid() = user_id);

drop policy if exists "Office can manage locks" on locked_days;
create policy "Office can manage locks" on locked_days FOR ALL USING ( is_office_admin() );

-- 8. Trigger: Automatisch user_settings Eintrag erstellen bei neuem Benutzer
-- Diese Funktion sorgt dafür, dass jeder neue Benutzer sofort einen Eintrag in user_settings hat
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.user_settings (user_id, display_name, role)
  values (new.id, new.raw_user_meta_data->>'display_name', 'installer')
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger aktivieren
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 9. REALTIME AKTIVIERUNG
-- Wichtig: Damit die App (Client) auf Änderungen hören kann (.on('postgres_changes'...)),
-- muss die Tabelle zur 'supabase_realtime' Publication hinzugefügt werden.
-- Dies ist bei Self-Hosting oft nicht standardmäßig aktiv.

alter publication supabase_realtime add table time_entries;
alter publication supabase_realtime add table user_settings;
alter publication supabase_realtime add table user_absences;
alter publication supabase_realtime add table vacation_requests;
alter publication supabase_realtime add table daily_logs;
alter publication supabase_realtime add table locked_days;
```