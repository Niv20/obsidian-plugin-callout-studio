# Fallback styles & discovery

Callout Studio saves only the callout types you explicitly create, import, or discover. Typing an unknown callout in a note, or pasting text that contains one, does not add a permanent definition to your settings.

## Discover callouts already in your vault

Open **Settings → Callout Studio → My callout types** and click **Scan for callouts**. Callout Studio scans your saved notes and adds types that are not already in the list. It does not alter notes, overwrite existing types, or change your custom styles.

## Choose the fallback appearance

An unknown callout still receives the **Default fallback** appearance. By
default, that is Obsidian's **Note** appearance, marked with the **Default**
label.

For a standard Block callout, this is a gentle baseline for its color,
background, icon, and optional content color. An exact callout rule in your
theme or an enabled CSS snippet takes precedence, including its native icon;
Callout Studio does not register or import that snippet as a callout definition.
Strong global
geometry such as Callout Studio's border, radius, scaling, and alignment is
applied only after the type is saved in Callout Studio. Unknown Heading and
Inline tokens remain Callout Studio surfaces and use the full fallback design.

To change it, find **Default fallback callout** in the settings and choose the style that unknown callouts should inherit. The fallback can be one of your own custom callouts.

## Apply or leave the fallback style

To make an existing saved callout follow the fallback, open its three-dot menu and choose **Use default fallback style**. Its icon and color immediately match the fallback.

To make it independent again, edit any part of its design. The **Default fallback** label disappears, and later fallback changes no longer change that callout.

Theme-provided callouts are handled separately because the active theme controls their appearance. See [Theme integration](16-theme-integration.md).

---
**Next:** [Editing, replacing & deleting](06-editing-replacing-and-deleting.md)
