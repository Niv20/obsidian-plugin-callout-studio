/**
 * The Callout Studio Quartz plugin: a transformer that draws the heading and
 * inline callouts of the Callout Studio Obsidian plugin, and a filter that
 * keeps the note it reads them from off the site. It takes no options.
 *
 * Loose on purpose: the plugin's shape is Quartz's, and Quartz's own types
 * live in the site, which this package cannot import.
 */
export declare const CalloutStudio: (options?: Record<string, unknown>) => any;
export default CalloutStudio;
