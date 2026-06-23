// Icon Components Library - SSM Design System
// All icons use the primary blue (#1b59f8) by default

import React from 'react';

const iconProps = {
  width: '24px',
  height: '24px',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '2',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const IconCalendar = ({ color = '#1b59f8', size = 24 }) => (
  <svg {...iconProps} width={size} height={size} viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" fill="none" stroke={color} strokeWidth="2" />
    <line x1="16" y1="2" x2="16" y2="6" stroke={color} strokeWidth="2" />
    <line x1="8" y1="2" x2="8" y2="6" stroke={color} strokeWidth="2" />
    <line x1="3" y1="10" x2="21" y2="10" stroke={color} strokeWidth="2" />
  </svg>
);

export const IconClock = ({ color = '#1b59f8', size = 24 }) => (
  <svg {...iconProps} width={size} height={size} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth="2" />
    <polyline points="12 6 12 12 16 14" stroke={color} strokeWidth="2" />
  </svg>
);

export const IconHome = ({ color = '#1b59f8', size = 24 }) => (
  <svg {...iconProps} width={size} height={size} viewBox="0 0 24 24">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke={color} strokeWidth="2" />
    <polyline points="9 22 9 12 15 12 15 22" stroke={color} strokeWidth="2" />
  </svg>
);

export const IconUser = ({ color = '#1b59f8', size = 24 }) => (
  <svg {...iconProps} width={size} height={size} viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" fill="none" stroke={color} strokeWidth="2" />
    <circle cx="12" cy="7" r="4" fill="none" stroke={color} strokeWidth="2" />
  </svg>
);

export const IconCheckCircle = ({ color = '#96cc29', size = 24 }) => (
  <svg {...iconProps} width={size} height={size} viewBox="0 0 24 24">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" fill="none" stroke={color} strokeWidth="2" />
    <polyline points="22 4 12 14.01 9 11.01" stroke={color} strokeWidth="2" />
  </svg>
);

export const IconAlertCircle = ({ color = '#ff2c1a', size = 24 }) => (
  <svg {...iconProps} width={size} height={size} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth="2" />
    <line x1="12" y1="8" x2="12" y2="12" stroke={color} strokeWidth="2" />
    <line x1="12" y1="16" x2="12.01" y2="16" stroke={color} strokeWidth="2" />
  </svg>
);

export const IconWarning = ({ color = '#ffa828', size = 24 }) => (
  <svg {...iconProps} width={size} height={size} viewBox="0 0 24 24">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z" fill="none" stroke={color} strokeWidth="2" />
    <line x1="12" y1="9" x2="12" y2="13" stroke={color} strokeWidth="2" />
    <line x1="12" y1="17" x2="12.01" y2="17" stroke={color} strokeWidth="2" />
  </svg>
);

export const IconArrowRight = ({ color = '#1b59f8', size = 24 }) => (
  <svg {...iconProps} width={size} height={size} viewBox="0 0 24 24">
    <line x1="5" y1="12" x2="19" y2="12" stroke={color} strokeWidth="2" />
    <polyline points="12 5 19 12 12 19" stroke={color} strokeWidth="2" />
  </svg>
);

export const IconArrowLeft = ({ color = '#1b59f8', size = 24 }) => (
  <svg {...iconProps} width={size} height={size} viewBox="0 0 24 24">
    <line x1="19" y1="12" x2="5" y2="12" stroke={color} strokeWidth="2" />
    <polyline points="12 19 5 12 12 5" stroke={color} strokeWidth="2" />
  </svg>
);

export const IconMenu = ({ color = '#1b59f8', size = 24 }) => (
  <svg {...iconProps} width={size} height={size} viewBox="0 0 24 24">
    <line x1="3" y1="6" x2="21" y2="6" stroke={color} strokeWidth="2" />
    <line x1="3" y1="12" x2="21" y2="12" stroke={color} strokeWidth="2" />
    <line x1="3" y1="18" x2="21" y2="18" stroke={color} strokeWidth="2" />
  </svg>
);

export const IconX = ({ color = '#535353', size = 24 }) => (
  <svg {...iconProps} width={size} height={size} viewBox="0 0 24 24">
    <line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth="2" />
    <line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth="2" />
  </svg>
);

export const IconSearch = ({ color = '#535353', size = 24 }) => (
  <svg {...iconProps} width={size} height={size} viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="8" fill="none" stroke={color} strokeWidth="2" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" stroke={color} strokeWidth="2" />
  </svg>
);

export const IconPlus = ({ color = '#1b59f8', size = 24 }) => (
  <svg {...iconProps} width={size} height={size} viewBox="0 0 24 24">
    <line x1="12" y1="5" x2="12" y2="19" stroke={color} strokeWidth="2" />
    <line x1="5" y1="12" x2="19" y2="12" stroke={color} strokeWidth="2" />
  </svg>
);

export const IconMinus = ({ color = '#535353', size = 24 }) => (
  <svg {...iconProps} width={size} height={size} viewBox="0 0 24 24">
    <line x1="5" y1="12" x2="19" y2="12" stroke={color} strokeWidth="2" />
  </svg>
);

export const IconEdit = ({ color = '#1b59f8', size = 24 }) => (
  <svg {...iconProps} width={size} height={size} viewBox="0 0 24 24">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" fill="none" stroke={color} strokeWidth="2" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" fill="none" stroke={color} strokeWidth="2" />
  </svg>
);

export const IconTrash = ({ color = '#ff2c1a', size = 24 }) => (
  <svg {...iconProps} width={size} height={size} viewBox="0 0 24 24">
    <polyline points="3 6 5 6 21 6" stroke={color} strokeWidth="2" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" fill="none" stroke={color} strokeWidth="2" />
    <line x1="10" y1="11" x2="10" y2="17" stroke={color} strokeWidth="2" />
    <line x1="14" y1="11" x2="14" y2="17" stroke={color} strokeWidth="2" />
  </svg>
);

export const IconDownload = ({ color = '#1b59f8', size = 24 }) => (
  <svg {...iconProps} width={size} height={size} viewBox="0 0 24 24">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" fill="none" stroke={color} strokeWidth="2" />
    <polyline points="7 10 12 15 17 10" stroke={color} strokeWidth="2" />
    <line x1="12" y1="15" x2="12" y2="3" stroke={color} strokeWidth="2" />
  </svg>
);

export const IconSettings = ({ color = '#535353', size = 24 }) => (
  <svg {...iconProps} width={size} height={size} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="3" fill="none" stroke={color} strokeWidth="2" />
    <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m6.08 0l4.24-4.24M1 12h6m6 0h6m-1.78 7.78l-4.24-4.24m-6.08 0l-4.24 4.24" fill="none" stroke={color} strokeWidth="2" />
  </svg>
);

export const IconLogout = ({ color = '#ff2c1a', size = 24 }) => (
  <svg {...iconProps} width={size} height={size} viewBox="0 0 24 24">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" fill="none" stroke={color} strokeWidth="2" />
    <polyline points="16 17 21 12 16 7" stroke={color} strokeWidth="2" />
    <line x1="21" y1="12" x2="9" y2="12" stroke={color} strokeWidth="2" />
  </svg>
);

export const IconSpaces = ({ color = '#1b59f8', size = 24 }) => (
  <svg {...iconProps} width={size} height={size} viewBox="0 0 24 24">
    <rect x="3" y="3" width="7" height="7" rx="1" fill="none" stroke={color} strokeWidth="2" />
    <rect x="14" y="3" width="7" height="7" rx="1" fill="none" stroke={color} strokeWidth="2" />
    <rect x="3" y="14" width="7" height="7" rx="1" fill="none" stroke={color} strokeWidth="2" />
    <rect x="14" y="14" width="7" height="7" rx="1" fill="none" stroke={color} strokeWidth="2" />
  </svg>
);

export const IconBell = ({ color = '#535353', size = 24 }) => (
  <svg {...iconProps} width={size} height={size} viewBox="0 0 24 24">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" fill="none" stroke={color} strokeWidth="2" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" fill="none" stroke={color} strokeWidth="2" />
  </svg>
);

export default {
  IconCalendar,
  IconClock,
  IconHome,
  IconUser,
  IconCheckCircle,
  IconAlertCircle,
  IconWarning,
  IconArrowRight,
  IconArrowLeft,
  IconMenu,
  IconX,
  IconSearch,
  IconPlus,
  IconMinus,
  IconEdit,
  IconTrash,
  IconDownload,
  IconSettings,
  IconLogout,
  IconSpaces,
  IconBell,
};
