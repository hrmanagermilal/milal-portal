import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import ButtonGroup from "@mui/material/ButtonGroup";
import { useLanguage } from "../i18n/LanguageContext";
import { api } from "../api";
import UserManagementDetail from "./UserManagementDetail";

const ITEMS_PER_PAGE = 20;

export default function UserManagement() {
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load users on mount and when page changes
  useEffect(() => {
    loadUsers();
  }, [currentPage]);

  // Load total count on mount
  useEffect(() => {
    loadTotalCount();
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const skip = (currentPage - 1) * ITEMS_PER_PAGE;
      const data = await api.adminGetUsers(skip, ITEMS_PER_PAGE);
      setUsers(data);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadTotalCount() {
    try {
      const data = await api.adminGetUserCount();
      setTotalCount(data.total);
    } catch (err) {
      console.error("Failed to load user count:", err);
    }
  }

  function handleUserClick(user) {
    setSelectedUser(user);
    setDetailModalOpen(true);
  }

  function handleCloseDetailModal() {
    setDetailModalOpen(false);
    setSelectedUser(null);
    // Refresh the list when detail modal closes
    loadUsers();
    loadTotalCount();
  }

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
          {t("userManagement") || "User Management"}
        </Typography>

        {/* Pagination Controls */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, gap: 2 }}>
          <Typography variant="caption" sx={{ color: "#8486a7", fontWeight: 600 }}>
            {totalCount > 0 
              ? `${startIdx + 1}–${Math.min(startIdx + ITEMS_PER_PAGE, totalCount)} of ${totalCount}`
              : "No users"
            }
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <ButtonGroup size="small" variant="outlined">
              <Button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                sx={{ fontSize: "12px", fontWeight: 600, color: "#1976d2", borderColor: "#d8dfe7" }}
              >
                {t("prev") || "Prev"}
              </Button>
              <Button
                disabled
                sx={{ fontSize: "12px", color: "#1976d2", borderColor: "#d8dfe7", cursor: "default" }}
              >
                {currentPage} / {totalPages || 1}
              </Button>
              <Button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                sx={{ fontSize: "12px", fontWeight: 600, color: "#1976d2", borderColor: "#d8dfe7" }}
              >
                {t("next") || "Next"}
              </Button>
            </ButtonGroup>
          </Stack>
        </Box>

        {/* Users Table */}
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead sx={{ bgcolor: "#eef2f7" }}>
              <TableRow>
                <TableCell sx={{ color: "#313b5e", fontWeight: 700, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {t("colName") || "Name"}
                </TableCell>
                <TableCell sx={{ color: "#313b5e", fontWeight: 700, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Email
                </TableCell>
                <TableCell sx={{ color: "#313b5e", fontWeight: 700, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {t("colPhone") || "Phone"}
                </TableCell>
                <TableCell sx={{ color: "#313b5e", fontWeight: 700, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {t("colStatus") || "Status"}
                </TableCell>
                <TableCell sx={{ color: "#313b5e", fontWeight: 700, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {t("action") || "Action"}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: "center", py: 3, color: "#8486a7" }}>
                    <Typography variant="body2">Loading...</Typography>
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: "center", py: 3, color: "#8486a7" }}>
                    <Typography variant="body2">{t("noUsers") || "No users"}</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600, color: "#313b5e", fontSize: "13px" }}>
                        {user.member_name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ color: "#5d7186", fontSize: "13px" }}>
                        {user.member_email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ color: "#5d7186", fontSize: "13px" }}>
                        {user.member_phone}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ 
                        color: user.is_admin ? "#d32f2f" : "#757575", 
                        fontWeight: 600,
                        fontSize: "13px" 
                      }}>
                        {user.is_admin ? "Admin" : "User"}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => handleUserClick(user)}
                        sx={{ color: "#1976d2", "&:hover": { bgcolor: "rgba(25, 118, 210, 0.1)" } }}
                        title="Edit user"
                      >
                        ✎
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Detail Modal */}
        {selectedUser && (
          <UserManagementDetail
            open={detailModalOpen}
            onClose={handleCloseDetailModal}
            user={selectedUser}
            onUserUpdated={handleCloseDetailModal}
          />
        )}
      </CardContent>
    </Card>
  );
}
