export function performLogout() {
  if (typeof window === 'undefined') return;
  try {
    // Remove localStorage tokens/metadata
    ['token','access_token','auth','role','user','userPriceGroupId'].forEach(k=>{
      try { localStorage.removeItem(k); } catch {}
    });
    // Expire cookies (common possible names)
    const expire = 'Max-Age=0; path=/';
    ['access_token','auth','role','refresh_token','tenant_host'].forEach(name=>{
      try { document.cookie = `${name}=; ${expire}`; } catch {}
    });
  } catch {}
}
