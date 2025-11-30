# Migrationsanleitung: Supabase Cloud zu Self-Hosted (Coolify)

Diese Anleitung beschreibt den Prozess, um Ihre Daten (Benutzer und Einträge) von der Supabase Cloud in Ihre eigene, via Coolify gehostete Instanz zu migrieren.

**Warum ist das kompliziert?**
In Supabase sind die Benutzer (Login-Daten) in einem geschützten Bereich (`auth.users`) gespeichert, während Ihre App-Daten (Zeiten, Einstellungen) im öffentlichen Bereich (`public`) liegen. Die App-Daten sind über eine ID (`user_id`) fest mit den Benutzern verknüpft. Wenn Sie nur die App-Daten kopieren und neue Benutzer anlegen, ändern sich die IDs und die Daten sind "verwaist".

**Ziel:** Wir kopieren die Datenbank 1:1, damit alle IDs gleich bleiben.

---

## Voraussetzungen

1.  **Terminal:** Sie benötigen Zugriff auf eine Kommandozeile (Terminal/PowerShell).
2.  **PostgreSQL Tools:** Die Programme `pg_dump` und `psql` müssen auf Ihrem Computer installiert sein.
    *   *Windows:* Installieren Sie PostgreSQL (die Tools sind dabei).
    *   *Mac:* `brew install libpq` (und in den Pfad aufnehmen) oder `brew install postgresql`.
    *   *Linux:* `sudo apt-get install postgresql-client`.
3.  **Verbindungsdaten:**
    *   **QUELLE (Cloud):** Gehen Sie in Ihrem Supabase Cloud Projekt auf **Settings** -> **Database** -> **Connection string** -> **URI**. Kopieren Sie den String (ersetzen Sie `[YOUR-PASSWORD]`).
    *   **ZIEL (Coolify):** Gehen Sie in Coolify zu Ihrem Supabase-Service -> **PostgreSQL** -> Kopieren Sie den Connection String (oft `postgres://postgres:password@ip:port/postgres`).

---

## Schritt 1: Daten exportieren (Backup)

Wir erstellen zwei Dateien: Eine für die Benutzer und eine für die App-Daten.

Öffnen Sie Ihr Terminal und führen Sie folgende Befehle aus (ersetzen Sie `SOURCE_CONNECTION_STRING` mit Ihrer Cloud-URL):

**1. Benutzer exportieren (`auth` Schema):**
```bash
pg_dump "SOURCE_CONNECTION_STRING" \
  --schema=auth \
  --data-only \
  --quote-all-identifiers \
  --file=auth_dump.sql
```

**2. App-Daten exportieren (`public` Schema):**
```bash
pg_dump "SOURCE_CONNECTION_STRING" \
  --schema=public \
  --data-only \
  --quote-all-identifiers \
  --file=public_dump.sql
```
*Hinweis: Wir exportieren hier `--data-only` (nur Daten), da wir davon ausgehen, dass Sie die Tabellen-Struktur (Schema) auf dem neuen Server bereits mit der Datei `supabase_schema.md` angelegt haben. Falls nicht, tun Sie dies bitte zuerst im SQL Editor des neuen Servers.*

---

## Schritt 2: Daten importieren (Restore)

Nun laden wir die Daten auf Ihren eigenen Server.
**ACHTUNG:** Dies sollte auf einer leeren Datenbank passieren (bzw. einer Datenbank, die nur die leeren Tabellen enthält).

Ersetzen Sie `DESTINATION_CONNECTION_STRING` mit Ihrer Coolify-Datenbank-URL.

**1. Datenbank bereinigen (Optional, aber empfohlen bei Konflikten):**
Wenn Sie bereits Testdaten auf dem neuen Server haben, löschen Sie diese im SQL Editor des neuen Servers:
```sql
TRUNCATE auth.users CASCADE;
TRUNCATE public.user_settings CASCADE;
-- Dies löscht ALLE Benutzer und Daten auf dem Zielserver!
```

**2. Benutzer importieren:**
```bash
psql "DESTINATION_CONNECTION_STRING" -f auth_dump.sql
```
*Es können Warnungen erscheinen (z.B. "relation already exists"), diese können bei `--data-only` meist ignoriert werden, solange die `INSERT` Befehle durchlaufen.*

**3. App-Daten importieren:**
```bash
psql "DESTINATION_CONNECTION_STRING" -f public_dump.sql
```

---

## Schritt 3: Nacharbeiten

1.  **Sequenzen zurücksetzen:**
    Da wir Daten mit festen IDs importiert haben, müssen wir der Datenbank mitteilen, dass sie bei neuen Einträgen nicht bei 1 anfangen soll (was zu Konflikten führt), sondern bei der höchsten ID weitermacht.
    
    Führen Sie im **SQL Editor des neuen Servers** folgendes aus (nur notwendig, wenn Sie `SERIAL` oder `BIGSERIAL` IDs nutzen, unsere App nutzt hauptsächlich `UUID`s, daher ist dieser Schritt hier oft optional, aber gut für interne Supabase-Tabellen):
    
    ```sql
    -- Sicherstellen, dass interne Auth-Sequenzen stimmen
    SELECT setval(pg_get_serial_sequence('auth.users', 'id'), coalesce(max(id),0) + 1, false) FROM auth.users;
    ```

2.  **Frontend verbinden:**
    Stellen Sie sicher, dass Sie in Coolify in den Umgebungsvariablen Ihrer App (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) die neuen Werte eingetragen haben und klicken Sie auf "Deploy" (Redeploy).

## Troubleshooting

*   **Passwörter funktionieren nicht:** Die Passwörter werden gehasht übertragen. Da Supabase Cloud und Self-Hosted denselben Hashing-Algorithmus nutzen, sollten Logins weiterhin funktionieren.
*   **"Foreign Key Violation":** Das bedeutet, Sie versuchen App-Daten zu importieren, für die es keinen passenden Benutzer in `auth.users` gibt. Stellen Sie sicher, dass Sie Schritt 2.2 (Auth Import) **vor** Schritt 2.3 (Public Import) erfolgreich ausgeführt haben.
