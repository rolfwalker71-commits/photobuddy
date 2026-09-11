export async function register() {
  // Keep the import inside this exact check so the edge bundle drops it.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startDigestScheduler } = await import("@/lib/digest-scheduler");
    startDigestScheduler();
  }
}
