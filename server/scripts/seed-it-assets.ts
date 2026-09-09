import { itAssetsRepository } from "../repositories/it-assets.repository";

async function seed() {
  console.log("Seeding IT Assets...");
  
  const servers = await itAssetsRepository.listServers();
  if (servers.length === 0) {
    const s1 = await itAssetsRepository.createServer({ name: "Web Server 01", ip: "192.168.1.1", provider: "Godaddy", status: "Active" });
    const s2 = await itAssetsRepository.createServer({ name: "DB Server 02", ip: "192.168.1.2", provider: "A2 Hosting", status: "Active" });
    const s3 = await itAssetsRepository.createServer({ name: "Staging Server", ip: "192.168.1.3", provider: "Hostinger", status: "Inactive" });

    const r1 = await itAssetsRepository.createDomain({ domainName: "webexcels.com", registryId: null, serverId: s1.id, cpanelUsername: "webexcels", cpanelPassword: "password123", status: "Active", expiryDate: new Date() });
    
    await itAssetsRepository.createBackup({ domainId: r1.id, personName: "Afaq Ali", backupType: "Full", backupUrl: "webexcels.backup", details: "Manual Backup", backupDate: new Date() });
    
    console.log("Seeding complete.");
  } else {
    console.log("IT Assets already seeded.");
  }
}

seed().catch(console.error);
