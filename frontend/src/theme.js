import { createTheme } from "@mui/material/styles";

// Design System extracted from Velok Admin Dashboard Template
export const designTokens = {
  colors: {
    // Velok Primary Colors
    primary: "#22b956",           // Velok Green
    primaryLight: "#4dc974",
    primaryDark: "#1a8a43",
    primaryBg: "#f0f7f3",
    
    // Velok Color Palette
    blue: "#1989df",
    indigo: "#53389f",
    purple: "#7f56da",
    pink: "#ff86c8",
    red: "#f95c5c",
    orange: "#ed8d55",
    yellow: "#f6c54d",
    teal: "#1bb394",
    cyan: "#32bbe5",
    
    // Status Colors (mapped to Velok palette)
    reserved: "#1989df",      // Blue
    reservedBg: "#e8f4ff",
    pending: "#f6c54d",       // Yellow
    pendingBg: "#fffbf0",
    restricted: "#22b956",    // Green
    restrictedBg: "#f0f7f3",
    approved: "#22b956",
    changed: "#1989df",
    rejected: "#f95c5c",
    error: "#f95c5c",
    errorBg: "#ffe8e8",
    
    // Grayscale (Velok palette)
    gray50: "#f8f9fa",
    gray100: "#eef2f7",
    gray200: "#d8dfe7",
    gray300: "#b0b0bb",
    gray400: "#8486a7",
    gray500: "#5d7186",
    gray600: "#424e5a",
    gray700: "#36404a",
    gray800: "#28303c",
    gray900: "#000000",
    
    // Semantic (Velok Light theme)
    background: "#f8f9fa",
    surface: "#ffffff",
    surfaceAlt: "#eef2f7",
    text: "#313b5e",
    textSecondary: "#5d7186",
    textTertiary: "#8486a7",
    border: "#d8dfe7",
    borderLight: "#eef2f7",
    
    // Velok Sidebar
    sidebarLight: "#ffffff",
    sidebarDark: "#26303a",
    sidebarMenuItem: "#5a5b70",
    sidebarMenuItemHover: "#f3f1fa",
  },
  
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "20px",
    "2xl": "24px",
    "3xl": "32px",
    "4xl": "40px",
  },
  
  borderRadius: {
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    "2xl": "20px",
    full: "9999px",
  },
  
  shadows: {
    sm: "0 1px 3px rgba(0, 0, 0, 0.08)",
    md: "0 2px 8px rgba(0, 0, 0, 0.06)",
    lg: "0 4px 12px rgba(0, 0, 0, 0.1)",
    card: "0 2px 8px rgba(0, 0, 0, 0.06)",
    cardHover: "0 4px 12px rgba(0, 0, 0, 0.1)",
    // Velok elevated shadows
    elevation1: "0 2px 8px rgba(34, 185, 86, 0.08)",
    elevation2: "0 4px 16px rgba(34, 185, 86, 0.12)",
    elevation3: "0 8px 24px rgba(34, 185, 86, 0.15)",
  },
  
  transitions: {
    smooth: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    hover: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  },
};

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: designTokens.colors.primary,      // #22b956 Velok Green
      light: designTokens.colors.primaryLight,
      dark: designTokens.colors.primaryDark,
      contrastText: "#ffffff",
    },
    secondary: {
      main: designTokens.colors.blue,
      light: "#4d9ded",
    },
    background: {
      default: designTokens.colors.background,
      paper: designTokens.colors.surface,
    },
    text: {
      primary: designTokens.colors.text,
      secondary: designTokens.colors.textSecondary,
    },
    success: {
      main: designTokens.colors.restricted,    // #22b956 Green
      light: designTokens.colors.restrictedBg,
    },
    error: {
      main: designTokens.colors.error,         // #f95c5c Red
      light: designTokens.colors.errorBg,
    },
    warning: {
      main: designTokens.colors.yellow,        // #f6c54d Yellow
      light: designTokens.colors.pendingBg,
    },
    info: {
      main: designTokens.colors.blue,          // #1989df Blue
      light: designTokens.colors.reservedBg,
    },
    divider: designTokens.colors.border,
  },
  shape: {
    borderRadius: parseInt(designTokens.borderRadius.lg),
  },
  typography: {
    fontFamily: '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: {
      fontWeight: 800,
      fontSize: "32px",
      letterSpacing: "-0.02em",
      lineHeight: 1.2,
    },
    h2: {
      fontWeight: 800,
      fontSize: "28px",
      letterSpacing: "-0.01em",
      lineHeight: 1.2,
    },
    h3: {
      fontWeight: 700,
      fontSize: "24px",
      letterSpacing: "-0.01em",
      lineHeight: 1.3,
    },
    h4: {
      fontWeight: 700,
      fontSize: "20px",
      lineHeight: 1.4,
    },
    h5: {
      fontWeight: 600,
      fontSize: "18px",
      lineHeight: 1.4,
    },
    h6: {
      fontWeight: 600,
      fontSize: "16px",
      lineHeight: 1.4,
    },
    body1: {
      fontSize: "14px",
      lineHeight: 1.6,
      fontWeight: 400,
    },
    body2: {
      fontSize: "13px",
      lineHeight: 1.5,
      fontWeight: 400,
    },
    caption: {
      fontSize: "12px",
      lineHeight: 1.4,
      fontWeight: 500,
    },
    button: {
      textTransform: "none",
      fontWeight: 600,
      fontSize: "14px",
      letterSpacing: "0.5px",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage: "radial-gradient(circle at top right, #e8f4ff 0%, #f8f9fa 45%)",
          backgroundAttachment: "fixed",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: designTokens.shadows.card,
          border: `1px solid ${designTokens.colors.border}`,
          transition: designTokens.transitions.hover,
          "&:hover": {
            boxShadow: designTokens.shadows.cardHover,
            borderColor: designTokens.colors.primary,
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          borderRadius: designTokens.borderRadius.md,
          transition: designTokens.transitions.smooth,
          "&:hover": {
            transform: "translateY(-2px)",
          },
          "&:active": {
            transform: "translateY(0)",
          },
        },
        contained: {
          boxShadow: `0 2px 8px rgba(34, 185, 86, 0.2)`,
          "&:hover": {
            boxShadow: `0 4px 12px rgba(34, 185, 86, 0.3)`,
          },
        },
        outlined: {
          border: `1.5px solid ${designTokens.colors.border}`,
          "&:hover": {
            backgroundColor: designTokens.colors.surface,
            borderColor: designTokens.colors.primary,
          },
        },
        text: {
          "&:hover": {
            backgroundColor: designTokens.colors.primaryBg,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          fontSize: "12px",
          borderRadius: designTokens.borderRadius.md,
          transition: designTokens.transitions.smooth,
        },
        colorPrimary: {
          backgroundColor: designTokens.colors.primaryBg,
          color: designTokens.colors.primary,
        },
        colorSuccess: {
          backgroundColor: "rgba(150, 204, 41, 0.1)",
          color: designTokens.colors.restricted,
        },
        colorError: {
          backgroundColor: "rgba(255, 44, 26, 0.1)",
          color: designTokens.colors.error,
        },
        colorWarning: {
          backgroundColor: "rgba(255, 168, 40, 0.1)",
          color: designTokens.colors.pending,
        },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: {
          "& thead th": {
            backgroundColor: designTokens.colors.surfaceAlt,
            fontWeight: 700,
            fontSize: "13px",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            borderBottom: `2px solid ${designTokens.colors.border}`,
          },
          "& tbody tr": {
            transition: designTokens.transitions.smooth,
            "&:hover": {
              backgroundColor: designTokens.colors.primaryBg,
            },
          },
          "& td": {
            borderBottomColor: designTokens.colors.borderLight,
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            transition: designTokens.transitions.smooth,
            "&:hover fieldset": {
              borderColor: designTokens.colors.primaryLight,
            },
            "&.Mui-focused fieldset": {
              borderColor: designTokens.colors.primary,
              boxShadow: `0 0 0 3px ${designTokens.colors.primaryBg}`,
            },
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: designTokens.borderRadius.lg,
          borderLeft: `4px solid transparent`,
        },
        standardInfo: {
          backgroundColor: designTokens.colors.primaryBg,
          color: designTokens.colors.primary,
          borderLeftColor: designTokens.colors.primary,
        },
        standardSuccess: {
          backgroundColor: "rgba(150, 204, 41, 0.1)",
          color: designTokens.colors.restricted,
          borderLeftColor: designTokens.colors.restricted,
        },
        standardWarning: {
          backgroundColor: "rgba(255, 168, 40, 0.1)",
          color: designTokens.colors.pending,
          borderLeftColor: designTokens.colors.pending,
        },
        standardError: {
          backgroundColor: "rgba(255, 44, 26, 0.1)",
          color: designTokens.colors.error,
          borderLeftColor: designTokens.colors.error,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          transition: designTokens.transitions.smooth,
        },
        elevation1: {
          boxShadow: designTokens.shadows.elevation1,
        },
        elevation2: {
          boxShadow: designTokens.shadows.elevation2,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          boxShadow: designTokens.shadows.elevation3,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: "#000000",
          fontWeight: 500,
          fontSize: "14px",
          transition: designTokens.transitions.smooth,
          "&:hover": {
            backgroundColor: "rgba(0, 0, 0, 0.08)",
          },
          "&.Mui-selected": {
            backgroundColor: "rgba(0, 0, 0, 0.08)",
            "&:hover": {
              backgroundColor: "rgba(0, 0, 0, 0.12)",
            },
          },
        },
      },
    },
  },
});

export default theme;
