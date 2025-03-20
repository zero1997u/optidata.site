// 初始化PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// 文件上传区域处理
document.querySelectorAll('.upload-area').forEach(area => {
    const input = area.querySelector('input[type="file"]');
    
    // 点击上传区域触发文件选择
    area.addEventListener('click', (e) => {
        if (e.target !== input) {
            input.click();
        }
    });

    // 拖放处理
    area.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        area.style.borderColor = '#2980b9';
        area.style.backgroundColor = '#f7f9fc';
    });

    area.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        area.style.borderColor = '#3498db';
        area.style.backgroundColor = 'white';
    });

    area.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        area.style.borderColor = '#3498db';
        area.style.backgroundColor = 'white';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            input.files = files;
            // 触发change事件
            const event = new Event('change');
            input.dispatchEvent(event);
        }
    });

    // 文件选择处理
    input.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            const fileName = files.length > 1 ? `${files.length}个文件` : files[0].name;
            area.querySelector('p').textContent = `已选择: ${fileName}`;
        } else {
            area.querySelector('p').textContent = '点击或拖拽PDF文件到这里';
        }
    });
});

// PDF合并功能
document.getElementById('merge-btn').addEventListener('click', async () => {
    const files = document.getElementById('merge-files').files;
    if (files.length < 2) {
        alert('请至少选择两个PDF文件进行合并');
        return;
    }

    // 添加等待提示
    const mergeBtn = document.getElementById('merge-btn');
    const originalText = mergeBtn.textContent;
    mergeBtn.textContent = '正在合并，请耐心等待...';
    mergeBtn.disabled = true;

    try {
        const pdfDoc = await PDFLib.PDFDocument.create();
        
        for (let file of files) {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
            
            // 使用copyPages来复制页面
            const pages = await pdfDoc.copyPages(pdf, pdf.getPageIndices());
            pages.forEach(page => pdfDoc.addPage(page));
        }

        const pdfBytes = await pdfDoc.save({
            useObjectStreams: true,
            addDefaultPage: false,
            objectsPerTick: 50,
            updateFieldAppearances: true,
            useCompression: true
        });
        
        downloadFile(pdfBytes, 'merged.pdf', 'application/pdf');
    } catch (error) {
        alert('合并PDF时发生错误：' + error.message);
    } finally {
        // 恢复按钮状态
        mergeBtn.textContent = originalText;
        mergeBtn.disabled = false;
    }
});

// PDF拆分功能
document.getElementById('split-btn').addEventListener('click', async () => {
    const file = document.getElementById('split-file').files[0];
    const startPage = parseInt(document.getElementById('start-page').value);
    const endPage = parseInt(document.getElementById('end-page').value);

    if (!file || !startPage || !endPage) {
        alert('请选择PDF文件并输入有效的页码范围');
        return;
    }

    // 添加等待提示
    const splitBtn = document.getElementById('split-btn');
    const originalText = splitBtn.textContent;
    splitBtn.textContent = '正在拆分，请耐心等待...';
    splitBtn.disabled = true;

    try {
        const arrayBuffer = await file.arrayBuffer();
        const sourcePdf = await PDFLib.PDFDocument.load(arrayBuffer);
        const newPdf = await PDFLib.PDFDocument.create();
        
        // 使用 copyPages 复制页面
        const pages = await newPdf.copyPages(sourcePdf, Array.from(
            { length: endPage - startPage + 1 },
            (_, i) => startPage - 1 + i
        ));
        
        // 将复制的页面添加到新文档
        pages.forEach(page => newPdf.addPage(page));
        
        const pdfBytes = await newPdf.save();
        downloadFile(pdfBytes, `split_${startPage}-${endPage}.pdf`, 'application/pdf');
    } catch (error) {
        alert('拆分PDF时发生错误：' + error.message);
    } finally {
        // 恢复按钮状态
        splitBtn.textContent = originalText;
        splitBtn.disabled = false;
    }
});

