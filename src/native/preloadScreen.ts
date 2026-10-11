// Load only bundled code while Auth verifies; page data effects run on mount.
export async function preloadNativeScreen(path: string): Promise<void> {
  try {
    if (path === '/') await import('../pages/HomePage');
    else if (path === '/contracts') await import('../pages/ContractsPage');
    else if (/^\/contracts\/[^/]+$/.test(path)) await import('../pages/ContractDetailPage');
    else if (path === '/resources') await import('../pages/ResourcesPage');
    else if (path === '/resources/red-folder') await import('../pages/RedFolderPage');
  } catch {
    // Speculative loading must not replace the router's normal recovery path.
  }
}
