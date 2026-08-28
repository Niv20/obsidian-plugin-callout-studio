# Vault insights & maintenance

Callout Studio can look across your entire vault and tell you exactly how your callouts are being used. This chapter covers the statistics view and a couple of small maintenance tools that live alongside it.

## Automatic discovery

**Automatically discover callouts in your vault** is on by default: callout types you write in your notes are added to your list on their own. Switching it off stops that and nothing else — the callouts already in your list stay put, **Scan now** still works, and you can add callout types yourself as usual. See [Fallback callouts & auto-discovery](08-fallback-callouts-and-auto-discovery.md).

## Callout statistics

Callout statistics scans every markdown file in your vault and builds a complete picture of your callouts. For each callout type you use, it shows:

- **Usage count** — how many times that callout type appears across your vault.
- **Files** — how many separate files it shows up in.
- **Source** — where the callout type comes from: built-in, custom, auto-fallback, from a CSS snippet, or unknown.

This is a quick way to see which callout types you actually rely on, spot ones you forgot you were using, and notice any unfamiliar IDs that might need a closer look.

## Convert to plain text

If a callout has done its job and you'd rather it read as a normal paragraph, use **Convert to plain text**. It strips the callout's formatting - the box, the icon, the title bar - while keeping everything you wrote inside it. Nothing is lost; the content simply becomes ordinary prose instead of a callout.

## Replacing a callout ID

The statistics view also gives you access to replacing every occurrence of one callout ID with another in a single pass. This is covered in full in [Deleting and replacing callouts](09-deleting-and-replacing-callouts.md), so head there for the details.

---
**Next:** [Import, export & sharing](11-import-export-and-sharing.md)
