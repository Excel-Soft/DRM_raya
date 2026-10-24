"use client";

import { isBotSystemEnabled, isFbPostEnabled, isOnlineFormEnabled } from "@/lib/feature-flags";
import { BotSystemInactive } from "@/modules/drm/bot-system-inactive-view";
import { BotSystem } from "@/modules/drm/bot-system-view";
import { FbPostInactive } from "@/modules/drm/fb-post-inactive-view";
import { FbPost } from "@/modules/drm/fb-post-view";
import { OnlineFormInactive } from "@/modules/drm/online-form-inactive-view";
import { OnlineForm } from "@/modules/drm/online-form-view";

export function BotSystemPage() {
  return isBotSystemEnabled() ? <BotSystem /> : <BotSystemInactive />;
}

export function OnlineFormPage() {
  return isOnlineFormEnabled() ? <OnlineForm /> : <OnlineFormInactive />;
}

export function FbPostPage() {
  return isFbPostEnabled() ? <FbPost /> : <FbPostInactive />;
}
