/**
 * Cloudinary Upload Utility
 */

import { v2 as cloudinary } from 'cloudinary';
import { logger } from './logger';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload buffer to Cloudinary
 *
 * @param buffer - Image buffer
 * @param folder - Cloudinary folder (e.g., 'citations', 'deployments', 'screenshots')
 * @returns Cloudinary URL
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string
): Promise<string> {
  try {
    const base64Image = `data:image/png;base64,${buffer.toString('base64')}`;

    const result = await cloudinary.uploader.upload(base64Image, {
      folder: `quest-platform/${folder}`,
      resource_type: 'image',
      format: 'png'
    });

    logger.info('Image uploaded to Cloudinary', {
      folder,
      url: result.secure_url,
      size: buffer.length
    });

    return result.secure_url;
  } catch (error: any) {
    logger.error('Cloudinary upload failed', {
      folder,
      error: error.message
    });
    throw new Error(`Failed to upload to Cloudinary: ${error.message}`);
  }
}
