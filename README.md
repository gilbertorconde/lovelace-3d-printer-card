# Lovelace 3D Printer Card for Home Assistant

`lovelace-3d-printer-card` is a custom Lovelace card for monitoring and controlling **Moonraker/Klipper** 3D printers from Home Assistant. Single-file, zero dependencies, no build step.

Key features at a glance:

- **Animated SVG printer visualization** — i3, CoreXY, and Cantilever styles; printed object builds up layer by layer
- **Hotend glow effect** when above 100°C
- **Message banner** — displays Klipper error/status messages, tinted with the current state color
- **Live stats bar** — hotend temp, bed temp, extra heaters, speed factor, flow factor
- **Progress arc** with layer count and filament used
- **ETA and elapsed time** tiles
- **Filename tile** with automatic thumbnail preview (during active prints)
- **Print controls** — Pause / Resume / Cancel / Emergency Stop (double-tap required for E-Stop)
- **Auto-discovery** — all entities crawled from `base_entity` prefix; no manual entity config required
- **Tune sheet** — speed factor and flow factor sliders
- **Macros sheet** — all `button.<base>_macro_*` buttons, auto-discovered
- **Movement sheet** — XYZ position display, home buttons, jog grid, speed slider
- **Misc sheet** — settable heaters with temperature inputs, fan/output sliders
- **System sheet** (⋯ More) — firmware restart, host restart, server restart
- **Camera section** — auto-discovered, collapsible, live streaming via `<ha-camera-stream>`
- **Device author:** [gil](https://github.com/gilbertorconde) — 2026

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

1. Download `lovelace-3d-printer-card.js` from the [latest release](https://github.com/gilbertorconde/lovelace-3d-printer-card/releases/latest).
2. Copy it to `/config/www/lovelace-3d-printer-card/lovelace-3d-printer-card.js`.
3. Add the following under **Settings → Dashboards → Resources**:

```yaml
resources:
  - url: /local/lovelace-3d-printer-card/lovelace-3d-printer-card.js
    type: module
```

### Add the card to your dashboard

**Minimal config** — the card discovers all entities automatically:

```yaml
type: custom:lovelace-3d-printer-card
name: Gilbot Nova
base_entity: gilbot_nova
printer_type: i3
```

**With camera rotation:**

```yaml
type: custom:lovelace-3d-printer-card
name: Gilbot Nova
base_entity: gilbot_nova
printer_type: i3
cameras:
  - entity: camera.gilbot_nova_back
    rotate: 180
  - entity: camera.gilbot_nova_top
    rotate: 90
```

**With a smart plug power button:**

```yaml
type: custom:lovelace-3d-printer-card
name: Gilbot Nova
base_entity: gilbot_nova
power_switch: switch.printer_smart_plug
```

---

## Config Reference

| Key | Type | Required | Description |
|---|---|---|---|
| `base_entity` | string | **Yes** | Entity name prefix, e.g. `gilbot_nova` |
| `name` | string | No | Display name shown in the card header |
| `printer_type` | string | No | `i3` (default), `corexy`, or `cantilever` |
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
| Status | `current_print_state`, `printer_state` |
| Progress | `progress` |
| Duration | `print_duration` |
| ETA | `print_eta`, `print_time_left` |
| Filename | `filename` |
| Current layer | `current_layer` |
| Total layers | `total_layer` (with or without trailing `s`) |
| Filament used | `filament_used` |
| Message | `current_print_message`, `printer_message`, `current_display_message` |
| Hotend temp | `extruder_temperature`, `extruder_temp` |
| Bed temp | `bed_temperature`, `bed_temp` |
| Position X/Y/Z | `toolhead_position_x/y/z` |

When multiple entities match the same role (e.g. an alias sensor), the one with a valid (non-unknown/unavailable) state wins.

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
- **Thumbnail** — `camera.*_thumbnail` → file tile thumbnail image (only shown during active prints)
- **Live cameras** — all other `camera.*` entities → collapsible camera section

### Labels

Display labels always come from the entity's `friendly_name` attribute, with the device prefix (e.g. `"Gilbot Nova "`) and trailing `" Temperature"` / `" Temp"` stripped. The entity ID is only used as a fallback if `friendly_name` is absent.

---

## Sheets (bottom panels)

### Print Tuning
Opened via **Tune**. Speed factor and flow factor sliders. Hidden if neither entity is found.

### Macros
Opened via **Macros**. All `button.<base>_macro_*` entities, sorted alphabetically. Hidden if none found.

### Movement
Opened via **Move**. Shown when any home button or position sensor exists.
- **Position bar** — live X/Y/Z readout
- **Home buttons** — Home All / X / Y / Z (shown individually based on availability)
- **Jog grid** — X/Y cross grid and Z column with ±0.1/1/10/100 mm increments
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
| `corexy` | CoreXY — corner posts, top gantry, fixed bed |
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

## Requirements

- Home Assistant 2023.4 or newer
- Moonraker integration installed and printer entities exposed to HA
- No additional HACS frontend cards required
