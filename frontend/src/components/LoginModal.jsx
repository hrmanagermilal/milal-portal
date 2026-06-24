import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import FormControlLabel from "@mui/material/FormControlLabel";
import RadioGroup from "@mui/material/RadioGroup";
import Radio from "@mui/material/Radio";
import { useLanguage } from "../i18n/LanguageContext";
import { api } from "../api";

const STEPS = {
  ENTRY:        "entry",
  FIND_MEMBER:  "find_member",
  OTP_SENT:     "otp_sent",
  SET_PASSWORD: "set_password",
  SUCCESS:      "success",
  LOGIN_PW:     "login_pw",
};

export default function LoginModal({ open, onLogin }) {
  const { t } = useLanguage();

  const [step, setStep]               = useState(STEPS.ENTRY);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [devCode, setDevCode]         = useState("");

  const [quickName, setQuickName]     = useState("");
  const [findName, setFindName]       = useState("");
  const [findPhone, setFindPhone]     = useState("");
  const [findEmail, setFindEmail]     = useState("");
  const [contactMode, setContactMode] = useState("email");
  const [foundMember, setFoundMember] = useState(null);
  const [contactType, setContactType] = useState("email");
  const [otpCode, setOtpCode]         = useState("");
  const [password, setPassword]       = useState("");
  const [confirm, setConfirm]         = useState("");
  const [loginName, setLoginName]     = useState("");
  const [loginPw, setLoginPw]         = useState("");

  function reset() {
    setStep(STEPS.ENTRY); setError(""); setDevCode("");
    setQuickName(""); setFindName(""); setFindPhone(""); setFindEmail("");
    setFoundMember(null); setOtpCode(""); setPassword(""); setConfirm("");
    setLoginName(""); setLoginPw("");
  }

  async function handleFindMember(e) {
    e.preventDefault();
    setError(""); setFoundMember(null);
    const contact = contactMode === "phone" ? findPhone : findEmail;
    if (!findName.trim() || !contact.trim()) { setError(t("authContactRequired")); return; }
    setLoading(true);
    try {
      const payload = { name: findName.trim() };
      if (contactMode === "phone") {
        payload.phone = findPhone.trim().replace(/[^0-9]/g, "");        
      }
      else {
        payload.email = findEmail.trim();
      }
      const member = await api.findMember(payload);
      setFoundMember(member);
      setContactType(contactMode);
    } catch (err) {
      setError(err.message || t("authMemberNotFound"));
    } finally { setLoading(false); }
  }

  async function handleSendOtp() {
    setError(""); setLoading(true);
    try {
      const res = await api.sendOtp({ member_id: foundMember.member_id, contact_type: contactType });
      setDevCode(res.dev_code || "");
      setStep(STEPS.OTP_SENT);
    } catch (err) {
      setError(err.message || t("authOtpFailed"));
    } finally { setLoading(false); }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError("");
    if (otpCode.length !== 4) { setError(t("authOtpLength")); return; }
    setLoading(true);
    try {
      await api.verifyOtp({ member_id: foundMember.member_id, code: otpCode });
      setStep(STEPS.SET_PASSWORD);
    } catch (err) {
      setError(err.message || t("authOtpInvalid"));
    } finally { setLoading(false); }
  }

  async function handleCreateAccount(e) {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError(t("authPwTooShort")); return; }
    if (password !== confirm) { setError(t("authPwMismatch")); return; }
    setLoading(true);
    try {
      
      await api.createAccount({ member_id: foundMember.member_id, code: otpCode, password });
      setStep(STEPS.SUCCESS);
    } catch (err) {
      setError(err.message || t("authCreateFailed"));
    } finally { setLoading(false); }
  }

  async function handleLoginWithPw(e) {
    e.preventDefault();
    setError("");
    if (!loginName.trim() || !loginPw) { setError(t("loginError")); return; }
    setLoading(true);
    try {
      const res = await api.loginWithPassword({ name: loginName.trim(), password: loginPw });
      console.log('login check:', res);
      // Store the access token in localStorage
      if (res.access_token) {
        localStorage.setItem("milal_token", res.access_token);
      }
      onLogin(res.name, res.permission, res.title, res.cell_group);
    } catch (err) {
      setError(err.message || t("authLoginFailed"));
    } finally { setLoading(false); }
  }

  const Header = ({ subtitle }) => (
    <Box sx={{ bgcolor: "#1976d2", px: 4, py: 3.5, textAlign: "center" }}>
      <Box sx={{ width: 56, height: 56, bgcolor: "white", borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        mx: "auto", mb: 1.5, boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
        <Typography sx={{ fontSize: "24px", fontWeight: 800, color: "#1976d2" }}>M</Typography>
      </Box>
      <Typography variant="h6" sx={{ color: "white", fontWeight: 800 }}>{t("loginTitle")}</Typography>
      <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.78)", mt: 0.4, fontSize: "13px" }}>
        {subtitle || t("loginSubtitle")}
      </Typography>
    </Box>
  );

  const BackBtn = ({ to }) => (
    <Button size="small" onClick={() => { setError(""); setStep(to); }}
      sx={{ textTransform: "none", color: "#5d7186", fontSize: "12px", mb: 1, pl: 0, minWidth: 0 }}>
      ← {t("authBack")}
    </Button>
  );

  return (
    <Dialog open={open} maxWidth="xs" fullWidth disableEscapeKeyDown>
      <DialogContent sx={{ p: 0 }}>

        {(step === STEPS.LOGIN_PW || step === STEPS.ENTRY) && (
          <>
            <Header subtitle={t("authLoginWithPwSubtitle")} />
            <Box sx={{ px: 3, py: 3 }}>
              <Box component="form" onSubmit={handleLoginWithPw}>
                <Stack spacing={2}>
                  <TextField label={t("authYourName")} fullWidth size="small" required
                    value={loginName} onChange={(e) => setLoginName(e.target.value)} autoFocus />
                  <TextField label={t("authPassword")} type="password" fullWidth size="small" required
                    value={loginPw} onChange={(e) => setLoginPw(e.target.value)} />
                  {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}

              <Button variant="outlined" fullWidth onClick={() => { setError(""); setStep(STEPS.FIND_MEMBER); }}
                  sx={{ textTransform: "none", fontWeight: 400, borderColor: "#d8dfe7", color: "#999999",
                    "&:hover": { borderColor: "#1976d2", color: "#1976d2", bgcolor: "rgba(25,118,210,0.04)" } }}>
                  {t("authCreateAccount")}
                </Button>
                  <Button type="submit" variant="contained" fullWidth disabled={loading}
                    sx={{ bgcolor: "#1976d2", py: 1.2, fontWeight: 700, textTransform: "none",
                      "&:hover": { bgcolor: "#1565c0" } }}>
                    {loading ? <CircularProgress size={18} color="inherit" /> : t("authLogin")}
                  </Button>
                </Stack>
              </Box>
            </Box>
          </>
        )}
        {step === STEPS.FIND_MEMBER && (
          <>
            <Header subtitle={t("authFindMemberSubtitle")} />
            <Box sx={{ px: 3, py: 3 }}>
              <BackBtn to={STEPS.ENTRY} />
              <Box component="form" onSubmit={handleFindMember}>
                <Stack spacing={2}>
                  <TextField label={t("authYourName")} fullWidth size="small" required
                    value={findName} onChange={(e) => { setFindName(e.target.value); setFoundMember(null); }} />
                  <Box>
                    <Typography variant="body2" sx={{ fontSize: "12px", color: "#666", mb: 0.8 }}>
                      {t("authSendOtpTo")}
                    </Typography>
                    <RadioGroup
                      row
                      value={contactMode}
                      onChange={(e) => { setContactMode(e.target.value); setFoundMember(null); setError(""); }}
                      sx={{ gap: 2 }}
                    >
                      <FormControlLabel
                        value="phone"
                        control={<Radio size="small" />}
                        label={t("authPhone")}
                        sx={{ m: 0 }}
                      />
                      <FormControlLabel
                        value="email"
                        control={<Radio size="small" />}
                        label={t("authEmail")}
                        sx={{ m: 0 }}
                      />
                    </RadioGroup>
                  </Box>
                  {contactMode === "phone"
                    ? <TextField label={t("authPhone")} fullWidth size="small" placeholder="010-0000-0000"
                        value={findPhone} onChange={(e) => { setFindPhone(e.target.value); setFoundMember(null); }} />
                    : <TextField label={t("authEmail")} type="email" fullWidth size="small"
                        value={findEmail} onChange={(e) => { setFindEmail(e.target.value); setFoundMember(null); }} />
                  }
                  {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
                  {foundMember && !error && foundMember.has_account && (
                    <Box sx={{ bgcolor: "#fff3e0", border: "1px solid #ffe0b2", borderRadius: "8px", p: 1.5 }}>
                      <Typography variant="body2" fontWeight={700} sx={{ color: "#e65100" }}>
                        ✓ {foundMember.name}
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#e65100", mt: 1, fontWeight: 600 }}>
                        {t("authAccountExists")}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#bf360c", display: "block", mt: 0.5 }}>
                        {t("authAccountExistsDesc")}
                      </Typography>
                      <Button variant="outlined" fullWidth size="small" 
                        onClick={() => { setError(""); setStep(STEPS.ENTRY); setFoundMember(null); }}
                        sx={{ mt: 1.5, color: "#e65100", borderColor: "#e65100", fontWeight: 600, textTransform: "none",
                          "&:hover": { bgcolor: "rgba(230, 81, 0, 0.04)", borderColor: "#e65100" } }}>
                        {t("authBack")}
                      </Button>
                    </Box>
                  )}
                  {foundMember && !error && !foundMember.has_account && (
                    <Box sx={{ bgcolor: "#f0f7ff", border: "1px solid #bbdefb", borderRadius: "8px", p: 1.5 }}>
                      <Typography variant="body2" fontWeight={700} sx={{ color: "#1976d2" }}>
                        ✓ {foundMember.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#5d7186" }}>
                        {t("authSendOtpTo")} {contactType === "phone" ? foundMember.phone_masked : foundMember.email_masked}
                      </Typography>
                      <Button variant="contained" fullWidth size="small" disabled={loading}
                        onClick={handleSendOtp}
                        sx={{ mt: 1.5, bgcolor: "#1976d2", fontWeight: 700, textTransform: "none" }}>
                        {loading ? <CircularProgress size={16} color="inherit" /> : t("authSendCode")}
                      </Button>
                    </Box>
                  )}
                  {!foundMember && (
                    <Button type="submit" variant="contained" fullWidth disabled={loading}
                      sx={{ bgcolor: "#1976d2", py: 1.2, fontWeight: 700, textTransform: "none",
                        "&:hover": { bgcolor: "#1565c0" } }}>
                      {loading ? <CircularProgress size={18} color="inherit" /> : t("authFindMember")}
                    </Button>
                  )}
                </Stack>
              </Box>
            </Box>
          </>
        )}

        {step === STEPS.OTP_SENT && (
          <>
            <Header subtitle={t("authEnterCodeSubtitle")} />
            <Box sx={{ px: 3, py: 3 }}>
              <BackBtn to={STEPS.FIND_MEMBER} />
              <Box component="form" onSubmit={handleVerifyOtp}>
                <Stack spacing={2}>
                  <Typography variant="body2" sx={{ color: "#5d7186", fontSize: "13px" }}>
                    {t("authCodeSentTo")} <strong>
                      {contactType === "phone" ? foundMember?.phone_masked : foundMember?.email_masked}
                    </strong>
                  </Typography>
                  <TextField label={t("authCode")} fullWidth size="small" required
                    inputProps={{ maxLength: 4, style: { letterSpacing: "0.5em", fontSize: "22px", textAlign: "center" } }}
                    value={otpCode}
                    onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }}
                    autoFocus />
                  {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
                  <Button type="submit" variant="contained" fullWidth disabled={loading || otpCode.length !== 4}
                    sx={{ bgcolor: "#1976d2", py: 1.2, fontWeight: 700, textTransform: "none",
                      "&:hover": { bgcolor: "#1565c0" } }}>
                    {loading ? <CircularProgress size={18} color="inherit" /> : t("authVerify")}
                  </Button>
                  <Button size="small" onClick={handleSendOtp} disabled={loading}
                    sx={{ textTransform: "none", color: "#5d7186", fontSize: "12px" }}>
                    {t("authResend")}
                  </Button>
                </Stack>
              </Box>
            </Box>
          </>
        )}

        {step === STEPS.SET_PASSWORD && (
          <>
            <Header subtitle={t("authSetPasswordSubtitle")} />
            <Box sx={{ px: 3, py: 3 }}>
              <Box component="form" onSubmit={handleCreateAccount}>
                <Stack spacing={2}>
                  <TextField label={t("authPassword")} type="password" fullWidth size="small" required
                    value={password} onChange={(e) => setPassword(e.target.value)} autoFocus
                    helperText={t("authPwHint")} />
                  <TextField label={t("authConfirmPassword")} type="password" fullWidth size="small" required
                    value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                  {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
                  <Button type="submit" variant="contained" fullWidth disabled={loading}
                    sx={{ bgcolor: "#1976d2", py: 1.2, fontWeight: 700, textTransform: "none",
                      "&:hover": { bgcolor: "#1565c0" } }}>
                    {loading ? <CircularProgress size={18} color="inherit" /> : t("authCreateAccountBtn")}
                  </Button>
                </Stack>
              </Box>
            </Box>
          </>
        )}

        {step === STEPS.SUCCESS && (
          <>
            <Header subtitle={t("authSuccessSubtitle")} />
            <Box sx={{ px: 3, py: 3, textAlign: "center" }}>
              <Typography sx={{ fontSize: "40px", mb: 1 }}>✅</Typography>
              <Typography variant="h6" fontWeight={700} sx={{ color: "#313b5e" }}>{t("authSuccessTitle")}</Typography>
              <Typography variant="body2" sx={{ color: "#5d7186", mt: 1, mb: 3 }}>{t("authSuccessDesc")}</Typography>
              <Button variant="contained" fullWidth onClick={reset}
                sx={{ bgcolor: "#1976d2", py: 1.2, fontWeight: 700, textTransform: "none",
                  "&:hover": { bgcolor: "#1565c0" } }}>
                {t("authGoToLogin")}
              </Button>
            </Box>
          </>
        )}

      </DialogContent>
    </Dialog>
  );
}
