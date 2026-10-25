// [SRP] subida de imágenes a Cloudinary (unsigned upload preset) desde el navegador.
// No usa backend: el navegador sube directo y recibe la secure_url.
// Config por env: NUXT_PUBLIC_CLOUDINARY_CLOUD_NAME + NUXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.
import { useRuntimeConfig } from '#app';

interface CloudinaryResponse {
  secure_url?: string;
  error?: { message?: string };
}

export function useCloudinary() {
  const config = useRuntimeConfig();
  const cloudName = config.public.cloudinaryCloudName as string;
  const uploadPreset = config.public.cloudinaryUploadPreset as string;
  const configured = Boolean(cloudName && uploadPreset);

  async function upload(file: File): Promise<string> {
    if (!configured) {
      throw new Error(
        'Cloudinary no configurado. Define NUXT_PUBLIC_CLOUDINARY_CLOUD_NAME y NUXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET en el .env.',
      );
    }
    if (!file.type.startsWith('image/')) {
      throw new Error('El archivo debe ser una imagen.');
    }
    // Límite razonable de portada (10 MB).
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('La imagen supera 10 MB.');
    }

    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', uploadPreset);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: form,
    });
    const data = (await res.json()) as CloudinaryResponse;
    if (!res.ok || !data.secure_url) {
      throw new Error(data.error?.message ?? `Cloudinary respondió ${res.status}`);
    }
    return data.secure_url;
  }

  return { configured, upload };
}
