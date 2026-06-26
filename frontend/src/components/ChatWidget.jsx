import { useState, useRef, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import Box from "@mui/material/Box";
import Fab from "@mui/material/Fab";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Zoom from "@mui/material/Zoom";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import { api } from "../api";
import { useLanguage } from "../i18n/LanguageContext";

const FAVICON = "/favicon.png";

const QUICK_PROMPTS_KO = [
  "오늘 예약 현황 알려줘",
  "내일 오후 2시 장소 예약 가능해?",
  "예약 신청해줘",
];
const QUICK_PROMPTS_EN = [
  "Show today's reservations",
  "Is the conference room free tomorrow 2pm?",
  "Help me make a reservation",
];

function TypingDots() {
  return (
    <Box sx={{ display: "flex", gap: "4px", alignItems: "center", px: 0.5, py: 0.25 }}>
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            bgcolor: "#94a3b8",
            animation: "chat-dot-bounce 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.2}s`,
            "@keyframes chat-dot-bounce": {
              "0%, 80%, 100%": { transform: "translateY(0)" },
              "40%": { transform: "translateY(-6px)" },
            },
          }}
        />
      ))}
    </Box>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: isUser ? "row-reverse" : "row",
        alignItems: "flex-end",
        gap: 1,
        mb: 1.5,
      }}
    >
      {!isUser && (
        <Avatar
          sx={{
            width: 28,
            height: 28,
            bgcolor: "transparent",
            flexShrink: 0,
            mb: 0.25,
          }}
        >
          <Box component="img" src={FAVICON} sx={{ width: 22, height: 22, objectFit: "contain" }} />
        </Avatar>
      )}
      <Box
        sx={{
          maxWidth: "78%",
          px: 1.75,
          py: 1.1,
          borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          background: isUser
            ? "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)"
            : "#f1f5f9",
          color: isUser ? "white" : "#1e293b",
          boxShadow: isUser
            ? "0 2px 8px rgba(25,118,210,0.35)"
            : "0 1px 4px rgba(0,0,0,0.08)",
        }}
      >
        <Typography
          variant="body2"
          sx={{
            fontSize: "13.5px",
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {msg.content}
        </Typography>
      </Box>
    </Box>
  );
}

MessageBubble.propTypes = {
  msg: PropTypes.shape({ role: PropTypes.string, content: PropTypes.string }).isRequired,
};

