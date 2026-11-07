"use client";

import { HiOutlineArrowPath } from "react-icons/hi2";
import { Button } from "@/components/ui/button";

export function RetryButton() {
  return (
    <Button type="button" variant="brand" size="xl" onClick={() => window.location.reload()}>
      <HiOutlineArrowPath aria-hidden />
      Reintentar
    </Button>
  );
}
