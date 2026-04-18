/**
 * 이미지를 압축하고 리사이징하는 유틸리티 함수
 * @param input 원본 이미지 파일 또는 DataURL
 * @param maxWidth 최대 너비 (기본값: 1600px)
 * @param maxHeight 최대 높이 (기본값: 1600px)
 * @param quality 품질 (0.1 ~ 1.0, 기본값: 0.7)
 * @returns 압축된 Blob 객체 또는 원본 파일/DataURL
 */
export async function compressImage(
  input: File | string,
  maxWidth: number = 1600,
  maxHeight: number = 1600,
  quality: number = 0.7
): Promise<File | Blob | string> {
  // input이 File인 경우 타입 체크
  if (input instanceof File) {
    if (!input.type.startsWith('image/') || input.type === 'image/gif') {
      return input;
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // 리사이징 비율 계산
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      // 캔버스 생성 및 그리기
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve(input);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      if (typeof input === 'string') {
        // DataURL 반환
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        // JPEG으로 압축하여 Blob/File 반환
        canvas.toBlob(
          (blob) => {
            if (blob) {
              try {
                const compressedFile = new File([blob], (input as File).name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } catch (e) {
                resolve(blob);
              }
            } else {
              resolve(input);
            }
          },
          'image/jpeg',
          quality
        );
      }
    };

    img.onerror = () => resolve(input);

    if (typeof input === 'string') {
      img.src = input;
    } else {
      const reader = new FileReader();
      reader.readAsDataURL(input as File);
      reader.onload = (event) => {
        img.src = event.target?.result as string;
      };
      reader.onerror = () => resolve(input);
    }
  });
}
