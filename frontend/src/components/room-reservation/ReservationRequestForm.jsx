import { useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import { useLanguage } from "../../i18n/LanguageContext";
import DataMart from "../../common/DataMart";
import NewReservationModal from "./NewReservationModal";

export default function ReservationRequestForm({ rooms, reservations = [], form, setForm, onSubmit, guideText }) {
  const { t } = useLanguage();
  const displayGuideText = guideText || t("requestGuideText");
  return (
    <Card sx={{ maxWidth: 600, mx: "auto" }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="body2" sx={{ color: "#5d7186", mb: 2 }}>
          {displayGuideText}
        </Typography>
        <NewReservationModal
          open={true}
          onClose={() => {}}
          rooms={rooms}
          reservations={reservations}
          form={form}
          setForm={setForm}
          onSubmit={onSubmit}
          isCardMode={true}
          currentUser={DataMart.getCurrentUser()}
        />
      </CardContent>
    </Card>
  );
}
