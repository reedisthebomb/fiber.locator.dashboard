# One Call Locator Dashboard

Local and home-server dashboard for Arkansas One Call ticket work.

This project combines Outlook ticket exports, GeoCall printable pages and polygons, Vitruvi layers, and Vetro fiber layers into one operational map and ticket workflow.

## Documentation

- [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)
- [HANDOFF.md](HANDOFF.md)
- [deploy/HOME_SERVER.md](deploy/HOME_SERVER.md)

## What the project does

- imports Arkansas One Call ticket exports from Outlook
- shows ticket details and the exact work/location description
- maps ticket points and GeoCall dig polygons
- overlays Vitruvi utility layers
- overlays Vetro fiber layers with layer-level controls
- preserves hidden tickets, filters, and map state per logged-in user
- supports local, LAN, HTTPS, and Tailscale access

## Notes

Sensitive ticket data, session cookies, and auth tokens are intentionally not stored in GitHub.
