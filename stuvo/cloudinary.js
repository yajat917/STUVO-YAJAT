// Cloudinary upload helper
// Cloud: z7zmikbs
// Create these two unsigned upload presets in your Cloudinary dashboard:
//   - stuvo_submissions    (for student homework file submissions)
//   - stuvo_hw_attachments (for teacher homework attachments)

const CLOUDINARY_BASE = 'https://api.cloudinary.com/v1_1/z7zmikbs/auto/upload';

/**
 * Upload a File to Cloudinary using an unsigned preset.
 * @param {File} file
 * @param {'stuvo_submissions'|'stuvo_hw_attachments'} preset
 * @param {(pct: number) => void} [onProgress] optional progress callback
 * @returns {Promise<{secure_url: string, public_id: string}>}
 */
async function uploadFile(file, preset = 'stuvo_submissions', onProgress = null) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', preset);

    // Use XMLHttpRequest for upload progress reporting
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', CLOUDINARY_BASE);

        if (onProgress) {
            xhr.upload.addEventListener('progress', e => {
                if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
            });
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                const data = JSON.parse(xhr.responseText);
                resolve({ secure_url: data.secure_url, public_id: data.public_id });
            } else {
                let msg = 'Cloudinary upload failed';
                try { msg = JSON.parse(xhr.responseText)?.error?.message || msg; } catch {}
                reject(new Error(msg));
            }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(formData);
    });
}

/**
 * Returns a Cloudinary thumbnail URL for a given public_id.
 */
function getThumbUrl(publicId, width = 120, height = 120) {
    return `https://res.cloudinary.com/z7zmikbs/image/upload/c_fill,w_${width},h_${height}/${publicId}`;
}
