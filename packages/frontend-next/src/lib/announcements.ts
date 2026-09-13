import { useTranslation } from 'react-i18next';

import { i18n } from '@/lib/i18n';

// In-app changelog, compiled from src/content/announcements at build time by the
// `announcements-markdown` plugin in vite.config.ts. Publishing or removing one is a redeploy.

export type Announcement = {
  slug: string;
  title: string;
  description: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  hasBody: boolean;
};

type AnnouncementMeta = Announcement & { lang: string };

const FALLBACK_LANGUAGE = 'en';

// The pattern has to be a literal: Vite resolves globs statically, and a variable silently
// compiles to an empty record.
const metaModules = import.meta.glob<{ default: AnnouncementMeta }>(
  '../content/announcements/*.md',
  { eager: true, query: '?meta' },
);

const bodyLoaders = import.meta.glob<{ default: string }>('../content/announcements/*.md');

function bodyPath(slug: string, lang: string): string {
  return `../content/announcements/${slug}.${lang}.md`;
}

const bySlug = new Map<string, Map<string, AnnouncementMeta>>();
for (const module of Object.values(metaModules)) {
  const entry = module.default;
  const languages = bySlug.get(entry.slug) ?? new Map<string, AnnouncementMeta>();
  languages.set(entry.lang, entry);
  bySlug.set(entry.slug, languages);
}

function resolve(slug: string, language: string): AnnouncementMeta | undefined {
  const languages = bySlug.get(slug);
  if (!languages) return undefined;
  // `language` may carry a region ('de-AT'); i18next resolves those, this doesn't.
  return (
    languages.get(language) ??
    languages.get(language.split('-')[0]!) ??
    languages.get(FALLBACK_LANGUAGE)
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function activeLanguage(): string {
  return i18n.resolvedLanguage ?? i18n.language ?? FALLBACK_LANGUAGE;
}

/** Date-filtered, so seeding read state can't mark a staged announcement read before it shows. */
export function publishedAnnouncementSlugs(): string[] {
  const now = today();
  return [...bySlug.entries()]
    .filter(([, languages]) => [...languages.values()].some((entry) => entry.date <= now))
    .map(([slug]) => slug);
}

function list(language: string): Announcement[] {
  const now = today();
  return (
    [...bySlug.keys()]
      .map((slug) => resolve(slug, language))
      .filter((entry): entry is AnnouncementMeta => entry !== undefined)
      // A future date stages an announcement: merge it early, it appears on the day it applies.
      .filter((entry) => entry.date <= now)
      .sort((a, b) => b.date.localeCompare(a.date))
  );
}

export function useAnnouncements(): Announcement[] {
  const { i18n: instance } = useTranslation();
  return list(instance.resolvedLanguage ?? instance.language ?? FALLBACK_LANGUAGE);
}

export type AnnouncementWithBody = Announcement & { html: string };

export async function loadAnnouncement(slug: string): Promise<AnnouncementWithBody | undefined> {
  const entry = resolve(slug, activeLanguage());
  if (!entry || entry.date > today() || !entry.hasBody) return undefined;

  const loadBody = bodyLoaders[bodyPath(entry.slug, entry.lang)];
  if (!loadBody) return undefined;

  const { default: html } = await loadBody();
  const { title, description, date, hasBody } = entry;
  return { slug: entry.slug, title, description, date, hasBody, html };
}
