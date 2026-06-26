import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Alert from "@mui/material/Alert";
import { api } from "../../api";
import { useLanguage } from "../../i18n/LanguageContext";

const DRAFT_KEY = "milal_cell_report_draft";

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function CellReportPanel() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [writeOpen, setWriteOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [reports, setReports] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  const [meetingDate, setMeetingDate] = useState(todayDate());
  const [meetingAt, setMeetingAt] = useState("");
  const [meetingPlace, setMeetingPlace] = useState("");
  const [overallPrayer, setOverallPrayer] = useState("");

  useEffect(() => {
    const draftRaw = localStorage.getItem(DRAFT_KEY);
    if (draftRaw) {
      try {
        const draft = JSON.parse(draftRaw);
        setMeetingDate(draft.meetingDate || todayDate());
        setMeetingAt(draft.meetingAt || "");
        setMeetingPlace(draft.meetingPlace || "");
        setOverallPrayer(draft.overallPrayer || "");
      } catch {
        // ignore invalid draft
      }
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, []);

  useEffect(() => {
    loadReports();
  }, []);

  const loadMembers = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api.getCellGroupMembers();
      const draftRaw = localStorage.getItem(DRAFT_KEY);
      let draftMembers = {};
      if (draftRaw) {
        try {
          const draft = JSON.parse(draftRaw);
          draftMembers = draft.members || {};
        } catch {
          draftMembers = {};
        }
      }

      setMembers(
        data.map((m) => ({
          id: m.id,
          name: m.name,
          title: m.title,
          attended: draftMembers[m.id]?.attended ?? false,
          prayer: draftMembers[m.id]?.prayer ?? "",
        }))
      );
    } catch (err) {
      setError(err.message || "Failed to load cell members");
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = () => {
    const payload = {
      meetingDate,
      meetingAt,
      meetingPlace,
      overallPrayer,
      members: members.reduce((acc, m) => {
        acc[m.id] = { attended: m.attended, prayer: m.prayer };
        return acc;
      }, {}),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    setSuccess(t("cellReportSaved"));
  };

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setMeetingDate(todayDate());
    setMeetingAt("");
    setMeetingPlace("");
    setOverallPrayer("");
    setMembers((prev) => prev.map((m) => ({ ...m, attended: false, prayer: "" })));
    setSuccess(t("cellReportCleared"));
  };

  const loadReports = async () => {
    try {
      setListLoading(true);
      const data = await api.getCellReports();
      setReports(data || []);
    } catch (err) {
      setError(err.message || t("cellReportListLoadFailed"));
    } finally {
      setListLoading(false);
    }
  };

  const submitReport = async () => {
    try {
      setSubmitLoading(true);
      setError("");
      setSuccess("");

      const payload = {
        meeting_date: meetingDate,
        meeting_time: meetingAt,
        meeting_place: meetingPlace,
        overall_prayer: overallPrayer,
        members: members.map((m) => ({
          member_id: m.id,
          attended: m.attended,
          prayer: m.prayer,
        })),
      };

      await api.createCellReport(payload);
      localStorage.removeItem(DRAFT_KEY);
      setSuccess(t("cellReportSubmitted"));
      setWriteOpen(false);
      await loadReports();
    } catch (err) {
      setError(err.message || t("cellReportSubmitFailed"));
    } finally {
      setSubmitLoading(false);
    }
  };

  const openDetail = async (reportId) => {
    try {
      setDetailOpen(true);
      setDetailLoading(true);
      const data = await api.getCellReportDetail(reportId);
      setDetail(data);
    } catch (err) {
      setError(err.message || t("cellReportDetailLoadFailed"));
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const attendedCount = useMemo(() => members.filter((m) => m.attended).length, [members]);

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess("")}>{success}</Alert>}

      <Card sx={{ borderRadius: "14px" }}>
        <CardContent>
          <Stack direction="row" alignItems="center" sx={{ mb: 1.25, width: "100%" }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{t("cellReportListTitle")}</Typography>
            </Stack>
            <Button
              variant="contained"
              onClick={() => setWriteOpen(true)}
              sx={{
                ml: "auto",
                bgcolor: "#2f68f9",
                fontSize: "14px",
                fontWeight: 600,
                textTransform: "none",
                "&:hover": {
                  bgcolor: "#1e50c7",
                },
              }}
            >
              {t("cellReportCreateButton")}
            </Button>
          </Stack>

          {listLoading ? (
            <Box sx={{ py: 3, display: "flex", justifyContent: "center" }}><CircularProgress size={24} /></Box>
          ) : reports.length === 0 ? (
            <Typography variant="body2" sx={{ color: "#64748b" }}>{t("cellReportEmpty")}</Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: "10px" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "#f8fafc" }}>
                    <TableCell sx={{ fontWeight: 700 }}>{t("cellReportDate")}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{t("cellReportTime")}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{t("cellReportPlace")}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{t("cellReportAttendanceSection")}</TableCell>
                    <TableCell sx={{ width: 120 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reports.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell>{r.meeting_date}</TableCell>
                      <TableCell>{r.meeting_time || "-"}</TableCell>
                      <TableCell>{r.meeting_place || "-"}</TableCell>
                      <TableCell>{`${r.attendee_count}/${r.total_count}`}</TableCell>
                      <TableCell>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => openDetail(r.id)}
                          sx={{
                            color: "#2f68f9",
                            borderColor: "#2f68f9",
                            fontSize: "12px",
                            fontWeight: 600,
                            textTransform: "none",
                            "&:hover": {
                              borderColor: "#1e50c7",
                              bgcolor: "rgba(47,104,249,0.06)",
                            },
                          }}
                        >
                          {t("cellReportDetailView")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Dialog open={writeOpen} onClose={() => setWriteOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{t("cellReportCreateTitle")}</DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <Stack spacing={2} sx={{ pt: 0.75, pb: 1 }}>
            <Card sx={{ borderRadius: "14px" }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.25 }}>{t("cellReportMetaSection")}</Typography>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
                  <TextField
                    label={t("cellReportDate")}
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label={t("cellReportTime")}
                    type="time"
                    value={meetingAt}
                    onChange={(e) => setMeetingAt(e.target.value)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label={t("cellReportPlace")}
                    value={meetingPlace}
                    onChange={(e) => setMeetingPlace(e.target.value)}
                    fullWidth
                  />
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: "14px" }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{t("cellReportAttendanceSection")}</Typography>
                  <Typography variant="body2" sx={{ color: "#64748b" }}>
                    {t("cellReportAttendanceCount").replace("{attended}", String(attendedCount)).replace("{total}", String(members.length))}
                  </Typography>
                </Stack>

                {loading ? (
                  <Box sx={{ py: 3, display: "flex", justifyContent: "center" }}><CircularProgress size={24} /></Box>
                ) : (
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: "10px" }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: "#f8fafc" }}>
                          <TableCell sx={{ width: 100, fontWeight: 700 }}>{t("cellReportAttended")}</TableCell>
                          <TableCell sx={{ width: 180, fontWeight: 700 }}>{t("name")}</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>{t("cellReportMemberPrayer")}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {members.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell>
                              <Checkbox
                                checked={m.attended}
                                onChange={(e) =>
                                  setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, attended: e.target.checked } : x)))
                                }
                              />
                            </TableCell>
                            <TableCell>{m.name}</TableCell>
                            <TableCell>
                              <TextField
                                value={m.prayer}
                                onChange={(e) =>
                                  setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, prayer: e.target.value } : x)))
                                }
                                placeholder={t("cellReportMemberPrayerPlaceholder")}
                                fullWidth
                                size="small"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: "14px" }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.25 }}>{t("cellReportOverallPrayerSection")}</Typography>
                <TextField
                  multiline
                  minRows={5}
                  fullWidth
                  value={overallPrayer}
                  onChange={(e) => setOverallPrayer(e.target.value)}
                  placeholder={t("cellReportOverallPrayerPlaceholder")}
                />
              </CardContent>
            </Card>

            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button variant="contained" onClick={submitReport} disabled={submitLoading}>
                {submitLoading ? t("saving") : t("cellReportSubmit")}
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t("cellReportDetailTitle")}</DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          {detailLoading ? (
            <Box sx={{ py: 3, display: "flex", justifyContent: "center" }}><CircularProgress size={24} /></Box>
          ) : detail ? (
            <Stack spacing={2} sx={{ pt: 0.75, pb: 1 }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mt: 0.5 }}>
                <TextField label={t("cellReportDate")} value={detail.meeting_date || ""} fullWidth InputProps={{ readOnly: true }} />
                <TextField label={t("cellReportTime")} value={detail.meeting_time || ""} fullWidth InputProps={{ readOnly: true }} />
                <TextField label={t("cellReportPlace")} value={detail.meeting_place || ""} fullWidth InputProps={{ readOnly: true }} />
              </Stack>

              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: "10px" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#f8fafc" }}>
                      <TableCell sx={{ width: 90, fontWeight: 700 }}>{t("cellReportAttended")}</TableCell>
                      <TableCell sx={{ width: 180, fontWeight: 700 }}>{t("name")}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{t("cellReportMemberPrayer")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detail.entries.map((entry) => (
                      <TableRow key={`${detail.id}-${entry.member_id}`}>
                        <TableCell>{entry.attended ? "O" : "-"}</TableCell>
                        <TableCell>{entry.member_name}</TableCell>
                        <TableCell>{entry.prayer || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <TextField
                label={t("cellReportOverallPrayerSection")}
                value={detail.overall_prayer || ""}
                fullWidth
                multiline
                minRows={4}
                InputProps={{ readOnly: true }}
              />
            </Stack>
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
