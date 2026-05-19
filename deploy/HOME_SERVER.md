# Home Server Deployment

This app is a Python stdlib web server. It does not need npm, a database, or a Python virtualenv.

## Copy To Server

Copy the whole project folder to the home server, for example:

```sh
scp -r /mnt/c/Users/reedc/onecall-locator-dashboard user@SERVER_IP:/opt/onecall-locator-dashboard
```

If copying from Windows PowerShell, use the Windows path:

```powershell
scp -r C:\Users\reedc\onecall-locator-dashboard user@SERVER_IP:/opt/onecall-locator-dashboard
```

## Run Manually

On the server:

```sh
cd /opt/onecall-locator-dashboard
python3 server.py --host 0.0.0.0 --port 8765
```

Open from any device on the same network:

```text
https://SERVER_IP:8765
```

If dashboard auth is enabled, sign in at:

```text
https://SERVER_IP:8765/login
```

## Run On Boot With systemd

On the server:

```sh
sudo cp /opt/onecall-locator-dashboard/deploy/onecall-dashboard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now onecall-dashboard
sudo systemctl status onecall-dashboard
```

## Data Locations

Portable ticket inbox:

```text
/opt/onecall-locator-dashboard/data/inbox
```

GeoCall printable page and polygon cache:

```text
/opt/onecall-locator-dashboard/data
```

Portable map layers:

```text
/opt/onecall-locator-dashboard/data/layers
```

Current staged layer files:

- `data/layers/vetro_clean_corrected_by_layer_5k_part01.kml` through `part08.kml`

## Updating Tickets

Export tickets from Outlook on the Windows desktop, then copy the resulting files into:

```text
/opt/onecall-locator-dashboard/data/inbox
```

The export helper can also push the files there directly from Windows if you have SSH access to the server:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\export_outlook_onecall.ps1 -DaysBack 4 -IncludeRead -SyncToServer
```

If Windows is running this WSL/Kali server locally, skip SSH and copy directly into the WSL server inbox:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\export_outlook_onecall.ps1 -DaysBack 4 -IncludeRead -SyncToLocalServer
```

The dashboard Refresh button now triggers that same Outlook export and local sync on the server, then reloads the ticket list after the update finishes.

GeoCall printable pages and polygons can be refreshed from a fresh logged-in DevTools `Copy as fetch` file:

```sh
cd /opt/onecall-locator-dashboard
python3 tools/fetch_geocall_details_from_fetch.py --fetch-file "/mnt/c/Users/reedc/OneDrive/Downloads/fetch(httpsgeocall.arkonecall.comge.txt"
```

The dashboard reads `.eml` and `.txt` files named like:

```text
Arkansas One Call Ticket 260501-0303.eml
Arkansas One Call Ticket 260501-0303.txt
```

Do not save Outlook, GeoCall, or Vetro cookies/session tokens in this project.
