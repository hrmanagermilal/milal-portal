import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import { useLanguage } from "../../i18n/LanguageContext";
import { api } from "../../api";
import MyAccountModal from "../MyAccountModal";

export default function CellGroupInfoModal() {
  const { t } = useLanguage();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const currentCellGroup = localStorage.getItem("milal_cell_group") || "";
  const cellLeader = members.find((member) => member.title === "순장");
  const cellGroupDisplay = currentCellGroup
    ? `${currentCellGroup}${cellLeader?.name ? `(${cellLeader.name} 순장)` : ""}`
    : "";

  useEffect(() => {
    fetchCellGroupMembers();
  }, []);

  const fetchCellGroupMembers = async () => {
    try {
      setLoading(true);
      const data = await api.getCellGroupMembers();
      setMembers(data);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load cell group members");
    } finally {
      setLoading(false);
    }
  };

  const handleEditMember = (member) => {
    setSelectedMember(member);
    setEditModalOpen(true);
  };

  const handleEditClose = () => {
    setEditModalOpen(false);
    setSelectedMember(null);
    fetchCellGroupMembers(); // Refresh the list
  };

  return (
    <>
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between", alignItems: "center", mb: 2.5 }}>
            <Stack spacing={0.3}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: "#313b5e", fontSize: "16px" }}>
                {t("cellGroupTitle")}
              </Typography>
              {cellGroupDisplay && (
                <Typography variant="body2" sx={{ color: "#5d7186", fontWeight: 500 }}>
                  {cellGroupDisplay}
                </Typography>
              )}
            </Stack>
          </Stack>

          {error && (
            <Typography
              color="error"
              sx={{ mb: 2, p: 2, bgcolor: "error.light", borderRadius: 1 }}
            >
              {error}
            </Typography>
          )}
          {loading && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          )}
          {!loading && members.length === 0 && (
            <Typography sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
              No members found
            </Typography>
          )}
          {!loading && members.length > 0 && (
            <TableContainer component={Paper} sx={{ mt: 2 }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                    <TableCell sx={{ fontWeight: 600, fontSize: "14px" }}>
                      {t("colMemberName")}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: "14px" }}>
                      {t("colTitle")}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: "14px" }}>
                      {t("colPhone")}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: "14px" }}>
                      {t("colEmail")}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: "14px" }}>
                      {t("colAddress")}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: "14px" }}>
                      {t("colCarPlate")}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: "14px", textAlign: "center" }}>
                      {t("editMember")}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id} sx={{ "&:hover": { backgroundColor: "#f9f9f9" } }}>
                      <TableCell
                        sx={{
                          cursor: "pointer",
                          color: "#1976d2",
                          "&:hover": { textDecoration: "underline" },
                        }}
                        onClick={() => handleEditMember(member)}
                      >
                        {member.name}
                      </TableCell>
                      <TableCell>{member.title}</TableCell>
                      <TableCell>{member.phone}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell sx={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {member.address}
                      </TableCell>
                      <TableCell>{member.car_plate}</TableCell>
                      <TableCell sx={{ textAlign: "center" }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleEditMember(member)}
                          sx={{
                            color: "#2f68f9",
                            borderColor: "#2f68f9",
                            textTransform: "none",
                            fontSize: "12px",
                          }}
                        >
                          {t("editMember")}
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

      {selectedMember && (
        <MyAccountModal
          open={editModalOpen}
          onClose={handleEditClose}
          targetMemberId={selectedMember.id}
          isEditingOther={true}
        />
      )}
    </>
  );
}
