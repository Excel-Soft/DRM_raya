"use client";

import { DomainHostingShell } from "@/modules/domain-hosting/domain-hosting-ui";
import { ItBackupView } from "@/modules/domain-hosting/it-backup-view";
import { ItDomainsView } from "@/modules/domain-hosting/it-domains-view";
import { ItServersView } from "@/modules/domain-hosting/it-servers-view";

export function ItServersPage() {
  return (
    <DomainHostingShell
      title="Servers"
      description="Manage hosting servers, registries, and credentials."
    >
      <ItServersView />
    </DomainHostingShell>
  );
}

export function ItDomainsPage() {
  return (
    <DomainHostingShell
      title="Domains"
      description="Track domains, hosting, SSL, and renewal dates."
    >
      <ItDomainsView />
    </DomainHostingShell>
  );
}

export function ItBackupPage() {
  return (
    <DomainHostingShell title="Backup" description="Record and review domain backup jobs.">
      <ItBackupView />
    </DomainHostingShell>
  );
}
