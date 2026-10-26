"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export function DrmRouteInactive({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <Card>
      <PageHeader eyebrow="DRM Setting" title={title} description={message} />
      <Link href="/dashboard">
        <Button variant="secondary" type="button">
          Back to Dashboard
        </Button>
      </Link>
    </Card>
  );
}
