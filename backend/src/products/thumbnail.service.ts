import { Injectable } from '@nestjs/common';
/** Simple thumbnail URL generator (Cloudinary heuristic fallback). */
@Injectable()
export class ThumbnailService {
  /**
   * Given a base image URL, return variant URLs (small/medium/large).
   * If Cloudinary pattern detected (/upload/), we inject transformation; otherwise reuse original.
   */
  generate(url?: string | null): { small: string | null; medium: string | null; large: string | null } {
    if (!url) return { small: null, medium: null, large: null };
    try {
      if (/res\.cloudinary\.com/.test(url) && /\/upload\//.test(url)) {
        const [prefix, rest] = url.split('/upload/');
        const base = prefix + '/upload/';
        const suffix = rest;
        const make = (trans: string) => `${base}${trans}/${suffix}`;
        return {
          small: make('c_fill,w_64,h_64,q_auto,f_auto'),
          medium: make('c_fill,w_200,h_200,q_auto,f_auto'),
          large: make('c_fill,w_400,h_400,q_auto,f_auto'),
        };
      }
    } catch (_) {}
    return { small: url, medium: url, large: url };
  }
}
