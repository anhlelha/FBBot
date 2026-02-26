# Mockup Creation Guide

> **Objective:** Create high-fidelity, interactive HTML+CSS mockups that match the project's design system and standards.
> **Reference:** `ref/mockups/index.html` + `ref/mockups/styles.css`

---

## ⚡ MANDATORY: Read Reference Files First

Before generating any mockup, **always study** the reference files:

- `ref/mockups/index.html` — Page structure, component patterns, SVG icon usage
- `ref/mockups/styles.css` — Full design system (tokens, components, utilities)

> 🔴 **DO NOT invent a new design system.** Extend and reuse the existing one.

---

## 🎨 Design System (From Reference)

### CSS Variables — Design Tokens

The reference uses a comprehensive `:root` token system. **Always use tokens, never hardcode values.**

```css
/* Colors */
--color-primary: #ff9900;        /* Main accent */
--color-primary-dark: #ec7211;
--color-primary-light: #ffb84d;
--color-accent: #00a1c9;

/* Backgrounds (dark mode) */
--bg-primary: #0d1117;
--bg-secondary: #161b22;
--bg-tertiary: #21262d;
--bg-elevated: #30363d;
--bg-hover: rgba(255, 153, 0, 0.1);

/* Text */
--text-primary: #f0f6fc;
--text-secondary: #8b949e;
--text-muted: #6e7681;

/* Status */
--color-success: #3fb950;
--color-warning: #d29922;
--color-error: #f85149;
--color-info: #58a6ff;

/* Borders & Radius */
--border-color: #30363d;
--border-radius-sm: 6px;
--border-radius-md: 8px;
--border-radius-lg: 12px;

/* Spacing (8-point grid) */
--space-xs: 4px; --space-sm: 8px;
--space-md: 16px; --space-lg: 24px;
--space-xl: 32px; --space-2xl: 48px;

/* Typography */
--font-family: 'Inter', -apple-system, sans-serif;
--font-size-xs: 12px; --font-size-sm: 14px;
--font-size-md: 16px; --font-size-lg: 18px;
--font-size-xl: 24px; --font-size-2xl: 32px;

/* Transitions */
--transition-fast: 0.15s ease;
--transition-normal: 0.25s ease;
```

### Typography: Google Fonts Import (Always Include)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

---

## 🏗️ File Structure

Every mockup consists of **2 files**:

```
mockups/
├── index.html      ← All pages, JS navigation, inline page-specific styles
└── styles.css      ← Shared design system (tokens + reusable components)
```

### HTML Skeleton

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Project Name] - Mockup</title>
  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <!-- Shared Design System -->
  <link rel="stylesheet" href="styles.css">
  <style>
    /* Page-specific styles only — not reusable component styles */
    .page { display: none; }
    .page.active { display: block; }
    /* Layout variants, page-specific grids, etc. */
  </style>
</head>
<body>
  <div class="app-container">
    <!-- Sidebar -->
    <aside class="sidebar">...</aside>
    <!-- Main content with multiple pages -->
    <main class="main-content">
      <div id="page-1" class="page active">...</div>
      <div id="page-2" class="page">...</div>
    </main>
  </div>

  <!-- Mockup Navigation (bottom-right floating panel) -->
  <nav class="mockup-nav">
    <button class="mockup-nav-btn active" onclick="showPage('page-1')">Page 1</button>
    <button class="mockup-nav-btn" onclick="showPage('page-2')">Page 2</button>
  </nav>

  <script>
    function showPage(pageId) {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.mockup-nav-btn').forEach(b => b.classList.remove('active'));
      document.getElementById(pageId).classList.add('active');
      event.target.classList.add('active');
    }

    // Sidebar navigation
    document.querySelectorAll('[data-page]').forEach(item => {
      item.addEventListener('click', function(e) {
        e.preventDefault();
        const pageId = this.dataset.page;
        showPage(pageId);
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');
      });
    });
  </script>