// PDF转图片功能
document.getElementById('convert-btn').addEventListener('click', async () => {
    const file = document.getElementById('convert-file').files[0];
    if (!file) {
        alert('请选择PDF文件');
        return;
    }

    // 添加等待提示
    const convertBtn = document.getElementById('convert-btn');
    const originalText = convertBtn.textContent;
    convertBtn.textContent = '正在处理，请耐心等待...';
    convertBtn.disabled = true;

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;

        // 显示弹窗
        const modal = document.getElementById('convert-modal');
        const previewContainer = document.querySelector('.page-preview-container');
        previewContainer.innerHTML = ''; // 清空预览容器

        // 移除旧的事件监听器
        const oldExportBtn = document.getElementById('export-selected');
        const newExportBtn = oldExportBtn.cloneNode(true);
        oldExportBtn.parentNode.replaceChild(newExportBtn, oldExportBtn);

        // 生成页面预览
        for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 0.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            const preview = document.createElement('div');
            preview.className = 'page-preview';
            preview.dataset.pageNumber = i;
            preview.innerHTML = `
                <img src="${canvas.toDataURL()}" alt="Page ${i}">
                <div class="page-number">第 ${i} 页</div>
                <div class="checkbox"></div>
            `;
            
            // 直接添加点击事件
            preview.addEventListener('click', () => {
                preview.classList.toggle('selected');
            });
            
            previewContainer.appendChild(preview);
        }

        modal.style.display = 'block';

        // 全选/取消全选功能
        const selectAllBtn = document.getElementById('select-all');
        const deselectAllBtn = document.getElementById('deselect-all');

        selectAllBtn.onclick = () => {
            document.querySelectorAll('.page-preview').forEach(preview => {
                preview.classList.add('selected');
            });
        };

        deselectAllBtn.onclick = () => {
            document.querySelectorAll('.page-preview').forEach(preview => {
                preview.classList.remove('selected');
            });
        };

        // 导出选中页面
        document.getElementById('export-selected').addEventListener('click', async function() {
            const exportBtn = document.getElementById('export-selected');
            const exportOriginalText = exportBtn.textContent;
            exportBtn.textContent = '正在导出，请耐心等待...';
            exportBtn.disabled = true;

            try {
                const selectedPages = document.querySelectorAll('.page-preview.selected');
                
                if (selectedPages.length === 0) {
                    alert('请至少选择一页');
                    return;
                }

                const zip = new JSZip();
                const format = document.getElementById('image-format').value || 'png'; // 默认使用PNG以保持最高质量
                const quality = format === 'jpeg' ? 1.0 : 1.0; // 所有格式都使用最高质量

                for (const preview of selectedPages) {
                    const pageNum = parseInt(preview.dataset.pageNumber);
                    const page = await pdf.getPage(pageNum);
                    
                    // 使用更高的缩放比例
                    const scale = 4.0; // 将分辨率提高到原始大小的4倍
                    const viewport = page.getViewport({ scale: scale });
                    
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d', {
                        alpha: false,
                        willReadFrequently: true
                    });
                    
                    // 设置更高的分辨率
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    
                    // 优化渲染质量设置
                    context.imageSmoothingEnabled = true;
                    context.imageSmoothingQuality = 'high';
                    context.fillStyle = 'white';
                    context.fillRect(0, 0, canvas.width, canvas.height);

                    await page.render({
                        canvasContext: context,
                        viewport: viewport,
                        intent: 'display', // 使用显示质量
                        renderInteractiveForms: true,
                        canvasFactory: {
                            create: function(width, height) {
                                const canvas = document.createElement('canvas');
                                canvas.width = width;
                                canvas.height = height;
                                return canvas;
                            },
                            reset: function(canvasAndContext, width, height) {
                                canvasAndContext[0].width = width;
                                canvasAndContext[0].height = height;
                            },
                            destroy: function(canvasAndContext) {
                                // 清理资源
                            }
                        },
                        enableWebGL: true
                    }).promise;

                    // 根据不同格式使用不同的导出设置
                    let imageData;
                    if (format === 'png') {
                        imageData = canvas.toDataURL('image/png');
                    } else if (format === 'jpeg') {
                        imageData = canvas.toDataURL('image/jpeg', quality);
                    } else if (format === 'webp') {
                        imageData = canvas.toDataURL('image/webp', quality);
                    }

                    zip.file(`page_${pageNum}.${format}`, imageData.split(',')[1], { base64: true });
                }

                const content = await zip.generateAsync({ 
                    type: 'blob',
                    compression: 'DEFLATE',
                    compressionOptions: {
                        level: 3 // 降低压缩级别以保持更好的质量
                    }
                });

                const url = URL.createObjectURL(content);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'converted_pages.zip';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                modal.style.display = 'none';
            } catch (error) {
                console.error('导出图片时发生错误:', error);
                alert('导出图片时发生错误：' + error.message);
            } finally {
                exportBtn.textContent = exportOriginalText;
                exportBtn.disabled = false;
            }
        });

        // 关闭弹窗
        document.querySelector('.close-btn').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        window.onclick = (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };

    } catch (error) {
        console.error('转换PDF时发生错误:', error);
        alert('转换PDF时发生错误：' + error.message);
    } finally {
        // 恢复按钮状态
        convertBtn.textContent = originalText;
        convertBtn.disabled = false;
    }
});

