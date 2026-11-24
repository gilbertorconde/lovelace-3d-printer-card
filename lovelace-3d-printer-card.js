// =============================================================================
// Lovelace 3D Printer Card  v3.1.0
// Dark, app-style card for Moonraker/Klipper printers (and others whose
// entities follow the same naming), with live printer drawing and cameras.
//
//   type: custom:lovelace-3d-printer-card
//   name: Voron 2.4
//   base_entity: voron
//   printer_type: corexy-flying-gantry   # i3 | corexy | corexy-flying-gantry | cantilever | delta
//   power_switch: switch.voron           # optional smart plug
//   variant: compact                     # optional: glance card + Full controls dialog
//
// Entities are discovered from base_entity; see README for the roles.
// =============================================================================

const CARD_TAG = 'lovelace-3d-printer-card';
const CARD_VERSION = '3.1.0';

// ── Default entity mappings (fallback when the mapping file can't load) ──────
const DEFAULT_MAPPINGS = {
  sensor: [
    ['status', ['current_print_state']],
    ['printer_state', ['printer_state']],
    ['progress', ['progress']],
    ['duration', ['print_duration']],
    ['eta', ['print_time_left', 'print_eta']],
    ['filename', ['filename']],
    ['current_layer', ['current_layer']],
    ['total_layers', ['total_layer', 'total_layers']],
    ['filament_used', ['filament_used']],
    ['current_print_message', ['current_print_message']],
    ['current_display_message', ['current_display_message']],
    ['hotend', ['extruder_temperature', 'extruder_temp']],
    ['bed', ['bed_temperature', 'bed_temp']],
    ['position_x', ['toolhead_position_x']],
    ['position_y', ['toolhead_position_y']],
    ['position_z', ['toolhead_position_z']],
    ['object_height', ['object_height']],
  ],
  number: [
    ['hotend_target', ['extruder_target']],
    ['bed_target', ['bed_target']],
    ['chamber_target', ['heater_chamber_target']],
    ['speed_factor', ['speed_factor']],
    ['flow_factor', ['flow_factor']],
  ],
  button: [
    ['cancel', ['cancel_print']],
    ['pause', ['pause_print']],
    ['resume', ['resume_print']],
    ['emergency', ['emergency_stop']],
    ['home_all', ['home_all_axes']],
    ['home_x', ['home_x_axis']],
    ['home_y', ['home_y_axis']],
    ['home_z', ['home_z_axis']],
    ['fw_restart', ['firmware_restart']],
    ['host_restart', ['host_restart']],
    ['server_restart', ['server_restart']],
    ['host_shutdown', ['host_shutdown']],
    ['klipper_restart', ['restart_klipper']],
  ],
  camera: [['thumbnail', ['thumbnail']]],
};

// ── Built-in mapping for Home Assistant's OctoPrint integration ─────────────
// Shipped inside the card so single-file (HACS) installs work too. Used when
// entity_mappings is 'octoprint', or auto-detected from <base>_current_state
// plus <base>_actual_tool0_temp. Number entity IDs follow the HA language
// (English: bed_temperature / extruder_temperature, German: bett_temperatur /
// extruder_temperatur), so both are listed.
const OCTOPRINT_MAPPINGS = {
  sensor: [
    ['status', ['current_state']],
    ['progress', ['job_percentage']],
    ['eta', ['estimated_finish_time']],
    ['filename', ['current_file']],
    ['hotend', ['actual_tool0_temp']],
    ['bed', ['actual_bed_temp']],
  ],
  number: [
    ['hotend_target', ['extruder_temperature', 'extruder_temperatur']],
    ['bed_target', ['bed_temperature', 'bett_temperatur']],
    ['speed_factor', ['speed_factor']],
    ['flow_factor', ['flow_factor']],
  ],
  // emergency_stop, home_* and the factors aren't part of the OctoPrint
  // integration; they match helper entities a user can add (README).
  button: [
    ['emergency', ['emergency_stop']],
    ['home_all', ['home_all_axes']],
    ['home_x', ['home_x_axis']],
    ['home_y', ['home_y_axis']],
    ['home_z', ['home_z_axis']],
    ['cancel', ['stop_job']],
    ['pause', ['pause_job']],
    ['resume', ['resume_job']],
    ['server_restart', ['restart_octoprint']],
    ['host_restart', ['reboot_system']],
    ['host_shutdown', ['shutdown_system']],
  ],
  camera: [],
  // Regexes on the entity suffix: read-only targets duplicate the settable
  // number entities; the file size is not a temperature.
  ignore: ['^target_', '_file_size$'],
  // Extra temperature sensors the printer doesn't report show as unavailable.
  hide_unavailable: true,
  // OctoPrint state text (lower-cased) → the card's states.
  status_map: {
    operational: 'ready',
    'printing from sd': 'printing',
    'sending file to sd': 'printing',
    starting: 'printing',
    finishing: 'printing',
    cancelling: 'printing',
    pausing: 'paused',
    resuming: 'printing',
    'offline after error': 'error',
    'opening serial connection': 'startup',
    connecting: 'startup',
    'detecting serial connection': 'startup',
    'detecting baudrate': 'startup',
    closed: 'offline',
    'closed with error': 'error',
  },
  // Friendly names look like "<device> OctoPrint actual A temp".
  label_strip: ['^.*?octoprint\\s+', '^actual\\s+'],
  ui: {
    server_restart: 'Restart OctoPrint',
    st_ready: 'Ready',
  },
};

// UI strings. A mapping file's `ui` block overrides these; missing keys fall back here.
const DEFAULT_UI = {
  eta: 'ETA',
  both: 'Both',
  elapsed: 'Elapsed',
  file: 'File',
  progress: 'Progress',
  hotend: 'Hotend',
  bed: 'Bed',
  speed: 'Speed',
  flow: 'Flow',
  pause: 'Pause',
  resume: 'Resume',
  cancel: 'Cancel',
  macros: 'Macros',
  move: 'Move',
  misc: 'Misc',
  more: 'More',
  movement: 'Movement',
  system: 'System',
  temperatures: 'Temperatures',
  fans_outputs: 'Fans & Outputs',
  klipper_control: 'Klipper Control',
  service_control: 'Service Control',
  host_control: 'Host Control',
  restart_klipper: 'Restart Klipper',
  firmware_restart: 'Firmware Restart',
  server_restart: 'Server Restart',
  host_restart: 'Host Restart',
  host_shutdown: 'Host Shutdown',
  reboot_host: 'Reboot Host',
  shutdown_host: 'Shutdown Host',
  cameras: 'Cameras',
  camera_fallback: 'Camera',
  home_all: 'All',
  // 3.0
  printer: 'Printer',
  tune: 'Tune',
  left: 'Left',
  done_at: 'Done at',
  layer: 'Layer',
  filament_used: 'filament used',
  tap_heater: 'Tap a heater to set it',
  drag_to_change: 'Drag to change',
  target: 'target',
  off: 'Off',
  turn_on: 'Turn on',
  powered_off: 'Powered off',
  plug_off: 'The smart plug is off.',
  offline: 'Not reachable',
  offline_msg: "The printer isn't reachable. Controls come back when it reconnects.",
  prints: 'Prints',
  print_time: 'Print time',
  filament: 'Filament',
  full_controls: 'Full controls',
  tap_again: 'Tap again',
  estop: 'Emergency stop (tap twice)',
  estop_armed: 'Tap again to stop the printer now',
  step: 'Step',
  home: 'Home',
  st_printing: 'Printing',
  st_paused: 'Paused',
  st_standby: 'Standby',
  st_ready: 'Ready',
  st_idle: 'Idle',
  st_complete: 'Complete',
  st_cancelled: 'Cancelled',
  st_error: 'Error',
  st_shutdown: 'Shutdown',
  st_startup: 'Starting',
  st_off: 'Off',
  st_offline: 'Offline',
};

