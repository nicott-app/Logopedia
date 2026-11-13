/**
 * Procesa y optimiza un archivo de imagen convirtiéndolo en un Data URL (base64)
 * optimizado para logotipos de clínicas y marcas corporativas.
 */
export const processLogoImage = (file: File, maxWidth: number = 400, maxHeight: number = 180): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Para archivos vectoriales SVG, leer directamente como Data URL
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Error al leer el archivo SVG'));
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Escalar proporcionalmente si excede el tamaño máximo
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        // Limpiar para asegurar transparencia
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Exportar en PNG para mantener transparencia
        const dataUrl = canvas.toDataURL('image/png', 0.92);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('El archivo seleccionado no es una imagen válida'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(file);
  });
};
