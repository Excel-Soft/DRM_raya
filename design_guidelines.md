# WebExcels DRM Design Guidelines

## Design Approach: Material Design for Enterprise

**Selected System**: Material Design 3 (adapted for enterprise data management)
**Justification**: Information-dense business application requiring clear hierarchy, robust data tables, and proven interaction patterns for complex workflows.

**Core Principles**:
- Clarity over decoration: Every pixel serves a functional purpose
- Scannable information architecture: Dense data presented in digestible chunks
- Consistent interaction patterns: Predictable behavior across all modules
- Professional aesthetic: Trust-building visual language for business users

---

## Typography

**Font Family**: 
- Primary: Inter (via Google Fonts)
- Monospace: JetBrains Mono (for numeric data, IDs)

**Scale**:
- Page Titles: 28px/Bold
- Section Headers: 20px/Semibold
- Card Titles: 16px/Semibold
- Body Text: 14px/Regular
- Captions/Labels: 12px/Medium
- Data/Metrics: 24-32px/Bold (for dashboard numbers)

---

## Layout System

**Spacing Primitives**: Tailwind units of 2, 4, 6, and 8
- Component padding: p-4 to p-6
- Card gaps: gap-4 to gap-6
- Section margins: mb-6 to mb-8
- Tight spacing for dense tables: p-2, gap-2

**Grid Structure**:
- Dashboard cards: 3-4 column grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-4)
- Main layout: Sidebar (280px fixed) + Content (flex-1) + Right Panel (320px fixed)
- Responsive: Stack to single column below 1024px

---

## Component Library

### Navigation & Structure
**Left Sidebar**:
- Collapsible sections with icons
- Active state: subtle background highlight
- Icon size: 20px, consistent left alignment
- Nested items indented by 16px

**Top Bar**:
- Fixed header: 64px height
- Role badge (pill-shaped, subtle background)
- Time period dropdown (segmented button group)
- User menu (right-aligned)

**Right Panel**:
- Promotion banner: 280x160px placeholder with rounded corners
- VAS graph: compact bar/line chart
- Quick action buttons: stacked, full-width, icon + label

### Dashboard Components
**Metric Cards**:
- Elevated surface with subtle shadow
- Large number display (32px bold)
- Label below (12px)
- Trend indicator (small arrow + percentage)
- Min height: 120px

**Performance Graphs**:
- Chart.js or similar for line/bar charts
- Legend positioned top-right
- Grid lines: subtle, dotted
- Tooltips on hover with detailed breakdowns
- Height: 320px for main charts, 240px for smaller widgets

**Data Tables**:
- Zebra striping for rows
- Sortable columns with arrow indicators
- Fixed header on scroll
- Row hover state
- Compact row height: 48px
- Action buttons (right-aligned): icon-only with tooltips

### Forms & Inputs
**Activity Logger**:
- Segmented button group for activity type (Call/WhatsApp/Meeting/Email)
- Time input with increment/decrement buttons
- Submit button: primary accent
- Recent activities list below

**Customer Follow-up**:
- Grade badges: color-coded pills (A+ through D)
- Date picker for next follow-up
- Stage progress indicator: stepper component
- Inline edit capability for quick updates

**To-Do List**:
- Checkbox + task text
- Status tag (Pending/Completed)
- Origin label (Self/Manager) with icon
- Strikethrough for completed items

### Pools & Lists
**Public Pool**:
- Card-based layout with company name header
- Compact details: account ID, contact info
- "Claim Lead" button (primary action)
- Filters: search bar + dropdown for lead status

**Target & Commission Tracker**:
- Two-column layout (Alibaba | VAS)
- Progress bars for each tier
- Commission slab table: clean, minimal borders
- Bonus callout: highlighted box with accent background

---

## Visual Consistency

**Elevation System**:
- Level 0: Base page background
- Level 1: Cards, panels (1px border or subtle shadow)
- Level 2: Modals, dropdowns (medium shadow)
- Level 3: Tooltips, popovers (strong shadow)

**Icons**:
- Use Material Icons via CDN
- Size: 20px standard, 24px for prominent actions
- Consistent stroke weight throughout

**Status Indicators**:
- Lead grades: A+ (green), A-/B+ (blue), B-/C+ (yellow), C/D (red)
- Project stages: Color-coded dots before text
- Countdown badges: Urgent (<7 days) red, warning (7-14) orange, normal (>14) green

**Animations**: None. Focus on instant feedback and responsive interactions.

---

## Dashboard-Specific Guidelines

**Role-Based Views**: Maintain identical layout structure across roles, show/hide sections based on permissions rather than restructuring the interface.

**Time Period Selector**: Segmented button group (TD/WC/MN/QT/YR) updates all dashboard metrics simultaneously without page reload.

**Responsive Behavior**: Below 1024px, stack sidebar as hamburger menu, hide right panel behind toggle, maintain full table functionality with horizontal scroll.

**Data Density**: Prioritize information over whitespace - this is a professional tool where users need to see maximum data at a glance. Use consistent padding (p-4) but pack components efficiently.