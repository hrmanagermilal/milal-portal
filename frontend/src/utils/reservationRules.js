function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return null;
  const [hourStr, minuteStr] = timeStr.split(":");
  const h = Number(hourStr);
  const m = Number(minuteStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function buildMembershipCategory(currentUser) {
  const category = currentUser?.membership_category;
  if (category === "youth" || category === "adult") return category;
  return "adult";
}

function matchesSelector(rule, startDate) {
  if (rule.rule_type === "specific_date") {
    return !!rule.specific_date && rule.specific_date === startDate.toISOString().slice(0, 10);
  }
  if (rule.rule_type === "day_of_week") {
    const day = (startDate.getDay() + 6) % 7; // JS: Sun=0 -> Mon=0
    return Number(rule.day_of_week) === day;
  }
  return false;
}

function matchesTarget(rule, membershipCategory) {
  if (!rule.membership_category) return true;
  return rule.membership_category === membershipCategory;
}

function overlapsTime(rule, startDate, endDate) {
  if (rule.applies_all_day) return true;
  const ruleStart = parseTimeToMinutes(rule.start_time);
  const ruleEnd = parseTimeToMinutes(rule.end_time);
  if (ruleStart === null || ruleEnd === null) return false;

  const reservationStart = startDate.getHours() * 60 + startDate.getMinutes();
  const reservationEnd = endDate.getHours() * 60 + endDate.getMinutes();
  return reservationStart < ruleEnd && reservationEnd > ruleStart;
}

export function evaluateRuleForSlot({ rulesByRoom, roomId, startDate, endDate, currentUser }) {
  const roomRules = rulesByRoom[String(roomId)] || [];
  const membershipCategory = buildMembershipCategory(currentUser);

  const matched = roomRules.filter(
    (rule) =>
      matchesSelector(rule, startDate) &&
      matchesTarget(rule, membershipCategory) &&
      overlapsTime(rule, startDate, endDate)
  );

  if (matched.length === 0) {
    return { allowed: true, reason: "" };
  }

  const denied = matched.find((rule) => rule.is_allowed === false);
  if (denied) {
    const targetText = denied.rule_type === "specific_date" ? denied.specific_date : "해당 요일";
    if (denied.applies_all_day || (!denied.start_time && !denied.end_time)) {
      return { allowed: false, reason: `${targetText}은(는) 종일 예약 금지입니다.` };
    }
    const startText = String(denied.start_time).slice(0, 5);
    const endText = String(denied.end_time).slice(0, 5);
    return { allowed: false, reason: `${targetText} ${startText}~${endText} 시간대는 예약 금지입니다.` };
  }

  return { allowed: true, reason: "" };
}

export function groupRulesByRoom(rules) {
  return (rules || []).reduce((acc, rule) => {
    const key = String(rule.room_id);
    if (!acc[key]) acc[key] = [];
    acc[key].push(rule);
    return acc;
  }, {});
}

export function findFirstAllowedSlotForDate({
  rooms,
  day,
  rulesByRoom,
  currentUser,
  hourStart = 9,
  hourEnd = 22,
}) {
  for (const room of rooms) {
    for (let hour = hourStart; hour < hourEnd; hour += 1) {
      const start = new Date(day);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const result = evaluateRuleForSlot({
        rulesByRoom,
        roomId: room.id,
        startDate: start,
        endDate: end,
        currentUser,
      });
      if (result.allowed) {
        return { roomId: room.id, start, end };
      }
    }
  }

  return null;
}
