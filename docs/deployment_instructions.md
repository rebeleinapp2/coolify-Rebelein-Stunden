# Anleitung zur Veröffentlichung der Zeiterfassungs-App

Diese Anleitung führt Sie Schritt für Schritt durch den Prozess, die Zeiterfassungs-App für Ihr Unternehmen online verfügbar zu machen ("Deployment"). Sie benötigen dafür keine tiefgehenden Programmierkenntnisse.

Wir nutzen zwei Dienste:
1.  **Supabase** (für die Datenbank und Benutzeranmeldung)
2.  **Netlify** (um die Webseite online zu stellen)

---

## Schritt 1: Datenbank einrichten (Supabase)

Supabase ist der Ort, an dem alle Daten (Zeiten, Benutzer, Einstellungen) gespeichert werden.

1.  Gehen Sie auf [supabase.com](https://supabase.com) und klicken Sie auf **"Start your project"**.
2.  Erstellen Sie einen Account (oder loggen Sie sich mit GitHub ein).
3.  Klicken Sie auf **"New Project"**.
4.  Füllen Sie das Formular aus:
    *   **Name:** z.B. `Firma Zeiterfassung`
    *   **Database Password:** Klicken Sie auf "Generate a password" und **kopieren Sie es sich sicher weg** (wir brauchen es später vielleicht, aber vor allem ist es wichtig für die Sicherheit).
    *   **Region:** Wählen Sie `Frankfurt` (oder eine Region in Ihrer Nähe) für den Datenschutz.
5.  Klicken Sie auf **"Create new project"**. Es dauert ca. 2-3 Minuten, bis das Projekt bereit ist.

### SQL-Code ausführen (Datenbankstruktur anlegen)

Damit die App weiß, wie sie Daten speichern soll, müssen wir Tabellen anlegen.

1.  Im Supabase-Menü links, klicken Sie auf das Icon **SQL Editor** (sieht aus wie ein Dokument mit Terminal-Zeichen `>_`).
2.  Klicken Sie oben auf **"+ New query"** (leeres Blatt).
3.  Kopieren Sie den **gesamten Inhalt** aus der Datei `docs/supabase_schema.md` (oder dem Code-Block unten) in das große Textfeld auf der rechten Seite.
4.  Klicken Sie unten rechts auf den grünen Button **"Run"**.
5.  Sie sollten im unteren Bereich "Success" lesen.

### Verbindungsdaten kopieren

Wir brauchen nun zwei "Schlüssel", damit die App mit der Datenbank sprechen darf.

1.  Klicken Sie im Menü links ganz unten auf das Zahnrad **Settings** -> **API**.
2.  Auf dieser Seite finden Sie unter "Project URL" und "Project API keys":
    *   **Project URL** (beginnt mit `https://...`)
    *   **anon public** Key (eine lange Zeichenkette, beginnt oft mit `eyJ...`)
3.  Lassen Sie diesen Tab offen oder kopieren Sie diese beiden Werte in eine Textdatei.

---

## Schritt 2: App online stellen (Netlify)

Netlify bringt den Programmcode ins Internet.

*Voraussetzung: Sie haben den Programmcode dieser App (die Dateien) idealerweise in einem GitHub-Repository. Wenn Sie die Dateien nur lokal auf dem PC haben, können Sie sie bei Netlify auch per "Drag & Drop" hochladen, aber GitHub wird für automatische Updates empfohlen.*

**Methode A: Drag & Drop (Einfach, für manuelle Updates)**

1.  Auf Ihrem Computer müssen Sie den Code erst "bauen". Wenn Sie einen Entwickler haben, bitten Sie ihn, den Befehl `npm run build` auszuführen. Dadurch entsteht ein Ordner namens `dist`.
2.  Gehen Sie auf [netlify.com](https://www.netlify.com) und loggen Sie sich ein.
3.  Gehen Sie auf "Sites" und suchen Sie den Bereich, wo steht "Drag and drop your site output folder here".
4.  Ziehen Sie den Ordner `dist` dort hinein.
5.  Die Seite ist nun online, funktioniert aber noch nicht (Datenbank fehlt noch).

**Methode B: GitHub (Empfohlen)**

1.  Laden Sie den Code in ein GitHub Repository hoch.
2.  Bei Netlify: "Add new site" -> "Import an existing project" -> "GitHub".
3.  Wählen Sie das Repository aus.
4.  Bei "Build command" tragen Sie ein: `npm run build`
5.  Bei "Publish directory" tragen Sie ein: `dist`

### Wichtig: Umgebungsvariablen setzen

Egal welche Methode, Sie müssen Netlify sagen, wo Ihre Supabase-Datenbank liegt.

1.  In Netlify, gehen Sie auf Ihre neue Seite -> **Site configuration** -> **Environment variables**.
2.  Klicken Sie auf "Add a variable".
3.  Fügen Sie folgende zwei Variablen hinzu (nutzen Sie die Werte aus Schritt 1):
    *   Key: `VITE_SUPABASE_URL`
        *   Value: *Ihre Project URL von Supabase*
    *   Key: `VITE_SUPABASE_ANON_KEY`
        *   Value: *Ihr anon public Key von Supabase*
4.  Speichern Sie.
5.  Falls Sie Methode B nutzen: Gehen Sie auf "Deploys" -> "Trigger deploy", damit die App mit den neuen Schlüsseln neu gebaut wird.

---

## Schritt 3: Erster Start & Admin-Einrichtung

1.  Öffnen Sie die Web-Adresse, die Netlify Ihnen gibt (z.B. `https://ihre-firma-zeit.netlify.app`).
2.  Registrieren Sie sich als erster Benutzer ("Registrieren").
3.  Da noch niemand Rechte hat, sind Sie erst einmal ein normaler Benutzer.

**Sich selbst zum Admin machen:**

1.  Gehen Sie zurück zu **Supabase**.
2.  Im Menü links auf **Table Editor** (Tabellen-Icon).
3.  Klicken Sie auf die Tabelle `user_settings`.
4.  Sie sollten dort Ihren Eintrag sehen.
5.  Ändern Sie in der Spalte `role` den Wert von `installer` auf `admin`.
6.  Klicken Sie unten auf **Save** (oder Enter).

## Fertig!

Wenn Sie die App jetzt neu laden, sollten Sie Zugriff auf das "Büro"-Dashboard und alle Einstellungen haben.

Ihre Mitarbeiter können sich nun ebenfalls registrieren. Als Admin sehen Sie diese im "Büro"-Bereich und können deren Rollen oder Arbeitszeiten verwalten.