// Material Design Icons paths (@mdi/js 7.4.47), inlined so the card needs no icon font.
const ICONS = {
  'view-split': 'M4,3H20A1,1 0 0,1 21,4V10A1,1 0 0,1 20,11H4A1,1 0 0,1 3,10V4A1,1 0 0,1 4,3M4,13H20A1,1 0 0,1 21,14V20A1,1 0 0,1 20,21H4A1,1 0 0,1 3,20V14A1,1 0 0,1 4,13Z',
  'printer3d-nozzle': 'M7,2H17V8H19V13H16.5L13,17H11L7.5,13H5V8H7V2M10,22H2V20H10A1,1 0 0,0 11,19V18H13V19A3,3 0 0,1 10,22Z',
  'printer3d': 'M19,6A1,1 0 0,0 20,5A1,1 0 0,0 19,4A1,1 0 0,0 18,5A1,1 0 0,0 19,6M19,2A3,3 0 0,1 22,5V11H18V7H6V11H2V5A3,3 0 0,1 5,2H19M18,18.25C18,18.63 17.79,18.96 17.47,19.13L12.57,21.82C12.4,21.94 12.21,22 12,22C11.79,22 11.59,21.94 11.43,21.82L6.53,19.13C6.21,18.96 6,18.63 6,18.25V13C6,12.62 6.21,12.29 6.53,12.12L11.43,9.68C11.59,9.56 11.79,9.5 12,9.5C12.21,9.5 12.4,9.56 12.57,9.68L17.47,12.12C17.79,12.29 18,12.62 18,13V18.25M12,11.65L9.04,13L12,14.6L14.96,13L12,11.65M8,17.66L11,19.29V16.33L8,14.71V17.66M16,17.66V14.71L13,16.33V19.29L16,17.66Z',
  'power': 'M16.56,5.44L15.11,6.89C16.84,7.94 18,9.83 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12C6,9.83 7.16,7.94 8.88,6.88L7.44,5.44C5.36,6.88 4,9.28 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,9.28 18.64,6.88 16.56,5.44M13,3H11V13H13',
  'close': 'M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z',
  'alert-octagon-outline': 'M8.27,3L3,8.27V15.73L8.27,21H15.73C17.5,19.24 21,15.73 21,15.73V8.27L15.73,3M9.1,5H14.9L19,9.1V14.9L14.9,19H9.1L5,14.9V9.1M11,15H13V17H11V15M11,7H13V13H11V7',
  'pause': 'M14,19H18V5H14M6,19H10V5H6V19Z',
  'play': 'M8,5.14V19.14L19,12.14L8,5.14Z',
  'stop': 'M18,18H6V6H18V18Z',
  'cube-outline': 'M21,16.5C21,16.88 20.79,17.21 20.47,17.38L12.57,21.82C12.41,21.94 12.21,22 12,22C11.79,22 11.59,21.94 11.43,21.82L3.53,17.38C3.21,17.21 3,16.88 3,16.5V7.5C3,7.12 3.21,6.79 3.53,6.62L11.43,2.18C11.59,2.06 11.79,2 12,2C12.21,2 12.41,2.06 12.57,2.18L20.47,6.62C20.79,6.79 21,7.12 21,7.5V16.5M12,4.15L6.04,7.5L12,10.85L17.96,7.5L12,4.15M5,15.91L11,19.29V12.58L5,9.21V15.91M19,15.91V9.21L13,12.58V19.29L19,15.91Z',
  'cctv': 'M6.03 12.03L8.03 15.5L5.5 18.68L2 12.62L6.03 12.03M17 18V15.29C17.88 14.9 18.5 14.03 18.5 13C18.5 12.43 18.3 11.9 17.97 11.5L19.94 10.35C20.95 9.76 21.3 8.47 20.71 7.46L19.33 5.06C18.74 4.05 17.45 3.7 16.44 4.28L8.31 9C7.36 9.53 7.03 10.75 7.58 11.71L9.08 14.31C9.63 15.26 10.86 15.59 11.81 15.04L13.69 13.96C13.94 14.55 14.41 15.03 15 15.29V18C15 19.1 15.9 20 17 20H22V18H17Z',
  'printer3d-nozzle-heat': 'M4 2H14V7H16V13H13.5L10 17H8L4.5 13H2V7H4V2M23 14.5L21.6 16.7L23 18.9L21 22L19.2 21.1L20.7 18.9L19.2 16.7L21.2 13.6L23 14.5M18.7 14.5L17.2 16.7L18.7 18.9L16.7 22L14.9 21.1L16.3 18.9L14.9 16.7L16.9 13.6L18.7 14.5',
  'radiator': 'M7.95,3L6.53,5.19L7.95,7.4H7.94L5.95,10.5L4.22,9.6L5.64,7.39L4.22,5.19L6.22,2.09L7.95,3M13.95,2.89L12.53,5.1L13.95,7.3L13.94,7.31L11.95,10.4L10.22,9.5L11.64,7.3L10.22,5.1L12.22,2L13.95,2.89M20,2.89L18.56,5.1L20,7.3V7.31L18,10.4L16.25,9.5L17.67,7.3L16.25,5.1L18.25,2L20,2.89M2,22V14A2,2 0 0,1 4,12H20A2,2 0 0,1 22,14V22H20V20H4V22H2M6,14A1,1 0 0,0 5,15V17A1,1 0 0,0 6,18A1,1 0 0,0 7,17V15A1,1 0 0,0 6,14M10,14A1,1 0 0,0 9,15V17A1,1 0 0,0 10,18A1,1 0 0,0 11,17V15A1,1 0 0,0 10,14M14,14A1,1 0 0,0 13,15V17A1,1 0 0,0 14,18A1,1 0 0,0 15,17V15A1,1 0 0,0 14,14M18,14A1,1 0 0,0 17,15V17A1,1 0 0,0 18,18A1,1 0 0,0 19,17V15A1,1 0 0,0 18,14Z',
  'heat-wave': 'M8.5 4.5L5.4 9.5L8.5 14.7L5.2 20.5L3.4 19.6L6.1 14.7L3 9.5L6.7 3.6L8.5 4.5M14.7 4.4L11.6 9.5L14.7 14.5L11.4 20.3L9.6 19.4L12.3 14.5L9.2 9.5L12.9 3.5L14.7 4.4M21 4.4L17.9 9.5L21 14.5L17.7 20.3L15.9 19.4L18.6 14.5L15.5 9.5L19.2 3.5L21 4.4',
  'thermometer': 'M15 13V5A3 3 0 0 0 9 5V13A5 5 0 1 0 15 13M12 4A1 1 0 0 1 13 5V8H11V5A1 1 0 0 1 12 4Z',
  'chip': 'M6,4H18V5H21V7H18V9H21V11H18V13H21V15H18V17H21V19H18V20H6V19H3V17H6V15H3V13H6V11H3V9H6V7H3V5H6V4M11,15V18H12V15H11M13,15V18H14V15H13M15,15V18H16V15H15Z',
  'tune-vertical': 'M7 3H5V9H7V3M19 3H17V13H19V3M3 13H5V21H7V13H9V11H3V13M15 7H13V3H11V7H9V9H15V7M11 21H13V11H11V21M15 15V17H17V21H19V17H21V15H15Z',
  'axis-arrow': 'M12,2L16,6H13V13.85L19.53,17.61L21,15.03L22.5,20.5L17,21.96L18.53,19.35L12,15.58L5.47,19.35L7,21.96L1.5,20.5L3,15.03L4.47,17.61L11,13.85V6H8L12,2Z',
  'code-braces': 'M8,3A2,2 0 0,0 6,5V9A2,2 0 0,1 4,11H3V13H4A2,2 0 0,1 6,15V19A2,2 0 0,0 8,21H10V19H8V14A2,2 0 0,0 6,12A2,2 0 0,0 8,10V5H10V3M16,3A2,2 0 0,1 18,5V9A2,2 0 0,0 20,11H21V13H20A2,2 0 0,0 18,15V19A2,2 0 0,1 16,21H14V19H16V14A2,2 0 0,1 18,12A2,2 0 0,1 16,10V5H14V3H16Z',
  'cog-outline': 'M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10M10,22C9.75,22 9.54,21.82 9.5,21.58L9.13,18.93C8.5,18.68 7.96,18.34 7.44,17.94L4.95,18.95C4.73,19.03 4.46,18.95 4.34,18.73L2.34,15.27C2.21,15.05 2.27,14.78 2.46,14.63L4.57,12.97L4.5,12L4.57,11L2.46,9.37C2.27,9.22 2.21,8.95 2.34,8.73L4.34,5.27C4.46,5.05 4.73,4.96 4.95,5.05L7.44,6.05C7.96,5.66 8.5,5.32 9.13,5.07L9.5,2.42C9.54,2.18 9.75,2 10,2H14C14.25,2 14.46,2.18 14.5,2.42L14.87,5.07C15.5,5.32 16.04,5.66 16.56,6.05L19.05,5.05C19.27,4.96 19.54,5.05 19.66,5.27L21.66,8.73C21.79,8.95 21.73,9.22 21.54,9.37L19.43,11L19.5,12L19.43,13L21.54,14.63C21.73,14.78 21.79,15.05 21.66,15.27L19.66,18.73C19.54,18.95 19.27,19.04 19.05,18.95L16.56,17.95C16.04,18.34 15.5,18.68 14.87,18.93L14.5,21.58C14.46,21.82 14.25,22 14,22H10M11.25,4L10.88,6.61C9.68,6.86 8.62,7.5 7.85,8.39L5.44,7.35L4.69,8.65L6.8,10.2C6.4,11.37 6.4,12.64 6.8,13.8L4.68,15.36L5.43,16.66L7.86,15.62C8.63,16.5 9.68,17.14 10.87,17.38L11.24,20H12.76L13.13,17.39C14.32,17.14 15.37,16.5 16.14,15.62L18.57,16.66L19.32,15.36L17.2,13.81C17.6,12.64 17.6,11.37 17.2,10.2L19.31,8.65L18.56,7.35L16.15,8.39C15.38,7.5 14.32,6.86 13.12,6.62L12.75,4H11.25Z',
  'chevron-down': 'M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z',
  'chevron-right': 'M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z',
  'arrow-up': 'M13,20H11V8L5.5,13.5L4.08,12.08L12,4.16L19.92,12.08L18.5,13.5L13,8V20Z',
  'arrow-down': 'M11,4H13V16L18.5,10.5L19.92,11.92L12,19.84L4.08,11.92L5.5,10.5L11,16V4Z',
  'arrow-left': 'M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z',
  'arrow-right': 'M4,11V13H16L10.5,18.5L11.92,19.92L19.84,12L11.92,4.08L10.5,5.5L16,11H4Z',
  'home': 'M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z',
  'restart': 'M12,4C14.1,4 16.1,4.8 17.6,6.3C20.7,9.4 20.7,14.5 17.6,17.6C15.8,19.5 13.3,20.2 10.9,19.9L11.4,17.9C13.1,18.1 14.9,17.5 16.2,16.2C18.5,13.9 18.5,10.1 16.2,7.7C15.1,6.6 13.5,6 12,6V10.6L7,5.6L12,0.6V4M6.3,17.6C3.7,15 3.3,11 5.1,7.9L6.6,9.4C5.5,11.6 5.9,14.4 7.8,16.2C8.3,16.7 8.9,17.1 9.6,17.4L9,19.4C8,19 7.1,18.4 6.3,17.6Z',
  'information-outline': 'M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z',
  'alert-outline': 'M12,2L1,21H23M12,6L19.53,19H4.47M11,10V14H13V10M11,16V18H13V16',
  'file-outline': 'M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z',
  'minus': 'M19,13H5V11H19V13Z',
  'plus': 'M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z',
  'fan': 'M12,11A1,1 0 0,0 11,12A1,1 0 0,0 12,13A1,1 0 0,0 13,12A1,1 0 0,0 12,11M12.5,2C17,2 17.11,5.57 14.75,6.75C13.76,7.24 13.32,8.29 13.13,9.22C13.61,9.42 14.03,9.73 14.35,10.13C18.05,8.13 22.03,8.92 22.03,12.5C22.03,17 18.46,17.1 17.28,14.73C16.78,13.74 15.72,13.3 14.79,13.11C14.59,13.59 14.28,14 13.88,14.34C15.87,18.03 15.08,22 11.5,22C7,22 6.91,18.42 9.27,17.24C10.25,16.75 10.69,15.71 10.89,14.79C10.4,14.59 9.97,14.27 9.65,13.87C5.96,15.85 2,15.07 2,11.5C2,7 5.56,6.89 6.74,9.26C7.24,10.25 8.29,10.68 9.22,10.87C9.41,10.39 9.73,9.97 10.14,9.65C8.15,5.96 8.94,2 12.5,2Z',
  'lightbulb-outline': 'M12,2A7,7 0 0,1 19,9C19,11.38 17.81,13.47 16,14.74V17A1,1 0 0,1 15,18H9A1,1 0 0,1 8,17V14.74C6.19,13.47 5,11.38 5,9A7,7 0 0,1 12,2M9,21V20H15V21A1,1 0 0,1 14,22H10A1,1 0 0,1 9,21M12,4A5,5 0 0,0 7,9C7,11.05 8.23,12.81 10,13.58V16H14V13.58C15.77,12.81 17,11.05 17,9A5,5 0 0,0 12,4Z',
  'cloud-off-outline': 'M19.8 22.6L17.15 20H6.5Q4.2 20 2.6 18.4T1 14.5Q1 12.58 2.19 11.08 3.38 9.57 5.25 9.15 5.33 8.95 5.4 8.76 5.5 8.57 5.55 8.35L1.4 4.2L2.8 2.8L21.2 21.2M6.5 18H15.15L7.1 9.95Q7.05 10.23 7.03 10.5 7 10.73 7 11H6.5Q5.05 11 4.03 12.03 3 13.05 3 14.5 3 15.95 4.03 17 5.05 18 6.5 18M11.13 14M21.6 18.75L20.15 17.35Q20.58 17 20.79 16.54 21 16.08 21 15.5 21 14.45 20.27 13.73 19.55 13 18.5 13H17V11Q17 8.93 15.54 7.46 14.08 6 12 6 11.33 6 10.7 6.16 10.07 6.33 9.5 6.68L8.05 5.23Q8.93 4.63 9.91 4.31 10.9 4 12 4 14.93 4 16.96 6.04 19 8.07 19 11 20.73 11.2 21.86 12.5 23 13.78 23 15.5 23 16.5 22.63 17.31 22.25 18.15 21.6 18.75M14.83 12.03Z',
  'power-plug-off-outline': 'M22.11 21.46L2.39 1.73L1.11 3L6.25 8.14C6.1 8.41 6 8.7 6 9V14.5L9.5 18V21H14.5V18L15.31 17.2L20.84 22.73L22.11 21.46M13.09 16.59L12.67 17H11.33L10.92 16.59L8 13.67V9.89L13.89 15.78L13.09 16.59M12.2 9L10.2 7H14V3H16V7C17 7 18 8 18 9V14.5L17.85 14.65L16 12.8V9.09C16 9.06 15.95 9 15.92 9H12.2M10 6.8L8 4.8V3H10V6.8Z',
  'speedometer': 'M12,16A3,3 0 0,1 9,13C9,11.88 9.61,10.9 10.5,10.39L20.21,4.77L14.68,14.35C14.18,15.33 13.17,16 12,16M12,3C13.81,3 15.5,3.5 16.97,4.32L14.87,5.53C14,5.19 13,5 12,5A8,8 0 0,0 4,13C4,15.21 4.89,17.21 6.34,18.65H6.35C6.74,19.04 6.74,19.67 6.35,20.06C5.96,20.45 5.32,20.45 4.93,20.07V20.07C3.12,18.26 2,15.76 2,13A10,10 0 0,1 12,3M22,13C22,15.76 20.88,18.26 19.07,20.07V20.07C18.68,20.45 18.05,20.45 17.66,20.06C17.27,19.67 17.27,19.04 17.66,18.65V18.65C19.11,17.2 20,15.21 20,13C20,12 19.81,11 19.46,10.1L20.67,8C21.5,9.5 22,11.18 22,13Z',
  'waves': 'M20,12H22V14H20C18.62,14 17.26,13.65 16,13C13.5,14.3 10.5,14.3 8,13C6.74,13.65 5.37,14 4,14H2V12H4C5.39,12 6.78,11.53 8,10.67C10.44,12.38 13.56,12.38 16,10.67C17.22,11.53 18.61,12 20,12M20,6H22V8H20C18.62,8 17.26,7.65 16,7C13.5,8.3 10.5,8.3 8,7C6.74,7.65 5.37,8 4,8H2V6H4C5.39,6 6.78,5.53 8,4.67C10.44,6.38 13.56,6.38 16,4.67C17.22,5.53 18.61,6 20,6M20,18H22V20H20C18.62,20 17.26,19.65 16,19C13.5,20.3 10.5,20.3 8,19C6.74,19.65 5.37,20 4,20H2V18H4C5.39,18 6.78,17.53 8,16.67C10.44,18.38 13.56,18.38 16,16.67C17.22,17.53 18.61,18 20,18Z',
  'layers-outline': 'M12,18.54L19.37,12.8L21,14.07L12,21.07L3,14.07L4.62,12.81L12,18.54M12,16L3,9L12,2L21,9L12,16M12,4.53L6.26,9L12,13.47L17.74,9L12,4.53Z',
  'clock-outline': 'M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z',
};

function ico(name, size = 18) {
  const d = ICONS[name];
  return d ? `<svg class="i" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${d}"/></svg>` : '';
}

// ── State colours ─────────────────────────────────────────────────────────────
const STATE_COLORS = {
  printing: '#4ade80', resuming: '#4ade80', complete: '#4ade80',
  paused: '#ffb347', pausing: '#ffb347',
  standby: '#8aa2ff', ready: '#8aa2ff', idle: '#8aa2ff', startup: '#8aa2ff', loading: '#8aa2ff',
  error: '#ff5c6c', cancelled: '#ff5c6c', shutdown: '#ff5c6c',
  off: '#8b93a3', offline: '#8b93a3', unknown: '#8b93a3',
};

