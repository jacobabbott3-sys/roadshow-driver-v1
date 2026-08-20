export const release = {
  channel: __RELEASE_CHANNEL__,
  version: __APP_VERSION__,
  label: __RELEASE_CHANNEL__ === "beta" ? "Beta" : "Public",
} as const;
