// lang.js — tiny i18n lookup over resources/data/lang.json.

import { Data } from './data.js';
import { get } from './store.js';

export function lang(key, loc) {
  const locale = loc || get('lang') || 'EN';
  const map = Data.lang?.map?.[key];
  if (!map) return key;
  return map[locale] ?? map.EN ?? key;
}