</body>
</html>
```

---

## 🧩 Component Patterns (Copy from Reference)

### Layout: App Shell

```html
<div class="app-container">
  <aside class="sidebar">
    <div class="sidebar-header">
      <a href="#" class="logo">
        <div class="logo-icon"><!-- SVG icon --></div>
        <div>
          <div class="logo-text">App Name</div>
          <div class="logo-subtitle">Tagline</div>
        </div>
      </a>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-section">
        <div class="nav-section-title">Section</div>
        <a href="#" class="nav-item active" data-page="dashboard">
          <!-- SVG icon (20×20) -->
          <span>Dashboard</span>
          <!-- Optional: <span class="nav-item-badge">5</span> -->
        </a>
      </div>
    </nav>
  </aside>
  <main class="main-content">
    <header class="page-header">
      <div class="page-header-content">
        <div>
          <h1 class="page-title">Page Title</h1>
          <p class="page-subtitle">Subtitle description</p>
        </div>
        <div style="display:flex; gap:12px;">
          <button class="btn btn-secondary">Secondary</button>
          <button class="btn btn-primary">Primary</button>
        </div>
      </div>
    </header>
    <div class="page-body"><!-- Content --></div>
  </main>
</div>
```

### Stats Grid

```html
<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-icon primary"><!-- SVG 24×24 --></div>
    <div class="stat-content">
      <div class="stat-value">1,247</div>
      <div class="stat-label">Total Items</div>
      <div class="stat-change positive">↑ 12% this week</div>
    </div>
  </div>
</div>
<!-- stat-icon variants: primary | success | info | warning -->
<!-- stat-change variants: positive | negative -->
```

### Card

```html
<div class="card">
  <div class="card-header">
    <h3 class="card-title">Card Title</h3>
    <button class="btn btn-ghost btn-sm">Action</button>
  </div>
  <div class="card-body"><!-- Content --></div>
  <div class="card-footer"><!-- Footer --></div>
</div>
```

### Buttons

```html
<!-- Variants: btn-primary | btn-secondary | btn-ghost | btn-success | btn-danger -->
<!-- Sizes: (default) | btn-lg | btn-sm | btn-icon -->
<button class="btn btn-primary">
  <!-- SVG 16×16 -->
  Label
</button>
```

### Form Elements

```html
<div class="form-group">
  <label class="form-label">Label</label>
  <input type="text" class="form-input" placeholder="Placeholder">
  <!-- Select: add class form-select -->
  <!-- Textarea: add class form-textarea -->
</div>
```

### Tags / Badges

```html
<!-- Variants: (default) | primary | success | info | warning -->
<span class="tag success">Active</span>
```

### Progress Bar

```html
<div class="progress-bar">
  <div class="progress-fill" style="width: 75%;"></div>
</div>
```

### Table

```html
<table class="table">
  <thead><tr><th>Col 1</th><th>Col 2</th></tr></thead>
  <tbody>
    <tr><td>Value</td><td><span class="tag success">Status</span></td></tr>
  </tbody>
</table>
```

### Upload Zone

```html
<div class="upload-zone" id="dropzone">
  <div class="upload-icon"><!-- SVG 48×48 --></div>
  <div class="upload-text">Drop files here or click to browse</div>
  <div class="upload-hint">Supports files up to 50MB</div>
  <input type="file" style="display:none;" id="fileInput">
</div>
```

### Toggle Switch

```html
<!-- Add class "active" to toggle on -->
<div class="toggle active"></div>
```

### Mockup Nav (Floating Page Switcher)

```html
<nav class="mockup-nav">
  <button class="mockup-nav-btn active">Dashboard</button>
  <button class="mockup-nav-btn">Settings</button>
</nav>
```

---

## 🖼️ SVG Icons — Rules

> 🔴 **CRITICAL: NEVER use icon fonts (Font Awesome, Lucide React, etc.) in mockups. ONLY inline SVG.**

### Standard Sizes
| Context | Size |
|---------|------|
| Sidebar nav | `width="20" height="20"` |
| Buttons | `width="16" height="16"` |
| Stat cards | `width="24" height="24"` |
| Upload zones | `width="48" height="48"` |
| Logo | `width="24" height="24"` |

### SVG Attributes (Always Include)
```html
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <!-- paths here -->
</svg>
```

### Common SVG Paths (Reference — Use These)

```html
<!-- Dashboard/Grid -->
<rect x="3" y="3" width="7" height="7"/>
<rect x="14" y="3" width="7" height="7"/>
<rect x="14" y="14" width="7" height="7"/>
<rect x="3" y="14" width="7" height="7"/>

<!-- Upload Arrow Up -->
<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
<polyline points="17 8 12 3 7 8"/>
<line x1="12" y1="3" x2="12" y2="15"/>

<!-- Check / Success -->
<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
<polyline points="22 4 12 14.01 9 11.01"/>

