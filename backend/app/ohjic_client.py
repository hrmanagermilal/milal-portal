"""
OHJIC (오직) API v2 클라이언트.
성도 정보, 그룹, 코드 등을 조회한다.
"""
import logging
import os
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)


class OhjicAPIClient:
    """
    OHJIC API v2 클라이언트.
    
    환경변수 필요:
    - OHJIC_API_KEY: API secret key (osk_live_... 또는 osk_test_...)
    - OHJIC_API_BASE_URL: API base URL (기본 https://api.ohjic.us)
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: float = 10.0,
    ):
        self.api_key = api_key or os.getenv("OHJIC_API_KEY")
        self.base_url = (base_url or os.getenv("OHJIC_API_BASE_URL", "https://api.ohjic.us")).rstrip("/")
        self.timeout = timeout

        if not self.api_key:
            raise ValueError("OHJIC_API_KEY 환경변수가 필요합니다.")

    def _make_headers(self) -> Dict[str, str]:
        """API 요청 헤더 생성."""
        return {
            "X-Api-Key": self.api_key,
            "Content-Type": "application/json",
        }

    async def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json_body: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """HTTP 요청 실행."""
        url = f"{self.base_url}{endpoint}"
        headers = self._make_headers()

        logger.info(f"[ohjic-http] {method} {endpoint}")
        logger.info(f"[ohjic-http] Full URL: {url}")
        if json_body:
            logger.info(f"[ohjic-http] Request body: {json_body}")
        if params:
            logger.info(f"[ohjic-http] Params: {params}")

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                logger.info(f"[ohjic-http] Sending {method} request...")
                response = await client.request(
                    method,
                    url,
                    headers=headers,
                    params=params,
                    json=json_body,
                )
                
                logger.info(f"[ohjic-http] Response status: {response.status_code}")
                if response.status_code >= 400:
                    logger.error(f"[ohjic-http] Error response: {response.text}")
                
                response.raise_for_status()
                response_json = response.json()
                logger.info(f"[ohjic-http] ✓ Response: {response_json}")
                return response_json
        except httpx.HTTPError as e:
            logger.error(f"[ohjic-http] ✗ API error - {type(e).__name__}: {e} (URL: {url})", exc_info=True)
            raise

    # ============ Members API ============

    async def get_members(
        self,
        page: int = 1,
        per_page: int = 20,
        name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        성도 목록 조회.
        
        Args:
            page: 페이지 번호 (기본 1)
            per_page: 페이지당 개수 (기본 20, 최대 100)
            name: 이름 부분검색
            
        Returns:
            { "data": [...], "meta": { "pagination": {...} } }
        """
        params = {"page": page, "per_page": per_page}
        if name:
            params["name"] = name

        return await self._request("GET", "/v2/members", params=params)

    async def get_member(self, member_id: int) -> Dict[str, Any]:
        """
        성도 상세 정보 조회.
        
        Args:
            member_id: 성도 고유번호
            
        Returns:
            { "data": {...} } (Member 스키마)
        """
        return await self._request("GET", f"/v2/members/{member_id}")

    async def update_member(
        self,
        member_id: int,
        member_name: Optional[str] = None,
        gender: Optional[str] = None,
        birth_date: Optional[str] = None,
        mobile_phone: Optional[str] = None,
        email: Optional[str] = None,
        position_name: Optional[str] = None,
        church_level_name: Optional[str] = None,
        address_road: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        성도 정보 수정 (부분).
        PUT /v2/members/{id}
        
        Supported fields by OHJIC API:
        - member_name: 이름
        - gender: 성별 ("M" | "F")
        - birth_date: 생년월일 (YYYY-MM-DD)
        - mobile_phone: 휴대전화
        - email: 이메일
        - position_name: 직분명
        - church_level_name: 신급명
        
        Note: Address fields (address_road, address_detail, etc.) cannot be updated via API.
              They are managed separately in the OHJIC system and are read-only via this API.
        
        Args:
            member_id: 성도 고유번호
            member_name: 이름
            gender: 성별 ("M" | "F")
            birth_date: 생년월일 (YYYY-MM-DD)
            mobile_phone: 휴대전화
            email: 이메일
            position_name: 직분명
            church_level_name: 신급명
            address_road: 도로명주소 (NOT SUPPORTED - will be ignored)
            **kwargs: 추가 필드
            
        Returns:
            { "data": {...} } (수정된 Member 스키마)
        """
        logger.info(f"[ohjic-update-member] START - member_id={member_id}")
        logger.info(f"[ohjic-update-member] Parameters: member_name={member_name}, mobile_phone={mobile_phone}, email={email}, address_road={address_road}")
        
        payload = {}
        if member_name is not None:
            payload["member_name"] = member_name
            logger.info(f"[ohjic-update-member] Added to payload: member_name={member_name}")
        if gender is not None:
            payload["gender"] = gender
        if birth_date is not None:
            payload["birth_date"] = birth_date
        if mobile_phone is not None:
            payload["mobile_phone"] = mobile_phone
            logger.info(f"[ohjic-update-member] Added to payload: mobile_phone={mobile_phone}")
        if email is not None:
            payload["email"] = email
            logger.info(f"[ohjic-update-member] Added to payload: email={email}")
        if position_name is not None:
            payload["position_name"] = position_name
        if church_level_name is not None:
            payload["church_level_name"] = church_level_name
        
        # address_road is NOT supported by OHJIC API - log and skip
        if address_road is not None:
            logger.warning(f"[ohjic-update-member] address_road is NOT supported by OHJIC API - skipping field: {address_road}")
        
        # 추가 필드 지원
        for key, value in kwargs.items():
            if value is not None:
                payload[key] = value
                logger.info(f"[ohjic-update-member] Added to payload: {key}={value}")
        
        logger.info(f"[ohjic-update-member] Final payload: {payload}")
        logger.info(f"[ohjic-update-member] Calling API endpoint: PUT /v2/members/{member_id}")
        
        try:
            result = await self._request("PUT", f"/v2/members/{member_id}", json_body=payload)
            logger.info(f"[ohjic-update-member] ✓ API response: {result}")
            return result
        except Exception as e:
            logger.error(f"[ohjic-update-member] ✗ API request failed - {type(e).__name__}: {e}", exc_info=True)
            raise



    # ============ Groups API ============

    async def get_groups(
        self,
        group_name: Optional[str] = None,
        year: Optional[int] = None,
        group_category: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        그룹 조회.
        
        Args:
            group_name: 그룹명 부분검색
            year: 연도
            group_category: 그룹 분류 코드
            
        Returns:
            { "data": [...] } (Group[] 스키마)
        """
        params = {}
        if group_name:
            params["group_name"] = group_name
        if year is not None:
            params["year"] = year
        if group_category is not None:
            params["group_category"] = group_category

        return await self._request("GET", "/v2/groups", params=params)

    # ============ Codes API ============

    async def get_codes(self, code_type: str) -> Dict[str, Any]:
        """
        코드 조회.
        
        Args:
            code_type: "PG"(직분) | "CL"(신급) | "MC"(교인구분)
            
        Returns:
            { "data": [...] } (Code[] 스키마)
        """
        return await self._request("GET", "/v2/codes", params={"type": code_type})

    # ============ Helper Methods ============

    async def get_member_accessible_and_permission(
        self, member_id: int
    ) -> tuple[int, str]:
        """
        멤버의 accessible과 permission 값을 계산.
        
        - accessible: member_custom_8이 "admin" 또는 "manager"이면 1, 아니면 0
        - permission: member_custom_8 값 ("admin", "manager", "member")
        
        Args:
            member_id: 성도 고유번호
            
        Returns:
            (accessible, permission)
        """
        logger.info(f"[get_member_accessible_and_permission] Called for member_id={member_id}")
        accessible = 0
        permission = "member"  # 기본값

        try:
            logger.info(f"[get_member_accessible_and_permission] Fetching member details for member_id={member_id}")
            member_response = await self.get_member(member_id)
            member = member_response.get("data", {})
            member_custom_8 = member.get("member_custom_8", "").strip()
            
            logger.info(f"[get_member_accessible_and_permission] member_custom_8 value: '{member_custom_8}' (type: {type(member_custom_8).__name__})")
            
            # member_custom_8 기반으로 권한 판단
            if member_custom_8 in {"admin", "manager"}:
                accessible = 1
                logger.info(f"[get_member_accessible_and_permission] Setting accessible=1 for member_custom_8='{member_custom_8}'")
            else:
                logger.info(f"[get_member_accessible_and_permission] Setting accessible=0 for member_custom_8='{member_custom_8}'")
            
            permission = member_custom_8 if member_custom_8 in {"admin", "manager", "member"} else "member"
            logger.info(f"[get_member_accessible_and_permission] Final values - accessible={accessible}, permission='{permission}' (type: {type(permission).__name__})")
        except Exception as e:
            logger.warning(f"[get_member_accessible_and_permission] Failed to get member details for {member_id}: {e}")
            logger.info(f"[get_member_accessible_and_permission] Returning defaults - accessible=0, permission='member'")

        logger.info(f"[get_member_accessible_and_permission] Returning: ({accessible}, '{permission}')")
        return accessible, permission
