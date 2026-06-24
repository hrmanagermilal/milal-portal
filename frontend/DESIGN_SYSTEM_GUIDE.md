# Design System Implementation Guide

## 📋 Overview

This frontend has been updated with a modern design system extracted from the professional SSM (씀) Milal Community system at https://www.ourssm.com/rooms.

**Key Design Elements:**
- Primary Blue: `#1b59f8` (Modern, professional)
- Modern Grayscale with clear hierarchy
- Status-based color system (Blue, Orange, Green, Red)
- Professional typography with Pretendard font
- Material-UI integration
- Comprehensive icon library

## 🚀 Quick Start

### 1. Using CSS Variables

All design tokens are available as CSS variables in `src/styles.css`:

```css
/* Colors */
background-color: var(--primary);
color: var(--text);
padding: var(--space-lg);
border: 1px solid var(--border);
border-radius: var(--radius-md);
box-shadow: var(--shadow-card);
```

### 2. Using JavaScript Theme

Import from `theme.js`:

```javascript
import theme, { designTokens } from './theme';

// Access design tokens
const primaryColor = designTokens.colors.primary;
const spacing = designTokens.spacing.lg;
const borderRadius = designTokens.borderRadius.md;
```

### 3. Using UI Components

Import pre-built components from `components/UIComponents.jsx`:

```javascript
import {
  ButtonPrimary,
  ButtonSecondary,
  Card,
  Badge Confirmed,
  InputField,
} from './components/UIComponents';

function MyComponent() {
  return (
    <Card title="Room Booking">
      <InputField label="Room Name" placeholder="Enter room name" />
      <ButtonPrimary>Book Room</ButtonPrimary>
    </Card>
  );
}
```

### 4. Using Icons

Import icons from `components/Icons.jsx`:

```javascript
import {
  IconCalendar,
  IconClock,
  IconCheckCircle,
  IconWarning,
} from './components/Icons';

function ReservationStatus() {
  return (
    <div>
      <IconCheckCircle size={24} color="#96cc29" />
      <span>Booking Confirmed</span>
    </div>
  );
}
```

## 🎨 Color System

### Status Colors - Use in your components

```javascript
// Reservations/Bookings
reserved:   '#1b59f8' (Blue)   - Confirmed booking
pending:    '#ffa828' (Orange) - Awaiting approval
restricted: '#96cc29' (Green)  - Restricted booking
error:      '#ff2c1a' (Red)    - Cancelled/Error
```

### Usage Example

```jsx
<BadgeReserved>Confirmed</BadgeReserved>
<BadgePending>Awaiting Approval</BadgePending>
<BadgeRestricted>Restricted</BadgeRestricted>
<BadgeError>Cancelled</BadgeError>
```

## 📐 Spacing System

Use consistent spacing throughout your app:

```javascript
--space-xs:   4px    // Tight spacing
--space-sm:   8px    // Small
--space-md:   12px   // Medium (default)
--space-lg:   16px   // Large
--space-xl:   20px   // Extra large
--space-2xl:  24px   // 2x Large
--space-3xl:  32px   // 3x Large
--space-4xl:  40px   // 4x Large
```

## 🔲 Border Radius

```javascript
--radius-sm:   4px    // Minimal rounding
--radius-md:   8px    // Standard (default)
--radius-lg:   12px   // More rounded
--radius-xl:   16px   // Card/Modal
--radius-2xl:  20px   // Large elements
--radius-full: 9999px // Fully rounded (pills, badges)
```

## 🌊 Shadows

Use these shadows for depth:

```javascript
--shadow-sm:         0 1px 2px rgba(0, 0, 0, 0.05)
--shadow-md:         0 4px 6px rgba(0, 0, 0, 0.1)
--shadow-lg:         0 10px 15px rgba(0, 0, 0, 0.1)
--shadow-card:       0px 10px 20px rgba(27, 89, 248, 0.08)    // Default card
--shadow-card-hover: 0px 15px 30px rgba(27, 89, 248, 0.12)    // Hover effect
```

## 🔤 Typography

### Fonts
`'Pretendard', 'SchoolSans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

### Font Sizes
- **xs**: 11px (Small labels)
- **sm**: 12px (Badges, captions)
- **base**: 14px (Body text)
- **lg**: 16px (Subheadings)
- **xl**: 18px (Titles)
- **2xl**: 20px (Large titles)
- **3xl**: 24px (Section headers)
- **4xl**: 28px (Page titles)
- **5xl**: 32px (Main headings)

## 📦 Available Components

### Badges
```jsx
<BadgeReserved />      // Blue confirmed status
<BadgePending />       // Orange pending status
<BadgeRestricted />    // Green restricted status
<BadgeError />         // Red error status
```

### Buttons
```jsx
<ButtonPrimary>Primary Action</ButtonPrimary>
<ButtonSecondary>Secondary Action</ButtonSecondary>
<ButtonDanger>Dangerous Action</ButtonDanger>
```

### Cards
```jsx
<Card title="Title" actions={<ButtonPrimary>Action</ButtonPrimary>}>
  Card content here
</Card>
```

### Forms
```jsx
<InputField
  label="Name"
  placeholder="Enter name"
  value={name}
  onChange={(e) => setName(e.target.value)}