<!-- Checkmark -->
<polyline points="20 6 9 17 4 12"/>

<!-- Settings Gear -->
<circle cx="12" cy="12" r="3"/>
<path d="M19.4 15a1.65..."/>  <!-- (full path from reference) -->

<!-- Edit Pencil -->
<path d="M12 20h9"/>
<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>

<!-- Trash -->
<polyline points="3 6 5 6 21 6"/>
<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6..."/>

<!-- Download Arrow Down -->
<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
<polyline points="7 10 12 15 17 10"/>
<line x1="12" y1="15" x2="12" y2="3"/>

<!-- Refresh -->
<polyline points="23 4 23 10 17 10"/>
<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>

<!-- Clock -->
<circle cx="12" cy="12" r="10"/>
<polyline points="12 6 12 12 16 14"/>
```

---

## 📋 CSS File Structure (styles.css)

Structure the CSS in this order:

```css
/* 1. CSS Variables / Design Tokens */
:root { ... }

/* 2. Reset & Base */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body { font-family: var(--font-family); ... }

/* 3. Layout */
.app-container { display: flex; min-height: 100vh; }

/* 4. Sidebar */
.sidebar { ... }
.sidebar-header, .logo, .sidebar-nav { ... }
.nav-section, .nav-item, .nav-item-badge { ... }

/* 5. Main Content */
.main-content, .page-header, .page-body { ... }

/* 6. Cards */
.card, .card-header, .card-body, .card-footer { ... }

/* 7. Stat Cards */
.stats-grid, .stat-card, .stat-icon, .stat-content { ... }

/* 8. Buttons */
.btn, .btn-primary, .btn-secondary, .btn-ghost { ... }

/* 9. Form Elements */
.form-group, .form-label, .form-input, .form-select { ... }

/* 10. Upload Zone */
.upload-zone, .upload-icon, .upload-text { ... }

/* 11. Progress Bar */
.progress-bar, .progress-fill { ... }

/* 12. Tags */
.tag, .tag.success, .tag.primary { ... }

/* 13. Tables */
.table { ... }

/* 14. Toggles */
.toggle, .toggle.active { ... }

/* 15. Utility */
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-lg); }
.fade-in { animation: fadeIn 0.3s ease; }

/* 16. Animations */
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

/* 17. Responsive */
@media (max-width: 1200px) { ... }
```

---

## ✅ Mockup Quality Checklist

Before delivering a mockup, verify:

| Check | Rule |
|-------|------|
| **Tokens** | All colors/spacing use CSS variables, no hardcoded values |
| **SVG Only** | Zero icon fonts — all icons are inline SVG |
| **Font Loaded** | Inter font imported from Google Fonts |
| **Dark Mode** | All backgrounds use `--bg-*` tokens |
| **Hover States** | All interactive elements have `:hover` styles |
| **Page Navigation** | Mockup nav panel exists, all pages switchable |
| **Responsive** | Layout works at 1200px and below |
| **Active States** | Nav items show `.active` class correctly |
| **Status Colors** | Success/warning/error use status tokens |
| **Transitions** | All transitions use `var(--transition-*)` |

---

## 🚫 Anti-Patterns (NEVER Do in Mockups)

| Bad | Good |
|-----|------|
| `color: #ff9900` (hardcoded) | `color: var(--color-primary)` |
| `<i class="fa fa-icon">` | `<svg ...>...</svg>` |
| Tailwind classes | Vanilla CSS with class system |
| Inline `style="background: #161b22"` | Use component class `.card` |
| Generic placeholder images | ASCII/SVG diagrams as placeholders |
| Purple / Violet colors | Follow project palette tokens |
| Mesh gradients as backgrounds | Flat dark backgrounds with token colors |
| Multiple separate JS files | Single `<script>` block at bottom of HTML |

---

## 📁 Naming & File Placement

```
# Always place mockups in:
[project-root]/mockups/

# Naming convention:
mockups/
├── index.html          ← Main multi-page mockup
├── styles.css          ← Shared design system
├── [feature]-flow.html ← Optional: isolated flow mockups
└── [feature].css       ← Optional: feature-specific styles
```

---

> **Remember:** A mockup's job is to communicate design intent clearly to developers. Every component pattern must be immediately copy-paste ready. Do not use placeholder lorem ipsum for important UI states — show real-looking data.
