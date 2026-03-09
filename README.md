# Lovelace 3D Printer Card for Home Assistant

`lovelace-3d-printer-card` is a custom Lovelace card for monitoring and controlling **Moonraker/Klipper** 3D printers from Home Assistant. Single-file, zero dependencies, no build step.

Key features at a glance:

- **Animated SVG printer visualization** — i3, CoreXY, CoreXY Flying Gantry, and Cantilever styles; printed object builds up layer by layer
- **Heater glow effect** — hotend, bed, and chamber glow in the SVG when a target temperature is set
- **Message banner** — displays Klipper error/status messages, tinted with the current state color
- **Live stats bar** — hotend temp, bed temp, extra heaters, speed factor, flow factor
- **Progress arc** with layer count and filament used
- **ETA and elapsed time** tiles
- **Filename tile** with automatic thumbnail preview when printing/paused (shown only after confirming the feed returns a valid image; falls back to file icon otherwise)
- **Print controls** — Pause / Resume / Cancel / Emergency Stop (double-tap required for E-Stop)
- **Auto-discovery** — all entities crawled from `base_entity` prefix; no manual entity config required
- **Macros sheet** — all `button.<base>_macro_*` buttons, auto-discovered
- **Movement sheet** — XYZ position display, home buttons, jog grid, speed slider
- **Misc sheet** — settable heaters with temperature inputs, fan/output sliders
- **System sheet** (⋯ More) — firmware restart, host restart, server restart
- **Camera section** — auto-discovered, collapsible, live streaming via `<ha-camera-stream>`
- **Device author:** [gil](https://github.com/gilbertorconde) — 2026

---

## Screenshots

| Main card (standby) | Main card (printing) |
|:---:|:---:|
| ![Card standby](screenshots/card-standby.png) | ![Card printing](screenshots/card-printing.png) |

| Temperatures & progress | Cameras expanded |
|:---:|:---:|
| ![Card temps](screenshots/card-temps.png) | ![Card cameras](screenshots/card-cameras.png) |

| Misc (temps & fans) |
|:---:|
| ![Misc sheet](screenshots/misc-temps-fans.png) |

| Macros |
|:---:|
| ![Macros sheet](screenshots/macros.png) |

| Printer types: i3 | Printer types: Cantilever |
|:---:|:---:|
| ![i3 style](screenshots/card-i3.png) | ![Cantilever style](screenshots/card-cantilever.png) |

| Printer types: CoreXY (printing) |
|:---:|
| ![CoreXY style](screenshots/card-corexy.png) |

---

## Installation

### Option A — HACS (recommended)

1. In Home Assistant, open **HACS → Frontend**.
2. Click the three-dot menu (⋮) in the top-right and choose **Custom repositories**.
3. Paste `https://github.com/gilbertorconde/lovelace-3d-printer-card` and select **Dashboard** as the category.
4. Click **Add**, then search for **Lovelace 3D Printer Card** and install it.
5. Reload your browser / clear the cache.

[![Add to HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=gilbertorconde&repository=lovelace-3d-printer-card&category=dashboard)

### Option B — Manual

1. Download `lovelace-3d-printer-card.js` and the `entities/` folder from the [latest release](https://github.com/gilbertorconde/lovelace-3d-printer-card/releases/latest).
2. Copy the card to `/config/www/lovelace-3d-printer-card/lovelace-3d-printer-card.js` and the `entities/` folder to `/config/www/lovelace-3d-printer-card/entities/`.
3. In **Settings → Dashboards → Resources**, add each file as a resource (type: **JavaScript Module**). Click **Add resource**, enter the URL, then add the next:
   - `/local/lovelace-3d-printer-card/lovelace-3d-printer-card.js` (the card)
   - `/local/lovelace-3d-printer-card/entities/en_generic.js`
   - `/local/lovelace-3d-printer-card/entities/de_generic.js`
   Add each entity mapping file you use; see the `entities/` folder for available options.

### Add the card to your dashboard

**Minimal config** — the card discovers all entities automatically:

```yaml
type: custom:lovelace-3d-printer-card
name: Voron 2.4
base_entity: voron_24
printer_type: i3
```

**With camera rotation:**

```yaml
type: custom:lovelace-3d-printer-card
name: Voron 2.4
base_entity: voron_24
printer_type: i3
cameras:
  - entity: camera.voron_24_back
    rotate: 180
  - entity: camera.voron_24_top
    rotate: 90
```

**With entity mappings (e.g. German UI):**

```yaml
type: custom:lovelace-3d-printer-card
name: Voron 2.4
base_entity: voron_24
entity_mappings: de_generic
```

**Check the `entities/` folder** in the repo to see which mapping files are available (e.g. `en_generic.js`, `de_generic.js`). Use the filename without `.js` as the value.

**With a smart plug power button:**

```yaml
type: custom:lovelace-3d-printer-card
name: Voron 2.4
base_entity: voron_24
power_switch: switch.printer_smart_plug
```

---

## Config Reference

| Key | Type | Required | Description |
|---|---|---|---|
| `base_entity` | string | **Yes** | Entity name prefix, e.g. `voron_24` |
| `name` | string | No | Display name shown in the card header |
| `printer_type` | string | No | `i3` (default), `corexy`, `corexy-flying-gantry`, or `cantilever` |
| `entity_mappings` | string | No | Entity mapping + UI locale. **Check the `entities/` folder** for available options (e.g. `en_generic`, `de_generic`). Default: `{hass.locale}_generic` or `en_generic` |
| `cameras` | list | No | Array of `{ entity, rotate }` for rotation overrides only |
| `power_switch` | string | No | Switch entity ID for the printer's smart plug — adds a power button to the header |

---

## How Auto-Discovery Works

On every update the card performs a single pass over `hass.states`, visiting every entity whose ID contains `base_entity`. Each entity is classified by domain and name suffix.

### Hidden entities

Any entity with `attributes.hidden === true` is skipped entirely. This filters out service-management buttons (stop/start/restart klipper, moonraker, crowsnest, etc.) that Moonraker marks hidden in the HA registry.

### Well-known roles — sensor

| Role | Matched suffix(es) |
|---|---|
| Status | `current_print_state` (values: `standby`, `printing`, `paused`, `complete`, `cancelled`, `error`) |
| Printer state | `printer_state` (values: `ready`, `startup`, `shutdown`, `error`) — combined with status for display; `error`/`shutdown`/`startup` take precedence |
| Progress | `progress` |
| Duration | `print_duration` (Moonraker: unit `min`) |
| ETA | `print_time_left` (preferred, unit `h`), `print_eta` (fallback, ISO timestamp) |
| Filename | `filename` |
| Current layer | `current_layer` |
| Total layers | `total_layer` (with or without trailing `s`) |
| Filament used | `filament_used` |
| Message | `current_print_message`, `current_display_message` (combined; banner hidden if both empty) |
| Hotend temp | `extruder_temperature`, `extruder_temp` |
| Bed temp | `bed_temperature`, `bed_temp` |
| Position X/Y/Z | `toolhead_position_x/y/z` |

When multiple entities match the same role (e.g. an alias sensor), the one with a valid (non-unknown/unavailable) state wins. For ETA, `print_time_left` is preferred over `print_eta` (time remaining vs. finish timestamp).

The card converts Moonraker units automatically: `print_duration` (min) and `print_time_left` (h) are converted to seconds for display.

### Well-known roles — number

| Role | Matched suffix |
|---|---|
| Hotend target | `extruder_target` |
| Bed target | `bed_target` |
| Speed factor | `speed_factor` |
| Flow factor | `flow_factor` |

### Well-known roles — button

| Role | Matched suffix |
|---|---|
| Cancel | `cancel_print` |
| Pause | `pause_print` |
| Resume | `resume_print` |
| Emergency stop | `emergency_stop` |
| Home All | `home_all_axes` |
| Home X/Y/Z | `home_x_axis`, `home_y_axis`, `home_z_axis` |
| Firmware restart | `firmware_restart` |
| Host restart | `host_restart` |
| Server restart | `server_restart` |

### Dynamic classification

- **Macros** — `button.*_macro_*` → Macros sheet
- **Temperature sensors** — `sensor.*` with unit `°C`/`°F`, not matched to a well-known role → paired with a `number.*_target` entity → Misc sheet as settable heater. Sensors with no matching target are read-only.
- **Fans/outputs** — `number.*` matching `fan|filter|exhaust|output_pin`, not already claimed → Misc sheet as sliders
- **Thumbnail** — `camera.*_thumbnail` → file tile thumbnail image (shown when state is `printing` or `paused`, only after the URL returns a valid image; falls back to file icon if the feed is empty or fails)
- **Live cameras** — all other `camera.*` entities → collapsible camera section

### Labels

Display labels always come from the entity's `friendly_name` attribute, with the device prefix (e.g. `"Voron 2.4 "`) and trailing `" Temperature"` / `" Temp"` stripped. The entity ID is only used as a fallback if `friendly_name` is absent.

---

## Sheets (bottom panels)

### Macros
Opened via **Macros**. All `button.<base>_macro_*` entities, sorted alphabetically. Hidden if none found.

### Movement
Opened via **Move**. Shown when any home button or position sensor exists.
- **Position bar** — live X/Y/Z readout
- **Home buttons** — Home All / X / Y / Z (shown individually based on availability)
- **Jog grid** — X/Y cross grid and Z column with ±0.1/1/10/100 mm increments (disabled while printing)
- **Speed slider** — speed factor entity

Jog moves are sent via `moonraker.send_gcode` or `klipper.send_gcode` (G91 relative move, then G90). Falls back to `script.<base>_jog` with `{ axis, distance }` variables.

### Misc
Opened via **Misc**. Shows hotend, bed, and any extra discovered heaters with editable temperature inputs, plus fan/output sliders. Hidden if no heaters or fans are found.

### System (⋯ More)
Opened via **More**. Only shown when any system restart entities are discovered. Grouped into three sections matching Mainsail's power panel:
- **Klipper Control** — Restart Klipper, Firmware Restart
- **Service Control** — auto-discovered `button.*_restart_*` entities (KlipperScreen, Moonraker, Crowsnest, Mobileraker, etc.)
- **Host Control** — Server Restart, Reboot Host, Shutdown Host (danger-styled)

---

## Printer Types

| Value | Description |
|---|---|
| `i3` | Prusa i3 / Cartesian — two Z rods, X gantry, moving bed |
| `corexy` | CoreXY — gantry fixed at top, bed moves down with object |
| `corexy-flying-gantry` | CoreXY Voron 2.4 — flying gantry moves up with object, fixed bed |
| `cantilever` | Cantilever (Ender-style) — single upright, cantilevered X arm |

---

## Cameras

Cameras are fully auto-discovered from `camera.*<base>*` entities (the thumbnail camera is excluded). The section collapses to zero height when closed. Streams use HA's native `<ha-camera-stream>` element (MJPEG, HLS, WebRTC).

The `cameras:` config array is only needed to specify rotation angles. Unspecified cameras default to `rotate: 0`.

```yaml
cameras:
  - entity: camera.printer_back
    rotate: 180    # flip upside down
  - entity: camera.printer_top
    rotate: 90     # rotate 90° clockwise
```

| Value | Result |
|---|---|
| `0` | No rotation (default) |
| `90` | Rotate 90° clockwise |
| `180` | Flip upside down |
| `270` | Rotate 90° counter-clockwise |

---

## Contributing — Entity Mappings

The card relies on entity mapping files to discover printer entities and translate UI strings. If your printer or language is not supported, the card may show no data. **We welcome contributions.**

### Available options

**Always check the `entities/` folder** in the repo to see which mapping files are available. Currently included:

- `en_generic.js` — Moonraker/Klipper, English (default)
- `de_generic.js` — Moonraker/Klipper, German (includes `verbleibende_zeit` for ETA)

### How to contribute

1. Add a new JS module in `entities/` following the naming `{language}_{printer}.js`. Examples of files you could add:
   - `en_bambu_p2p.js` — Bambu P2P/P2S, English
   - `de_bambu_p2p.js` — Bambu P2P/P2S, German
   - `de_voron_24.js` — Voron 2.4, German

2. Copy `en_generic.js` as a starting point (use `export default { ... }`), then add or adjust the suffixes for your integration's entity IDs (e.g. BambuLab uses `verbleibende_zeit` for ETA in German).

3. Add UI translations in the `"ui"` object for buttons, labels, and section headers (e.g. "Pause", "Macros", "Temperatures"). Entity-derived labels use HA `friendly_name` and need no translation.

4. Submit a PR with the new file and a short note in the PR description.

---

## Requirements

- Home Assistant 2023.4 or newer
- Moonraker integration installed and printer entities exposed to HA
- No additional HACS frontend cards required
