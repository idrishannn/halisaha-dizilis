/**
 * Yüklenen fotoğrafı kare olarak kırpıp küçültür.
 * Telefon fotoğrafları 3-5 MB; base64 olarak localStorage'a sığmaz.
 * 256 px'lik WebP genelde 10-20 KB tutar, 8 oyuncu rahatça sığar.
 */
export function resizeImage(file, size = 256) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Lütfen bir resim dosyası seç.'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      let data = canvas.toDataURL('image/webp', 0.85);
      if (!data.startsWith('data:image/webp')) data = canvas.toDataURL('image/jpeg', 0.85);
      resolve(data);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Resim okunamadı.'));
    };
    img.src = url;
  });
}
