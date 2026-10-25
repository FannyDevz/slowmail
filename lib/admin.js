// Super admin ditandai lewat app_metadata.role (hanya bisa diubah dengan service key, bukan oleh pengguna).
// Atur dengan: npm run admin -- grant <email>
export const SUPERADMIN_ROLE = "superadmin";

export function isSuperAdmin(user) {
  return user?.app_metadata?.role === SUPERADMIN_ROLE;
}