// PDF压缩功能
document.getElementById('compress-btn').addEventListener('click', async () => {
    const file = document.getElementById('compress-file').files[0];
    const quality = document.getElementById('quality').value / 100;

    if (!file) {
        alert('请选择PDF文件');
        return;
    }

    // 添加等待提示
    const compressBtn = document.getElementById('compress-btn');
    const originalText = compressBtn.textContent;
    compressBtn.textContent = '正在压缩，请耐心等待...';
    compressBtn.disabled = true;

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;
        
        // 创建新的PDF文档
        const pdfDoc = await PDFLib.PDFDocument.create();
        
        // 遍历每一页
        for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.0 });
            
            // 创建canvas
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            // 渲染页面到canvas
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
            // 将canvas转换为图片
            const imageData = canvas.toDataURL('image/jpeg', quality);
            
            // 创建新的PDF页面
            const newPage = pdfDoc.addPage([viewport.width, viewport.height]);
            
            // 将图片嵌入到新页面
            const image = await pdfDoc.embedJpg(imageData);
            newPage.drawImage(image, {
                x: 0,
                y: 0,
                width: viewport.width,
                height: viewport.height
            });
        }
        
        // 保存压缩后的PDF
        const pdfBytes = await pdfDoc.save({
            useObjectStreams: true,
            addDefaultPage: false,
            objectsPerTick: 50,
            updateFieldAppearances: true,
            useCompression: true,
            compressionLevel: Math.floor(quality * 9)
        });
        
        downloadFile(pdfBytes, 'compressed.pdf', 'application/pdf');
    } catch (error) {
        alert('压缩PDF时发生错误：' + error.message);
    } finally {
        // 恢复按钮状态
        compressBtn.textContent = originalText;
        compressBtn.disabled = false;
    }
});

