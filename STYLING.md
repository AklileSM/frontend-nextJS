# Styling Guide

This app uses **Tailwind CSS** for layout and static styles, and **Framer Motion** for transitions and animated UI elements. There is no CSS-in-JS, no Sass, and no component library.

---

## Color palette

All colors are defined in `tailwind.config.ts`. Do not use arbitrary hex values, use these tokens.

### `base` dark UI surfaces


| Token      | Hex       | Use                                                 |
| ---------- | --------- | --------------------------------------------------- |
| `base-950` | `#0B0E12` | Deepest background (page root, full-bleed sections) |
| `base-900` | `#13171D` | Card / panel backgrounds                            |
| `base-800` | `#1B2027` | Elevated surfaces (dropdowns, modals, hover states) |
| `base-700` | `#262C35` | Borders, dividers                                   |
| `base-600` | `#3A424E` | Subtle borders on interactive elements              |
| `base-500` | `#5C6573` | Muted icons, disabled states                        |
| `base-400` | `#8A93A1` | Secondary labels                                    |
| `base-300` | `#B8BFC9` | Tertiary text                                       |


### `ink` text on dark backgrounds


| Token     | Hex       | Use                                                                             |
| --------- | --------- | ------------------------------------------------------------------------------- |
| `ink-50`  | `#F4F6F8` | Primary text (headings, important labels) use `text-white` for maximum contrast |
| `ink-100` | `#E6EAEF` | Body text                                                                       |
| `ink-200` | `#C8CFD9` | Secondary text, list items                                                      |
| `ink-300` | `#9BA3AE` | Placeholder text, captions, helper text                                         |
| `ink-400` | `#6E7682` | Timestamps, metadata                                                            |


### `amber` accent / brand


| Token       | Hex       | Use                                                    |
| ----------- | --------- | ------------------------------------------------------ |
| `amber-400` | `#FBBF24` | Highlights, active badges                              |
| `amber-500` | `#F59E0B` | Primary accent avatars, active indicators, admin badge |
| `amber-600` | `#D97706` | Pressed/hover on amber elements                        |


**Pattern:** amber on dark surfaces uses a tinted background for subtle highlights:

```
bg-amber-500/15 text-amber-500   ← "admin" role badge
bg-amber-500/10 text-amber-400   ← subtle warning state
```

---

## Typography

Two font families, set via CSS variables in the root layout:


| Class          | Variable              | Use                                  |
| -------------- | --------------------- | ------------------------------------ |
| `font-display` | `--font-inter-tight`  | Headings, labels, nav items          |
| `font-body`    | `--font-inter`        | Body text, form fields, descriptions |
| `font-mono`    | `--font-inter` (same) | Metadata chips, timestamps, code     |


**Sizing convention:** use explicit pixel sizes in brackets rather than the default Tailwind scale to stay consistent with the design:

```
text-[10px]   ← metadata chips, tracking badges
text-[12px]   ← captions, secondary labels
text-[13px]   ← body text, menu items, form labels
text-[14px]   ← default UI text
text-[16px]   ← card titles
text-[18px]+  ← section headings
```

**Letter-spacing:** use `tracking-[0.18em]` (not `tracking-widest`) for uppercase monospaced chips.

---

## Common UI patterns

### Card / panel

```tsx
<div className="rounded-md border border-base-700 bg-base-900 p-4">
```

### Elevated surface (dropdown, modal)

```tsx
<div className="rounded-md border border-base-700 bg-base-900 shadow-2xl shadow-black/50">
```

### Interactive button (non-accent)

```tsx
<button className="rounded-sm px-3 py-2.5 text-[13px] text-ink-200 transition-colors hover:bg-base-800 hover:text-white">
```

### Border-button (outlined)

```tsx
<button className="rounded-md border border-base-700 bg-base-900/40 transition-colors hover:border-ink-300">
```

### Divider

```tsx
<div className="border-t border-base-800" />
```

### Badge / chip

```tsx
{/* Role badge */}
<span className="inline-flex items-center rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] bg-amber-500/15 text-amber-500">
  admin
</span>

{/* Neutral chip */}
<span className="rounded-sm bg-base-800 px-1.5 py-0.5 font-mono text-[10px] text-ink-300">
  label
</span>
```

---

## Framer Motion conventions

Use Motion for **overlay entrances**, **dropdown menus**, and **tab/panel transitions**. Do not use it for hover effects that CSS `transition-`* handles fine.

### Standard dropdown / popover entrance

```tsx
<motion.div
  initial={{ opacity: 0, y: -6, scale: 0.97 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  exit={{ opacity: 0, y: -6, scale: 0.97 }}
  transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
  style={{ transformOrigin: 'top right' }}
>
```

The easing `[0.22, 1, 0.36, 1]` is a custom ease-out that gives the entrance a snappy feel. Use it consistently for all pop-over entrances.

Always wrap conditionally-rendered Motion elements in `<AnimatePresence>` so the exit animation plays before unmount:

```tsx
<AnimatePresence>
  {open && (
    <motion.div key="menu" ...>
      {/* content */}
    </motion.div>
  )}
</AnimatePresence>
```

### Fade-in content

```tsx
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.2 }}
>
```

### When NOT to use Framer Motion

- Simple hover/focus color changes → use Tailwind `transition-colors hover:...`
- Loading spinners → use a CSS `animate-spin` class
- Scroll animations on the landing page → acceptable, but avoid on the app shell (it runs on every page render)

---

## Responsive design

The app is primarily a desktop tool. The responsive breakpoints that matter:


| Breakpoint        | Tailwind prefix | Used for                                                |
| ----------------- | --------------- | ------------------------------------------------------- |
| `< sm` (< 640 px) | *(no prefix)*   | Mobile, many text labels hidden                         |
| `sm` (≥ 640 px)   | `sm:`           | Show username in ProfileMenu, wider panels              |
| `lg` (≥ 1024 px)  | `lg:`           | Sidebar switches from drawer overlay to persistent rail |


The sidebar uses a single `open` boolean; the layout interprets it differently at `lg+` (rail vs expanded) and below `lg` (hidden vs overlay drawer). See `components/layout/SidebarContext.tsx`.

---

## What to avoid

- **Arbitrary colors**: use tokens. `text-[#FBBF24]` → `text-amber-400`.
- **Tailwind's default neutral/gray palette**: it conflicts with `base`/`ink`. Use only `base-`* and `ink-*` for grays.
- **Framer Motion for every animation**: CSS transitions are lighter. Save Motion for mount/unmount sequences.
- **Inline** `style={}` **for colors/spacing**: use Tailwind classes. `style={{ color: '#9BA3AE' }}` → `text-ink-300`.
- **Magic px numbers outside the** `text-[Npx]` **convention**: if you need a one-off size, use a bracket value but leave a comment explaining why.

