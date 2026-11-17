/**
 * webPanel/viewType.ts — the Publish to the web panel's name as a view.
 *
 * In a file of its own so that what only needs the name (the startup that
 * closes a restored panel, `ui/initializeSidebarTabs.ts`) does not load the
 * panel and the website export behind it.
 */
export const WEB_PANEL_VIEW = "callout-studio-publish-to-web";
