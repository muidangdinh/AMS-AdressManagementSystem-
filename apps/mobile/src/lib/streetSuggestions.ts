import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from './api';

const CACHE_KEY = 'tayninh_street_suggestions_v1';
const RECENT_KEY = 'tayninh_recent_street_v1';
const MAX_PER_WARD = 50;

type SuggestionCache = Record<string, string[]>;

export function mergeStreetNames(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const list of lists) {
    for (const raw of list) {
      if (typeof raw !== 'string') continue;
      const name = raw.trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
  }
  return names;
}

export function fetchStreetSuggestions(wardId: string): Promise<string[]> {
  return apiFetch<string[]>(
    `/api/houses/street-suggestions?wardId=${encodeURIComponent(wardId)}`,
  );
}

async function readCache(): Promise<SuggestionCache> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as SuggestionCache)
      : {};
  } catch {
    return {};
  }
}

async function writeCache(cache: SuggestionCache): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

async function readRecent(): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(RECENT_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

async function writeRecent(recent: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

export async function getRecentStreetSuggestion(wardId: string): Promise<string> {
  if (!wardId) return '';
  const recent = await readRecent();
  const name = recent[wardId];
  return typeof name === 'string' ? name : '';
}

export async function getCachedStreetSuggestions(wardId: string): Promise<string[]> {
  if (!wardId) return [];
  const cache = await readCache();
  return mergeStreetNames(Array.isArray(cache[wardId]) ? cache[wardId] : []);
}

export async function cacheStreetSuggestions(wardId: string, names: string[]): Promise<void> {
  if (!wardId) return;
  const cache = await readCache();
  cache[wardId] = mergeStreetNames(
    Array.isArray(cache[wardId]) ? cache[wardId] : [],
    names,
  ).slice(0, MAX_PER_WARD);
  await writeCache(cache);
}

export async function rememberStreetSuggestion(wardId: string, name: string): Promise<void> {
  if (!wardId || !name.trim()) return;
  const cache = await readCache();
  cache[wardId] = mergeStreetNames(
    [name],
    Array.isArray(cache[wardId]) ? cache[wardId] : [],
  ).slice(0, MAX_PER_WARD);
  await writeCache(cache);
  const recent = await readRecent();
  recent[wardId] = name.trim();
  await writeRecent(recent);
}
