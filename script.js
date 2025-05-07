document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const imageUpload = document.getElementById('imageUpload');
    const dpiInput = document.getElementById('dpiInput');
    const resetButton = document.getElementById('resetButton');
    const canvas = document.getElementById('imageCanvas');
    const ctx = canvas.getContext('2d');
    const imagePlaceholder = document.getElementById('image-placeholder');
    const dropZone = document.getElementById('dropZone'); // For drag & drop

    // Output elements
    const originalPxEl = document.getElementById('originalPx');
    const originalCmEl = document.getElementById('originalCm');
    const originalInEl = document.getElementById('originalIn');
    const selectionInstructionsEl = document.getElementById('selectionInstructions');
    const selectedPxEl = document.getElementById('selectedPx');
    const selectedPercentEl = document.getElementById('selectedPercent');
    const selectedCmEl = document.getElementById('selectedCm');
    const selectedInEl = document.getElementById('selectedIn');

    // --- State Variables ---
    let img = new Image();
    let originalWidth = 0;
    let originalHeight = 0;
    let isDrawing = false;
    let startX, startY, currentX, currentY;
    let finalizedSelection = { x: 0, y: 0, width: 0, height: 0, active: false };
    let animationFrameId = null;
    const CLICK_THRESHOLD = 5;

    // --- Event Listeners ---
    imageUpload.addEventListener('change', (e) => handleFile(e.target.files[0]));
    dpiInput.addEventListener('input', updatePhysicalDimensions);
    resetButton.addEventListener('click', resetApp);

    // Paste Event Listener (on document)
    document.addEventListener('paste', handlePaste);

    // Drag and Drop Event Listeners
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    dropZone.addEventListener('click', () => { // Allow clicking placeholder to trigger file input
        if (!img.src || originalWidth === 0) {
            imageUpload.click();
        }
    });


    // --- Core Image Handling ---
    function processImageFile(file) {
        if (file && file.type.startsWith('image/')) {
            resetAppBeforeNewImage(); // Reset relevant parts before loading
            const reader = new FileReader();
            reader.onload = (e) => {
                img.onload = () => {
                    originalWidth = img.naturalWidth;
                    originalHeight = img.naturalHeight;
                    canvas.width = originalWidth;
                    canvas.height = originalHeight;
                    ctx.drawImage(img, 0, 0, originalWidth, originalHeight);

                    imagePlaceholder.style.display = 'none';
                    canvas.style.display = 'block';
                    selectionInstructionsEl.textContent = 'Click and drag to select. Click image to clear selection.';
                    
                    updateOriginalDimensions();
                    updatePhysicalDimensions(); // This will also update selection if active
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            alert('Please upload a valid image file (PNG, JPG, GIF, etc.).');
            resetApp(); // Full reset if invalid file
        }
    }

    function handleFile(file) { // From file input
        if (file) {
            processImageFile(file);
        }
    }

    // --- Paste Handling ---
    function handlePaste(event) {
        const items = (event.clipboardData || event.originalEvent.clipboardData)?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    event.preventDefault(); // Prevent default paste action
                    processImageFile(blob);
                    return; // Process first image found
                }
            }
        }
    }

    // --- Drag and Drop Handling ---
    function handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.add('dragover');
    }

    function handleDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.remove('dragover');
    }

    function handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.remove('dragover');

        const files = event.dataTransfer.files;
        if (files.length > 0) {
            processImageFile(files[0]); // Process the first dropped file
        }
    }


    // --- App Reset Logic ---
    function resetAppBeforeNewImage() {
        // Partial reset suitable before loading a new image, keeps DPI
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Keep canvas dimensions for a moment to avoid layout shift if new image is similar size
        // canvas.width = 0; canvas.height = 0; // Will be set by new image
        canvas.style.display = 'none';
        imagePlaceholder.style.display = 'flex'; // Assuming placeholder is flex for centering

        originalWidth = 0;
        originalHeight = 0;
        img = new Image(); // Create a new Image object for the new src

        isDrawing = false;
        startX = undefined; startY = undefined; currentX = undefined; currentY = undefined;

        clearOriginalDimensions();
        clearSelectionInfo(true); // Clear selection data and redraw
    }

    function resetApp() { // Full reset
        resetAppBeforeNewImage();
        imageUpload.value = ''; // Clear the file input
        // dpiInput.value = '96'; // Optionally reset DPI
        selectionInstructionsEl.textContent = 'Click and drag to select. Click image to clear selection.';
        // Ensure placeholder is correctly displayed
        imagePlaceholder.style.display = 'flex';
        canvas.style.display = 'none';
    }


    // --- Dimension Calculations and Updates (largely unchanged) ---
    function updateOriginalDimensions() {
        originalPxEl.textContent = `Pixels: ${originalWidth} W x ${originalHeight} H`;
    }

    function updatePhysicalDimensions() {
        // (If no image, originalPxEl will be empty, so no physical dims shown)
        if (originalWidth === 0 || originalHeight === 0) {
            originalCmEl.textContent = '';
            originalInEl.textContent = '';
            // If selection exists, update its physical part, which might show invalid DPI
            if (finalizedSelection.active) {
                 updateSelectionDisplay(finalizedSelection.width, finalizedSelection.height);
            }
            return;
        }

        const dpi = parseFloat(dpiInput.value) || 96;
        if (dpi <= 0) {
            originalCmEl.textContent = `CM (at ${dpiInput.value} DPI): Invalid DPI`;
            originalInEl.textContent = `IN (at ${dpiInput.value} DPI): Invalid DPI`;
            if (finalizedSelection.active) {
                selectedCmEl.textContent = `CM (at ${dpiInput.value} DPI): Invalid DPI`;
                selectedInEl.textContent = `IN (at ${dpiInput.value} DPI): Invalid DPI`;
            }
            return;
        }

        const widthCm = (originalWidth / dpi * 2.54).toFixed(2);
        const heightCm = (originalHeight / dpi * 2.54).toFixed(2);
        const widthIn = (originalWidth / dpi).toFixed(2);
        const heightIn = (originalHeight / dpi).toFixed(2);

        originalCmEl.textContent = `CM (at ${dpi} DPI): ${widthCm} W x ${heightCm} H`;
        originalInEl.textContent = `IN (at ${dpi} DPI): ${widthIn} W x ${heightIn} H`;

        if (finalizedSelection.active) {
            updateSelectionDisplay(finalizedSelection.width, finalizedSelection.height);
        }
    }

    function clearOriginalDimensions() {
        originalPxEl.textContent = '';
        originalCmEl.textContent = '';
        originalInEl.textContent = '';
    }

    function clearSelectionInfo(forceRedraw = false) {
        selectedPxEl.textContent = '';
        selectedPercentEl.textContent = '';
        selectedCmEl.textContent = '';
        selectedInEl.textContent = '';
        // Don't change instruction text here, it's set contextually

        const wasActive = finalizedSelection.active;
        finalizedSelection.active = false;
        finalizedSelection.width = 0;
        finalizedSelection.height = 0;
        
        if (forceRedraw || wasActive) {
            if (img.src && originalWidth > 0) {
                 if (animationFrameId) cancelAnimationFrame(animationFrameId);
                 animationFrameId = requestAnimationFrame(() => {
                     drawSelectionRectangle();
                     animationFrameId = null;
                 });
            }
        }
    }
    
    function updateSelectionDisplay(selWidth, selHeight) {
        selWidth = Math.abs(selWidth);
        selHeight = Math.abs(selHeight);

        selectedPxEl.textContent = `Pixels: ${selWidth.toFixed(0)} W x ${selHeight.toFixed(0)} H`;

        if (originalWidth > 0 && originalHeight > 0 && selWidth > 0 && selHeight > 0) {
            const percentWidth = ((selWidth / originalWidth) * 100).toFixed(1);
            const percentHeight = ((selHeight / originalHeight) * 100).toFixed(1);
            selectedPercentEl.textContent = `% of Original: ${percentWidth}% W x ${percentHeight}% H`;
        } else {
            selectedPercentEl.textContent = '';
        }

        const dpi = parseFloat(dpiInput.value) || 96;
         if (dpi > 0) {
            const selWidthCm = (selWidth / dpi * 2.54).toFixed(2);
            const selHeightCm = (selHeight / dpi * 2.54).toFixed(2);
            const selWidthIn = (selWidth / dpi).toFixed(2);
            const selHeightIn = (selHeight / dpi).toFixed(2);
            selectedCmEl.textContent = `CM (at ${dpi} DPI): ${selWidthCm} W x ${selHeightCm} H`;
            selectedInEl.textContent = `IN (at ${dpi} DPI): ${selWidthIn} W x ${selHeightIn} H`;
        } else {
            selectedCmEl.textContent = `CM (at ${dpiInput.value} DPI): Invalid DPI`;
            selectedInEl.textContent = `IN (at ${dpiInput.value} DPI): Invalid DPI`;
        }
    }

    // --- Canvas Drawing and Selection (largely unchanged) ---
    function getMousePos(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        let x = (e.clientX - rect.left) * scaleX;
        let y = (e.clientY - rect.top) * scaleY;
        x = Math.max(0, Math.min(x, canvas.width));
        y = Math.max(0, Math.min(y, canvas.height));
        return { x, y };
    }

    canvas.addEventListener('mousedown', (e) => {
        if (!img.src || originalWidth === 0) return;
        const pos = getMousePos(e);
        startX = pos.x; startY = pos.y;
        currentX = pos.x; currentY = pos.y;
        isDrawing = true;
        selectionInstructionsEl.textContent = 'Release mouse to finalize selection.';
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing || !img.src || originalWidth === 0) return;
        const pos = getMousePos(e);
        currentX = pos.x; currentY = pos.y;

        if (Math.abs(currentX - startX) > CLICK_THRESHOLD || Math.abs(currentY - startY) > CLICK_THRESHOLD) {
            if (finalizedSelection.active) { // If dragging starts and a selection existed
                clearSelectionInfo(); // Clear old selection numbers, keep visual until mouseup
            }
            finalizedSelection.active = false; // Mark that we are in a new drag
        }

        if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(() => {
                drawSelectionRectangle();
                if (!finalizedSelection.active) {
                     const selWidth = Math.abs(currentX - startX);
                     const selHeight = Math.abs(currentY - startY);
                     if (selWidth > 0 || selHeight > 0) {
                        updateSelectionDisplay(selWidth, selHeight);
                     }
                }
                animationFrameId = null;
            });
        }
    });

    canvas.addEventListener('mouseup', (e) => {
        if (!isDrawing || !img.src || originalWidth === 0) return;
        isDrawing = false;
        const pos = getMousePos(e);
        currentX = pos.x; currentY = pos.y;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        
        const selectionWidth = Math.abs(currentX - startX);
        const selectionHeight = Math.abs(currentY - startY);

        if (selectionWidth <= CLICK_THRESHOLD && selectionHeight <= CLICK_THRESHOLD) {
            if (finalizedSelection.active) clearSelectionInfo(true);
            else clearSelectionInfo(true); // Clear any minor drag lines
            selectionInstructionsEl.textContent = 'Click and drag to select. Click image to clear selection.';
        } else {
            finalizedSelection.x = Math.min(startX, currentX);
            finalizedSelection.y = Math.min(startY, currentY);
            finalizedSelection.width = selectionWidth;
            finalizedSelection.height = selectionHeight;
            finalizedSelection.active = true;
            updateSelectionDisplay(selectionWidth, selectionHeight);
            selectionInstructionsEl.textContent = 'Selection complete. Drag again or click image to clear.';
        }
        
        requestAnimationFrame(drawSelectionRectangle);
    });
    
    // mouseleave on canvas might not be strictly needed if mouseup on canvas handles most cases
    // but can be a fallback if drag ends outside window.
    canvas.addEventListener('mouseleave', (e) => {
        if (isDrawing) {
            // This can be tricky: if mouseup happens outside browser window, it might not be caught.
            // For now, we rely on mouseup on the canvas element, which modern browsers usually fire
            // even if pointer is outside when button is released, as long as mousedown was on it.
            // Setting isDrawing = false here could prematurely end a drag if user briefly exits and re-enters.
        }
    });

    function drawSelectionRectangle() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (img.src && originalWidth > 0) {
            ctx.drawImage(img, 0, 0, originalWidth, originalHeight);
        }

        let rectToDraw = { x: 0, y: 0, w: 0, h: 0, valid: false };

        if (isDrawing) {
            rectToDraw.x = Math.min(startX, currentX);
            rectToDraw.y = Math.min(startY, currentY);
            rectToDraw.w = Math.abs(currentX - startX);
            rectToDraw.h = Math.abs(currentY - startY);
            if (rectToDraw.w > CLICK_THRESHOLD || rectToDraw.h > CLICK_THRESHOLD || !finalizedSelection.active) {
                 rectToDraw.valid = rectToDraw.w > 0 && rectToDraw.h > 0;
            } else {
                 rectToDraw.valid = false;
            }
        } else if (finalizedSelection.active) {
            rectToDraw.x = finalizedSelection.x;
            rectToDraw.y = finalizedSelection.y;
            rectToDraw.w = finalizedSelection.width;
            rectToDraw.h = finalizedSelection.height;
            rectToDraw.valid = rectToDraw.w > 0 && rectToDraw.h > 0;
        }

        if (rectToDraw.valid) {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.85)';
            ctx.lineWidth = 1.5;
            // ctx.setLineDash([4, 2]); // Optional dashed line
            ctx.strokeRect(rectToDraw.x, rectToDraw.y, rectToDraw.w, rectToDraw.h);
            // ctx.setLineDash([]);
        }
    }

    // Initial setup text
    selectionInstructionsEl.textContent = 'Upload, paste, or drag & drop an image to begin.';
});