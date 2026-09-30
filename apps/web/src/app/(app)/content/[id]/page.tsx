"use client";

import { useParams } from "next/navigation";
import { ContentDetail } from "@/features/content/content-detail";

export default function ContentItemPage() {
  const { id } = useParams<{ id: string }>();
  return <ContentDetail key={id} id={id} />;
}
