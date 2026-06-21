# Phase 3 — Core Features Implementation Plan

> **For agentic workers:** Inline execution — each task is self-contained and testable.

**Goal:** Memisahkan business logic dari `commands/` ke `handlers/` untuk Register, Start, Confess, Profile + resolve duplicate handler bug.

**Architecture:** 
- `commands/xxx.js` → hanya registrasi handler ke bot (thin entry point)
- `handlers/xxx.handler.js` → pure business logic functions
- start.js dan profile.js saat ini punya 7 handler DUPLICATE — akan di-consolidate ke profile.js

**Tech Stack:** Node.js + Telegraf

---

### Task 1: Bersihkan duplicate handlers dari start.js

**Files:**
- Modify: `src/commands/start.js`

**Problem:** start.js memiliki handler `edit_gender`, `set_gender_`, `edit_origin`, `cancel_edit_origin`, `privacy_settings`, `toggle_hide_`, `pendingOriginEdit`, `btn_upgrade_rank`, `upgrade_to_` + text handler untuk origin edit — PADAHAL handler2 ini juga ada di profile.js.

**Action:** Hapus semua handler profile-related dari start.js. start.js hanya handle: main menu, membership, help, FAQ, view confessions.

- [ ] **Step 1: Hapus edit_gender, set_gender_, edit_origin, cancel_edit_origin, pendingOriginEdit Map, privacy_settings, toggle_hide_, serta bot.on('text') untuk origin dari start.js.**
- [ ] **Step 2: Hapus btn_upgrade_rank, upgrade_to_ dari start.js** — pindahkan ke profile.js karena terkait profile.

---

### Task 2: Pindahkan handler yang dihapus ke profile.js

**Files:**
- Modify: `src/commands/profile.js`

**Action:** Pastikan profile.js menangani SEMUA handler yang dihapus dari start.js. Tambahkan membershipMiddleware.

- [ ] **Step 1: Tambahkan semua handler profile ke profile.js** — edit_gender, set_gender_, edit_origin, cancel_edit_origin, privacy_settings, toggle_hide_, btn_upgrade_rank, upgrade_to_, pendingOriginEdit + text handler

---

### Task 3: Buat handlers/start.handler.js — main menu logic

**Files:**
- Create: `src/handlers/start.handler.js`

**Action:** Pindahkan fungsi showMainMenu, btn_view, btn_help, show_faq, back_to_main ke handler file.

- [ ] **Step 1: Buat handlers/start.handler.js dengan showMainMenu, handleViewConfessions, handleHelp, handleFaq, handleBackToMain**

---

### Task 4: Buat handlers/profile.handler.js — profile logic

**Files:**
- Create: `src/handlers/profile.handler.js`

**Action:** Pindahkan fungsi showProfile, showPrivacyMenu, edit handlers ke handler file.

- [ ] **Step 1: Buat handlers/profile.handler.js dengan showProfile, showPrivacyMenu, handleEditGender, handleSetGender, handleEditOrigin, handleOriginText, handlePrivacySettings, handleToggleHide**

---

### Task 5: Buat handlers/confession.handler.js — confession logic

**Files:**
- Create: `src/handlers/confession.handler.js`
- Modify: `src/commands/confess.js`

**Action:** Pindahkan business logic confession (rate limit check, format, send) ke handler.

- [ ] **Step 1: Buat handlers/confession.handler.js dengan handleConfessText, getRateLimitConfig, dan helper confession lainnya**

---

### Task 6: Update bot.js — sederhanakan text handler chain

**Files:**
- Modify: `src/bot.js`

**Action:** Rapikan chain handler di bot.on('text').

- [ ] **Step 1: Update bot.on('text') chain — profile text handler sudah pindah ke dalam profile.js**

---

### Task 7: Syntax check + runtime test + commit

- [ ] **Step 1: node --check semua file**
- [ ] **Step 2: timeout 10 node server.js**
- [ ] **Step 3: git add + commit**