export default function ChatWidget({ userName, userPhone, userEmail, userTitle, userCellGroup }) {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const quickPrompts = language === "ko" ? QUICK_PROMPTS_KO : QUICK_PROMPTS_EN;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content: t("chatWelcome"),
        },
      ]);
    }
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = useCallback(
    async (text) => {
      const content = (text || input).trim();
      if (!content || loading) return;
      setInput("");

      const userMsg = { role: "user", content };
      const history = messages.filter((m) => m.role !== "typing");
      setMessages((prev) => [...prev, userMsg, { role: "typing", content: "" }]);
      setLoading(true);

      try {
        const result = await api.sendChat({
          message: content,
          history: history.slice(-12),
          user_name: userName || "",
          user_phone: userPhone || "",
          user_email: userEmail || "",
          user_title: userTitle || "",
          user_cell_group: userCellGroup || "",
          language: language || "ko",
        });
        setMessages((prev) =>
          prev
            .filter((m) => m.role !== "typing")
            .concat({ role: "assistant", content: result.message || t("chatError") })
        );
      } catch (err) {
        setMessages((prev) =>
          prev
            .filter((m) => m.role !== "typing")
            .concat({ role: "assistant", content: `⚠️ ${err.message || t("chatError")}` })
        );
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages, userName, userPhone, userEmail, language, t]
  );

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <Tooltip title={t("chatTooltip")} placement="left">
        <Fab
          onClick={() => setOpen((v) => !v)}
          sx={{
            position: "fixed",
            bottom: { xs: 80, md: 28 },
            right: { xs: 16, md: 28 },
            zIndex: 1300,
            width: 56,
            height: 56,
            background: open
              ? "linear-gradient(135deg, #475569 0%, #334155 100%)"
              : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            boxShadow: "0 4px 20px rgba(102,126,234,0.5)",
            transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
            "&:hover": {
              transform: "scale(1.08)",
              boxShadow: "0 6px 24px rgba(102,126,234,0.65)",
            },
          }}
        >
          {open ? (
            <CloseIcon sx={{ color: "white", fontSize: 22 }} />
          ) : (
            <Box component="img" src={FAVICON} sx={{ width: 32, height: 32, objectFit: "contain" }} />
          )}
        </Fab>
      </Tooltip>

      {/* Chat Panel */}
      <Zoom in={open} timeout={220}>
        <Paper
          elevation={0}
          sx={{
            position: "fixed",
            bottom: { xs: 148, md: 96 },
            right: { xs: 12, md: 28 },
            width: { xs: "calc(100vw - 24px)", sm: 390 },
            height: { xs: 480, sm: 540 },
            zIndex: 1299,
            borderRadius: "20px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            border: "1px solid rgba(148,163,184,0.2)",
            boxShadow:
              "0 20px 60px rgba(0,0,0,0.18), 0 8px 24px rgba(102,126,234,0.12)",
            bgcolor: "white",
          }}
        >
          {/* Header */}
          <Box
            sx={{
              px: 2.5,
              py: 1.75,
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              flexShrink: 0,
            }}
          >
            <Avatar
              sx={{
                width: 34,
                height: 34,
                bgcolor: "rgba(255,255,255,0.2)",
              }}
            >
              <Box component="img" src={FAVICON} sx={{ width: 24, height: 24, objectFit: "contain" }} />
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography sx={{ color: "white", fontWeight: 700, fontSize: "14.5px", lineHeight: 1.2 }}>
                {t("chatTitle")}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25 }}>
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    bgcolor: "#4ade80",
                    animation: "pulse-green 2s ease infinite",
                    "@keyframes pulse-green": {
                      "0%, 100%": { opacity: 1 },
                      "50%": { opacity: 0.5 },
                    },
                  }}
                />
                <Typography sx={{ color: "rgba(255,255,255,0.8)", fontSize: "11px" }}>
                  {t("chatOnline")}
                </Typography>
              </Box>
            </Box>
            <IconButton
              onClick={() => setOpen(false)}
              size="small"
              sx={{ color: "rgba(255,255,255,0.75)", "&:hover": { color: "white", bgcolor: "rgba(255,255,255,0.1)" } }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Messages */}
          <Box
            sx={{
              flexGrow: 1,
              overflowY: "auto",
              px: 2,
              pt: 2,
              pb: 1,
              display: "flex",
              flexDirection: "column",
              bgcolor: "#fafbff",
              "&::-webkit-scrollbar": { width: "4px" },
              "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
              "&::-webkit-scrollbar-thumb": { bgcolor: "#e2e8f0", borderRadius: "4px" },
            }}
          >
            {messages.map((msg, i) =>
              msg.role === "typing" ? (
                <Box key={i} sx={{ display: "flex", alignItems: "flex-end", gap: 1, mb: 1.5 }}>
                  <Avatar sx={{ width: 28, height: 28, bgcolor: "transparent", flexShrink: 0 }}>
                    <Box component="img" src={FAVICON} sx={{ width: 22, height: 22, objectFit: "contain" }} />
                  </Avatar>
                  <Box sx={{ px: 1.75, py: 1, borderRadius: "18px 18px 18px 4px", bgcolor: "#f1f5f9", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
                    <TypingDots />
                  </Box>
                </Box>
              ) : (
                <MessageBubble key={i} msg={msg} />
              )
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Quick prompts */}
          {messages.length <= 1 && !loading && (
            <Box sx={{ px: 2, pb: 1, display: "flex", gap: 0.75, flexWrap: "wrap", flexShrink: 0 }}>
              {quickPrompts.map((q) => (
                <Chip
                  key={q}
                  label={q}
                  size="small"
                  onClick={() => handleSend(q)}
                  sx={{
                    fontSize: "11.5px",
                    height: 26,
                    cursor: "pointer",
                    bgcolor: "#ede9fe",
                    color: "#6d28d9",
                    border: "1px solid #c4b5fd",
                    "&:hover": { bgcolor: "#ddd6fe" },
                    transition: "all 0.15s",
                  }}
                />
              ))}
            </Box>
          )}

          {/* Input */}
          <Box
            sx={{
              px: 1.5,
              py: 1.25,
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              gap: 1,
              alignItems: "flex-end",
              flexShrink: 0,
              bgcolor: "white",
            }}
          >
            <TextField
              inputRef={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("chatPlaceholder")}
              multiline
              maxRows={3}
              fullWidth
              disabled={loading}
              size="small"
              variant="outlined"
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "14px",
                  fontSize: "13.5px",
                  bgcolor: "#f8fafc",
                  "& fieldset": { borderColor: "#e2e8f0" },
                  "&:hover fieldset": { borderColor: "#c4b5fd" },
                  "&.Mui-focused fieldset": { borderColor: "#7c3aed", borderWidth: 1.5 },
                },
              }}
            />
            <IconButton
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              sx={{
                width: 38,
                height: 38,
                flexShrink: 0,
                background:
                  input.trim() && !loading
                    ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                    : "#e2e8f0",
                color: input.trim() && !loading ? "white" : "#94a3b8",
                borderRadius: "12px",
                transition: "all 0.2s",
                "&:hover": {
                  transform: input.trim() && !loading ? "scale(1.05)" : "none",
                },
                "&.Mui-disabled": { background: "#e2e8f0", color: "#94a3b8" },
              }}
            >
              <SendIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Paper>
      </Zoom>
    </>
  );
}

ChatWidget.propTypes = {
  userName: PropTypes.string,
  userPhone: PropTypes.string,
  userEmail: PropTypes.string,
  userTitle: PropTypes.string,
  userCellGroup: PropTypes.string,
};
