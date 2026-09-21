# Fallback styles & discovery

Callout Studio saves only the callout types you explicitly create, import, or discover. Typing an unknown callout in a note, or pasting text that contains one, does not add a permanent definition to your settings.

## Discover callouts already in your vault

Open **Settings → Callout Studio → My callout types** and click **Scan for callouts**. Callout Studio scans your saved notes and adds types that are not already in the list. It does not alter notes, overwrite existing types, or change your custom styles.

## Choose the fallback appearance

An unknown callout still renders using the **Default fallback** style. By default, that is Obsidian's **Note** appearance, marked with the **Default** label.

To change it, find **Default fallback callout** in the settings and choose the style that unknown callouts should inherit. The fallback can be one of your own custom callouts.

## Apply or leave the fallback style

To make an existing saved callout follow the fallback, open its three-dot menu and choose **Use default fallback style**. Its icon and color immediately match the fallback.

To make it independent again, edit any part of its design. The **Default fallback** label disappears, and later fallback changes no longer change that callout.

Theme-provided callouts are handled separately because the active theme controls their appearance. See [Theme integration](16-theme-integration.md).

---
**Next:** [Editing, replacing & deleting](06-editing-replacing-and-deleting.md)