function stateColor(status) {
  const s = (status || 'idle').toLowerCase();
  if (STATE_COLORS[s]) return STATE_COLORS[s];
  for (const [key, color] of Object.entries(STATE_COLORS)) if (s.includes(key)) return color;
  return STATE_COLORS.idle;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function fmtSeconds(secs) {
  if (secs == null || isNaN(secs) || secs < 0) return null;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

// Parse duration strings from Moonraker: "21m 10s", "2h 10m", "2h 30m 45s", "18s", "In 2 hours"
function parseDurationToSeconds(v) {
  if (v == null) return null;
  const s = String(v).trim();
  const n = parseFloat(s);
  if (!isNaN(n) && s === String(n)) return n;
  let total = 0;
  const h = s.match(/(\d+)\s*h(?:ours?)?/i);
  const m = s.match(/(\d+)\s*m(?:in(?:utes?)?)?(?!\s*s)/i) || s.match(/(\d+)\s*min/i);
  const sec = s.match(/(\d+)\s*s(?:ec(?:onds?)?)?/i) || s.match(/(\d+)\s*sec/i);
  if (h) total += parseInt(h[1], 10) * 3600;
  if (m) total += parseInt(m[1], 10) * 60;
  if (sec) total += parseInt(sec[1], 10);
  if (total > 0) return total;
  if (!isNaN(n) && n > 0) return n;
  return null;
}

/** Finish clock time, following HA's language and 12/24-hour setting. */
function fmtClock(remainingSecs, locale) {
  if (!remainingSecs || isNaN(remainingSecs)) return null;
  const tf = locale?.time_format;
  const opts = { hour: 'numeric', minute: '2-digit' };
  if (tf === '12' || tf === '24') opts.hour12 = tf === '12';
  const lang = tf === 'system' ? undefined : (locale?.language || undefined);
  return new Date(Date.now() + remainingSecs * 1000).toLocaleTimeString(lang, opts);
}

function stVal(hass, entityId) {
  const st = hass?.states?.[entityId];
  if (!st || st.state === 'unknown' || st.state === 'unavailable') return null;
  return st.state;
}

function numVal(hass, entityId) {
  const v = stVal(hass, entityId);
  if (v === null) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function attrVal(hass, entityId, attr) {
  return hass?.states?.[entityId]?.attributes?.[attr] ?? null;
}

// Seconds from a duration-ish entity: Moonraker reports print_duration in min,
// print_time_left in h, print_eta as a timestamp; others send "2h 10m".
function durationVal(hass, entityId) {
  const v = stVal(hass, entityId);
  if (v == null) return null;
  const deviceClass = attrVal(hass, entityId, 'device_class') || '';
  const unit = (attrVal(hass, entityId, 'unit_of_measurement') || '').toLowerCase();
  const s = String(v).trim();
  if (deviceClass === 'timestamp' && /^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const t = new Date(s).getTime();
    if (!isNaN(t)) return Math.max(0, (t - Date.now()) / 1000);
  }
  const n = parseFloat(v);
  if (!isNaN(n) && s === String(n)) {
    if (unit === 'min' || unit === 'minute' || unit === 'minutes') return n * 60;
    if (unit === 'h' || unit === 'hour' || unit === 'hours') return n * 3600;
    if (unit === 'd' || unit === 'day' || unit === 'days') return n * 86400;
    return n;
  }
  return parseDurationToSeconds(v);
}

// ── Printer drawing ───────────────────────────────────────────────────────────
// One drawing per printer_type, all in the same dark style: the object grows
// layer by layer with progress, heaters glow while they have a target, and the
// toolhead sweeps while printing.
// Finished layers of the printed object, standing on bedTop.
function layersSvg(cx, bedTop, objW, objMax, p, color, outline) {
  if (p <= 0) return '';
  let obj = outline ? `<rect x="${cx - objW / 2}" y="${bedTop - objMax}" width="${objW}" height="${objMax}" rx="3" fill="none" stroke="${color}" stroke-opacity=".16" stroke-dasharray="3 3"/>` : '';
  const objH = objMax * p;
  const lh = objMax / 12;
  const n = Math.ceil(objH / lh);
  for (let i = 0; i < n; i++) {
    const top = Math.max(bedTop - objH, bedTop - (i + 1) * lh);
    const h = bedTop - i * lh - top - 1;
    if (h <= 0.3) continue;
    obj += `<rect x="${cx - objW / 2 + (i % 2)}" y="${top.toFixed(1)}" width="${objW - (i % 3 ? 1 : 0)}" height="${h.toFixed(1)}" rx="1.2" fill="${color}" opacity="${(0.5 + 0.45 * (i + 1) / 12).toFixed(2)}"/>`;
  }
  return obj;
}

// Delta (Kossel/Rostock), side view in the same style as the other types:
// two front towers, the back tower faint in the middle, fixed bed. While
// printing the effector sweeps like the other toolheads and each carriage
// height follows the arm geometry (√(L² − d²)), so the arms keep their length.
function deltaSvg(s, c) {
  const { p, HOT, BED, FR, OBJ } = c;
  const ORANGE = '#ff7a45'; // effector and hotend, always orange; heating shows as the glow
  const cx = 125, bedTop = 182, objMax = 68, objW = 46;
  const objH = objMax * p;
  const nozzleY = bedTop - objH - 2;
  const effY = nozzleY - 12;     // effector plate, arms attach here
  // Rod length and sweep are chosen so the carriages never leave the towers,
  // which keeps every side rod at exactly L on screen.
  const L = 88, ATT = 14, BACK = 60, SWEEP = 16;
  // [screen x, plan depth offset, attachment side, faint]
  const towers = [[125, BACK, 0, true], [41, 0, -1, false], [209, 0, 1, false]];

  const frame = (ex) => towers.map(([tx, depth, side]) => {
    const ax = cx + ex + side * ATT;
    const d = Math.hypot(tx - ax, depth);
    const y1 = effY - Math.sqrt(L * L - d * d);   // rod top, on the carriage
    return { carY: y1 - 7, y1, ax };
  });

  const N = 24, DUR = '2.6s';
  const xs = s.printing ? Array.from({ length: N + 1 }, (_, i) => SWEEP * Math.sin((2 * Math.PI * i) / N)) : [0];
  const frames = xs.map(frame);
  const f0 = frames[0];
  const vals = (fn) => frames.map(fn).map((v) => v.toFixed(1)).join(';');
  const anim = (attr, fn) => (s.printing ? `<animate attributeName="${attr}" values="${vals(fn)}" dur="${DUR}" repeatCount="indefinite"/>` : '');

  const towerSvg = towers.map(([tx, , , faint]) => `<rect x="${tx - 5}" y="18" width="10" height="182" rx="3" fill="#141821" stroke="${FR}" stroke-width="1.5" ${faint ? 'opacity=".3"' : ''}/>`).join('');
  const carriage = (i) => [towers[i]].map(([tx, , , faint]) => `<rect x="${tx - 8}" y="${f0[i].carY.toFixed(1)}" width="16" height="13" rx="3" fill="#252b36" stroke="${FR}" ${faint ? 'opacity=".5"' : ''}>${anim('y', (f) => f[i].carY)}</rect>`)[0];
  const arm = (i) => [towers[i]].map(([tx, , , faint]) => [-2.5, 2.5].map((o) => `<line x1="${tx + o}" y1="${f0[i].y1.toFixed(1)}" x2="${(f0[i].ax + o).toFixed(1)}" y2="${effY}" stroke="rgba(255,255,255,.4)" stroke-width="1.6" stroke-linecap="round" ${faint ? 'opacity=".4"' : ''}>${anim('y1', (f) => f[i].y1)}${anim('x2', (f) => f[i].ax + o)}</line>`).join(''))[0];
  const effMove = s.printing
    ? `<animateTransform attributeName="transform" type="translate" values="${xs.map((x) => `${x.toFixed(1)} 0`).join(';')}" dur="${DUR}" repeatCount="indefinite"/>`
    : '';

  return `<svg viewBox="0 0 250 230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Delta printer">
  <defs>
    <radialGradient id="p3g1"><stop offset="0" stop-color="${HOT}" stop-opacity=".55"/><stop offset="1" stop-color="${HOT}" stop-opacity="0"/></radialGradient>
    <radialGradient id="p3g2"><stop offset="0" stop-color="${BED}" stop-opacity=".38"/><stop offset="1" stop-color="${BED}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect x="26" y="198" width="198" height="10" rx="4" fill="rgba(255,255,255,.08)"/>
  ${towerSvg}
  ${carriage(0)}${arm(0)}
  <line x1="41" y1="20" x2="209" y2="20" stroke="${FR}" stroke-width="3" stroke-linecap="round"/>
  <line x1="41" y1="196" x2="209" y2="196" stroke="${FR}" stroke-width="3" stroke-linecap="round"/>
  ${s.bed ? `<ellipse cx="${cx}" cy="${bedTop + 3}" rx="96" ry="15" fill="url(#p3g2)"><animate attributeName="opacity" values=".7;1;.7" dur="2.6s" repeatCount="indefinite"/></ellipse>` : ''}
  ${layersSvg(cx, bedTop, objW, objMax, p, OBJ, true)}
  <rect x="50" y="${bedTop}" width="150" height="7" rx="3" fill="${BED}" opacity="${s.bed ? 0.9 : 0.55}"/>
  ${carriage(1)}${carriage(2)}
  ${arm(1)}${arm(2)}
  <g transform="translate(${cx} ${nozzleY})"><g transform="translate(0 0)">${effMove}
    ${s.hot ? `<ellipse cx="0" cy="4" rx="20" ry="12" fill="url(#p3g1)"/>` : ''}
    <rect x="-16" y="-14" width="32" height="5" rx="2" fill="${ORANGE}"/>
    <rect x="-6" y="-9" width="12" height="7" rx="2" fill="${ORANGE}"/>
    <path d="M-4 -2h8l-4 6z" fill="${ORANGE}"/>
  </g></g>
</svg>`;
}

function printerSvg(type, s) {
  const t = (type || 'i3').toLowerCase();
  const p = clamp(s.p || 0, 0, 1);
  if (t === 'delta') {
    return deltaSvg(s, {
      p,
      HOT: s.hot ? '#ff7a45' : '#5a6170',
      BED: s.bed ? '#3fa9ff' : '#4a5160',
      FR: 'rgba(255,255,255,.16)',
      OBJ: '#5eead4',
    });
  }
  const HOT = s.hot ? '#ff7a45' : '#5a6170';
  const BED = s.bed ? '#3fa9ff' : '#4a5160';
  const FR = 'rgba(255,255,255,.16)';
  const OBJ = '#5eead4';
  const cx = 125, objMax = 92, objW = 50;
  const objH = objMax * p;
  const movingBed = t === 'corexy';
  const nozzleY = movingBed ? 66 : 182 - objH - 2;
  const bedTop = movingBed ? nozzleY + 2 + objH : 182;

  let frame = '';
  if (t === 'i3') {
    frame = `<rect x="26" y="198" width="198" height="10" rx="4" fill="rgba(255,255,255,.08)"/>
      <rect x="36" y="18" width="10" height="182" rx="3" fill="#141821" stroke="${FR}" stroke-width="1.5"/>
      <rect x="204" y="18" width="10" height="182" rx="3" fill="#141821" stroke="${FR}" stroke-width="1.5"/>
      <line x1="41" y1="20" x2="209" y2="20" stroke="${FR}" stroke-width="3" stroke-linecap="round"/>
      <rect x="33" y="${nozzleY - 27}" width="16" height="14" rx="3" fill="#252b36" stroke="${FR}"/>
      <rect x="201" y="${nozzleY - 27}" width="16" height="14" rx="3" fill="#252b36" stroke="${FR}"/>`;
  } else if (t === 'cantilever') {
    frame = `<rect x="26" y="198" width="198" height="10" rx="4" fill="rgba(255,255,255,.08)"/>
      <rect x="38" y="16" width="14" height="184" rx="4" fill="#141821" stroke="${FR}" stroke-width="1.5"/>
      <rect x="34" y="${nozzleY - 28}" width="22" height="16" rx="3" fill="#252b36" stroke="${FR}"/>`;
  } else {
    frame = `<rect x="22" y="14" width="206" height="200" rx="10" fill="#0f1218" stroke="${FR}" stroke-width="2"/>
      <rect x="30" y="22" width="190" height="184" rx="6" fill="none" stroke="rgba(255,255,255,.05)"/>
      ${[22, 228].map((x) => `<rect x="${x - 4}" y="10" width="8" height="8" rx="2" fill="${FR}"/><rect x="${x - 4}" y="210" width="8" height="8" rx="2" fill="${FR}"/>`).join('')}
      ${s.cham ? `<rect x="30" y="22" width="190" height="184" rx="6" fill="#a78bfa" opacity=".07"><animate attributeName="opacity" values=".05;.13;.05" dur="3s" repeatCount="indefinite"/></rect>` : ''}`;
  }

  const barY = nozzleY - 20;
  const bar = t === 'cantilever'
    ? `<line x1="52" y1="${barY}" x2="214" y2="${barY}" stroke="rgba(255,255,255,.35)" stroke-width="4" stroke-linecap="round"/>`
    : t === 'i3'
      ? `<line x1="46" y1="${barY}" x2="204" y2="${barY}" stroke="rgba(255,255,255,.35)" stroke-width="4" stroke-linecap="round"/>`
      : `<line x1="34" y1="${barY}" x2="216" y2="${barY}" stroke="rgba(255,255,255,.35)" stroke-width="4" stroke-linecap="round"/>`;

  // Object: finished layers, plus a faint outline of the whole part on fixed beds.
  const obj = layersSvg(cx, bedTop, objW, objMax, p, OBJ, !movingBed);

  const zRods = movingBed
    ? `<path d="M60 ${bedTop + 7}V206M190 ${bedTop + 7}V206" stroke="rgba(255,255,255,.14)" stroke-width="1.5" stroke-dasharray="4 3"/>`
    : '';

  return `<svg viewBox="0 0 250 230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Printer">
  <defs>
    <radialGradient id="p3g1"><stop offset="0" stop-color="${HOT}" stop-opacity=".55"/><stop offset="1" stop-color="${HOT}" stop-opacity="0"/></radialGradient>
    <radialGradient id="p3g2"><stop offset="0" stop-color="${BED}" stop-opacity=".38"/><stop offset="1" stop-color="${BED}" stop-opacity="0"/></radialGradient>
  </defs>
  ${frame}
  ${zRods}
  ${s.bed ? `<ellipse cx="${cx}" cy="${bedTop + 3}" rx="96" ry="15" fill="url(#p3g2)"><animate attributeName="opacity" values=".7;1;.7" dur="2.6s" repeatCount="indefinite"/></ellipse>` : ''}
  ${obj}
  <rect x="44" y="${bedTop}" width="162" height="7" rx="3" fill="${BED}" opacity="${s.bed ? 0.9 : 0.55}"/>
  ${bar}
  <g transform="translate(${cx} ${nozzleY})"><g class="${s.printing ? 'th-run' : ''}">
    ${s.hot ? `<ellipse cx="0" cy="4" rx="20" ry="12" fill="url(#p3g1)"/>` : ''}
    <rect x="-14" y="-31" width="28" height="22" rx="5" fill="#252b36" stroke="${HOT}" stroke-width="1.5"/>
    <path d="M-4 -9h8l-4 7z" fill="${HOT}"/>
  </g></g>
</svg>`;
}

// ── Card ──────────────────────────────────────────────────────────────────────
class PrinterCard3D extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._config = null;
    this._entities = {};
    this._cameras = [];
    this._macros = [];
    this._heaters = [];
    this._fans = [];
    this._serviceButtons = [];
    this._statusSeen = false;
    this._entityMappings = null;
    this._entityMappingsKey = null;
    this._entityMappingsPromise = null;
    this._built = false;
    this._skeletonFor = null;
    this._lastHtml = new Map();
    this._open = {};            // <details> open state by section
    this._tab = null;           // selected camera entity id
    this._view = null;          // live view mode: 'printer' | 'both' | 'camera'
    this._vm = 'printer';       // effective mode after availability checks
    this._sel = null;           // heater whose target setter is open
    this._confirm = null;       // armed two-tap action
    this._confirmTimer = null;
    this._numPending = {};      // entity_id -> { value, timer } until HA reflects it
    this._sendTimers = {};
    this._jogStep = 10;
    this._dragging = false;
    this._thumbIdent = null;
    this._thumbEl = null;
    this._thumbOk = false;
    this._dlg = null;           // compact variant: { wrap, card }
    this._host = null;          // compact card that opened this one as a dialog
    // Escape in a more-info dialog opened from our dialog closes only that one.
    this._onKey = (ev) => {
      if (ev.key !== 'Escape' || ev.composedPath().some((n) => n.localName === 'ha-more-info-dialog')) return;
      this._closeDialog();
    };
  }

  static getStubConfig() {
    return { name: 'Printer', base_entity: 'voron', printer_type: 'corexy' };
  }

  getCardSize() { return this._config?.variant === 'compact' ? 3 : 10; }

  setConfig(config) {
    if (!config || !config.base_entity) throw new Error('lovelace-3d-printer-card: base_entity is required');
    this._config = config;
    if (this._built && this._entityMappings) { this._crawlEntities(); this._render(); }
  }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (this._dlg) this._dlg.card.hass = hass;
    if (!this._config) return;

    for (const [eid, pend] of Object.entries(this._numPending)) {
      const real = parseFloat(hass.states[eid]?.state);
      if (Number.isFinite(real) && Math.abs(real - pend.value) < 0.01) {
        clearTimeout(pend.timer);
        delete this._numPending[eid];
      }
    }

    const key = this._resolveEntityMappingsKey();
    if (!(this._entityMappings && this._entityMappingsKey === key)) {
      if (!this._entityMappingsPromise || this._entityMappingsKey !== key) {
        this._entityMappingsKey = key;
        this._entityMappingsPromise = this._loadEntityMappings(key).then((m) => {
          this._entityMappings = m;
          this._crawlEntities();
          this._render();
        });
      }
      return;
    }
    this._crawlEntities();
    this._syncCams();
    if (prev && this._built && !this._entitiesChanged(prev, hass)) return;
    this._render();
  }

  connectedCallback() {
    if (this._hass && this._entityMappings && !this._built) this._render();
  }

  disconnectedCallback() {
    // Dashboards that redraw (gil-home's room sheet) detach and re-attach the
    // card in one go; only close the dialog if the card is really gone.
    setTimeout(() => {
      if (this.isConnected) return;
      this._closeDialog();
      clearTimeout(this._confirmTimer);
    }, 0);
  }

  _resolveEntityMappingsKey() {
    if (this._config?.entity_mappings) return this._config.entity_mappings;
    const b = this._config?.base_entity;
    const st = this._hass?.states || {};
    if (b && st[`sensor.${b}_current_state`] && st[`sensor.${b}_actual_tool0_temp`]) return 'octoprint';
    return (this._hass?.locale?.language || this._hass?.language || 'en') + '_generic';
  }

  _loadEntityMappings(key) {
    if (key === 'octoprint') return Promise.resolve(OCTOPRINT_MAPPINGS);
    const url = new URL(`./entities/${key}.js`, import.meta.url).href;
    return import(/* webpackIgnore: true */ url)
      .then((m) => m.default)
      .catch(() => this._loadEntityMappingsFallback(key));
  }

  _loadEntityMappingsFallback(key) {
    const lang = key.split('_')[0];
    const enUrl = new URL('./entities/en_generic.js', import.meta.url).href;
    const en = () => import(/* webpackIgnore: true */ enUrl).then((m) => m.default).catch(() => DEFAULT_MAPPINGS);
    if (lang === 'en') return en();
    const langUrl = new URL(`./entities/${lang}_generic.js`, import.meta.url).href;
    return import(/* webpackIgnore: true */ langUrl).then((m) => m.default).catch(en);
  }

  _t(key) {
    return this._entityMappings?.ui?.[key] ?? DEFAULT_UI[key] ?? key;
  }

  // ── Entity crawler ──────────────────────────────────────────────────────────
  // One pass over the entities containing base_entity, classifying each into a
  // well-known role or a dynamic bucket (macros, heaters, fans, cameras).
  _crawlEntities() {
    if (!this._hass || !this._config) return;
    const b = this._config.base_entity;

    // Friendly names start with the device name: the card's name or base_entity in words.
    const reEsc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const names = [this._config.name, b.replace(/_/g, ' '), b].filter(Boolean).map(reEsc);
    const devicePrefix = new RegExp(`^(${names.join('|')})\\s+`, 'i');
    const m = this._entityMappings || DEFAULT_MAPPINGS;
    // Optional mapping keys: label_strip (regexes removed from friendly names),
    // ignore (regexes on the entity suffix), hide_unavailable (drop extra
    // temperature sensors that are unavailable/unknown).
    const labelStrip = (m.label_strip || []).map((r) => new RegExp(r, 'i'));
    const ignore = (m.ignore || []).map((r) => new RegExp(r));
    const label = (st, id) => {
      const fn = st.attributes?.friendly_name;
      if (fn) {
        let l = fn.replace(devicePrefix, '');
        for (const r of labelStrip) l = l.replace(r, '');
        return l.replace(/\s+temperature$/i, '').replace(/\s+temp$/i, '').trim();
      }
      return id.replace(/^[^.]+\./, '').replace(new RegExp(`^${b}_`), '').replace(/_/g, ' ').trim();
    };

    const table = (arr) => (arr || []).map(([role, patterns]) => [patterns, role]);
    const SENSOR_ROLES = table(m.sensor);
    const NUMBER_ROLES = table(m.number);
    const BUTTON_ROLES = table(m.button);
    const CAMERA_ROLES = table(m.camera);
    const matchRole = (suffix, roles) => {
      for (const [patterns, role] of roles) for (const p of patterns) if (suffix === p || suffix.endsWith('_' + p)) return role;
      return null;
    };

    this._entities = {};
    this._macros = [];
    this._heaters = [];
    this._fans = [];
    this._serviceButtons = [];
    this._statusSeen = false;
    const tempTargetIds = new Set();
    const remainingSensors = [];

    for (const [id, st] of Object.entries(this._hass.states)) {
      if (!id.includes(b)) continue;
      if (st.attributes?.hidden === true) continue;
      const domain = id.split('.')[0];
      const suffix = id.replace(/^[^.]+\./, '').replace(new RegExp(`^${b}_`), '');
      if (ignore.some((r) => r.test(suffix))) continue;

      if (domain === 'sensor') {
        const role = matchRole(suffix, SENSOR_ROLES);
        if (role) {
          if (role === 'status' || role === 'printer_state') this._statusSeen = true;
          const existing = this._entities[role];
          const isNewGood = st.state !== 'unknown' && st.state !== 'unavailable';
          if (!existing) {
            if (isNewGood) this._entities[role] = id;
          } else {
            const existingSt = this._hass.states[existing];
            const isExistingBad = !existingSt || existingSt.state === 'unknown' || existingSt.state === 'unavailable';
            const preferNew = (role === 'hotend' && id.includes('extruder_temperature') && existing.includes('extruder_temp'))
              || (role === 'bed' && id.includes('bed_temperature') && existing.includes('bed_temp'))
              || (role === 'eta' && id.includes('print_time_left') && existing.includes('print_eta'));
            if ((isExistingBad && isNewGood) || preferNew) this._entities[role] = id;
          }
        } else {
          const unit = st.attributes?.unit_of_measurement;
          const gone = m.hide_unavailable && (st.state === 'unavailable' || st.state === 'unknown');
          if ((unit === '°C' || unit === '°F') && !gone) remainingSensors.push([id, st, suffix]);
        }
      } else if (domain === 'number') {
        const role = matchRole(suffix, NUMBER_ROLES);
        if (role && !this._entities[role]) this._entities[role] = id;
      } else if (domain === 'button') {
        const role = matchRole(suffix, BUTTON_ROLES);
        if (role) {
          if (!this._entities[role]) this._entities[role] = id;
        } else if (suffix.includes('macro_')) {
          this._macros.push({ entity_id: id, label: label(st, id).replace(/^macro\s+/i, '').trim() });
        } else if (suffix.startsWith('restart_') || suffix.startsWith('stop_') || suffix.startsWith('start_')) {
          this._serviceButtons.push({ entity_id: id, label: label(st, id) });
        }
      } else if (domain === 'camera') {
        const role = matchRole(suffix, CAMERA_ROLES);
        if (role === 'thumbnail' && !this._entities.thumbnail) this._entities.thumbnail = id;
      }
    }
    this._macros.sort((x, y) => x.label.localeCompare(y.label));
    this._serviceButtons.sort((x, y) => x.label.localeCompare(y.label));

    const coreTemps = new Set([this._entities.hotend, this._entities.bed].filter(Boolean));
    const coreTargets = new Set([this._entities.hotend_target, this._entities.bed_target].filter(Boolean));
    for (const [sensorId, st] of remainingSensors) {
      if (coreTemps.has(sensorId)) continue;
      const targetId = sensorId.replace(/^sensor\./, 'number.').replace(/_temperature$/, '_target').replace(/_temp$/, '_target');
      if (coreTargets.has(targetId)) continue;
      const targetSt = this._hass.states[targetId];
      const cur = parseFloat(st.state);
      if (targetSt) {
        tempTargetIds.add(targetId);
        const tgt = parseFloat(targetSt.state);
        this._heaters.push({ entity_id: sensorId, label: label(st, sensorId), current: isNaN(cur) ? null : cur, target: isNaN(tgt) ? null : tgt, target_entity: targetId, readonly: false });
      } else {
        this._heaters.push({ entity_id: sensorId, label: label(st, sensorId), current: isNaN(cur) ? null : cur, target: null, target_entity: null, readonly: true });
      }
    }
    // Settable heaters first, then read-only sensors.
    this._heaters.sort((x, y) => Number(x.readonly) - Number(y.readonly));

    const claimed = new Set(Object.values(this._entities).filter((id) => id?.startsWith('number.')));
    const fanPattern = /fan|filter|exhaust|output_pin|light|led/i;
    for (const [id, st] of Object.entries(this._hass.states)) {
      if (!id.startsWith('number.') || !id.includes(b)) continue;
      if (st.attributes?.hidden === true) continue;
      if (claimed.has(id) || tempTargetIds.has(id) || !fanPattern.test(id)) continue;
      const v = parseFloat(st.state);
      this._fans.push({
        entity_id: id,
        label: label(st, id),
        value: isNaN(v) ? 0 : v,
        unavailable: st.state === 'unavailable' || st.state === 'unknown',
        min: parseFloat(st.attributes?.min ?? 0),
        max: parseFloat(st.attributes?.max ?? 100),
        step: parseFloat(st.attributes?.step ?? 1),
        unit: st.attributes?.unit_of_measurement || '',
      });
    }

    // Fans first, then lights and other outputs.
    const isLight = (id) => /light|led|output_pin/i.test(id);
    this._fans.sort((x, y) => Number(isLight(x.entity_id)) - Number(isLight(y.entity_id)));

    const rotation = {};
    const aspects = {};
    for (const c of (this._config.cameras || [])) {
      const e = typeof c === 'string' ? { entity: c, rotate: 0 } : c;
      if (e.entity) { rotation[e.entity] = e.rotate || 0; if (e.aspect) aspects[e.entity] = String(e.aspect).replace(':', ' / '); }
    }
    this._cameras = [];
    for (const [id, st] of Object.entries(this._hass.states)) {
      if (!id.startsWith('camera.') || !id.includes(b)) continue;
      if (st.attributes?.hidden === true || id === this._entities.thumbnail) continue;
      this._cameras.push({ entity: id, label: label(st, id), rotate: rotation[id] ?? 0, aspect: aspects[id] });
    }
    this._cameras.sort((x, y) => x.entity.localeCompare(y.entity));
  }

  _entitiesChanged(prev, next) {
    const ps = this._config?.power_switch;
    if (ps && prev.states[ps] !== next.states[ps]) return true;
    const b = this._config.base_entity;
    const thumb = this._entities.thumbnail;
    const cams = new Set(this._cameras.map((c) => c.entity));
    for (const id of Object.keys(next.states)) {
      // Camera entities change with every token rotation; they're synced separately.
      if (!id.includes(b) || id === thumb || cams.has(id)) continue;
      if (prev.states[id] !== next.states[id]) return true;
    }
    return false;
  }

  _exists(key) { const id = this._entities[key]; return !!(id && this._hass?.states[id]); }
  _stVal(key) { return stVal(this._hass, this._entities[key]); }
  _numVal(key) { return numVal(this._hass, this._entities[key]); }
  _num(eid) {
    if (eid && this._numPending[eid]) return this._numPending[eid].value;
    return numVal(this._hass, eid);
  }

  _powerOn() {
    const ps = this._config?.power_switch;
    return ps ? this._hass?.states[ps]?.state === 'on' : null;
  }

  // Combines the plug, reachability, printer_state (ready/startup/shutdown/error)
  // and current_print_state (standby/printing/paused/complete/cancelled/error).
  _effectiveStatus() {
    if (this._powerOn() === false) return 'off';
    const printerState = (this._stVal('printer_state') || '').toLowerCase();
    const rawState = (this._stVal('status') || '').toLowerCase();
    const printState = this._entityMappings?.status_map?.[rawState] || rawState;
    if (!printerState && !printState && this._statusSeen) return 'offline';
    if (printerState === 'error' || printerState === 'shutdown' || printerState === 'startup') return printerState;
    return printState || printerState || 'idle';
  }

  // Markup that makes a reading open Home Assistant's more-info dialog (with its
  // history graph) for the entity behind it; nothing when that entity is missing.
  _mi(id) {
    return id && this._hass?.states[id] ? ` data-more-info="${esc(id)}" role="button" tabindex="0"` : '';
  }

  _miSpan(id, html) {
    const a = this._mi(id);
    return a ? `<span${a}>${html}</span>` : html;
  }

  _statusLabel(status) {
    const k = 'st_' + status;
    const t = this._t(k);
    return t !== k ? t : status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
  }

  // Everything both variants show, read once per render.
  _readState() {
    const status = this._effectiveStatus();
    const printing = status === 'printing';
    const paused = status === 'paused';
    const active = printing || paused;
    const offLike = status === 'off' || status === 'offline';
    let progress = this._numVal('progress') || 0;
    if (progress > 0 && progress <= 1 && attrVal(this._hass, this._entities.progress, 'unit_of_measurement') !== '%') progress *= 100;
    const duration = durationVal(this._hass, this._entities.duration);
    const etaRaw = durationVal(this._hass, this._entities.eta);
    let eta = etaRaw;
    if (!eta && duration != null && progress > 0) eta = duration / (progress / 100) - duration;
    const filRaw = this._numVal('filament_used');
    const filUnit = attrVal(this._hass, this._entities.filament_used, 'unit_of_measurement');
    const filament = filRaw != null ? (filUnit === 'm' || filRaw < 100 ? filRaw : filRaw / 1000) : null;
    const chamber = this._heaters.find((h) => /chamber/i.test(h.entity_id) && !h.readonly) || this._heaters.find((h) => /chamber/i.test(h.entity_id));
    return {
      status, printing, paused, active, offLike,
      label: this._statusLabel(status),
      color: stateColor(status),
      progress,
      duration, eta,
      // An ETA worked out from elapsed time and progress has no single entity behind it.
      etaId: etaRaw ? this._entities.eta : null,
      filament,
      filename: this._stVal('filename'),
      layer: this._numVal('current_layer'),
      layers: this._numVal('total_layers'),
      hotend: this._numVal('hotend'),
      hotendTarget: this._num(this._entities.hotend_target),
      bed: this._numVal('bed'),
      bedTarget: this._num(this._entities.bed_target),
      chamber: chamber?.current ?? null,
      chamberId: chamber?.entity_id ?? null,
      chamberTarget: this._num(this._entities.chamber_target) ?? (chamber?.target_entity ? this._num(chamber.target_entity) : null),
    };
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  // The skeleton is built once per variant; each render only replaces regions
  // whose markup changed, so camera streams, the toolhead animation and open
  // sections survive state updates. A drag pauses rendering until release.
  _render() {
    if (!this._hass || !this._config || !this._entityMappings) return;
    if (!this._built) this._initShadow();
    if (this._dragging) return;
    const compact = this._config.variant === 'compact';
    const variant = compact ? 'compact' : 'full';
    const root = this.shadowRoot;
    if (this._skeletonFor !== variant) {
      root.innerHTML = `<style>${this._css()}</style>${compact ? this._compactSkeleton() : this._fullSkeleton()}`;
      this._lastHtml = new Map();
      this._skeletonFor = variant;
    }
    const parts = compact ? this._compactParts() : this._fullParts();
    const card = root.getElementById('card');
    if (card.className !== parts.cls) card.className = parts.cls;
    card.style.setProperty('--mc', parts.color);
    for (const [id, html] of Object.entries(parts.regions)) this._setHtml(root.getElementById(id), html);
    if (!compact) {
      root.getElementById('hero').style.display = parts.hero ? '' : 'none';
      this._syncCams();
      this._placeThumb();
    }
  }

  _setHtml(el, html) {
    if (!el || this._lastHtml.get(el) === html) return;
    el.innerHTML = html;
    this._lastHtml.set(el, html);
  }

  _initShadow() {
    this.attachShadow({ mode: 'open' });
    const r = this.shadowRoot;
    r.addEventListener('click', (e) => this._onClick(e));
    r.addEventListener('keydown', (e) => this._onKeyDown(e));
    r.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    // <details> toggles don't bubble; capture them to remember which sections are open.
    r.addEventListener('toggle', (e) => {
      const d = e.target;
      if (d instanceof HTMLDetailsElement && d.dataset.sec) this._open[d.dataset.sec] = d.open;
    }, true);
    this._built = true;
    PrinterCard3D._loadFont();
  }

  static _loadFont() {
    if (document.getElementById('p3d-inter')) return;
    const l = document.createElement('link');
    l.id = 'p3d-inter';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap';
    document.head.appendChild(l);
  }

  _fullSkeleton() {
    return `<div id="card">
  <div class="dh" id="r-head"></div>
  <div id="r-banner"></div>
  <div class="body">
    <div class="col c1">
      <div id="r-off"></div>
      <div class="hero" id="hero"><div class="view"><div class="draw" id="r-draw"></div><div class="camwrap" id="cams"></div></div><div class="tabs" id="r-tabs"></div></div>
      <div id="r-prog"></div>
      <div id="r-acts"></div>
    </div>
    <div class="col c2">
      <div id="r-temps"></div>
      <div id="r-tune"></div>
      <div id="r-move"></div>
      <div id="r-macros"></div>
      <div id="r-sys"></div>
    </div>
  </div>
</div>`;
  }

  _compactSkeleton() {
    return `<div id="card"><div id="g-main"></div><div id="g-bar"></div><div id="g-temps"></div><div id="g-foot"></div></div>`;
  }

  // ── Full card ───────────────────────────────────────────────────────────────
  _fullParts() {
    const s = this._readState();
    const cfg = this._config;
    const t = (k) => this._t(k);
    const name = cfg.name || t('printer');
    const pct = Math.round(s.progress);
    const powerId = cfg.power_switch;
    const powerOn = this._powerOn();

    // Header
    const E = this._entities;
    let sub;
    if (s.status === 'off') sub = esc(t('powered_off'));
    else if (s.status === 'offline') sub = esc(t('offline'));
    else if (s.active) {
      sub = `${esc(s.label)} · ${s.layer != null && s.layers
        ? this._miSpan(E.current_layer, esc(`${t('layer')} ${Math.round(s.layer)} / ${Math.round(s.layers)}`))
        : this._miSpan(E.progress, `${pct}%`)}`;
    } else {
      sub = [esc(s.label),
        s.hotend != null ? this._miSpan(E.hotend, esc(`${t('hotend')} ${Math.round(s.hotend)}°`)) : '',
        s.bed != null ? this._miSpan(E.bed, esc(`${t('bed')} ${Math.round(s.bed)}°`)) : ''].filter(Boolean).join(' · ');
    }
    const armedE = this._confirm === 'emergency';
    const head = `<div class="ic">${ico(s.active ? 'printer3d-nozzle' : 'printer3d', 22)}</div>
    <div class="tt"><h3>${esc(name)}</h3><p>${sub}</p></div>
    <div class="sp"></div>
    <span class="pill"><i></i>${esc(s.label)}</span>
    ${this._exists('emergency') && !s.offLike ? `<button class="iconbtn danger ${armedE ? 'armed' : ''}" data-action="emergency" title="${esc(armedE ? t('estop_armed') : t('estop'))}" aria-label="${esc(t('estop'))}">${ico('alert-octagon-outline')}</button>` : ''}
    ${powerId ? `<button class="power ${powerOn ? '' : 'off'} ${this._confirm === 'power' ? 'armed' : ''}" data-action="toggle-power" title="${esc(this._confirm === 'power' ? t('tap_again') : powerOn ? 'Turn off' : t('turn_on'))}" aria-label="Power">${ico('power', 20)}</button>` : ''}
    ${cfg._inDialog ? `<button class="iconbtn" data-action="close-dialog" title="Close" aria-label="Close">${ico('close')}</button>` : ''}`;

    // Message banner (Klipper print/display messages)
    const valid = (v) => v && v.toLowerCase() !== 'none' && isNaN(parseFloat(v));
    const msgs = [this._stVal('current_print_message'), this._stVal('current_display_message')].filter(valid);
    const bad = /error|cancel|shutdown/.test(s.status);
    const banner = msgs.length && !s.offLike
      ? `<div class="banner ${bad ? 'bad' : ''}">${ico(bad ? 'alert-outline' : 'information-outline')}<span>${esc(msgs.join(' · '))}</span></div>`
      : '';

    // Off / offline block
    let off = '';
    if (s.offLike) {
      const totals = this._totals().map(([k, v, id]) => `<div class="fact"${this._mi(id)}><span>${esc(t(k))}</span><b>${esc(v)}</b></div>`).join('');
      off = `<div class="offhero"><div class="offart">${printerSvg(cfg.printer_type, { p: 0 })}</div>
        <p>${esc(s.status === 'off' ? t('plug_off') : t('offline_msg'))}</p>
        ${s.status === 'off' && powerId ? `<button class="big go" data-action="toggle-power">${ico('power')}${esc(t('turn_on'))}</button>` : ''}
        ${totals ? `<div class="facts f3">${totals}</div>` : ''}</div>`;
    }

    // Live view: a mode toggle (printer drawing / both stacked / camera), plus a
    // camera picker when there is more than one camera. Cameras keep working
    // with the printer off.
    const cams = this._cameras;
    const modes = s.offLike ? (cams.length ? ['camera'] : []) : (cams.length ? ['printer', 'both', 'camera'] : ['printer']);
    if (this._view == null) {
      try { this._view = localStorage.getItem(`l3pc-view:${cfg.base_entity}`); } catch (e) { /* storage unavailable */ }
      this._view = this._view || cfg.view || 'printer';
    }
    this._vm = modes.includes(this._view) ? this._view : (modes.includes('camera') && s.offLike ? 'camera' : modes[0] || 'printer');
    if (!cams.some((c) => c.entity === this._tab)) this._tab = cams[0]?.entity ?? null;
    const tabs = modes;
    const modeInfo = {
      printer: [t('printer'), 'cube-outline'],
      both: [t('both'), 'view-split'],
      camera: [cams.length === 1 ? (cams[0].label || t('camera_fallback')) : t('camera_fallback'), 'cctv'],
    };
    const btn = (action, key, label, icon, on) => `<button class="${on ? 'on' : ''}" data-action="${action}" data-key="${esc(key)}">${icon ? ico(icon, 15) : ''}<span>${esc(label)}</span></button>`;
    const modeRow = modes.length > 1 ? `<div class="trow">${modes.map((m) => btn('view', m, modeInfo[m][0], modeInfo[m][1], m === this._vm)).join('')}</div>` : '';
    const camRow = cams.length > 1 && this._vm !== 'printer'
      ? `<div class="trow">${cams.map((c, i) => btn('tab', c.entity, c.label || `${t('camera_fallback')} ${i + 1}`, 'cctv', c.entity === this._tab)).join('')}</div>`
      : '';
    const tabsHtml = modeRow + camRow;
    const draw = s.offLike ? '' : printerSvg(cfg.printer_type, {
      p: s.progress / 100, printing: s.printing,
      hot: s.hotendTarget > 0, bed: s.bedTarget > 0, cham: s.chamberTarget > 0,
    });

    // Progress
    let prog = '';
    const showProg = s.active || ((s.status === 'complete' || s.status === 'cancelled') && s.filename);
    if (showProg) {
      const facts = [];
      if (s.active && s.eta != null) facts.push([t('left'), fmtSeconds(s.eta), s.etaId]);
      if (s.active && s.eta) facts.push([t('done_at'), fmtClock(s.eta, this._hass?.locale), s.etaId]);
      if (s.duration != null) facts.push([t('elapsed'), fmtSeconds(s.duration), E.duration]);
      if (s.layer != null && s.layers) facts.push([t('layer'), `${Math.round(s.layer)} / ${Math.round(s.layers)}`, E.current_layer]);
      const file = (s.filename || '').replace(/\.gcode$/i, '');
      const fsub = s.active && s.filament != null
        ? this._miSpan(E.filament_used, esc(`${s.filament.toFixed(1)} m ${t('filament_used')}`))
        : esc(s.label);
      prog = `<div class="prog">
        <div class="top"><div class="thumb">${ico('file-outline', 28)}</div><div class="fn"><b title="${esc(file)}">${esc(file || '—')}</b><small>${fsub}</small></div><div class="pct"${this._mi(E.progress)}>${pct}<sup>%</sup></div></div>
        <div class="bar"><i style="width:${clamp(s.progress, 0, 100)}%"></i></div>
        ${facts.length ? `<div class="facts">${facts.map(([k, v, id]) => `<div class="fact"${this._mi(id)}><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>` : ''}
      </div>`;
    }
    this._updateThumb(s);

    // Pause / Resume / Cancel
    let acts = '';
    if (s.active) {
      const btns = [];
      if (s.printing && this._exists('pause')) btns.push(`<button class="big warn" data-action="pause">${ico('pause')}${esc(t('pause'))}</button>`);
      if (s.paused && this._exists('resume')) btns.push(`<button class="big go" data-action="resume">${ico('play')}${esc(t('resume'))}</button>`);
      if (this._exists('cancel')) btns.push(`<button class="big stop ${this._confirm === 'cancel' ? 'armed' : ''}" data-action="cancel">${ico('stop')}${esc(this._confirm === 'cancel' ? t('tap_again') : t('cancel'))}</button>`);
      if (btns.length) acts = `<div class="btns n${btns.length}">${btns.join('')}</div>`;
    }

    const regions = {
      'r-head': head, 'r-banner': banner, 'r-off': off, 'r-draw': draw, 'r-tabs': tabsHtml,
      'r-prog': prog, 'r-acts': acts,
      'r-temps': s.offLike ? '' : this._tempsHtml(s),
      'r-tune': s.offLike ? '' : this._tuneHtml(),
      'r-move': s.offLike ? '' : this._moveHtml(s),
      'r-macros': s.offLike ? '' : this._macrosHtml(s),
      'r-sys': s.status === 'off' ? '' : this._sysHtml(),
    };
    return {
      cls: `card st-${s.status}${s.offLike ? ' is-off' : ''}`,
      color: s.color,
      hero: tabs.length > 0,
      regions,
    };
  }

  _totals() {
    const b = this._config.base_entity;
    const out = [];
    const jobsId = `sensor.${b}_totals_jobs`;
    const jobs = numVal(this._hass, jobsId);
    if (jobs != null) out.push(['prints', Math.round(jobs).toLocaleString(), jobsId]);
    const timeId = `sensor.${b}_totals_print_time`;
    const secs = durationVal(this._hass, timeId);
    if (secs != null) out.push(['print_time', `${Math.round(secs / 3600).toLocaleString()} h`, timeId]);
    const filId = `sensor.${b}_totals_filament_used`;
    const fil = numVal(this._hass, filId);
    if (fil != null) {
      const unit = attrVal(this._hass, filId, 'unit_of_measurement');
      const m = unit === 'mm' ? fil / 1000 : fil;
      out.push(['filament', m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`, filId]);
    }
    return out;
  }

  // Heater tiles. Tapping a settable one opens its target setter below its row.
  _heaterList(s) {
    const list = [];
    if (this._exists('hotend')) list.push({ key: 'hotend', entity: this._entities.hotend, label: this._t('hotend'), icon: 'printer3d-nozzle-heat', color: 'var(--hot)', cur: s.hotend, targetId: this._entities.hotend_target, maxDef: 300 });
    if (this._exists('bed')) list.push({ key: 'bed', entity: this._entities.bed, label: this._t('bed'), icon: 'radiator', color: 'var(--bed)', cur: s.bed, targetId: this._entities.bed_target, maxDef: 120 });
    for (const h of this._heaters) {
      const cham = /chamber/i.test(h.entity_id);
      list.push({
        key: h.entity_id, entity: h.entity_id, label: h.label,
        icon: h.readonly ? 'chip' : cham ? 'heat-wave' : 'thermometer',
        color: h.readonly ? 'var(--text3)' : cham ? 'var(--cham)' : 'var(--amber)',
        cur: h.current, targetId: h.target_entity, maxDef: 100,
      });
    }
    return list;
  }

  _presetsFor(x) {
    const cfgP = this._config.presets || {};
    const raw = cfgP[x.key] ?? (x.targetId ? cfgP[x.targetId] : undefined) ?? cfgP[x.label] ?? (x.key === 'hotend'
      ? [{ name: 'PLA', value: 215 }, { name: 'PETG', value: 245 }, { name: 'ABS', value: 260 }]
      : x.key === 'bed' ? [{ name: 'PLA', value: 60 }, { name: 'PETG', value: 80 }, { name: 'ABS', value: 100 }] : []);
    return (Array.isArray(raw) ? raw : []).map((p) => (typeof p === 'number' ? { name: '', value: p } : { name: p.name || '', value: Number(p.value) })).filter((p) => Number.isFinite(p.value));
  }

  _tempsHtml(s) {
    const list = this._heaterList(s);
    if (!list.length) return '';
    const t = (k) => this._t(k);
    const settable = (x) => !!(x.targetId && this._hass.states[x.targetId] && this._hass.states[x.targetId].state !== 'unavailable');
    if (this._sel && !list.some((x) => x.key === this._sel && settable(x))) this._sel = null;
    const tiles = list.map((x) => {
      const tgt = x.targetId ? this._num(x.targetId) : null;
      const max = parseFloat(attrVal(this._hass, x.targetId, 'max')) || x.maxDef;
      const fill = x.cur != null ? clamp(x.cur / max, 0, 1) * 100 : 0;
      const mark = tgt > 0 ? clamp(tgt / max, 0, 1) * 100 : null;
      const v = `<span class="v">${x.cur != null ? Math.round(x.cur) + '°' : '—'}${tgt > 0 ? `<small>/ ${Math.round(tgt)}°</small>` : x.targetId ? `<small>${esc(t('off'))}</small>` : ''}</span>`;
      const inner = `<span class="n">${ico(x.icon, 14)}<span>${esc(x.label)}</span></span>${v}${x.targetId ? `<span class="tb"><i style="width:${fill.toFixed(1)}%"></i>${mark != null ? `<em style="left:${mark.toFixed(1)}%"></em>` : ''}</span>` : ''}`;
      const cls = `t ${tgt > 0 ? 'heat' : ''} ${this._sel === x.key ? 'sel' : ''} ${x.targetId ? '' : 'ro'}`;
      // A settable tile is the setter's toggle, so its reading opens history from the setter row instead.
      return settable(x)
        ? `<button class="${cls}" style="--tc:${x.color}" data-action="sel-heater" data-key="${esc(x.key)}">${inner}</button>`
        : `<div class="${cls}" style="--tc:${x.color}"${this._mi(x.entity)}>${inner}</div>`;
    });
    const idx = list.findIndex((x) => x.key === this._sel);
    if (idx >= 0) {
      const x = list[idx];
      const tgt = this._num(x.targetId) || 0;
      const presets = this._presetsFor(x);
      const now = x.cur != null ? `<span class="now"${this._mi(x.entity)}>${Math.round(x.cur)}°</span> · ` : '';
      const setter = `<div class="setter"><span class="lbl"><b>${esc(x.label)}</b> ${now}${esc(t('target'))}</span>
        <button class="step" data-action="heat-step" data-dir="-1" aria-label="-">${ico('minus', 20)}</button><span class="val">${tgt > 0 ? Math.round(tgt) + '°' : esc(t('off'))}</span><button class="step" data-action="heat-step" data-dir="1" aria-label="+">${ico('plus', 20)}</button>
        <div class="presets"><button class="chip ${tgt <= 0 ? 'on' : ''}" data-action="heat-set" data-val="0">${esc(t('off'))}</button>${presets.map((p) => `<button class="chip ${Math.round(tgt) === Math.round(p.value) ? 'on' : ''}" data-action="heat-set" data-val="${p.value}">${esc(p.name ? `${p.name} ${p.value}` : `${p.value}°`)}</button>`).join('')}</div></div>`;
      tiles.splice(Math.min(list.length, Math.floor(idx / 3) * 3 + 3), 0, setter);
    }
    const anySettable = list.some(settable);
    return `<div class="blk"><div class="bh"><span class="label">${esc(t('temperatures'))}</span>${anySettable ? `<small>${esc(t('tap_heater'))}</small>` : ''}</div><div class="temps">${tiles.join('')}</div></div>`;
  }

  // Speed/flow sliders and 10-bar fan/output controls. Shown as a block when
  // wide; folded into a section on a narrow card.
  _tuneItems() {
    const items = [];
    const track = (key, lbl, defMin, defMax) => {
      const id = this._entities[key];
      if (!id || !this._hass.states[id]) return;
      const v = this._num(id);
      const min = parseFloat(attrVal(this._hass, id, 'min')) || defMin;
      const max = parseFloat(attrVal(this._hass, id, 'max')) || defMax;
      const step = parseFloat(attrVal(this._hass, id, 'step')) || 1;
      const f = v != null ? clamp((v - min) / (max - min), 0, 1) * 100 : 0;
      const mid = clamp((100 - min) / (max - min), 0, 1) * 100;
      items.push(`<div class="sl" style="--sc:var(--blue)"><div class="h"><span>${esc(lbl)}</span><b class="dv"${this._mi(id)}>${v != null ? Math.round(v) + '%' : '—'}</b></div>
        <div class="track ${v == null ? 'dis' : ''}" data-drag="track" data-entity="${id}" data-min="${min}" data-max="${max}" data-step="${step}" data-unit="%"><i style="width:${f.toFixed(1)}%"></i><span class="mid" style="left:${mid.toFixed(1)}%"></span></div></div>`);
    };
    track('speed_factor', this._t('speed'), 10, 200);
    track('flow_factor', this._t('flow'), 50, 150);
    for (const fan of this._fans) {
      const v = this._num(fan.entity_id) ?? fan.value;
      const f = fan.max > fan.min ? clamp((v - fan.min) / (fan.max - fan.min), 0, 1) : 0;
      const lit = Math.round(f * 10);
      const color = /light|led/i.test(fan.entity_id) ? 'var(--amber)' : 'var(--fan)';
      items.push(`<div class="sl" style="--sc:${color}"><div class="h"><span>${esc(fan.label)}</span><b class="dv"${this._mi(fan.entity_id)}>${this._fanText(fan, v)}</b></div>
        <div class="bars ${fan.unavailable ? 'dis' : ''}" data-drag="bars" data-entity="${fan.entity_id}" data-min="${fan.min}" data-max="${fan.max}" data-step="${fan.step}" data-unit="${esc(fan.unit)}">${Array.from({ length: 10 }, (_, i) => `<span class="${i < lit ? 'on' : ''}" style="height:${30 + i * 7}%"></span>`).join('')}</div></div>`);
    }
    return items;
  }

  _fanText(fan, v) {
    if (fan.unavailable) return '—';
    if (!(v > fan.min)) return esc(this._t('off'));
    if (fan.unit === '%') return `${Math.round(v)}%`;
    if (fan.max <= 1 || !fan.unit) return `${Math.round(((v - fan.min) / ((fan.max - fan.min) || 1)) * 100)}%`;
    return `${Math.round(v)}${esc(fan.unit)}`;
  }

  _tuneHtml() {
    const items = this._tuneItems();
    if (!items.length) return '';
    const t = (k) => this._t(k);
    const sp = this._num(this._entities.speed_factor), fl = this._num(this._entities.flow_factor);
    const summary = [sp != null ? `${t('speed')} ${Math.round(sp)}%` : '', fl != null ? `${t('flow')} ${Math.round(fl)}%` : ''].filter(Boolean).join(' · ');
    return `<div class="blk tune-w"><div class="bh"><span class="label">${esc(t('tune'))}</span><small>${esc(t('drag_to_change'))}</small></div><div class="tune">${items.join('')}</div></div>
      ${this._details('tune', 'tune-vertical', t('tune'), summary, `<div class="tune">${items.join('')}</div>`, 'tune-n')}`;
  }

  _details(sec, icon, title, small, body, cls = '') {
    return `<details class="${cls}" data-sec="${sec}" ${this._open[sec] ? 'open' : ''}><summary>${ico(icon, 18)}<b>${esc(title)}</b>${small ? `<small>${esc(small)}</small>` : ''}<span class="chev">${ico('chevron-down', 18)}</span></summary><div class="dbody">${body}</div></details>`;
  }

  _moveHtml(s) {
    const hasHome = ['home_all', 'home_x', 'home_y', 'home_z'].some((k) => this._exists(k));
    const x = this._numVal('position_x'), y = this._numVal('position_y'), z = this._numVal('position_z');
    if (!hasHome && x == null && !this._exists('position_x')) return '';
    const dis = s.printing ? 'disabled' : '';
    const pos = [['X', x, 1, 'position_x'], ['Y', y, 1, 'position_y'], ['Z', z, 2, 'position_z']];
    const small = pos.filter(([, v]) => v != null).map(([a, v, d]) => `${a} ${v.toFixed(d)}`).join(' · ');
    const step = this._jogStep;
    const jb = (axis, dir, icon) => `<button data-action="jog" data-axis="${axis}" data-dir="${dir}" ${dis} aria-label="${axis}${dir > 0 ? '+' : '-'}">${ico(icon, 20)}</button>`;
    const body = `
      ${small ? `<div class="pos">${pos.map(([a, v, d, k]) => `<div${this._mi(this._entities[k])}><span>${a}</span><b>${v != null ? v.toFixed(d) : '—'}</b></div>`).join('')}</div>` : ''}
      <div class="mrow"><span class="label">${esc(this._t('home'))}</span><div class="chips">
        ${this._exists('home_all') ? `<button class="chip" data-action="home" data-axis="all" ${dis}>${ico('home', 15)}${esc(this._t('home_all'))}</button>` : ''}
        ${['x', 'y', 'z'].filter((a) => this._exists('home_' + a)).map((a) => `<button class="chip" data-action="home" data-axis="${a}" ${dis}>${a.toUpperCase()}</button>`).join('')}
      </div></div>
      <div class="mrow"><span class="label">${esc(this._t('step'))}</span><div class="chips">${[0.1, 1, 10, 100].map((d) => `<button class="chip ${step === d ? 'on' : ''}" data-action="jog-step" data-val="${d}">${d} mm</button>`).join('')}</div></div>
      <div class="move">
        <div class="jog">
          <span></span>${jb('y', 1, 'arrow-up')}<span></span>
          ${jb('x', -1, 'arrow-left')}<button class="home" data-action="home" data-axis="all" ${dis || (this._exists('home_all') ? '' : 'disabled')} aria-label="Home all">${ico('home', 20)}</button>${jb('x', 1, 'arrow-right')}
          <span></span>${jb('y', -1, 'arrow-down')}<span></span>
        </div>
        <div class="zcol">${jb('z', 1, 'arrow-up')}<span class="zl">Z${step > 10 ? ' ≤10' : ''}</span>${jb('z', -1, 'arrow-down')}</div>
      </div>`;
    return this._details('move', 'axis-arrow', this._t('move'), small, body);
  }

  _macrosHtml(s) {
    if (!this._macros.length) return '';
    const dis = s.printing ? 'disabled' : '';
    const body = `<div class="macros">${this._macros.map((m) => `<button data-action="run-macro" data-entity="${m.entity_id}" ${dis} title="${esc(m.label)}">${ico('play', 15)}<span>${esc(m.label)}</span></button>`).join('')}</div>`;
    return this._details('macros', 'code-braces', this._t('macros'), String(this._macros.length), body);
  }

  _sysHtml() {
    const t = (k) => this._t(k);
    const btn = (id, lbl, danger) => {
      const armed = this._confirm === 'sys:' + id;
      return `<button class="sys ${danger ? 'danger' : ''} ${armed ? 'armed' : ''}" data-action="sys" data-entity="${id}" data-danger="${danger ? 1 : 0}">${ico('restart', 16)}<span>${esc(armed ? t('tap_again') : lbl)}</span></button>`;
    };
    const groups = [];
    const klipper = [];
    if (this._exists('klipper_restart')) klipper.push(btn(this._entities.klipper_restart, t('restart_klipper')));
    if (this._exists('fw_restart')) klipper.push(btn(this._entities.fw_restart, t('firmware_restart')));
    if (klipper.length) groups.push([t('klipper_control'), klipper]);
    if (this._serviceButtons.length) groups.push([t('service_control'), this._serviceButtons.map((b) => btn(b.entity_id, b.label))]);
    const host = [];
    if (this._exists('server_restart')) host.push(btn(this._entities.server_restart, t('server_restart')));
    if (this._exists('host_restart')) host.push(btn(this._entities.host_restart, t('reboot_host'), true));
    if (this._exists('host_shutdown')) host.push(btn(this._entities.host_shutdown, t('shutdown_host'), true));
    if (host.length) groups.push([t('host_control'), host]);
    if (!groups.length) return '';
    const body = groups.map(([g, bs]) => `<div class="label sysl">${esc(g)}</div><div class="sysg">${bs.join('')}</div>`).join('');
    return this._details('sys', 'cog-outline', t('system'), groups.map(([g]) => g).join(' · '), body);
  }

  // Thumbnail: loaded once per file into a kept <img>, shown only after it has
  // decoded to a real image; otherwise the file icon stays.
  _updateThumb(s) {
    const id = this._entities.thumbnail;
    const ident = id && s.active ? `${id}|${s.filename || ''}` : null;
    if (ident === this._thumbIdent) return;
    this._thumbIdent = ident;
    this._thumbOk = false;
    this._thumbEl = null;
    const pic = ident ? this._hass.states[id]?.attributes?.entity_picture : null;
    if (!pic) return;
    const img = new Image();
    img.className = 'thumb-img';
    img.alt = '';
    img.onload = () => { if (this._thumbEl === img && img.naturalWidth > 0) { this._thumbOk = true; this._placeThumb(); } };
    img.onerror = () => { if (this._thumbEl === img) this._thumbOk = false; };
    img.src = pic;
    this._thumbEl = img;
  }

  _placeThumb() {
    const slot = this.shadowRoot?.querySelector('.thumb');
    if (!slot || !this._thumbOk || !this._thumbEl || this._thumbEl.parentNode === slot) return;
    slot.classList.add('has');
    slot.appendChild(this._thumbEl);
  }

  // Keep at most one live <ha-camera-stream> (the selected tab), created once and
  // only given a new stateObj when Home Assistant sends one.
  _syncCams() {
    const root = this.shadowRoot;
    const wrap = root?.getElementById('cams');
    if (!wrap) return;
    const cam = this._vm !== 'printer' && this._tab ? this._cameras.find((c) => c.entity === this._tab) : null;
    const draw = root.getElementById('r-draw');
    if (draw) draw.style.display = cam && this._vm === 'camera' ? 'none' : '';
    wrap.parentElement?.classList.toggle('both', !!cam && this._vm === 'both');
    wrap.parentElement?.classList.toggle('camonly', !!cam && this._vm === 'camera');
    wrap.style.setProperty('--cam-ar', cam?.aspect || '16 / 9');
    if (!cam) {
      if (wrap.firstChild) wrap.replaceChildren();
      wrap.style.display = 'none';
      return;
    }
    wrap.style.display = '';
    let el = wrap.querySelector('ha-camera-stream');
    if (!el || el.dataset.entity !== cam.entity) {
      wrap.replaceChildren();
      el = document.createElement('ha-camera-stream');
      el.dataset.entity = cam.entity;
      el.muted = true;
      el.allowExoPlayer = true;
      el.setAttribute('muted', '');
      el.className = `cam r${((cam.rotate % 360) + 360) % 360}`;
      el.style.setProperty('--rot', `${cam.rotate}deg`);
      wrap.appendChild(el);
      const live = document.createElement('span');
      live.className = 'live';
      live.textContent = 'LIVE';
      wrap.appendChild(live);
    }
    const st = this._hass.states[cam.entity];
    if (st && el.stateObj !== st) { el.hass = this._hass; el.stateObj = st; }
  }

  // ── Compact glance card ─────────────────────────────────────────────────────
  _compactParts() {
    const s = this._readState();
    const cfg = this._config;
    const t = (k) => this._t(k);
    const name = cfg.name || t('printer');
    const pct = Math.round(s.progress);
    const powerOn = this._powerOn();
    let act = '';
    if (s.printing && this._exists('pause')) act = `<button class="iconbtn" data-action="pause" title="${esc(t('pause'))}">${ico('pause')}</button>`;
    else if (s.paused && this._exists('resume')) act = `<button class="iconbtn" data-action="resume" title="${esc(t('resume'))}">${ico('play')}</button>`;
    else if (cfg.power_switch && !s.active) act = `<button class="toggle ${powerOn ? 'on' : ''}" data-action="toggle-power" aria-label="Power"></button>`;
    const file = (s.filename || '').replace(/\.gcode$/i, '');
    const E = this._entities;
    const sub = s.active
      ? [esc(file), s.eta ? this._miSpan(s.etaId, esc(`${t('done_at')} ${fmtClock(s.eta, this._hass?.locale)}`)) : ''].filter(Boolean).join(' · ')
      : esc(s.status === 'off' ? t('powered_off') : s.status === 'offline' ? t('offline') : s.label);
    const main = `<div class="gh"><div class="gi">${ico(s.active ? 'printer3d-nozzle' : 'printer3d', 24)}</div><div class="gt"><b>${esc(name)}${s.active ? ` · ${this._miSpan(E.progress, `${pct}%`)}` : ''}</b><small>${sub}</small></div>${act}</div>`;
    const bar = s.active ? `<div class="bar"><i style="width:${clamp(s.progress, 0, 100)}%"></i></div>` : '';
    const temps = s.offLike ? '' : `<div class="gtemps">
      ${s.hotend != null ? `<span${this._mi(E.hotend)}>${ico('printer3d-nozzle-heat', 15)}${Math.round(s.hotend)}°</span>` : ''}
      ${s.bed != null ? `<span class="b"${this._mi(E.bed)}>${ico('radiator', 15)}${Math.round(s.bed)}°</span>` : ''}
      ${s.chamber != null ? `<span class="c"${this._mi(s.chamberId)}>${ico('heat-wave', 15)}${Math.round(s.chamber)}°</span>` : ''}
      ${s.active && s.layer != null && s.layers ? `<span class="r"${this._mi(E.current_layer)}>${esc(t('layer'))} ${Math.round(s.layer)} / ${Math.round(s.layers)}</span>` : ''}</div>`;
    const showLeft = s.active && s.eta != null;
    const left = showLeft ? `${t('left')} ${fmtSeconds(s.eta)}` : s.status === 'off' ? t('plug_off') : '';
    const foot = `<div class="foot"><span${showLeft ? this._mi(s.etaId) : ''}>${esc(left)}</span><button class="link" data-action="open-dialog">${esc(t('full_controls'))} ${ico('chevron-right', 16)}</button></div>`;
    return { cls: `card glance st-${s.status}`, color: s.color, regions: { 'g-main': main, 'g-bar': bar, 'g-temps': temps, 'g-foot': foot } };
  }

  // The dialog lives on document.body so no transformed or clipped ancestor of
  // the card (a dashboard sheet, a grid) can trap the fixed positioning.
  _openDialog() {
    if (this._dlg) return;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,6,10,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);overflow:auto';
    const card = document.createElement(CARD_TAG);
    const { variant, ...rest } = this._config;
    card.setConfig({ ...rest, variant: 'full', _inDialog: true });
    card._host = this;
    card.style.cssText = 'width:min(940px,100%);max-height:calc(100vh - 32px);overflow:auto;border-radius:30px;box-shadow:0 40px 80px -30px rgba(0,0,0,.8);margin:auto';
    card.addEventListener('p3d-close', () => this._closeDialog());
    wrap.addEventListener('click', (ev) => { if (ev.target === wrap) this._closeDialog(); });
    wrap.appendChild(card);
    document.body.appendChild(wrap);
    card.hass = this._hass;
    document.addEventListener('keydown', this._onKey);
    this._dlg = { wrap, card };
  }

  _closeDialog() {
    if (!this._dlg) return;
    this._dlg.wrap.remove();
    document.removeEventListener('keydown', this._onKey);
    this._dlg = null;
  }

  // ── Actions ─────────────────────────────────────────────────────────────────
  _fire(type, detail) {
    const from = this._host && this._host.isConnected ? this._host : this;
    from.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  _call(domain, service, data) {
    Promise.resolve(this._hass.callService(domain, service, data)).catch((err) => {
      this._fire('hass-notification', { message: `${this._config.name || 'Printer'}: ${err?.message || 'action failed'}` });
    });
  }

  _press(id) { if (id) this._call('button', 'press', { entity_id: id }); }

  // Two-tap confirmation: the first tap arms the action for 4 s.
  _arm(key) {
    if (this._confirm === key) {
      clearTimeout(this._confirmTimer);
      this._confirm = null;
      this._render();
      return true;
    }
    clearTimeout(this._confirmTimer);
    this._confirm = key;
    this._confirmTimer = setTimeout(() => { this._confirm = null; this._render(); }, 4000);
    this._render();
    return false;
  }

  // Set a number entity, keeping the value on screen until HA reflects it (max 4 s).
  // A delay batches quick +/- taps into one call.
  _setNum(eid, value, delay = 0) {
    if (!eid) return;
    clearTimeout(this._numPending[eid]?.timer);
    this._numPending[eid] = { value, timer: setTimeout(() => { delete this._numPending[eid]; this._render(); }, 4000 + delay) };
    clearTimeout(this._sendTimers[eid]);
    this._sendTimers[eid] = setTimeout(() => this._call('number', 'set_value', { entity_id: eid, value }), delay);
  }

  _moreInfo(entityId) {
    if (entityId) this._fire('hass-more-info', { entityId });
  }

  // Path inside this card only; a dialog card's events continue up to document.body.
  _ownPath(e) {
    const path = e.composedPath();
    const end = path.indexOf(this.shadowRoot);
    return end >= 0 ? path.slice(0, end) : path;
  }

  _onKeyDown(e) {
    if ((e.key !== 'Enter' && e.key !== ' ') || e.repeat) return;
    const id = e.target?.dataset?.moreInfo;
    if (!id) return;
    e.preventDefault();
    this._moreInfo(id);
  }

  _onClick(e) {
    const path = this._ownPath(e);
    const el = path.find((n) => n instanceof Element && n.dataset?.action);
    if (!el) {
      const mi = path.find((n) => n instanceof Element && n.dataset?.moreInfo);
      if (mi) this._moreInfo(mi.dataset.moreInfo);
      return;
    }
    if (el.disabled) return;
    const a = el.dataset.action;
    const status = this._effectiveStatus();
    const nav = ['open-dialog', 'close-dialog', 'tab', 'toggle-power', 'sel-heater', 'jog-step'];
    if ((status === 'off' || status === 'offline') && !nav.includes(a)) return;

    switch (a) {
      case 'open-dialog': this._openDialog(); return;
      case 'close-dialog': this.dispatchEvent(new CustomEvent('p3d-close')); return;
      case 'tab': this._tab = el.dataset.key; this._render(); this._syncCams(); return;
      case 'view':
        this._view = el.dataset.key;
        try { localStorage.setItem(`l3pc-view:${this._config.base_entity}`, this._view); } catch (e) { /* storage unavailable */ }
        this._render(); this._syncCams(); return;

      case 'toggle-power': {
        const ps = this._config.power_switch;
        if (!ps) return;
        // Cutting power mid-print ruins the print, so that needs a second tap.
        if (this._powerOn() && ['printing', 'paused'].includes(status) && !this._arm('power')) return;
        this._call('switch', 'toggle', { entity_id: ps });
        return;
      }
      case 'emergency': if (this._arm('emergency')) this._press(this._entities.emergency); return;
      case 'pause': this._press(this._entities.pause); return;
      case 'resume': this._press(this._entities.resume); return;
      case 'cancel': if (this._arm('cancel')) this._press(this._entities.cancel); return;
      case 'sel-heater': this._sel = this._sel === el.dataset.key ? null : el.dataset.key; this._render(); return;
      case 'heat-step':
      case 'heat-set': {
        const x = this._heaterList(this._readState()).find((h) => h.key === this._sel);
        if (!x?.targetId) return;
        const id = x.targetId;
        const min = parseFloat(attrVal(this._hass, id, 'min')) || 0;
        const max = parseFloat(attrVal(this._hass, id, 'max')) || x.maxDef;
        const step = parseFloat(attrVal(this._hass, id, 'step')) || 1;
        let v;
        if (a === 'heat-set') v = Number(el.dataset.val);
        else {
          const inc = step >= 5 ? step : 5;
          const cur = this._num(id) || 0;
          v = cur + Number(el.dataset.dir) * inc;
          if (v > 0 && v < min) v = Number(el.dataset.dir) > 0 ? min : 0;
        }
        v = clamp(Math.round(v / step) * step, v <= 0 ? 0 : min, max);
        this._setNum(id, v, a === 'heat-step' ? 600 : 0);
        this._render();
        return;
      }
      case 'run-macro': this._press(el.dataset.entity); return;
      case 'home': this._press(this._entities[{ all: 'home_all', x: 'home_x', y: 'home_y', z: 'home_z' }[el.dataset.axis]]); return;
      case 'jog-step': this._jogStep = Number(el.dataset.val); this._render(); return;
      case 'jog': {
        const axis = el.dataset.axis;
        const dist = Number(el.dataset.dir) * (axis === 'z' ? Math.min(this._jogStep, 10) : this._jogStep);
        this._jog(axis, dist);
        return;
      }
      case 'sys': {
        if (el.dataset.danger === '1' && !this._arm('sys:' + el.dataset.entity)) return;
        this._press(el.dataset.entity);
        return;
      }
    }
  }

  _jog(axis, dist) {
    const letter = { x: 'X', y: 'Y', z: 'Z' }[axis];
    if (!letter || !dist) return;
    const gcode = `G91\nG0 ${letter}${dist} F3000\nG90`;
    const sv = this._hass.services || {};
    if (sv.moonraker?.send_gcode || sv.klipper?.send_gcode) {
      this._call(sv.moonraker?.send_gcode ? 'moonraker' : 'klipper', 'send_gcode', { gcode });
      return;
    }
    // Fallback: a script named <base>_jog taking axis and distance.
    const scriptId = `script.${this._config.base_entity}_jog`;
    if (this._hass.states[scriptId]) this._call('script', 'turn_on', { entity_id: scriptId, variables: { axis, distance: dist } });
    else this._fire('hass-notification', { message: 'Jogging needs the moonraker.send_gcode service or a script.' + this._config.base_entity + '_jog' });
  }

  // Drag on a speed/flow track or a fan's bars; the value is sent on release.
  _onPointerDown(ev) {
    const el = ev.composedPath().find((n) => n instanceof Element && n.dataset?.drag);
    if (!el || el.classList.contains('dis') || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    const st = this._effectiveStatus();
    if (st === 'off' || st === 'offline') return;
    ev.preventDefault();
    el.setPointerCapture(ev.pointerId);
    this._dragging = true;
    const min = Number(el.dataset.min), max = Number(el.dataset.max), step = Number(el.dataset.step) || 1;
    const unit = el.dataset.unit;
    const dv = el.parentElement.querySelector('.dv');
    let value = null;
    const apply = (e2) => {
      const r = el.getBoundingClientRect();
      let f = clamp((e2.clientX - r.left) / r.width, 0, 1);
      if (el.dataset.drag === 'bars') f = Math.round(f * 10) / 10;
      value = clamp(Math.round((min + f * (max - min)) / step) * step, min, max);
      const ff = (value - min) / ((max - min) || 1);
      if (el.dataset.drag === 'track') el.querySelector('i').style.width = `${(ff * 100).toFixed(1)}%`;
      else el.querySelectorAll('span').forEach((s, i) => s.classList.toggle('on', i < Math.round(ff * 10)));
      if (dv) dv.textContent = !(value > min) && el.dataset.drag === 'bars' ? this._t('off')
        : unit === '%' ? `${Math.round(value)}%` : max <= 1 || !unit ? `${Math.round(ff * 100)}%` : `${Math.round(value)}${unit}`;
    };
    apply(ev);
    const move = (e2) => apply(e2);
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      this._dragging = false;
      if (value != null) this._setNum(el.dataset.entity, value);
      this._render();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  // ── CSS ─────────────────────────────────────────────────────────────────────
  _css() {
    return `
:host {
  --bg: #0b0d12; --bg2: #11141b; --surface: #161a22; --surface2: #1d222c; --line: rgba(255,255,255,.07);
  --text: #f2f3f5; --text2: #a9afbb; --text3: #737b8c;
  --amber: #ffb347; --heat: #ff7a45; --ok: #4ade80; --danger: #ff5c6c; --violet: #a78bfa; --blue: #8aa2ff; --fan: #34d1a6;
  --hot: #ff7a45; --bed: #3fa9ff; --cham: #a78bfa;
  --r-lg: 26px;
  display: block; container-type: inline-size; color: var(--text);
  font-family: Inter, Figtree, Roboto, system-ui, sans-serif; -webkit-font-smoothing: antialiased;
}
* { box-sizing: border-box; }
button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
button:disabled { cursor: default; opacity: .38; }
.i { fill: currentColor; flex-shrink: 0; display: block; }
/* readings that open the entity's history: unchanged at rest */
[data-more-info] { cursor: pointer; text-underline-offset: 3px; }
[data-more-info]:focus { outline: none; }
@media (hover: hover) { [data-more-info]:not(.fact, .t, .pos > div):hover { text-decoration: underline dotted color-mix(in srgb, currentColor 50%, transparent); } }
[data-more-info]:not(.fact, .t, .pos > div):focus-visible { text-decoration: underline solid color-mix(in srgb, var(--mc, #8aa2ff) 80%, transparent); background-color: rgba(255,255,255,.08); border-radius: 4px; }
@media (hover: hover) { :is(.fact, .t, .pos > div)[data-more-info]:hover { box-shadow: inset 0 0 0 1px rgba(255,255,255,.14); } }
:is(.fact, .t, .pos > div)[data-more-info]:focus-visible { box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--mc, #8aa2ff) 70%, transparent); }
.label { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--text3); font-weight: 600; }

.card { background: linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.012)), var(--bg2); border: 1px solid var(--line); border-radius: 30px; overflow: hidden; user-select: none; -webkit-user-select: none; }

/* header: buttons never shrink; the pill goes first when it gets tight */
.dh { display: flex; align-items: center; gap: 10px; padding: 18px 20px 0; }
.dh .ic { width: 42px; height: 42px; border-radius: 14px; display: grid; place-items: center; flex-shrink: 0; background: color-mix(in srgb, var(--mc) 16%, transparent); color: var(--mc); }
.dh .tt { min-width: 0; flex: 0 1 auto; }
.dh h3 { margin: 0; font-size: 17px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dh p { margin: 1px 0 0; font-size: 12.5px; color: var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dh .sp { flex: 1; }
.pill { height: 30px; padding: 0 12px; border-radius: 999px; display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; white-space: nowrap; flex-shrink: 0;
  color: var(--mc); background: color-mix(in srgb, var(--mc) 14%, transparent); border: 1px solid color-mix(in srgb, var(--mc) 35%, transparent); }
.pill i { width: 7px; height: 7px; border-radius: 50%; background: var(--mc); box-shadow: 0 0 8px var(--mc); }
@container (max-width: 600px) { .dh .pill { display: none; } }
.iconbtn { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; color: var(--text2); background: rgba(255,255,255,.05); border: 1px solid var(--line); flex-shrink: 0; }
.iconbtn:hover { color: var(--text); }
.iconbtn.danger { color: var(--danger); background: rgba(255,92,108,.1); border-color: rgba(255,92,108,.28); }
.iconbtn.danger.armed { color: #fff; background: var(--danger); animation: pulse 1s ease-in-out infinite; }
.power { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; flex-shrink: 0; background: var(--ok); color: #06140b; box-shadow: 0 0 0 5px rgba(74,222,128,.18); }
.power.off { background: rgba(255,255,255,.07); color: var(--text2); box-shadow: none; border: 1px solid var(--line); }
.power.armed { background: var(--danger); color: #fff; box-shadow: 0 0 0 5px rgba(255,92,108,.25); animation: pulse 1s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .6; } }

.banner { margin: 14px 20px 0; border-radius: 14px; padding: 10px 12px; font-size: 12.5px; display: flex; gap: 9px; align-items: center; background: rgba(138,162,255,.1); border: 1px solid rgba(138,162,255,.25); color: #c9d3ff; }
.banner.bad { background: rgba(255,92,108,.1); border-color: rgba(255,92,108,.3); color: #ffc2c8; }

.body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; padding: 16px 16px 18px; }
.col { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.col > div:empty { display: none; }
@container (min-width: 700px) {
  .body { grid-template-columns: minmax(0, 380px) minmax(0, 1fr); gap: 20px; padding: 18px 22px 22px; }
  .is-off .body { grid-template-columns: minmax(0, 1fr); }
  .is-off .c1 { display: grid; grid-template-columns: 1fr 1fr; align-items: start; }
  .is-off .c2 { display: none; }
}

/* live view */
.hero { border-radius: var(--r-lg); background: radial-gradient(260px 200px at 50% 60%, rgba(255,122,69,.1), transparent 70%), var(--surface); border: 1px solid var(--line); overflow: hidden; }
.view { position: relative; height: 250px; display: grid; place-items: center; }
@container (max-width: 480px) { .view { height: 220px; } }
.draw { display: grid; place-items: center; width: 100%; height: 100%; }
.draw svg { width: 250px; height: 230px; max-width: 100%; }
.camwrap { position: absolute; inset: 0; background: #000; overflow: hidden; }
.cam { display: block; width: 100%; height: 100%; transform: rotate(var(--rot, 0deg)); transform-origin: center; }
.cam.r90, .cam.r270 { transform: rotate(var(--rot)) scale(1.78); }
.live { position: absolute; top: 12px; left: 12px; font-size: 10.5px; font-weight: 700; letter-spacing: .08em; background: rgba(255,92,108,.9); color: #fff; padding: 3px 7px; border-radius: 6px; pointer-events: none; }
.tabs { display: flex; flex-direction: column; gap: 6px; padding: 8px; border-top: 1px solid var(--line); background: rgba(0,0,0,.18); }
.trow { display: flex; gap: 6px; }
.view.both { height: auto; display: flex; flex-direction: column; }
.view.both .draw { height: 230px; }
.view.both .camwrap { position: relative; inset: auto; width: 100%; aspect-ratio: var(--cam-ar, 16 / 9); border-top: 1px solid var(--line); }
.view.camonly { height: auto; display: block; }
.view.camonly .camwrap { position: relative; inset: auto; width: 100%; aspect-ratio: var(--cam-ar, 16 / 9); }
.tabs:empty { display: none; }
.tabs button { flex: 1; min-width: 0; height: 32px; border-radius: 10px; font-size: 12px; font-weight: 600; color: var(--text2); display: flex; align-items: center; justify-content: center; gap: 6px; }
.tabs button span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tabs button.on { background: rgba(255,255,255,.08); color: var(--text); }
.th-run { animation: sweep 2.6s ease-in-out infinite alternate; }
@keyframes sweep { from { transform: translateX(-30px); } to { transform: translateX(30px); } }

/* progress */
.prog { border-radius: var(--r-lg); background: var(--surface); border: 1px solid var(--line); padding: 16px 16px 14px; }
.prog .top { display: flex; gap: 14px; align-items: center; }
.thumb { width: 64px; height: 64px; border-radius: 16px; background: rgba(255,255,255,.05); display: grid; place-items: center; flex-shrink: 0; border: 1px solid var(--line); color: var(--text3); overflow: hidden; position: relative; }
.thumb.has { background: #0f1218; }
.thumb.has > .i { display: none; }
.thumb-img { width: 100%; height: 100%; object-fit: contain; }
.fn { min-width: 0; flex: 1; }
.fn b { display: block; font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fn small { font-size: 12px; color: var(--text2); }
.pct { font-size: 40px; font-weight: 300; letter-spacing: -.03em; line-height: 1; flex-shrink: 0; }
.pct sup { font-size: 16px; color: var(--text2); vertical-align: top; position: relative; top: 5px; }
.bar { height: 10px; border-radius: 6px; background: rgba(255,255,255,.07); margin: 14px 0 12px; overflow: hidden; position: relative; }
.bar i { position: absolute; inset: 0 auto 0 0; border-radius: 6px; background: linear-gradient(90deg, color-mix(in srgb, var(--mc) 60%, transparent), var(--mc)); transition: width .4s; }
.facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.facts.f3 { grid-template-columns: repeat(3, minmax(0, 1fr)); width: 100%; }
@container (max-width: 420px) { .facts:not(.f3) { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.fact { border-radius: 13px; background: rgba(0,0,0,.25); padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.fact span { font-size: 10.5px; color: var(--text3); }
.fact b { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@container (min-width: 421px) and (max-width: 860px) { .fact b { font-size: 13px; } }
.btns { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.btns.n1 { grid-template-columns: 1fr; }
.big { height: 48px; border-radius: 15px; font-size: 14px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; background: rgba(255,255,255,.06); border: 1px solid var(--line); }
.big.warn { background: rgba(255,179,71,.14); border-color: rgba(255,179,71,.32); color: var(--amber); }
.big.stop { background: rgba(255,92,108,.1); border-color: rgba(255,92,108,.28); color: var(--danger); }
.big.stop.armed { background: var(--danger); color: #fff; }
.big.go { background: var(--ok); color: #06140b; border: 0; }

/* off */
.offhero { border-radius: var(--r-lg); background: var(--surface); border: 1px solid var(--line); padding: 18px; display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
.offart svg { width: 180px; height: 160px; opacity: .45; display: block; }
.offhero p { margin: 0; font-size: 13px; color: var(--text2); line-height: 1.45; }
.offhero .big { width: 100%; }

/* blocks */
.blk .bh { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin: 0 2px 8px; }
.blk .bh small { font-size: 12px; color: var(--text2); text-align: right; }

/* temperatures */
.temps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.t { border-radius: 16px; background: var(--surface); border: 1px solid var(--line); padding: 11px 12px 10px; min-width: 0; text-align: left; display: flex; flex-direction: column; }
.t.heat { background: radial-gradient(120px 80px at 0% 0%, color-mix(in srgb, var(--tc) 16%, transparent), transparent 80%), var(--surface); border-color: color-mix(in srgb, var(--tc) 28%, transparent); }
.t .n { font-size: 11.5px; color: var(--text2); display: flex; gap: 5px; align-items: center; min-width: 0; }
.t .n span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.t .n .i { color: var(--tc); }
.t .v { font-size: 22px; font-weight: 500; margin-top: 4px; letter-spacing: -.02em; white-space: nowrap; }
.t .v small { font-size: 12px; color: var(--text3); font-weight: 500; margin-left: 3px; letter-spacing: 0; }
.t .tb { height: 4px; border-radius: 3px; background: rgba(255,255,255,.07); margin-top: 8px; position: relative; }
.t .tb i { position: absolute; inset: 0 auto 0 0; border-radius: 3px; background: var(--tc); }
.t .tb em { position: absolute; top: -3px; width: 2px; height: 10px; border-radius: 1px; background: var(--text); margin-left: -1px; }
.t.sel { outline: 2px solid var(--tc); outline-offset: -1px; }
@container (max-width: 400px) { .t .v { font-size: 19px; } .t .v small { display: none; } }
.setter { grid-column: 1 / -1; border-radius: 16px; background: rgba(0,0,0,.28); padding: 10px 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.setter .lbl { font-size: 12.5px; color: var(--text2); flex: 1; min-width: 0; }
.setter .lbl b { color: var(--text); font-weight: 600; }
.setter .presets { order: 3; width: 100%; display: flex; gap: 6px; flex-wrap: wrap; }
.step { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; background: rgba(255,255,255,.06); border: 1px solid var(--line); flex-shrink: 0; }
.setter .val { font-size: 20px; font-weight: 500; min-width: 58px; text-align: center; }
.chip { height: 34px; padding: 0 12px; border-radius: 11px; font-size: 12.5px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,.05); border: 1px solid var(--line); color: var(--text2); white-space: nowrap; }
.chip.on { background: color-mix(in srgb, var(--mc) 16%, transparent); border-color: color-mix(in srgb, var(--mc) 42%, transparent); color: var(--text); }
.chips { display: flex; gap: 7px; flex-wrap: wrap; }

/* tune */
.tune { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@container (max-width: 480px) { .tune { grid-template-columns: 1fr; } }
.sl { border-radius: 16px; background: var(--surface); border: 1px solid var(--line); padding: 10px 12px 12px; min-width: 0; }
.dbody .sl { background: rgba(0,0,0,.2); }
.sl .h { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--text2); margin-bottom: 8px; }
.sl .h span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sl .h b { color: var(--text); font-weight: 600; flex-shrink: 0; }
.bars { display: flex; gap: 4px; align-items: flex-end; height: 30px; touch-action: none; cursor: pointer; }
.bars span { flex: 1; border-radius: 5px; background: rgba(255,255,255,.07); pointer-events: none; }
.bars span.on { background: var(--sc); }
.track { height: 30px; border-radius: 10px; background: rgba(0,0,0,.3); position: relative; overflow: hidden; touch-action: none; cursor: pointer; }
.track i { position: absolute; inset: 0 auto 0 0; background: color-mix(in srgb, var(--sc) 35%, transparent); border-right: 3px solid var(--sc); pointer-events: none; }
.track .mid { position: absolute; top: 6px; bottom: 6px; width: 1px; background: rgba(255,255,255,.25); pointer-events: none; }
.bars.dis, .track.dis { opacity: .35; cursor: default; }
.tune-n { display: none; }
@container (max-width: 699px) { .tune-w { display: none; } .tune-n { display: block; } }

/* folding sections */
details { border-radius: 18px; background: var(--surface); border: 1px solid var(--line); }
summary { list-style: none; display: flex; align-items: center; gap: 10px; padding: 13px 14px; font-size: 13.5px; cursor: pointer; min-width: 0; }
summary::-webkit-details-marker { display: none; }
summary > .i { color: var(--text2); }
summary b { font-weight: 600; flex-shrink: 0; }
summary small { font-size: 12px; color: var(--text3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
summary .chev { margin-left: auto; color: var(--text3); display: grid; transition: transform .2s; flex-shrink: 0; }
details[open] summary .chev { transform: rotate(180deg); }
.dbody { padding: 0 14px 14px; display: flex; flex-direction: column; gap: 12px; }
.pos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.pos div { border-radius: 11px; background: rgba(0,0,0,.25); padding: 6px 9px; font-size: 11px; color: var(--text3); }
.pos b { display: block; font-size: 14px; color: var(--text); font-weight: 600; }
.mrow { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.mrow .label { min-width: 44px; }
.move { display: flex; gap: 16px; align-items: flex-start; }
.jog { display: grid; grid-template-columns: repeat(3, 44px); grid-template-rows: repeat(3, 44px); gap: 6px; }
.jog button, .zcol button { width: 44px; height: 44px; border-radius: 13px; background: rgba(255,255,255,.06); border: 1px solid var(--line); display: grid; place-items: center; color: var(--text2); }
.jog button.home { color: var(--ok); }
.zcol { display: grid; grid-template-rows: 44px 44px 44px; gap: 6px; justify-items: center; align-items: center; }
.zl { font-size: 12px; font-weight: 700; color: var(--text3); }
.macros { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
@container (max-width: 480px) { .macros { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.macros button { height: 38px; border-radius: 12px; background: rgba(255,255,255,.05); border: 1px solid var(--line); font-size: 12px; font-weight: 600; color: var(--text2); display: flex; align-items: center; gap: 7px; padding: 0 10px; min-width: 0; }
.macros button span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.macros button .i { color: var(--violet); }
.sysl { margin-top: 2px; }
.sysg { display: flex; flex-wrap: wrap; gap: 7px; }
.sys { height: 38px; padding: 0 12px; border-radius: 12px; background: rgba(255,255,255,.05); border: 1px solid var(--line); font-size: 12.5px; font-weight: 600; color: var(--text2); display: inline-flex; align-items: center; gap: 7px; }
.sys.danger { color: var(--danger); border-color: rgba(255,92,108,.28); background: rgba(255,92,108,.08); }
.sys.armed { background: var(--danger); color: #fff; }

/* compact glance */
.glance { border-radius: 22px; background: var(--surface); padding: 14px; }
.gh { display: flex; align-items: center; gap: 12px; }
.gi { width: 46px; height: 46px; border-radius: 15px; display: grid; place-items: center; background: color-mix(in srgb, var(--mc) 16%, transparent); color: var(--mc); flex-shrink: 0; }
.gt { flex: 1; min-width: 0; }
.gt b { display: block; font-size: 14.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gt small { display: block; font-size: 12.5px; color: var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.glance .bar { margin: 12px 0 0; height: 8px; }
.gtemps { display: flex; gap: 14px; font-size: 12.5px; color: var(--text2); margin-top: 10px; align-items: center; }
.gtemps:empty { display: none; }
.gtemps span { display: flex; gap: 4px; align-items: center; white-space: nowrap; }
.gtemps .i { color: var(--hot); }
.gtemps .b .i { color: var(--bed); }
.gtemps .c .i { color: var(--cham); }
.gtemps .r { margin-left: auto; }
.foot { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--line); font-size: 12.5px; color: var(--text3); }
.foot span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.link { font-size: 12.5px; font-weight: 600; color: var(--text); display: inline-flex; gap: 2px; align-items: center; white-space: nowrap; flex-shrink: 0; }
.toggle { width: 46px; height: 28px; border-radius: 999px; background: rgba(255,255,255,.12); position: relative; flex-shrink: 0; }
.toggle::after { content: ""; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; transition: left .2s; }
.toggle.on { background: var(--ok); }
.toggle.on::after { left: 21px; }
`;
  }
}

customElements.define(CARD_TAG, PrinterCard3D);

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: '3D Printer Card',
  description: 'Dark, app-style card for Moonraker/Klipper printers: live drawing and cameras, progress, heaters, tuning, movement and macros. variant: compact gives a glance card.',
  preview: false,
});

console.info(`%c 3D-PRINTER-CARD %c v${CARD_VERSION} `, 'background:#4ade80;color:#06140b;font-weight:700', 'background:#161a22;color:#f2f3f5');
