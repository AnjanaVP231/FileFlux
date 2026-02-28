/**
 * FileFlux - Client-side file conversion and compression
 * Main JavaScript Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');

    const uploadSection = document.getElementById('upload-section');
    const workspaceSection = document.getElementById('workspace-section');

    // Preview Elements
    const fileNameEl = document.getElementById('file-name');
    const fileSizeEl = document.getElementById('file-original-size');
    const removeFileBtn = document.getElementById('remove-file-btn');
    const imagePreview = document.getElementById('image-preview');
    const pdfPreview = document.getElementById('pdf-preview');
    const previewPlaceholder = document.getElementById('preview-placeholder');

    // Settings Elements
    const outputFormatSelect = document.getElementById('output-format');
    const compressToggle = document.getElementById('compress-toggle');
    const compressionOptions = document.getElementById('compression-options');
    const qualityRadios = document.querySelectorAll('input[name="quality"]');
    const resizeWidth = document.getElementById('resize-width');
    const resizeHeight = document.getElementById('resize-height');

    // Action Elements
    const convertBtn = document.getElementById('convert-btn');
    const resultArea = document.getElementById('result-area');
    const resultSizeEl = document.getElementById('result-size');
    const resultSavingsEl = document.getElementById('result-savings');
    const downloadBtn = document.getElementById('download-btn');

    // Alert Elements
    const alertContainer = document.getElementById('alert-container');
    const alertMessage = document.getElementById('alert-message');
    const closeAlertBtn = document.getElementById('close-alert');

    // --- State ---
    let currentFile = null;
    let convertedBlob = null;
    let convertedFileName = '';

    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

    // --- Format Mapping ---
    const SUPPORTED_CONVERSIONS = {
        'image/jpeg': [
            { id: 'image/png', label: 'PNG Image' },
            { id: 'application/pdf', label: 'PDF Document' }
        ],
        'image/png': [
            { id: 'image/jpeg', label: 'JPG Image' },
            { id: 'application/pdf', label: 'PDF Document' }
        ],
        'application/pdf': [
            { id: 'image/jpeg', label: 'JPG Image' },
            { id: 'image/png', label: 'PNG Image' }
        ]
    };

    // --- Event Listeners ---

    // Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-active');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-active');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-active');
        if (e.dataTransfer.files.length) {
            handleFileSelection(e.dataTransfer.files[0]);
        }
    });

    // File Input
    browseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFileSelection(e.target.files[0]);
        }
    });

    // Remove File
    removeFileBtn.addEventListener('click', resetWorkspace);

    // Settings Validation
    outputFormatSelect.addEventListener('change', () => {
        convertBtn.disabled = !outputFormatSelect.value;
        updateCompressionAvailability();
    });

    compressToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            compressionOptions.classList.remove('hidden');
        } else {
            compressionOptions.classList.add('hidden');
        }
    });

    // Aspect Ratio lock for resize
    let aspectRatio = 1;

    // Convert Action
    convertBtn.addEventListener('click', processFile);

    // Download Action
    downloadBtn.addEventListener('click', () => {
        if (convertedBlob) {
            const url = URL.createObjectURL(convertedBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = convertedFileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    });

    // Alert Close
    closeAlertBtn.addEventListener('click', () => {
        alertContainer.classList.add('hidden');
    });

    // --- Core Functions ---

    function handleFileSelection(file) {
        // Validate MIME type
        if (!SUPPORTED_CONVERSIONS[file.type]) {
            showAlert('Unsupported file type. Please upload a JPG, PNG, or PDF file.');
            fileInput.value = '';
            return;
        }

        // Validate Size
        if (file.size > MAX_FILE_SIZE) {
            showAlert(`File is too large (${formatBytes(file.size)}). Maximum allowed is 20MB.`);
            fileInput.value = '';
            return;
        }

        currentFile = file;

        // Update UI
        fileNameEl.textContent = file.name;
        fileNameEl.title = file.name;
        fileSizeEl.textContent = formatBytes(file.size);

        populateFormats(file.type);
        renderPreview(file);

        // Switch views
        uploadSection.classList.add('hidden');
        workspaceSection.classList.remove('hidden');
        resultArea.classList.add('hidden');
        convertBtn.disabled = true;
        resetCompressionSettings();
        hideAlert();
    }

    function populateFormats(inputType) {
        outputFormatSelect.innerHTML = '<option value="" disabled selected>Select Target Format</option>';
        const formats = SUPPORTED_CONVERSIONS[inputType] || [];

        formats.forEach(format => {
            const option = document.createElement('option');
            option.value = format.id;
            option.textContent = format.label;
            outputFormatSelect.appendChild(option);
        });

        // Add 'Same Format' if compression is possible and it's an image
        if (inputType.startsWith('image/')) {
            const ext = inputType === 'image/jpeg' ? 'JPG' : 'PNG';
            const option = document.createElement('option');
            option.value = inputType;
            option.textContent = `Compress existing ${ext}`;
            outputFormatSelect.appendChild(option);
        }
    }

    function updateCompressionAvailability() {
        const targetFormat = outputFormatSelect.value;
        const group = document.querySelector('.compression-group');

        // Disable compression settings for PDF outputs
        if (targetFormat === 'application/pdf') {
            compressToggle.checked = false;
            compressToggle.disabled = true;
            compressionOptions.classList.add('hidden');
            group.style.opacity = '0.5';
        } else {
            compressToggle.disabled = false;
            group.style.opacity = '1';
        }
    }

    function resetCompressionSettings() {
        compressToggle.checked = false;
        compressionOptions.classList.add('hidden');
        outputFormatSelect.value = '';
        resizeWidth.value = '';
        resizeHeight.value = '';
        document.querySelector('input[name="quality"][value="High"]').checked = true;
    }

    async function renderPreview(file) {
        hideAllPreviews();
        previewPlaceholder.classList.remove('hidden');
        previewPlaceholder.querySelector('p').textContent = 'Generating Preview...';

        try {
            if (file.type.startsWith('image/')) {
                const url = URL.createObjectURL(file);
                imagePreview.src = url;
                imagePreview.onload = () => {
                    previewPlaceholder.classList.add('hidden');
                    imagePreview.classList.remove('hidden');
                    aspectRatio = imagePreview.naturalWidth / imagePreview.naturalHeight;
                    // Optional: URL.revokeObjectURL(url) here, but we might need it for processing
                };
            } else if (file.type === 'application/pdf') {
                const fileReader = new FileReader();
                fileReader.onload = async function () {
                    const typedarray = new Uint8Array(this.result);
                    try {
                        const pdf = await pdfjsLib.getDocument(typedarray).promise;
                        const page = await pdf.getPage(1);

                        const viewport = page.getViewport({ scale: 1.5 });
                        const context = pdfPreview.getContext('2d');
                        pdfPreview.height = viewport.height;
                        pdfPreview.width = viewport.width;

                        aspectRatio = viewport.width / viewport.height;

                        const renderContext = {
                            canvasContext: context,
                            viewport: viewport
                        };
                        await page.render(renderContext).promise;

                        previewPlaceholder.classList.add('hidden');
                        pdfPreview.classList.remove('hidden');
                    } catch (e) {
                        console.error("PDF Render Error:", e);
                        previewPlaceholder.querySelector('p').textContent = 'Preview not available for this PDF.';
                    }
                };
                fileReader.readAsArrayBuffer(file);
            }
        } catch (error) {
            console.error(error);
            previewPlaceholder.querySelector('p').textContent = 'Preview failed.';
        }
    }

    function hideAllPreviews() {
        imagePreview.classList.add('hidden');
        pdfPreview.classList.add('hidden');
        previewPlaceholder.classList.add('hidden');
    }

    function resetWorkspace() {
        currentFile = null;
        convertedBlob = null;
        fileInput.value = '';
        uploadSection.classList.remove('hidden');
        workspaceSection.classList.add('hidden');
        resultArea.classList.add('hidden');
        hideAlert();
        hideAllPreviews();
    }

    // --- Processing Logic ---

    async function processFile() {
        if (!currentFile || !outputFormatSelect.value) return;

        setLoadingState(true);

        try {
            const inputType = currentFile.type;
            const targetFormat = outputFormatSelect.value;
            const useCompression = compressToggle.checked;

            // Get quality multiplier
            let quality = 0.92; // Default browser is ~0.92
            if (useCompression) {
                const qLevel = document.querySelector('input[name="quality"]:checked').value;
                if (qLevel === 'High') quality = 0.8;
                if (qLevel === 'Medium') quality = 0.6;
                if (qLevel === 'Low') quality = 0.4;
            }

            // Get resize values
            let targetW = parseInt(resizeWidth.value);
            let targetH = parseInt(resizeHeight.value);

            // Execute corresponding conversion
            if (inputType.startsWith('image/') && targetFormat.startsWith('image/')) {
                // Image to Image (with or without compression)
                convertedBlob = await convertImageToImage(currentFile, targetFormat, useCompression, quality, targetW, targetH);
                convertedFileName = generateFileName(currentFile.name, targetFormat);

            } else if (inputType.startsWith('image/') && targetFormat === 'application/pdf') {
                // Image to PDF
                convertedBlob = await convertImageToPdf(currentFile);
                convertedFileName = generateFileName(currentFile.name, 'application/pdf');

            } else if (inputType === 'application/pdf' && targetFormat.startsWith('image/')) {
                // PDF to Image
                convertedBlob = await convertPdfToImage(currentFile, targetFormat, useCompression, quality, targetW, targetH);
                convertedFileName = generateFileName(currentFile.name, targetFormat);

            } else {
                throw new Error("Conversion path not implemented or invalid.");
            }

            showResults(currentFile.size, convertedBlob.size);

        } catch (error) {
            console.error("Conversion Error:", error);
            showAlert("An error occurred during conversion: " + error.message);
        } finally {
            setLoadingState(false);
        }
    }

    // Convert Image to Image using Canvas
    function convertImageToImage(file, targetMimeType, resize, quality, targetW, targetH) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                let width = img.width;
                let height = img.height;

                if (resize) {
                    if (targetW && !targetH) {
                        width = targetW;
                        height = Math.round(targetW / aspectRatio);
                    } else if (targetH && !targetW) {
                        height = targetH;
                        width = Math.round(targetH * aspectRatio);
                    } else if (targetW && targetH) {
                        width = targetW;
                        height = targetH;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                // For JPEG output, fill white background to avoid transparent parts turning black
                if (targetMimeType === 'image/jpeg') {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, width, height);
                }

                ctx.drawImage(img, 0, 0, width, height);

                // For PNG, canvas standard compression isn't well supported in toBlob. 
                // We fallback to standard export if quality parameter doesn't apply.
                canvas.toBlob((blob) => {
                    URL.revokeObjectURL(url);
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error("Failed to create blob from canvas."));
                    }
                }, targetMimeType, targetMimeType === 'image/jpeg' ? quality : undefined);
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("Failed to load image for processing."));
            };

            img.src = url;
        });
    }

    // Convert Image to PDF using jsPDF
    function convertImageToPdf(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = () => {
                try {
                    // PDF dimensions (A4 size approximation)
                    // We calculate orientation based on image
                    const orientation = img.width > img.height ? 'l' : 'p';
                    const { jsPDF } = window.jspdf;
                    const doc = new jsPDF({
                        orientation: orientation,
                        unit: 'px',
                        format: [img.width, img.height]
                    });

                    doc.addImage(img, file.type === 'image/png' ? 'PNG' : 'JPEG', 0, 0, img.width, img.height);
                    resolve(doc.output('blob'));
                } catch (e) {
                    reject(e);
                } finally {
                    URL.revokeObjectURL(url);
                }
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("Failed to load image for PDF creation."));
            };

            img.src = url;
        });
    }

    // Convert PDF (First Page) to Image using PDF.js
    async function convertPdfToImage(file, targetMimeType, resize, quality, targetW, targetH) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
        const page = await pdf.getPage(1);

        let viewport = page.getViewport({ scale: 2.0 }); // High initial scale for better quality

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        // Initial render dimensions
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        await page.render(renderContext).promise;

        // Now handle compression/resizing by drawing to a second canvas if needed
        let finalWidth = canvas.width;
        let finalHeight = canvas.height;
        const pdfAspect = finalWidth / finalHeight;

        if (resize) {
            if (targetW && !targetH) {
                finalWidth = targetW;
                finalHeight = Math.round(targetW / pdfAspect);
            } else if (targetH && !targetW) {
                finalHeight = targetH;
                finalWidth = Math.round(targetH * pdfAspect);
            } else if (targetW && targetH) {
                finalWidth = targetW;
                finalHeight = targetH;
            }
        }

        const outCanvas = document.createElement('canvas');
        outCanvas.width = finalWidth;
        outCanvas.height = finalHeight;
        const outCtx = outCanvas.getContext('2d');

        // Fill white background for JPEG
        if (targetMimeType === 'image/jpeg') {
            outCtx.fillStyle = '#FFFFFF';
            outCtx.fillRect(0, 0, finalWidth, finalHeight);
        }

        outCtx.drawImage(canvas, 0, 0, finalWidth, finalHeight);

        return new Promise((resolve, reject) => {
            outCanvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("Failed to create image blob from PDF canvas."));
            }, targetMimeType, targetMimeType === 'image/jpeg' ? quality : undefined);
        });
    }

    // --- Helpers ---

    function setLoadingState(isLoading) {
        const btnText = convertBtn.querySelector('.btn-text');
        const icon = convertBtn.querySelector('.fa-wand-magic-sparkles');
        const spinner = convertBtn.querySelector('.spinner');

        convertBtn.disabled = isLoading;
        outputFormatSelect.disabled = isLoading;
        compressToggle.disabled = isLoading;

        if (isLoading) {
            btnText.textContent = 'Processing...';
            icon.classList.add('hidden');
            spinner.classList.remove('hidden');
            resultArea.classList.add('hidden');
        } else {
            btnText.textContent = 'Convert File';
            icon.classList.remove('hidden');
            spinner.classList.add('hidden');
        }
    }

    function showResults(oldSize, newSize) {
        resultSizeEl.textContent = formatBytes(newSize);

        const savingsContainer = document.getElementById('result-savings-container');

        if (newSize < oldSize) {
            const savedBytes = oldSize - newSize;
            const percentage = ((savedBytes / oldSize) * 100).toFixed(1);
            resultSavingsEl.textContent = `-${percentage}%`;
            resultSavingsEl.className = 'stat-value accent'; // Green
            savingsContainer.classList.remove('hidden');
        } else if (newSize > oldSize) {
            const incBytes = newSize - oldSize;
            const percentage = ((incBytes / oldSize) * 100).toFixed(1);
            resultSavingsEl.textContent = `+${percentage}%`;
            resultSavingsEl.style.color = '#ef4444'; // Red
            savingsContainer.classList.remove('hidden');
        } else {
            savingsContainer.classList.add('hidden');
        }

        resultArea.classList.remove('hidden');
    }

    function generateFileName(originalName, targetMimeType) {
        const lastDot = originalName.lastIndexOf('.');
        const nameWithoutExt = lastDot > 0 ? originalName.substring(0, lastDot) : originalName;

        let ext = '';
        if (targetMimeType === 'image/jpeg') ext = '.jpg';
        else if (targetMimeType === 'image/png') ext = '.png';
        else if (targetMimeType === 'application/pdf') ext = '.pdf';

        return `${nameWithoutExt}-fileflux${ext}`;
    }

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    function showAlert(msg) {
        alertMessage.textContent = msg;
        alertContainer.classList.remove('hidden');
        setTimeout(hideAlert, 6000);
    }

    function hideAlert() {
        alertContainer.classList.add('hidden');
    }
});
