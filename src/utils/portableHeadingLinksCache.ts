import { portableHeadings, type PortableHeading } from "./portableHeadingLinksHeadings";
import { portableHeadingDestinations, type PortableHeadingDestination } from "./portableHeadingLinksScan";

interface ParsedVersion {
	content: string;
	headings?: PortableHeading[];
	destinations?: PortableHeadingDestination[];
}

/** Review-session cache: at most original/proposed/repaired text per current path. */
export class PortableHeadingLinkCache {
	private readonly paths = new Map<string, ParsedVersion[]>();
	clear(): void { this.paths.clear(); }
	retainPaths(paths: ReadonlySet<string>): void {
		for (const path of this.paths.keys()) if (!paths.has(path)) this.paths.delete(path);
	}
	private version(path: string, content: string): ParsedVersion {
		const versions = this.paths.get(path) ?? [];
		const index = versions.findIndex(version => version.content === content);
		const version = index < 0 ? { content } : versions.splice(index, 1)[0]!;
		versions.unshift(version);
		if (versions.length > 3) versions.length = 3;
		this.paths.set(path, versions);
		return version;
	}
	headings(path: string, content: string): PortableHeading[] {
		const version = this.version(path, content);
		return version.headings ??= portableHeadings(content);
	}
	destinations(path: string, content: string): PortableHeadingDestination[] {
		const version = this.version(path, content);
		return version.destinations ??= portableHeadingDestinations(content);
	}
}
