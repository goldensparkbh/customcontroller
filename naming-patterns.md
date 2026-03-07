# Zoho Item Naming Guide (PS5 Configurator)

This configurator only ingests Zoho Inventory items whose **name** matches:

```
ps5_{part}_{gamemode|color}_{value}
ps5_{part}_color_{transparent|solid}_{value}
ps5_{part}_color_{trans|t|opaque|s}_{value}
```

## Supported parts

Use one of these part slugs (lowercase):
- shell
- trimpiece
- stickL
- stickR
- faceButtons
- touchpad
- bumpers
- psButton
- share
- options
- backShellMain
- backHandles
- backTriggers

## Gamemode items (primary list)

Pattern: `ps5_{part}_gamemode_{value}`
- Valid values: `standard`, `hall effect` (or `halleffect`), `tmr`
- Example: `ps5_stickL_gamemode_tmr`

## Color items (secondary list)

Pattern (legacy): `ps5_{part}_color_{value}`
Pattern (with transparency): `ps5_{part}_color_{transparent|solid}_{value}`
Short forms accepted: `ps5_{part}_color_{trans|t|opaque|s}_{value}`
- Value can be:
  - A known color slug (see below), e.g. `red`, `midnight blue`, `frosted white`
  - A hex code (`ff0000` or `#ff0000`)
- Example: `ps5_shell_color_red`, `ps5_backTriggers_color_ffcc00`
- Transparency tag behavior (front parts only):
  - `transparent` -> use `/assets/controller_t.png`
  - `solid` -> use `/assets/controller.png`

### Known color slugs
- orange, yellow, light blue, steel gray, blue, midnight blue, magenta, soft white, hot pink, hot pink_shell, matte black, black, light gray, red, dark blue purple, mint green, royal purple, sky blue, pink violet, indigo purple, clear, transparent red, transparent blue, transparent green, transparent purple, gunmetal gray, transparent brown, frosted white

## Stock & price

- Price comes from the item `rate`.
- Quantity is read from `available_stock/available_quantity/...`.
  - ≤0: marked “Out of Stock” (disabled)
  - <5: shows “(N pieces left)” (or Arabic equivalent)
  - ≥5: no qty message

## Quick examples

- Gamemode: `ps5_stickR_gamemode_hall effect`
- Color (named): `ps5_faceButtons_color_midnight blue`
- Color (hex): `ps5_shell_color_#00ffcc`
- Color (transparent): `ps5_shell_color_transparent_clear`
- Color (transparent, short): `ps5_shell_color_trans_clear`
- Color (solid, short): `ps5_shell_color_solid_matte black`

## Visual cheat-sheet

```
ps5_stickL_gamemode_tmr          -> primary list, shows TMR option
ps5_stickL_color_red             -> secondary list, shows Red swatch
ps5_shell_color_ff8800           -> secondary list, shows hex swatch
ps5_backTriggers_gamemode_tmr    -> primary list, shows TMR option
ps5_backTriggers_color_gunmetal  -> secondary list, shows Gunmetal swatch
```
