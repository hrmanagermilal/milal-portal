// UI Component Examples - SSM Design System
// Copy and adapt these components for your application

import React from 'react';
import {
  IconCalendar,
  IconClock,
  IconCheckCircle,
  IconWarning,
  IconAlertCircle,
  IconArrowRight,
  IconEdit,
  IconTrash,
} from './Icons';

// ============================================
// STATUS BADGES
// ============================================

export const BadgeReserved = ({ children = 'Confirmed' }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#f0f4fc',
    color: '#2f68f9',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '600',
  }}>
    <IconCheckCircle size={16} color="#2f68f9" />
    {children}
  </span>
);

export const BadgePending = ({ children = 'Pending Approval' }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#f0ffcc',
    color: '#3c8200',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '600',
  }}>
    <IconWarning size={16} color="#3c8200" />
    {children}
  </span>
);

export const BadgeRestricted = ({ children = 'Restricted' }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#ffefd4',
    color: '#a86100',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '600',
  }}>
    {children}
  </span>
);

export const BadgeError = ({ children = 'Cancelled' }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#ffe8e0',
    color: '#d32f2f',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '600',
  }}>
    <IconAlertCircle size={16} color="#d32f2f" />
    {children}
  </span>
);

// ============================================
// BUTTONS
// ============================================

export const ButtonPrimary = ({ children, onClick, disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      backgroundColor: disabled ? '#d9d9d9' : '#2f68f9',
      color: 'white',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    }}
    onMouseEnter={(e) => !disabled && (e.target.style.backgroundColor = '#2560e0')}
    onMouseLeave={(e) => !disabled && (e.target.style.backgroundColor = '#2f68f9')}
  >
    {children}
  </button>
);

export const ButtonSecondary = ({ children, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      backgroundColor: '#ffffff',
      color: '#222222',
      border: '1px solid #d9d9d9',
      padding: '8px 16px',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    }}
    onMouseEnter={(e) => {
      e.target.style.backgroundColor = '#f5f5f5';
      e.target.style.borderColor = '#b3b3b3';
    }}
    onMouseLeave={(e) => {
      e.target.style.backgroundColor = '#ffffff';
      e.target.style.borderColor = '#d9d9d9';
    }}
  >
    {children}
  </button>
);

export const ButtonDanger = ({ children, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      backgroundColor: '#ff2c1a',
      color: 'white',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'background-color 0.2s ease',
    }}
    onMouseEnter={(e) => (e.target.style.backgroundColor = '#e61800')}
    onMouseLeave={(e) => (e.target.style.backgroundColor = '#ff2c1a')}
  >
    {children}
  </button>
);

// ============================================
// CARDS
// ============================================

export const Card = ({ title, children, actions = null }) => (
  <div style={{
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
    padding: '20px',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  }}
  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)')}
  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)')}
  >
    {title && (
      <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#222222' }}>
          {title}
        </h3>
        {actions && <div style={{ display: 'flex', gap: '8px' }}>{actions}</div>}
      </div>
    )}
    <div>{children}</div>
  </div>
);

// ============================================
// INPUT FIELDS
// ============================================

export const InputField = ({ label, placeholder, value, onChange, disabled = false }) => (
  <div style={{ marginBottom: '16px' }}>
    {label && (
      <label style={{
        display: 'block',
        marginBottom: '6px',
        fontSize: '14px',
        fontWeight: '600',
        color: '#222222',
      }}>
        {label}
      </label>
    )}
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '8px 12px',
        fontSize: '14px',
        border: '1px solid #d9d9d9',
        borderRadius: '6px',
        fontFamily: 'inherit',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        boxSizing: 'border-box',
      }}
      onFocus={(e) => {
        e.target.style.borderColor = '#2f68f9';
        e.target.style.boxShadow = '0 0 0 2px rgba(47, 104, 249, 0.1)';
      }}
      onBlur={(e) => {
        e.target.style.borderColor = '#d9d9d9';
        e.target.style.boxShadow = 'none';
      }}
    />
  </div>
);

// ============================================
// TIME BLOCK
// ============================================

export const TimeBlock = ({ status = 'reserved', title, time, organizer }) => {
  const statusStyles = {
    reserved: { bg: '#f0f4fc', border: '#2f68f9', color: '#2f68f9' },
    pending: { bg: '#f0ffcc', border: '#3c8200', color: '#3c8200' },
    restricted: { bg: '#ffefd4', border: '#a86100', color: '#a86100' },
    rejected: { bg: '#ffe8e0', border: '#d32f2f', color: '#d32f2f' },
  };

  const style = statusStyles[status] || statusStyles.reserved;

  return (
    <div style={{
      position: 'absolute',
      backgroundColor: style.bg,
      backgroundImage: status === 'reserved' ? 'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(47, 104, 249, 0.3) 3px, rgba(47, 104, 249, 0.3) 6px)' : 'none',
      border: `1px solid ${style.border}`,
      borderRadius: '6px',
      padding: '4px 8px',
      fontSize: '12px',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      minHeight: '20px',
      color: style.color,
      fontWeight: '600',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    }}>
      <strong>{title}</strong>
      <span>{time}</span>
      {organizer && <span>{organizer}</span>}
    </div>
  );
};

// ============================================
// HEADER/NAVIGATION ITEM
// ============================================

export const NavItem = ({ icon: Icon, label, active = false, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '10px 16px',
      width: '100%',
      backgroundColor: active ? '#f0f4fc' : 'transparent',
      border: 'none',
      borderLeft: active ? '3px solid #2f68f9' : '3px solid transparent',
      color: active ? '#2f68f9' : '#535353',
      fontSize: '14px',
      fontWeight: active ? '600' : '500',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
    }}
    onMouseEnter={(e) => !active && (e.target.style.backgroundColor = '#f5f5f5')}
    onMouseLeave={(e) => !active && (e.target.style.backgroundColor = 'transparent')}
  >
    {Icon && <Icon size={20} color={active ? '#2f68f9' : '#535353'} />}
    <span>{label}</span>
  </button>
);

// ============================================
// EMPTY STATE
// ============================================

export const EmptyState = ({ icon: Icon, title, description, action = null }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 20px',
    textAlign: 'center',
    color: '#535353',
  }}>
    {Icon && <Icon size={48} color="#d9d9d9" style={{ marginBottom: '16px' }} />}
    <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#222222' }}>
      {title}
    </h3>
    <p style={{ fontSize: '14px', marginBottom: '20px', color: '#808080' }}>
      {description}
    </p>
    {action && <div>{action}</div>}
  </div>
);

// ============================================
// LOADING SPINNER
// ============================================

export const Spinner = ({ size = 24, color = '#2f68f9' }) => (
  <div style={{
    display: 'inline-block',
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    borderTop: `3px solid ${color}`,
    borderRight: '3px solid transparent',
    animation: 'spin 0.6s linear infinite',
  }} />
);

export default {
  BadgeReserved,
  BadgePending,
  BadgeRestricted,
  BadgeError,
  ButtonPrimary,
  ButtonSecondary,
  ButtonDanger,
  Card,
  InputField,
  TimeBlock,
  NavItem,
  EmptyState,
  Spinner,
};