// OCR功能
document.getElementById('ocr-btn').addEventListener('click', async () => {
    const file = document.getElementById('ocr-file').files[0];
    const language = document.getElementById('ocr-language').value;
    const resultArea = document.getElementById('ocr-result');

    if (!file) {
        alert('请选择PDF文件');
        return;
    }

    // 添加等待提示
    const ocrBtn = document.getElementById('ocr-btn');
    const originalText = ocrBtn.textContent;
    ocrBtn.textContent = '正在识别，请耐心等待...';
    ocrBtn.disabled = true;
    resultArea.innerHTML = '正在处理中，请耐心等待...';

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;

        // 创建多个 worker 实例进行并行处理
        const maxWorkers = Math.min(4, numPages); // 最多4个并行worker
        const workers = [];
        for (let i = 0; i < maxWorkers; i++) {
            const worker = await Tesseract.createWorker();
            await worker.loadLanguage('chi_sim');
            await worker.initialize('chi_sim');
            workers.push(worker);
        }

        // 存储所有页面的识别结果
        const results = new Array(numPages).fill(null);
        let completedPages = 0;

        // 创建处理任务队列
        const processPage = async (pageNum, workerId) => {
            try {
                const page = await pdf.getPage(pageNum);
                const scale = 4.0;
                const viewport = page.getViewport({ scale: scale });
                
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d', {
                    alpha: false,
                    willReadFrequently: true
                });
                
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                context.imageSmoothingEnabled = true;
                context.imageSmoothingQuality = 'high';
                context.fillStyle = 'white';
                context.fillRect(0, 0, canvas.width, canvas.height);

                await page.render({
                    canvasContext: context,
                    viewport: viewport,
                    intent: 'display',
                    renderInteractiveForms: true,
                    background: 'white'
                }).promise;

                // 使用对应的worker进行识别
                const result = await workers[workerId].recognize(canvas, {
                    tessedit_ocr_engine_mode: 1,
                    tessedit_pageseg_mode: 1,
                    preserve_interword_spaces: 0,
                    textord_tabfind_vertical_text: 1,
                    language_model_ngram_on: 1
                });

                // 存储结果
                results[pageNum - 1] = {
                    pageNum: pageNum,
                    text: result.data.text.trim()
                };

                // 更新进度
                completedPages++;
                resultArea.innerHTML = `正在识别中...已完成 ${completedPages}/${numPages} 页`;

                // 清理资源
                canvas.width = 0;
                canvas.height = 0;
                context.clearRect(0, 0, 0, 0);
                canvas.remove();
                await page.cleanup();

                return true;
            } catch (error) {
                console.error(`处理第 ${pageNum} 页时出错:`, error);
                results[pageNum - 1] = {
                    pageNum: pageNum,
                    text: '[识别失败]'
                };
                completedPages++;
                return false;
            }
        };

        // 并行处理页面
        const pageGroups = [];
        for (let i = 1; i <= numPages; i += maxWorkers) {
            const group = [];
            for (let j = 0; j < maxWorkers && i + j <= numPages; j++) {
                group.push(processPage(i + j, j));
            }
            await Promise.all(group);
        }

        // 终止所有worker
        await Promise.all(workers.map(worker => worker.terminate()));

        // 处理并显示最终结果
        if (results.some(r => r && r.text)) {
            let processedText = results
                .map(result => {
                    if (!result) return '';
                    
                    // 处理每页文本中的空格
                    let cleanText = result.text
                        // 删除行首和行尾的空格
                        .split('\n')
                        .map(line => line.trim())
                        .filter(line => line)  // 删除空行
                        .join('\n')
                        // 处理中文之间的空格
                        .replace(/([\\u4e00-\\u9fa5])\s+([\\u4e00-\\u9fa5])/g, '$1$2')
                        // 处理标点符号前后的空格
                        .replace(/\s*([，。！？；：、（）【】《》])\s*/g, '$1')
                        // 处理多个连续空格
                        .replace(/\s+/g, ' ')
                        // 最后整体清理首尾空格
                        .trim();

                    return `\n==================== 第 ${result.pageNum} 页 ====================\n\n${cleanText}\n`;
                })
                .join('\n')
                // 最后再次清理多余的换行
                .replace(/\n{3,}/g, '\n\n');

            // 创建弹窗显示结果
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.cssText = `
                display: block;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                z-index: 1000;
            `;
            
            modal.innerHTML = `
                <div class="modal-content" style="
                    background-color: white;
                    margin: 2rem auto;
                    padding: 1.5rem;
                    border-radius: 8px;
                    max-width: 800px;
                    width: 90%;
                    position: relative;
                ">
                    <div class="modal-header" style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 1rem;
                    ">
                        <h3 style="margin: 0; color: #2c3e50;">OCR识别结果（共 ${numPages} 页）</h3>
                        <button class="close-btn" style="
                            background: none;
                            border: none;
                            font-size: 1.5rem;
                            color: #666;
                            cursor: pointer;
                            padding: 0.5rem;
                        ">&times;</button>
                    </div>
                    <div class="modal-body">
                        <textarea class="ocr-result-text" style="
                            width: 100%;
                            height: 300px;
                            padding: 10px;
                            margin: 10px 0;
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            font-size: 14px;
                            line-height: 1.5;
                        ">${processedText}</textarea>
                    </div>
                    <div class="modal-footer" style="text-align: right;">
                        <button class="copy-btn" style="
                            background-color: #3498db;
                            color: white;
                            border: none;
                            padding: 0.5rem 1rem;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                        ">复制文本</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const closeBtn = modal.querySelector('.close-btn');
            const copyBtn = modal.querySelector('.copy-btn');

            closeBtn.onclick = () => document.body.removeChild(modal);
            modal.onclick = (e) => {
                if (e.target === modal) document.body.removeChild(modal);
            };
            copyBtn.onclick = () => {
                const textarea = modal.querySelector('.ocr-result-text');
                textarea.select();
                document.execCommand('copy');
                alert('文本已复制到剪贴板');
            };

        } else {
            resultArea.innerHTML = '未能识别出文字，请确保PDF文件清晰可读';
        }

    } catch (error) {
        console.error('处理错误:', error);
        resultArea.innerHTML = '识别失败: ' + (error.message || '请刷新页面后重试');
    } finally {
        ocrBtn.textContent = originalText;
        ocrBtn.disabled = false;
    }
});

// 压缩质量滑块更新
document.getElementById('quality').addEventListener('input', (e) => {
    document.getElementById('quality-value').textContent = `${e.target.value}%`;
});

// 下载文件辅助函数
function downloadFile(data, filename, type) {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
} 