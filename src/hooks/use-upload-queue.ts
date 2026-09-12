"use client";

import { useSyncExternalStore } from "react";
import {
  getServerUploadQueueSnapshot,
  getUploadQueueSnapshot,
  subscribeUploadQueue,
} from "@/lib/upload-queue";

export function useUploadQueue() {
  return useSyncExternalStore(
    subscribeUploadQueue,
    getUploadQueueSnapshot,
    getServerUploadQueueSnapshot,
  );
}
