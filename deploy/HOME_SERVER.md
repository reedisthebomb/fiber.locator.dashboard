# Home Server Deployment Notes

Home server:

```text
192.168.50.231
```

Service:

```text
onecall-dashboard
```

Service file:

```text
/etc/systemd/system/onecall-dashboard.service
```

Run command:

```text
/usr/bin/python3 /opt/onecall-locator-dashboard/server.py --host 0.0.0.0 --port 8765
```

Dashboard login:

```text
https://192.168.50.231:8765/login
```

Tailscale access is available through the configured tailnet URL on the home server.

## Refresh

The page refresh button runs the Outlook export plus server inbox sync, then reloads the dashboard state.

## Notes

The deployment keeps the dashboard private. Sensitive ticket exports, cookies, and auth tokens are not stored in this repo.
