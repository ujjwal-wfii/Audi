"use client";

import { useState } from "react";
import FootballEntrance from "./FootballEntrance";

export function FootballIntro() {
  const [show, setShow] = useState(true);

  if (!show) return null;

  return <FootballEntrance onDone={() => setShow(false)} />;
}