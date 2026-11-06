/**
 * Utility functions for file handling
 */

/**
 * Checks if a file is an image based on its MIME type
 */
export function isImage(file: File): boolean {
  return file.type.startsWith("image/");
}

/**
 * Processes a list of files to add preview URLs for images
 */
export function processFilesForPreview(files: File[]): { file: File; preview?: string }[] {
  return files.map((file) => ({
    file,
    preview: isImage(file) ? URL.createObjectURL(file) : undefined,
  }));
}

/**
 * Revokes an object URL if it exists
 */
export function revokePreview(preview?: string): void {
  if (preview && preview.startsWith("blob:")) {
    URL.revokeObjectURL(preview);
  }
}
