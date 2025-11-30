# Anleitung: Self-Hosting auf eigenem VPS (Ubuntu)

Diese Anleitung beschreibt, wie Sie die Zeiterfassungs-App auf einem eigenen virtuellen Server (VPS) installieren. Wir nutzen dafür **Coolify**. Coolify ist ein geniales Tool, das auf Ihrem Server installiert wird und Ihnen eine Oberfläche bietet, um Datenbanken (Supabase) und Webseiten (unsere App) per Klick zu installieren – ähnlich wie ein eigenes Netlify oder Heroku.

**Der Stack:**
*   **Server:** Ubuntu VPS
*   **Management:** Coolify (verwaltet Docker automatisch)
*   **Datenbank:** Supabase (Self-hosted via Coolify)
*   **Domain:** DynDNS oder eigene Domain mit SSL (automatisch durch Coolify)

---

## Voraussetzung

1.  Einen **VPS** (Virtual Private Server) bei einem Anbieter (z.B. Hetzner, Strato, IONOS).
    *   Betriebssystem: **Ubuntu 22.04** oder **24.04**.
    *   Leistung: Mindestens **2 CPU / 4 GB RAM** (da Supabase einige Dienste startet).
2.  Eine **Domain** oder **DynDNS-Adresse** (z.B. `meine-firma.dyndns.org`), die auf die IP-Adresse Ihres Servers zeigt.
3.  Zugang zum Server via **SSH** (Terminal).
4.  Den Programmcode dieser App in einem **GitHub Repository** (privat oder öffentlich).

---

## Schritt 1: Server vorbereiten & Coolify installieren

Melden Sie sich per SSH auf Ihrem Server an:
`ssh root@deine-server-ip`

Führen Sie folgenden Befehl aus, um **Coolify** zu installieren. Das Skript installiert automatisch Docker und alles Nötige:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

*Warten Sie einige Minuten, bis die Installation abgeschlossen ist.*

Sobald fertig, öffnen Sie Ihren Browser:
`http://<Ihre-Server-IP>:8000`

1.  Registrieren Sie sich mit Email und Passwort (das ist Ihr lokaler Admin-Account).
2.  Folgen Sie dem Einrichtungsassistenten (meistens einfach "Localhost" auswählen und bestätigen).

---

## Schritt 2: Supabase (Datenbank) installieren

In der Coolify Oberfläche:

1.  Gehen Sie auf **"Projects"** -> Erstellen Sie ein neues Projekt (z.B. "Zeiterfassung").
2.  Klicken Sie auf **"New"** -> **"Service"**.
3.  Suchen Sie nach **"Supabase"** und wählen Sie es aus.
4.  Klicken Sie auf **"Continue"**.
5.  Coolify bereitet nun alle Supabase-Container vor (Datenbank, Auth, Realtime, API, Studio).

**Konfiguration:**
1.  Klicken Sie in den Supabase-Einstellungen in Coolify auf **"General"**.
2.  Bei **"Service URL" (oder Domains)** geben Sie eine Subdomain an, z.B. `http://supabase.meine-firma.dyndns.org` (wenn Sie DynDNS nutzen).
    *   *Tipp:* Wenn Sie nur eine IP haben, nutzen Sie `http://<IP>:8000` (wobei 8000 von Coolify belegt ist, nutzen Sie für Supabase Studio dann z.B. Port 8001 oder nutzen Sie sslip.io: `http://supabase.<IP>.sslip.io`).
3.  Klicken Sie auf **"Save"** und dann oben rechts auf **"Deploy"**.

*Das dauert beim ersten Mal ca. 5-10 Minuten.*

**Zugangsdaten finden:**
Sobald Supabase grün ("Healthy") ist, sehen Sie in Coolify unter dem Reiter **"Environment Variables"** (oder ähnlich, je nach Version) die wichtigen Schlüssel. Suchen Sie nach:
*   `SERVICE_URL_KONG` (oder API URL) -> Das ist Ihre `VITE_SUPABASE_URL`.
*   `ANON_KEY` -> Das ist Ihr `VITE_SUPABASE_ANON_KEY`.
*   `SERVICE_PASSWORD` -> Ihr Datenbank-Passwort.

**Datenbank einrichten:**
1.  Öffnen Sie das **Supabase Studio** (Über den Link, den Coolify anzeigt, oft Port 8000 oder die konfigurierte Domain).
2.  Gehen Sie zum **SQL Editor**.
3.  Kopieren Sie den Inhalt aus der Datei `docs/supabase_schema.md` und führen Sie ihn aus.

---

## Schritt 3: Die App installieren (Frontend)

1.  Gehen Sie in Coolify zurück zu Ihrem Projekt "Zeiterfassung".
2.  Klicken Sie auf **"New"** -> **"Public Repository"** (oder "Private Repository", wenn Sie GitHub verknüpft haben).
3.  Geben Sie die URL Ihres GitHub-Repositories an, wo der Code dieser App liegt.
4.  **Build Pack:** Wählen Sie **"Static"** oder **"Nixpacks"**. Coolify erkennt meist automatisch, dass es eine Vite/React App ist.
    *   *Build Command:* `npm run build`
    *   *Publish Directory:* `dist`
5.  **Environment Variables (Umgebungsvariablen):**
    Bevor Sie auf Deploy klicken, gehen Sie in den Reiter **"Environment Variables"**. Fügen Sie hinzu:
    *   Key: `VITE_SUPABASE_URL`
    *   Value: *Die URL aus Schritt 2 (beginnt meist mit https://...)*
    *   Key: `VITE_SUPABASE_ANON_KEY`
    *   Value: *Der Key aus Schritt 2*
6.  **Domain:** Tragen Sie bei "General" -> "Domains" Ihre gewünschte Domain ein (z.B. `https://zeit.meine-firma.dyndns.org`). Coolify kümmert sich automatisch um das HTTPS-Zertifikat (Let's Encrypt).
7.  Klicken Sie auf **"Deploy"**.

---

## Optional: Portainer

Coolify ersetzt Portainer fast vollständig für Deployment-Zwecke. Wenn Sie Portainer dennoch parallel nutzen wollen (z.B. zum Debuggen der Container):

1.  In Coolify ein neues "Service" hinzufügen.
2.  Nach "Portainer" suchen.
3.  Deployen.
4.  Achtung: Portainer nutzt Standard-Ports, die evtl. mit Coolify kollidieren. Ändern Sie in der Config den Port (z.B. auf 9443).

---

## Zusammenfassung für den Betrieb

*   Ihre App ist nun unter Ihrer Domain erreichbar (z.B. `https://zeit.meine-firma.dyndns.org`).
*   Die Datenbank läuft auf Ihrem Server.
*   Backups: Coolify bietet eine Backup-Funktion für Datenbanken (S3 kompatibel). Es wird dringend empfohlen, diese zu konfigurieren, da die Daten nun auf Ihrem Server liegen und nicht mehr in der Cloud.