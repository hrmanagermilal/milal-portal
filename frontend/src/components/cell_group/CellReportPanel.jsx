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
import Pagination from "@mui/material/Pagination";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { api } from "../../api";
import { useLanguage } from "../../i18n/LanguageContext";

const DRAFT_KEY = "milal_cell_report_draft";
const REPORTS_PER_PAGE = 6;

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function CellReportPanel() {
  const { t } = useLanguage();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [writeOpen, setWriteOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [reports, setReports] = useState([]);
  const [reportPage, setReportPage] = useState(1);
  const [listLoading, setListLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [detail, setDetail] = useState(null);
  const currentCellGroup = localStorage.getItem("milal_cell_group") || "";

  const [meetingDate, setMeetingDate] = useState(todayDate());
  const [meetingAt, setMeetingAt] = useState("");
  const [meetingPlace, setMeetingPlace] = useState("");
  const [overallPrayer, setOverallPrayer] = useState("");
  const [leaderComment, setLeaderComment] = useState("");

  useEffect(() => {
    const draftRaw = localStorage.getItem(DRAFT_KEY);
    if (draftRaw) {
      try {
        const draft = JSON.parse(draftRaw);
        setMeetingDate(draft.meetingDate || todayDate());
        setMeetingAt(draft.meetingAt || "");
        setMeetingPlace(draft.meetingPlace || "");
        setOverallPrayer(draft.overallPrayer || "");
        setLeaderComment(draft.leaderComment || "");
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

      console.log("Draft members loaded:", data);

      setMembers(
        data.map((m) => ({
          id: m.id,
          name: m.name,
          title: m.title,
          attended: draftMembers[m.id]?.attended ?? false,
          attendanceType: draftMembers[m.id]?.attendanceType ?? "absent",
          prayer: draftMembers[m.id]?.prayer ?? "",
          remarks: draftMembers[m.id]?.remarks ?? "",
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
      leaderComment,
      members: members.reduce((acc, m) => {
        acc[m.id] = { attended: m.attended, attendanceType: m.attendanceType, prayer: m.prayer, remarks: m.remarks };
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
    setLeaderComment("");
    setMembers((prev) => prev.map((m) => ({ ...m, attended: false, attendanceType: "absent", prayer: "", remarks: "" })));
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
        leader_comment: leaderComment,
        members: members.map((m) => ({
          member_id: m.id,
          attended: m.attended,
          attendance_type: m.attendanceType,
          prayer: m.prayer,
          remarks: m.remarks,
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

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const buildPdfMarkup = (report) => {
    const attendedCount = report.entries.filter((entry) => entry.attended).length;
    const rows = report.entries
      .map(
        (entry) => `
          <tr>
            <td>${entry.attended ? "O" : "-"}</td>
            <td>${escapeHtml(entry.member_name)}</td>
            <td>${escapeHtml(entry.prayer || "-")}</td>
          </tr>
        `
      )
      .join("");

    return `
      <div style="font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; color:#1e3258; width:760px; background:#ffffff; padding:28px 30px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #dce6fb; padding-bottom:14px;">
          <div>
            <div style="font-size:28px; font-weight:800; letter-spacing:0.2px;">${escapeHtml(t("cellReportTitle"))}</div>
            <div style="font-size:13px; color:#4a5f86; margin-top:6px;">${escapeHtml(report.cell_group || "")}</div>
          </div>
          <div style="font-size:12px; color:#4a5f86; text-align:right; line-height:1.6;">
            <div>${escapeHtml(t("cellReportDate"))}: ${escapeHtml(report.meeting_date || "-")}</div>
            <div>${escapeHtml(t("cellReportTime"))}: ${escapeHtml(report.meeting_time || "-")}</div>
            <div>${escapeHtml(t("cellReportPlace"))}: ${escapeHtml(report.meeting_place || "-")}</div>
          </div>
        </div>

        <div style="margin-top:14px; background:#f4f8ff; border:1px solid #dbe7ff; border-radius:10px; padding:10px 12px; font-size:13px; color:#355083;">
          ${escapeHtml(t("cellReportAttendanceCount")).replace("{attended}", String(attendedCount)).replace("{total}", String(report.entries.length))}
        </div>

        <table style="width:100%; margin-top:14px; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="background:#edf2fa;">
              <th style="text-align:left; border:1px solid #d5deec; padding:9px 10px; width:70px;">${escapeHtml(t("cellReportAttended"))}</th>
              <th style="text-align:left; border:1px solid #d5deec; padding:9px 10px; width:160px;">${escapeHtml(t("name"))}</th>
              <th style="text-align:left; border:1px solid #d5deec; padding:9px 10px;">${escapeHtml(t("cellReportMemberPrayer"))}</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div style="margin-top:16px;">
          <div style="font-size:13px; font-weight:700; color:#1e3258; margin-bottom:8px;">${escapeHtml(t("cellReportOverallPrayerSection"))}</div>
          <div style="border:1px solid #d5deec; border-radius:10px; background:#fcfdff; min-height:120px; padding:12px 13px; font-size:13px; color:#2f3e5f; line-height:1.7; white-space:pre-wrap;">${escapeHtml(report.overall_prayer || "-")}</div>
        </div>
      </div>
    `;
  };

  const exportReportPdf = async (report) => {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-10000px";
    container.style.top = "0";
    container.style.zIndex = "-1";
    container.style.background = "#fff";
    container.innerHTML = buildPdfMarkup(report);
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container.firstElementChild, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });

      const pdf = new jsPDF("p", "pt", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const imgData = canvas.toDataURL("image/png");
      const printableHeight = pageHeight - margin * 2;

      let offset = 0;
      while (offset < imgHeight) {
        if (offset > 0) {
          pdf.addPage();
        }
        pdf.addImage(imgData, "PNG", margin, margin - offset, imgWidth, imgHeight);
        offset += printableHeight;
      }

      const datePart = report.meeting_date || "report";
      pdf.save(`cell-report-${datePart}.pdf`);
    } finally {
      document.body.removeChild(container);
    }
  };

  const downloadReport = async (reportId) => {
    try {
      setDownloadingId(reportId);
      setError("");
      const report = await api.getCellReportDetail(reportId);
      report.cell_group = cellGroupDisplay;
      await exportReportPdf(report);
      setSuccess(t("cellReportDownloadSuccess"));
    } catch (err) {
      setError(err.message || t("cellReportDownloadFailed"));
    } finally {
      setDownloadingId(null);
    }
  };

  const attendedCount = useMemo(() => members.filter((m) => m.attended).length, [members]);
  const cellLeader = useMemo(() => members.find((member) => member.title === "순장"), [members]);
  const cellGroupDisplay = currentCellGroup
    ? `${currentCellGroup}${cellLeader?.name ? `(${cellLeader.name} 순장)` : ""}`
    : "";
  const totalReportPages = useMemo(
    () => Math.max(1, Math.ceil(reports.length / REPORTS_PER_PAGE)),
    [reports.length]
  );
  const pagedReports = useMemo(() => {
    const start = (reportPage - 1) * REPORTS_PER_PAGE;
    return reports.slice(start, start + REPORTS_PER_PAGE);
  }, [reportPage, reports]);

  useEffect(() => {
    setReportPage(1);
  }, [reports.length]);

  console.log("Members state:", members, cellLeader, cellGroupDisplay);
  return (
    <Stack
      spacing={2}
      sx={{
        "& .MuiTypography-root": { fontSize: "13px" },
        "& .MuiButton-root": { fontSize: "13px" },
        "& .MuiInputBase-input": { fontSize: "13px" },
        "& .MuiInputLabel-root": { fontSize: "13px" },
        "& .MuiTableCell-root": { fontSize: "13px" },
        "& .MuiPaginationItem-root": { fontSize: "13px" },
        "& .MuiDialogTitle-root": { fontSize: "13px" },
      }}
    >
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess("")}>{success}</Alert>}

      <Card sx={{ borderRadius: "14px" }}>
        <CardContent>
          <Stack direction="row" alignItems="center" sx={{ mb: 1.25, width: "100%" }}>
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{t("cellReportListTitle")}</Typography>
              {cellGroupDisplay && (
                <Typography variant="body2" sx={{ color: "#5d7186", fontWeight: 500 }}>
                  {cellGroupDisplay}
                </Typography>
              )}
            </Stack>
            <Button
              variant="contained"
              onClick={() => setWriteOpen(true)}
              sx={{
                ml: "auto",
                bgcolor: "#2f68f9",
                fontSize: "13px",
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
            <Stack spacing={1.25}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                  gap: 1.25,
                }}
              >
                {pagedReports.map((r) => (
                  <Card
                    key={r.id}
                    variant="outlined"
                    onClick={isMobile ? () => openDetail(r.id) : undefined}
                    sx={{
                      borderRadius: "8px",
                      borderColor: "#2f68f9",
                      bgcolor: "#f8fbff",
                      cursor: isMobile ? "pointer" : "default",
                    }}
                  >
                    <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Stack spacing={1.15}>
                        <Stack
                          spacing={0.55}
                          onClick={!isMobile ? () => openDetail(r.id) : undefined}
                          sx={{ cursor: "pointer" }}
                        >
                          <Stack
                            direction="row"
                            spacing={isMobile ? 1.6 : 1}
                            sx={{ alignItems: "center", minWidth: 0 }}
                          >
                            <Typography
                              sx={{
                                fontWeight: 700,
                                color: "#1976d2",
                                fontSize: "13px",
                                lineHeight: 1.4,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {r.meeting_date}
                            </Typography>
                            <Typography sx={{ color: "#94a3b8", fontSize: "13px", lineHeight: 1.4, mx: isMobile ? 0.6 : 0 }}>|</Typography>
                            <Typography
                              sx={{
                                fontWeight: 600,
                                color: "#0f264a",
                                fontSize: "13px",
                                lineHeight: 1.4,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {r.meeting_time || "-"}
                            </Typography>
                            <Typography sx={{ color: "#94a3b8", fontSize: "13px", lineHeight: 1.4, mx: isMobile ? 0.6 : 0 }}>|</Typography>
                            <Typography
                              sx={{
                                fontWeight: 600,
                                color: "#0f264a",
                                fontSize: "13px",
                                lineHeight: 1.4,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {r.meeting_place || "-"}
                            </Typography>
                          </Stack>
                        </Stack>

                        <Typography sx={{ color: "#4a5568", fontSize: "13px", lineHeight: 1.6 }}>
                          {t("cellReportAttendanceSection")}: {r.attendee_count}/{r.total_count} · {t("cellReportMemberPrayer")}: {r.prayer_recorded_count}
                        </Typography>

                        {!isMobile && (
                          <Stack direction="row" spacing={0.8}>
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => openDetail(r.id)}
                              sx={{
                                bgcolor: "#2196f3",
                                fontSize: "13px",
                                fontWeight: 600,
                                px: 2,
                                py: 0.5,
                                borderRadius: "6px",
                                textTransform: "none",
                                "&:hover": {
                                  bgcolor: "#1e88e5",
                                },
                              }}
                            >
                              {t("cellReportDetailView")}
                            </Button>
                            <Button
                              variant="outlined"
                              size="small"
                              disabled={downloadingId === r.id}
                              onClick={() => downloadReport(r.id)}
                              sx={{
                                color: "#2f68f9",
                                borderColor: "#2f68f9",
                                fontSize: "13px",
                                fontWeight: 600,
                                textTransform: "none",
                                "&:hover": {
                                  borderColor: "#1e50c7",
                                  bgcolor: "rgba(47,104,249,0.06)",
                                },
                              }}
                            >
                              {downloadingId === r.id ? t("cellReportDownloading") : t("cellReportDownload")}
                            </Button>
                          </Stack>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Box>

              <Stack direction="row" justifyContent="center" sx={{ pt: 0.75 }}>
                <Pagination
                  count={totalReportPages}
                  page={reportPage}
                  onChange={(_, value) => setReportPage(value)}
                  size={isMobile ? "small" : "medium"}
                  color="primary"
                />
              </Stack>
            </Stack>
          )}
        </CardContent>
      </Card>

      <Dialog open={writeOpen} onClose={() => setWriteOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{t("cellReportCreateTitle")}</DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <Stack spacing={2} sx={{ pt: 0.75, pb: 1 }}>
            <Card sx={{ borderRadius: "14px" }}>
              <CardContent>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 1.25 }}>{t("cellReportMetaSection")}</Typography>
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
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{t("cellReportAttendanceSection")}</Typography>
                  <Typography variant="body2" sx={{ color: "#64748b" }}>
                    {t("cellReportAttendanceCount").replace("{attended}", String(attendedCount)).replace("{total}", String(members.length))}
                  </Typography>
                </Stack>

                {loading ? (
                  <Box sx={{ py: 3, display: "flex", justifyContent: "center" }}><CircularProgress size={24} /></Box>
                ) : (
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: "10px", overflowX: "auto" }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: "#f8fafc" }}>
                          <TableCell sx={{ fontWeight: 700, minWidth: 100 }}>{t("name")}</TableCell>
                          <TableCell sx={{ fontWeight: 700, minWidth: 120 }}>출석 상태</TableCell>
                          <TableCell sx={{ fontWeight: 700, minWidth: 200 }}>{t("cellReportMemberPrayer")}</TableCell>
                          <TableCell sx={{ fontWeight: 700, minWidth: 150 }}>참고사항</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {members.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell sx={{ minWidth: 100 }}>{m.name}</TableCell>
                            <TableCell sx={{ minWidth: 120 }}>
                              <select
                                value={m.attendanceType}
                                onChange={(e) =>
                                  setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, attendanceType: e.target.value } : x)))
                                }
                                style={{
                                  padding: "6px 8px",
                                  borderRadius: "4px",
                                  border: "1px solid #ddd",
                                  fontSize: "13px",
                                  width: "100%",
                                }}
                              >
                                <option value="present">출석</option>
                                <option value="absent">결석</option>
                                <option value="long_absence">장기결석</option>
                              </select>
                            </TableCell>
                            <TableCell sx={{ minWidth: 200 }}>
                              <TextField
                                value={m.prayer}
                                onChange={(e) =>
                                  setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, prayer: e.target.value } : x)))
                                }
                                placeholder="기도제목"
                                fullWidth
                                size="small"
                                multiline
                                maxRows={2}
                              />
                            </TableCell>
                            <TableCell sx={{ minWidth: 150 }}>
                              <TextField
                                value={m.remarks}
                                onChange={(e) =>
                                  setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, remarks: e.target.value } : x)))
                                }
                                placeholder="참고사항"
                                fullWidth
                                size="small"
                                multiline
                                maxRows={2}
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
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 1.25 }}>{t("cellReportOverallPrayerSection")}</Typography>
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

            <Card sx={{ borderRadius: "14px" }}>
              <CardContent>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 1.25 }}>순장 코멘트</Typography>
                <TextField
                  multiline
                  minRows={4}
                  fullWidth
                  value={leaderComment}
                  onChange={(e) => setLeaderComment(e.target.value)}
                  placeholder="순장 의견/코멘트를 입력하세요"
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
        <DialogTitle sx={{ pr: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ width: "100%" }}>
            <Typography sx={{ fontWeight: 700, fontSize: "13px" }}>{t("cellReportDetailTitle")}</Typography>
            {isMobile && detail && (
              <Button
                variant="outlined"
                size="small"
                disabled={downloadingId === detail.id}
                onClick={() => downloadReport(detail.id)}
                sx={{
                  ml: "auto",
                  color: "#2f68f9",
                  borderColor: "#2f68f9",
                  fontSize: "13px",
                  fontWeight: 600,
                  textTransform: "none",
                  "&:hover": {
                    borderColor: "#1e50c7",
                    bgcolor: "rgba(47,104,249,0.06)",
                  },
                }}
              >
                {downloadingId === detail.id ? t("cellReportDownloading") : t("cellReportDownload")}
              </Button>
            )}
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          {detailLoading ? (
            <Box sx={{ py: 3, display: "flex", justifyContent: "center" }}><CircularProgress size={24} /></Box>
          ) : detail ? (
            <Stack spacing={2} sx={{ pt: 0.75, pb: 1 }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={{ xs: 2, md: 1 }} sx={{ mt: 0.5 }}>
                <TextField label={t("cellReportDate")} value={detail.meeting_date || ""} fullWidth InputProps={{ readOnly: true }} />
                <TextField label={t("cellReportTime")} value={detail.meeting_time || ""} fullWidth InputProps={{ readOnly: true }} />
                <TextField label={t("cellReportPlace")} value={detail.meeting_place || ""} fullWidth InputProps={{ readOnly: true }} />
              </Stack>

              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: "10px", overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#f8fafc" }}>
                      <TableCell sx={{ fontWeight: 700, minWidth: 100 }}>{t("name")}</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 120 }}>출석 상태</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 200 }}>{t("cellReportMemberPrayer")}</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 150 }}>참고사항</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detail.entries.map((entry) => (
                      <TableRow key={`${detail.id}-${entry.member_id}`}>
                        <TableCell sx={{ minWidth: 100 }}>{entry.member_name}</TableCell>
                        <TableCell sx={{ minWidth: 120 }}>
                          {entry.attendance_type === "present" && "출석"}
                          {entry.attendance_type === "absent" && "결석"}
                          {entry.attendance_type === "long_absence" && "장기결석"}
                        </TableCell>
                        <TableCell sx={{ minWidth: 200 }}>{entry.prayer || "-"}</TableCell>
                        <TableCell sx={{ minWidth: 150 }}>{entry.remarks || "-"}</TableCell>
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

              <TextField
                label="순장 코멘트"
                value={detail.leader_comment || ""}
                fullWidth
                multiline
                minRows={3}
                InputProps={{ readOnly: true }}
              />

              <Stack direction="row" justifyContent="flex-end">
                <Button
                  variant="contained"
                  onClick={() => setDetailOpen(false)}
                  sx={{
                    bgcolor: "#2f68f9",
                    fontWeight: 600,
                    textTransform: "none",
                    "&:hover": {
                      bgcolor: "#1e50c7",
                    },
                  }}
                >
                  {t("close")}
                </Button>
              </Stack>
            </Stack>
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
