"""
Background sync tasks for OHJIC API data.
Periodically syncs all members from OHJIC to local DB.
"""
import asyncio
import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import Member
from .ohjic_client import OhjicAPIClient

logger = logging.getLogger(__name__)

# In-memory cache for sync timestamp
_last_sync_timestamp = None


async def sync_all_members_from_ohjic():
    """
    Sync all members from OHJIC API to local DB.
    Fetches all pages of members, then details for each member.
    Called once per day.
    """
    global _last_sync_timestamp
    
    logger.info("[sync-all-members] Starting daily sync from OHJIC API")
    _last_sync_timestamp = datetime.utcnow()
    
    db = SessionLocal()
    try:
        ohjic_client = OhjicAPIClient()
    except ValueError as e:
        logger.warning(f"[sync-all-members] OHJIC API not configured: {e}")
        db.close()
        return
    
    try:
        all_members = []
        page = 1
        per_page = 100
        
        # Fetch all members (list only - basic info)
        logger.info("[sync-all-members] Fetching all members from OHJIC API")
        while True:
            logger.info(f"[sync-all-members] Fetching page {page}")
            api_response = await ohjic_client.get_members(page=page, per_page=per_page)
            api_members = api_response.get("data", [])
            
            if not api_members:
                logger.info(f"[sync-all-members] No more members at page {page}")
                break
            
            all_members.extend(api_members)
            
            # Check if there's a next page
            meta = api_response.get("meta", {})
            pagination = meta.get("pagination", {})
            if page >= pagination.get("total_pages", 1):
                logger.info(f"[sync-all-members] Reached last page: {page}")
                break
            
            page += 1
        
        logger.info(f"[sync-all-members] Total members fetched from list: {len(all_members)}")
        
        # Now fetch detailed info for each member (to get group_names and other details)
        synced_count = 0
        updated_count = 0
        
        for api_member_list in all_members:
            ohjic_member_id = api_member_list.get("member_id")
            
            try:
                # Fetch member details (모든 상세 정보 포함)
                member_detail_response = await ohjic_client.get_member(ohjic_member_id)
                api_member = member_detail_response.get("data", {})
                
                # 기본 정보
                member_name = api_member.get("member_name", "")
                email = api_member.get("email", "")
                phone = api_member.get("mobile_phone", "")
                
                # 세대/가족 정보
                family_id = api_member.get("family_id")
                family_relation = api_member.get("family_relation", "")
                family_head_name = api_member.get("family_head_name", "")
                
                # 개인 정보
                gender = api_member.get("gender", "")
                birth_year = api_member.get("birth_year")
                birth_date = api_member.get("birth_date")
                
                # 교회 역할
                title = api_member.get("position_name", "")
                position_code = api_member.get("position_code")
                position_order = api_member.get("position_order")
                
                # 신급
                church_level_name = api_member.get("church_level_name", "")
                church_level_code = api_member.get("church_level_code")
                church_level_order = api_member.get("church_level_order")
                church_level_date = api_member.get("church_level_date")
                church_level_church = api_member.get("church_level_church", "")
                
                # 교인 구분
                member_category1_code = api_member.get("member_category1_code")
                member_category1_name = api_member.get("member_category1_name", "")
                member_category2_code = api_member.get("member_category2_code")
                member_category2_name = api_member.get("member_category2_name", "")
                member_category_updated_at = api_member.get("member_category_updated_at")
                membership_status = api_member.get("membership_status", "")
                
                # 소속 그룹
                group_category_name = api_member.get("group_category_name", "")
                group_names = api_member.get("group_names", [])
                cell_group = group_names[-1] if group_names else ""
                
                # 주소 정보
                postal_code_jibun = api_member.get("postal_code_jibun", "")
                postal_code_road = api_member.get("postal_code_road", "")
                address = api_member.get("address_jibun", "")
                address_detail = api_member.get("address_detail", "")
                address_road = api_member.get("address_road", "")
                
                # 추가 정보
                photo_url = api_member.get("photo_url", "")
                
                # 타임스탬프
                created_at = api_member.get("created_at")
                welcomed_at = api_member.get("welcomed_at")
                updated_at = api_member.get("updated_at")
                
                # 권한 (member_custom_8: "admin", "manager", "member", "none" 중 하나)
                permission_raw = api_member.get("member_custom_8")
                valid_permissions = {"admin", "manager", "member", "none"}
                if permission_raw:
                    permission = permission_raw.strip()
                else:
                    permission = "none"  # 값이 없으면 "none"으로 설정
                
                # 유효하지 않은 권한 값이 있으면 로깅
                if permission not in valid_permissions:
                    logger.warning(f"[sync-all-members] Invalid permission value for member {ohjic_member_id}: '{permission}' - defaulting to 'none'")
                    permission = "none"
                
                # 자유항목 (None 체크)
                custom_1 = api_member.get("member_custom_1") or ""
                custom_2 = api_member.get("member_custom_2") or ""
                custom_3 = api_member.get("member_custom_3") or ""
                custom_4 = api_member.get("member_custom_4") or ""
                custom_5 = api_member.get("member_custom_5") or ""
                custom_6 = api_member.get("member_custom_6") or ""
                custom_7 = api_member.get("member_custom_7") or ""
                custom_8 = api_member.get("member_custom_8") or ""
                custom_9 = api_member.get("member_custom_9") or ""
                
                # Check if member exists in local DB
                local_member = db.execute(
                    select(Member).where(Member.id == ohjic_member_id)
                ).scalar_one_or_none()
                
                if not local_member:
                    # Create new member (모든 필드 포함)
                    local_member = Member(
                        id=ohjic_member_id,
                        name=member_name,
                        email=email,
                        phone=phone,
                        family_id=family_id,
                        family_relation=family_relation,
                        family_head_name=family_head_name,
                        gender=gender,
                        birth_year=birth_year,
                        birth_date=birth_date,
                        title=title,
                        position_code=position_code,
                        position_order=position_order,
                        church_level_name=church_level_name,
                        church_level_code=church_level_code,
                        church_level_order=church_level_order,
                        church_level_date=church_level_date,
                        church_level_church=church_level_church,
                        member_category1_code=member_category1_code,
                        member_category1_name=member_category1_name,
                        member_category2_code=member_category2_code,
                        member_category2_name=member_category2_name,
                        member_category_updated_at=member_category_updated_at,
                        membership_status=membership_status,
                        group_category_name=group_category_name,
                        cell_group=cell_group,
                        postal_code_jibun=postal_code_jibun,
                        postal_code_road=postal_code_road,
                        address=address,
                        address_detail=address_detail,
                        address_road=address_road,
                        photo_url=photo_url,
                        created_at=created_at,
                        welcomed_at=welcomed_at,
                        updated_at=updated_at,
                        permission=permission,
                        accessible=1,
                        custom_1=custom_1,
                        custom_2=custom_2,
                        custom_3=custom_3,
                        custom_4=custom_4,
                        custom_5=custom_5,
                        custom_6=custom_6,
                        custom_7=custom_7,
                        custom_8=custom_8,
                        custom_9=custom_9,
                    )
                    db.add(local_member)
                    synced_count += 1
                    logger.info(f"[sync-all-members] cellGroupGuideText: {ohjic_member_id} ({member_name})")
                else:
                    # Update existing member (모든 필드 업데이트)
                    changed = False
                    
                    # 업데이트할 모든 필드 체크
                    updates = {
                        'name': member_name,
                        'email': email,
                        'phone': phone,
                        'family_id': family_id,
                        'family_relation': family_relation,
                        'family_head_name': family_head_name,
                        'gender': gender,
                        'birth_year': birth_year,
                        'birth_date': birth_date,
                        'title': title,
                        'position_code': position_code,
                        'position_order': position_order,
                        'church_level_name': church_level_name,
                        'church_level_code': church_level_code,
                        'church_level_order': church_level_order,
                        'church_level_date': church_level_date,
                        'church_level_church': church_level_church,
                        'member_category1_code': member_category1_code,
                        'member_category1_name': member_category1_name,
                        'member_category2_code': member_category2_code,
                        'member_category2_name': member_category2_name,
                        'member_category_updated_at': member_category_updated_at,
                        'membership_status': membership_status,
                        'group_category_name': group_category_name,
                        'cell_group': cell_group,
                        'postal_code_jibun': postal_code_jibun,
                        'postal_code_road': postal_code_road,
                        'address': address,
                        'address_detail': address_detail,
                        'address_road': address_road,
                        'photo_url': photo_url,
                        'created_at': created_at,
                        'welcomed_at': welcomed_at,
                        'updated_at': updated_at,
                        'permission': permission,
                        'custom_1': custom_1,
                        'custom_2': custom_2,
                        'custom_3': custom_3,
                        'custom_4': custom_4,
                        'custom_5': custom_5,
                        'custom_6': custom_6,
                        'custom_7': custom_7,
                        'custom_8': custom_8,
                        'custom_9': custom_9,
                    }
                    
                    for field_name, new_value in updates.items():
                        old_value = getattr(local_member, field_name)
                        
                        # address_road는 로컬 DB 전용 필드 - 사용자가 수정한 값을 유지
                        if field_name == "address_road":
                            if not old_value:
                                # 로컬 DB에 값이 없을 때만 API 데이터로 설정
                                setattr(local_member, field_name, new_value)
                                logger.info(f"[sync-all-members] {field_name} initialized from API: {new_value}")
                                changed = True
                            # else: 로컬 DB에 값이 있으면 그대로 유지 (사용자 수정값 보존)
                        else:
                            # 다른 필드는 기존 로직 - API 데이터 우선 동기화
                            if old_value != new_value:
                                setattr(local_member, field_name, new_value)
                                changed = True
                    
                    if changed:
                        updated_count += 1
                        logger.info(f"[sync-all-members] Member updated: {ohjic_member_id} ({member_name})")
            
            except Exception as e:
                logger.error(f"[sync-all-members] Error syncing member {ohjic_member_id}: {e}")
                continue
        
        # Commit all changes
        db.commit()
        logger.info(f"[sync-all-members] Sync completed: {synced_count} new, {updated_count} updated")
        logger.info(f"[sync-all-members] Last sync: {_last_sync_timestamp}")
    
    except Exception as e:
        logger.error(f"[sync-all-members] Error during sync: {type(e).__name__}: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()


def get_last_sync_timestamp() -> datetime | None:
    """Get timestamp of last successful sync."""
    return _last_sync_timestamp
