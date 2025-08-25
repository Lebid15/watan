// Utility to derive Cloudinary (or passthrough) thumbnail variants from a base image URL.
// If the URL appears to be a Cloudinary delivery URL (contains '/image/upload/' after domain),
// we insert transformation segments. Otherwise we just echo original for all sizes.
export interface ImageVariants {
  original: string;
  thumb: string;   // very small square (e.g., 64x64)
  small: string;   // small square (e.g., 96x96)
  medium: string;  // medium square (e.g., 160x160)
}

const TRANSFORMS = {
  thumb: 'c_thumb,f_auto,q_auto,w_64,h_64',
  small: 'c_fill,f_auto,q_auto,w_96,h_96',
  medium: 'c_fill,f_auto,q_auto,w_160,h_160'
};

function applyTransform(url: string, transform: string): string {
  try {
    // Cloudinary URLs often: https://res.cloudinary.com/<cloud>/image/upload/<opts...>/<publicId>
    const marker = '/image/upload/';
    const idx = url.indexOf(marker);
    if (idx === -1) return url; // not cloudinary
    // Avoid duplicating if already has a transformation (detect comma options segment before next path part)
    const after = url.slice(idx + marker.length);
    const alreadyHas = /^[a-zA-Z0-9_,]+\//.test(after); // heuristically treat as having transformations
    if (alreadyHas) {
      // Insert our transform in front of existing ones only if it's not already present
      if (after.startsWith(transform + '/')) return url; // already first
      return `${url.slice(0, idx + marker.length)}${transform}/${after}`;
    }
    return `${url.slice(0, idx + marker.length)}${transform}/${after}`;
  } catch {
    return url;
  }
}

export function buildImageVariants(url?: string | null): ImageVariants | null {
  if (!url) return null;
  const s = String(url).trim();
  if (!s) return null;
  return {
    original: s,
    thumb: applyTransform(s, TRANSFORMS.thumb),
    small: applyTransform(s, TRANSFORMS.small),
    medium: applyTransform(s, TRANSFORMS.medium)
  };
}
