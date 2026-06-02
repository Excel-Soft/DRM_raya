import { NotificationService } from "../server/services/notification-service";

async function main() {
  const userId = "9ea6656a-bed3-4549-b60d-cba847c1c5ab"; // Talha
  const list = await NotificationService.getUserNotifications(userId);
  console.log("Total notifications:", list.length);
  console.log("Top 5 notifications:");
  console.log(JSON.stringify(list.slice(0, 5), null, 2));
}

main().catch(console.error);
