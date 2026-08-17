import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Modal,
  Typography,
  CircularProgress,
  Alert,
  Pagination,
} from '@mui/material';
import { api } from '../api';

/**
 * ADMIN 전용: 성도 검색 및 관리 메뉴
 */
export default function AdminSearchMembers() {
  const [searchQuery, setSearchQuery] = useState('');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const [selectedMember, setSelectedMember] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // 검색 쿼리 변경 시 첫 페이지로 리셋
  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  // 멤버 목록 조회
  useEffect(() => {
    const fetchMembers = async () => {
      setLoading(true);
      setError('');
      try {
        const skip = (page - 1) * pageSize;
        const data = await api.adminGetUsers(skip, pageSize, searchQuery);
        setMembers(data);

        const countData = await api.adminGetUserCount(searchQuery);
        setTotalCount(countData.total || 0);
      } catch (err) {
        setError(err.message || '성도 목록 조회 실패');
        console.error('Failed to fetch members:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [page, pageSize, searchQuery]);

  // 멤버 상세정보 모달 열기
  const handleOpenModal = (member) => {
    setSelectedMember(member);
    setModalOpen(true);
  };

  // 페이지 변경
  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>
        🔍 성도 검색 및 관리
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* 검색 필드 */}
      <Box sx={{ mb: 3 }}>
        <TextField
          label="성도 검색 (이름, 이메일, 전화, User ID)"
          variant="outlined"
          fullWidth
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="예: 김순장, user@example.com, 010-1234-5678"
          sx={{ maxWidth: 500 }}
        />
      </Box>

      {/* 멤버 테이블 */}
      <TableContainer component={Paper}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table>
            <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>이름</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>User ID</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>이메일</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>전화</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>직책</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Accessible</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>관리자</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                    검색 결과가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>{member.member_name}</TableCell>
                    <TableCell>{member.user_id}</TableCell>
                    <TableCell>{member.email || '-'}</TableCell>
                    <TableCell>{member.phone || '-'}</TableCell>
                    <TableCell>{member.member_title || '-'}</TableCell>
                    <TableCell>
                      {member.member_accessible === 1 ? '✓' : '✗'}
                    </TableCell>
                    <TableCell>
                      {member.is_admin ? '✓ Admin' : '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleOpenModal(member)}
                      >
                        편집
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* 페이지네이션 */}
      {totalCount > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={Math.ceil(totalCount / pageSize)}
            page={page}
            onChange={handlePageChange}
          />
        </Box>
      )}

      {/* 상세정보 모달 */}
      {selectedMember && (
        <AdminMemberDetailModal
          member={selectedMember}
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedMember(null);
            // 목록 새로고침
            setPage(1);
          }}
        />
      )}
    </Box>
  );
}

/**
 * 멤버 상세정보 편집 모달
 */
function AdminMemberDetailModal({ member, open, onClose }) {
  const [isAccessible, setIsAccessible] = useState(member?.member_accessible === 1);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleAccessibleToggle = async () => {
    setSaving(true);
    setMessage('');
    try {
      const newValue = isAccessible ? 0 : 1;
      await api.adminUpdateMemberAccessible(member.member_id, newValue);
      setIsAccessible(newValue === 1);
      setMessage(`✓ Accessible 상태가 "${newValue === 1 ? '활성화' : '비활성화'}"되었습니다.`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(`✗ 업데이트 실패: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 500,
          maxHeight: '80vh',
          overflow: 'auto',
          backgroundColor: 'white',
          borderRadius: 2,
          boxShadow: 3,
          p: 4,
        }}
      >
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
          성도 상세정보
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ color: 'gray' }}>이름</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>{member.member_name}</Typography>

          <Typography variant="body2" sx={{ color: 'gray' }}>User ID</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>{member.user_id}</Typography>

          <Typography variant="body2" sx={{ color: 'gray' }}>이메일</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>{member.email || '-'}</Typography>

          <Typography variant="body2" sx={{ color: 'gray' }}>전화</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>{member.phone || '-'}</Typography>

          <Typography variant="body2" sx={{ color: 'gray' }}>직책</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>{member.member_title || '-'}</Typography>

          {/* Accessible 토글 */}
          <Box
            sx={{
              mt: 3,
              p: 2,
              backgroundColor: '#f5f5f5',
              borderRadius: 1,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                Accessible
              </Typography>
              <Typography variant="caption" sx={{ color: 'gray' }}>
                그룹직책 순장/순모 이상인 경우 활성화
              </Typography>
            </Box>
            <Button
              variant={isAccessible ? 'contained' : 'outlined'}
              onClick={handleAccessibleToggle}
              disabled={saving}
              sx={{
                backgroundColor: isAccessible ? '#3b522e' : 'transparent',
                color: isAccessible ? 'white' : '#3b522e',
                borderColor: '#3b522e',
              }}
            >
              {isAccessible ? '✓ 활성화' : '✗ 비활성화'}
            </Button>
          </Box>

          {message && (
            <Alert
              severity={message.includes('✓') ? 'success' : 'error'}
              sx={{ mt: 2 }}
            >
              {message}
            </Alert>
          )}
        </Box>

        {/* 닫기 버튼 */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Button
            onClick={onClose}
            variant="outlined"
            disabled={saving}
          >
            닫기
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}