/>
```

### Time Blocks
```jsx
<TimeBlock
  status="reserved"
  title="Team Meeting"
  time="10:00 - 11:00"
  organizer="John Doe"
/>
```

### Navigation
```jsx
<NavItem
  icon={IconCalendar}
  label="Calendar"
  active={true}
  onClick={handleClick}
/>
```

### States
```jsx
<EmptyState
  icon={IconSearch}
  title="No Results"
  description="Try adjusting your search"
  action={<ButtonPrimary>Clear Filters</ButtonPrimary>}
/>
```

## 🎯 Icons Library

40+ icons available in `components/Icons.jsx`:

```javascript
// Navigation
IconHome, IconMenu, IconSearch, IconLogout

// Status
IconCheckCircle, IconWarning, IconAlertCircle

// Actions
IconArrowRight, IconArrowLeft, IconPlus, IconMinus,
IconEdit, IconTrash, IconDownload

// Time/Calendar
IconCalendar, IconClock

// Other
IconUser, IconSpaces, IconSettings, IconBell
```

**Customizing Icons:**
```jsx
<IconCalendar size={32} color="#1b59f8" />
```

## 🌐 Responsive Design

The design system supports all screen sizes:

```css
/* Breakpoints */
xs: 0px
sm: 640px   // Small phones
md: 768px   // Tablets
lg: 1024px  // Small laptops
xl: 1280px  // Desktop
2xl: 1536px // Large desktop
```

Use CSS media queries or Tailwind classes:

```css
@media (max-width: 768px) {
  .grid-2,
  .grid-3 {
    grid-template-columns: 1fr;
  }
}
```

## 📚 File Structure

```
frontend/
├── src/
│   ├── theme.js                    // Material-UI theme + design tokens
│   ├── styles.css                  // Global CSS variables + base styles
│   ├── components/
│   │   ├── Icons.jsx              // SVG icon components (40+)
│   │   ├── UIComponents.jsx       // Pre-built UI components
│   │   ├── AdminReservationPanel.jsx
│   │   ├── ReservationRequestForm.jsx
│   │   ├── ReservationTimeline.jsx
│   │   └── RoomSettingsPanel.jsx
│   ├── App.jsx
│   └── main.jsx
├── DESIGN_SYSTEM.md               // Design system documentation
└── index.html
```

## 🔄 Migration Tips

If you're updating existing components:

### Old → New Colors

```javascript
// Before
backgroundColor: '#0d5c63'

// After
backgroundColor: designTokens.colors.primary
// or
backgroundColor: 'var(--primary)'
```

### Adding Icons

```javascript
// Before (no icon)
<button>Delete</button>

// After (with icon)
import { IconTrash } from './components/Icons';

<button>
  <IconTrash size={16} color="#ff2c1a" />
  Delete
</button>
```

## 🧪 Testing Components

```jsx
import {
  ButtonPrimary,
  BadgeReserved,
  Card,
  InputField,
} from './components/UIComponents';

function ComponentShowcase() {
  return (
    <div style={{ padding: '20px', gap: '20px', display: 'flex', flexDirection: 'column' }}>
      <Card title="Test Card">
        <InputField label="Test Input" />
        <ButtonPrimary>Submit</ButtonPrimary>
      </Card>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <BadgeReserved />
        <BadgePending />
        <BadgeRestricted />
        <BadgeError />
      </div>
    </div>
  );
}

export default ComponentShowcase;
```

## 🎨 Design Decisions

Why these colors?
- **Blue (#1b59f8)**: Professional, tech-focused, widely trusted
- **Orange (#ffa828)**: Warm, attention-grabbing for pending actions
- **Green (#96cc29)**: Positive, associated with availability
- **Red (#ff2c1a)**: Standard for errors/cancellations
- **Grayscale**: Clear hierarchy, accessible, modern

## 📖 References

- **Design Source**: https://www.ourssm.com/rooms
- **Design System**: SSM (씀) - Professional Meeting Room System
- **Framework**: Material-UI + Tailwind CSS concepts
- **Font**: Pretendard (Korean-optimized Sans-serif)

## ✅ Checklist for Implementation

- [ ] Import design tokens in existing components
- [ ] Replace old colors with CSS variables or theme tokens
- [ ] Update buttons to use ButtonPrimary/Secondary/Danger
- [ ] Add icons to appropriate places
- [ ] Update time blocks with new status colors
- [ ] Test responsive design on mobile
- [ ] Update shadows on cards
- [ ] Verify typography looks good

## 🚀 Next Steps

1. **Update existing components** - Replace colors with design tokens
2. **Add missing icons** - Use IconXXX from components/Icons.jsx
3. **Test on mobile** - Ensure responsive design works
4. **A/B test colors** - Get user feedback on new design
5. **Document custom components** - Add to UIComponents.jsx

## 📞 Support

For design questions or component additions:
1. Check DESIGN_SYSTEM.md for color/spacing reference
2. Review UIComponents.jsx for component patterns
3. Look at Icons.jsx for icon customization

---

**Design System Version**: 1.0  
**Last Updated**: 2026-06-18  
**Framework**: React + Material-UI + Custom CSS
