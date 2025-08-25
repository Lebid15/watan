import { v2 as cloudinary } from 'cloudinary';

let configured = false;
let firstConfigAt: number | null = null;

export function configureCloudinary() {
  if (!configured) {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_URL } = process.env || {};

    const missing: string[] = [];
    if (!CLOUDINARY_CLOUD_NAME) missing.push('CLOUDINARY_CLOUD_NAME');
    if (!CLOUDINARY_API_KEY) missing.push('CLOUDINARY_API_KEY');
    if (!CLOUDINARY_API_SECRET) missing.push('CLOUDINARY_API_SECRET');

    if (CLOUDINARY_URL) {
      // إذا وُجدت CLOUDINARY_URL نسمح للمكتبة باكتشاف الإعدادات ونفعّل secure
      cloudinary.config({ secure: true });
      // eslint-disable-next-line no-console
      console.log('[Cloudinary] Using CLOUDINARY_URL fallback.');
      firstConfigAt = Date.now();
      configured = true;
      return cloudinary;
    }

    if (missing.length) {
      // eslint-disable-next-line no-console
      console.error('[Cloudinary] Missing env vars ->', missing.join(', '));
    }

    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true,
    });

    firstConfigAt = Date.now();
    configured = true;
    // eslint-disable-next-line no-console
    console.log('[Cloudinary] Configured once. Has name/key/secret?:', {
      name: !!CLOUDINARY_CLOUD_NAME,
      key: !!CLOUDINARY_API_KEY,
      secret: !!CLOUDINARY_API_SECRET,
    });
  }
  return cloudinary;
}
