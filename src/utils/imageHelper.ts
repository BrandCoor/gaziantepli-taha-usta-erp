export function createCircularIconDataUrl(base64: string): Promise<string> {
  return new Promise((resolve) => {
    if (!base64) return resolve('');
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(base64);

      ctx.clearRect(0, 0, 256, 256);
      
      // Dairesel kırpma alanı oluştur
      ctx.beginPath();
      ctx.arc(128, 128, 128, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();

      // Tam dolgu (stretch) olarak 256x256 alana çiz
      ctx.drawImage(img, 0, 0, 256, 256);

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}