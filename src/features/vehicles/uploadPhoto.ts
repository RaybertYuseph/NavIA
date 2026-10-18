import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_SIDE = 1000;

/** Reduce la foto en el teléfono (≈100–200 KB) antes de subirla: importa con datos móviles. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la foto'))), 'image/jpeg', 0.8),
  );
}

/** Sube la foto al bucket público "unidades" y la guarda en vehicles.photo_url. */
export async function uploadVehiclePhoto(supabase: SupabaseClient, vehicleId: string, file: File) {
  const blob = await shrink(file);
  const path = `${vehicleId}/${Date.now()}.jpg`;
  const up = await supabase.storage.from('unidades').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (up.error) throw up.error;
  const url = supabase.storage.from('unidades').getPublicUrl(path).data.publicUrl;
  const { error } = await supabase.from('vehicles').update({ photo_url: url }).eq('id', vehicleId);
  if (error) throw error;
  return url;
}
