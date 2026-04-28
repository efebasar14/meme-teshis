// Meme Görüntüsü Ön Değerlendirme - 4 Kriterli Analiz

const uploadBtn = document.getElementById('uploadBtn');
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const previewImage = document.getElementById('previewImage');
const removeImageBtn = document.getElementById('removeImage');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingSection = document.getElementById('loading');
const resultSection = document.getElementById('result');
const newAnalysisBtn = document.getElementById('newAnalysisBtn');

let selectedImage = null;
let isAnalyzing = false;

uploadBtn.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', handleImageSelect);
removeImageBtn.addEventListener('click', removeImage);
analyzeBtn.addEventListener('click', analyzeImage);
newAnalysisBtn.addEventListener('click', resetAnalysis);

function handleImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Lütfen bir görsel dosyası seçiniz.');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        alert("Dosya boyutu 10MB'dan büyük olamaz.");
        return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
        selectedImage = e.target.result;
        previewImage.src = selectedImage;
        imagePreview.classList.add('active');
        analyzeBtn.disabled = false;
        resultSection.classList.remove('active');
        newAnalysisBtn.style.display = 'none';
    };

    reader.readAsDataURL(file);
}

function removeImage() {
    selectedImage = null;
    previewImage.src = '';
    imagePreview.classList.remove('active');
    imageInput.value = '';
    analyzeBtn.disabled = true;
    resultSection.classList.remove('active');
    newAnalysisBtn.style.display = 'none';
}

async function analyzeImage() {
    if (!selectedImage || isAnalyzing) return;

    isAnalyzing = true;
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<span class="icon">⏳</span> Analiz Ediliyor...';

    loadingSection.classList.add('active');
    resultSection.classList.remove('active');

    const analysis = await processImage(selectedImage);
    const result = generateAnalysisResult(analysis);

    displayResult(result);

    isAnalyzing = false;
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = '<span class="icon">🔍</span> Görsel Bulguları Analiz Et';
    loadingSection.classList.remove('active');
}

function processImage(imageSrc) {
    return new Promise((resolve) => {
        const img = new Image();

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const maxSize = 600;
            let width = img.width;
            let height = img.height;

            if (width > height && width > maxSize) {
                height = Math.round(height * maxSize / width);
                width = maxSize;
            } else if (height > maxSize) {
                width = Math.round(width * maxSize / height);
                height = maxSize;
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            const gray = toGray(data);

            const skinMask = getSkinMask(data, width, height);
            const quality = checkImageQuality(gray, skinMask, width, height);

            let skinChange;
            let asymmetry;
            let nippleRetraction;

            if (!quality.usable) {
                skinChange = unavailableResult(
                    'skin',
                    'Cilt Değişikliği',
                    'Görüntü kalitesi yetersiz olduğu için cilt değişikliği güvenilir biçimde değerlendirilemedi.'
                );

                asymmetry = unavailableResult(
                    'asymmetry',
                    'Asimetri',
                    'Görüntü kalitesi yetersiz olduğu için asimetri güvenilir biçimde değerlendirilemedi.'
                );

                nippleRetraction = unavailableResult(
                    'nipple',
                    'Meme Ucu Retraksiyonu',
                    'Görüntü kalitesi yetersiz olduğu için meme ucu retraksiyonu güvenilir biçimde değerlendirilemedi.'
                );
            } else {
                skinChange = detectSkinChanges(data, skinMask, width, height);
                asymmetry = detectAsymmetry(gray, skinMask, width, height);
                nippleRetraction = detectNippleRetraction(gray, skinMask, width, height);
            }

            resolve({
                quality,
                skinChange,
                asymmetry,
                nippleRetraction
            });
        };

        img.src = imageSrc;
    });
}

function toGray(data) {
    const gray = new Float32Array(data.length / 4);

    for (let i = 0; i < data.length; i += 4) {
        gray[i / 4] = (
            0.299 * data[i] +
            0.587 * data[i + 1] +
            0.114 * data[i + 2]
        ) / 255;
    }

    return gray;
}

function getSkinMask(data, width, height) {
    const mask = new Uint8Array(width * height);
    let skinCount = 0;

    for (let i = 0; i < data.length; i += 4) {
        const pixelIndex = i / 4;

        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);

        const isSkin =
            r > 0.23 &&
            g > 0.13 &&
            b > 0.08 &&
            r > b &&
            max - min > 0.04 &&
            r >= g * 0.85 &&
            r <= g * 1.75;

        if (isSkin) {
            mask[pixelIndex] = 1;
            skinCount++;
        }
    }

    return {
        mask,
        skinCount,
        skinRatio: skinCount / (width * height)
    };
}

function checkImageQuality(gray, skinMask, width, height) {
    let mean = 0;

    for (let i = 0; i < gray.length; i++) {
        mean += gray[i];
    }

    mean /= gray.length;

    let variance = 0;

    for (let i = 0; i < gray.length; i++) {
        variance += Math.pow(gray[i] - mean, 2);
    }

    variance /= gray.length;

    let edgeCount = 0;

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;

            const gx =
                -gray[idx - width - 1] + gray[idx - width + 1] +
                -2 * gray[idx - 1] + 2 * gray[idx + 1] +
                -gray[idx + width - 1] + gray[idx + width + 1];

            const gy =
                -gray[idx - width - 1] - 2 * gray[idx - width] - gray[idx - width + 1] +
                gray[idx + width - 1] + 2 * gray[idx + width] + gray[idx + width + 1];

            const mag = Math.sqrt(gx * gx + gy * gy);
            if (mag > 0.16) edgeCount++;
        }
    }

    const edgeRatio = edgeCount / (width * height);

    const tooDark = mean < 0.15;
    const tooBright = mean > 0.90;
    const lowContrast = variance < 0.006;
    const blurry = edgeRatio < 0.008;
    const notEnoughSkin = skinMask.skinRatio < 0.18;

    const usable = !tooDark && !tooBright && !lowContrast && !blurry && !notEnoughSkin;

    let problems = [];

    if (tooDark) problems.push('görüntü karanlık');
    if (tooBright) problems.push('görüntü fazla parlak');
    if (lowContrast) problems.push('kontrast düşük');
    if (blurry) problems.push('görüntü bulanık olabilir');
    if (notEnoughSkin) problems.push('yeterli ilgili anatomik bölge algılanamadı');

    return {
        key: 'quality',
        title: 'Görüntü Kalitesi',
        status: usable ? 'Yeterli' : 'Yetersiz',
        suspicious: !usable,
        usable,
        score: Math.round((1 - Math.min(problems.length / 5, 1)) * 100),
        description: usable
            ? 'Görüntü analiz için yeterli netlik, ışık ve kontrasta sahip görünüyor.'
            : 'Görüntü kalitesi sınırlı: ' + problems.join(', ') + '. Daha net ve iyi aydınlatılmış bir görüntü yüklenmelidir.'
    };
}

function detectSkinChanges(data, skinMask, width, height) {
    let redness = 0;
    let strongRedness = 0;
    let darkArea = 0;
    let textureEdges = 0;
    let skinPixels = skinMask.skinCount;

    if (skinPixels < width * height * 0.18) {
        return unavailableResult(
            'skin',
            'Cilt Değişikliği',
            'Yeterli cilt alanı algılanamadığı için cilt değişikliği değerlendirilemedi.'
        );
    }

    const gray = toGray(data);

    for (let i = 0; i < data.length; i += 4) {
        const p = i / 4;
        if (!skinMask.mask[p]) continue;

        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;

        if (r > 0.68 && r > g + 0.18 && r > b + 0.18) {
            redness++;
        }

        if (r > 0.76 && r > g + 0.24 && r > b + 0.24) {
            strongRedness++;
        }

        if (r < 0.18 && g < 0.16 && b < 0.16) {
            darkArea++;
        }
    }

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            if (!skinMask.mask[idx]) continue;

            const diff =
                Math.abs(gray[idx] - gray[idx - 1]) +
                Math.abs(gray[idx] - gray[idx + 1]) +
                Math.abs(gray[idx] - gray[idx - width]) +
                Math.abs(gray[idx] - gray[idx + width]);

            if (diff > 0.38) textureEdges++;
        }
    }

    const rednessRatio = redness / skinPixels;
    const strongRednessRatio = strongRedness / skinPixels;
    const darkRatio = darkArea / skinPixels;
    const textureRatio = textureEdges / skinPixels;

    let score = 0;
    score += Math.min(rednessRatio / 0.22, 1) * 35;
    score += Math.min(strongRednessRatio / 0.10, 1) * 30;
    score += Math.min(darkRatio / 0.10, 1) * 20;
    score += Math.min(textureRatio / 0.18, 1) * 15;

    score = Math.round(score);

    const suspicious = score >= 55;

    return {
        key: 'skin',
        title: 'Cilt Değişikliği',
        status: suspicious ? 'Şüpheli bulgu olabilir' : 'Belirgin değil',
        suspicious,
        score,
        description: suspicious
            ? 'Görüntüde belirgin kızarıklık, renk değişimi veya doku düzensizliği olabilecek alanlar algılandı.'
            : 'Belirgin kızarıklık, renk değişimi veya cilt bozulması algılanmadı.'
    };
}

function detectAsymmetry(gray, skinMask, width, height) {
    const mid = Math.floor(width / 2);

    let leftSum = 0;
    let rightSum = 0;
    let leftCount = 0;
    let rightCount = 0;

    const yStart = Math.floor(height * 0.15);
    const yEnd = Math.floor(height * 0.92);

    for (let y = yStart; y < yEnd; y++) {
        for (let x = 0; x < mid; x++) {
            const idx = y * width + x;
            if (!skinMask.mask[idx]) continue;
            leftSum += gray[idx];
            leftCount++;
        }

        for (let x = mid; x < width; x++) {
            const idx = y * width + x;
            if (!skinMask.mask[idx]) continue;
            rightSum += gray[idx];
            rightCount++;
        }
    }

    if (leftCount < 500 || rightCount < 500) {
        return unavailableResult(
            'asymmetry',
            'Asimetri',
            'Sol ve sağ bölge yeterince algılanamadığı için asimetri değerlendirilemedi.'
        );
    }

    const leftAvg = leftSum / leftCount;
    const rightAvg = rightSum / rightCount;

    const areaDiff = Math.abs(leftCount - rightCount) / Math.max(leftCount, rightCount);
    const brightnessDiff = Math.abs(leftAvg - rightAvg);

    let score = 0;
    score += Math.min(areaDiff / 0.42, 1) * 65;
    score += Math.min(brightnessDiff / 0.18, 1) * 35;

    score = Math.round(score);

    const suspicious = score >= 60;

    return {
        key: 'asymmetry',
        title: 'Asimetri',
        status: suspicious ? 'Belirgin olabilir' : 'Belirgin değil',
        suspicious,
        score,
        description: suspicious
            ? 'Sol ve sağ meme bölgesi arasında belirgin olabilecek alan veya yoğunluk farkı algılandı.'
            : 'Görüntüde belirgin asimetri algılanmadı.'
    };
}

function detectNippleRetraction(gray, skinMask, width, height) {
    const candidates = findDarkCircularCandidates(gray, skinMask, width, height);

    if (candidates.length === 0) {
        return {
            key: 'nipple',
            title: 'Meme Ucu Retraksiyonu',
            status: 'Belirgin değil',
            suspicious: false,
            score: 0,
            description: 'Meme ucu çevresinde belirgin içe çekilme/çöküntü göstergesi algılanmadı.'
        };
    }

    const best = candidates[0];
    const suspicious = best.score >= 65;

    return {
        key: 'nipple',
        title: 'Meme Ucu Retraksiyonu',
        status: suspicious ? 'Şüpheli olabilir' : 'Belirgin değil',
        suspicious,
        score: Math.round(best.score),
        description: suspicious
            ? 'Meme ucu çevresinde içe çekilme/çöküntüye benzeyen koyu merkezli bir bölge algılandı.'
            : 'Belirgin meme ucu içe çekilmesi algılanmadı.'
    };
}

function findDarkCircularCandidates(gray, skinMask, width, height) {
    const candidates = [];
    const step = Math.max(6, Math.floor(Math.min(width, height) / 55));
    const radius = Math.max(8, Math.floor(Math.min(width, height) * 0.045));

    const yStart = Math.floor(height * 0.25);
    const yEnd = Math.floor(height * 0.85);
    const xStart = Math.floor(width * 0.12);
    const xEnd = Math.floor(width * 0.88);

    for (let y = yStart; y < yEnd; y += step) {
        for (let x = xStart; x < xEnd; x += step) {
            const idx = y * width + x;
            if (!skinMask.mask[idx]) continue;

            const score = localDarknessScore(gray, skinMask, width, height, x, y, radius);

            if (score > 25) {
                candidates.push({ x, y, score });
            }
        }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, 5);
}

function localDarknessScore(gray, skinMask, width, height, cx, cy, radius) {
    let inner = 0;
    let outer = 0;
    let innerCount = 0;
    let outerCount = 0;

    for (let y = cy - radius * 2; y <= cy + radius * 2; y++) {
        for (let x = cx - radius * 2; x <= cx + radius * 2; x++) {
            if (x < 0 || x >= width || y < 0 || y >= height) continue;

            const idx = y * width + x;
            if (!skinMask.mask[idx]) continue;

            const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
            const value = gray[idx];

            if (dist <= radius) {
                inner += value;
                innerCount++;
            } else if (dist <= radius * 2) {
                outer += value;
                outerCount++;
            }
        }
    }

    if (innerCount < 20 || outerCount < 40) return 0;

    const innerAvg = inner / innerCount;
    const outerAvg = outer / outerCount;

    const darkness = outerAvg - innerAvg;

    if (darkness <= 0) return 0;

    return Math.min(darkness / 0.22, 1) * 100;
}

function unavailableResult(key, title, description) {
    return {
        key,
        title,
        status: 'Değerlendirilemedi',
        suspicious: false,
        score: null,
        description
    };
}

function generateAnalysisResult(analysis) {
    const findings = [
        analysis.quality,
        analysis.skinChange,
        analysis.asymmetry,
        analysis.nippleRetraction
    ];

    if (!analysis.quality.usable) {
        return {
            riskLevel: 'medium',
            icon: '📷',
            title: 'Görüntü Kalitesi Yetersiz',
            description: 'Bu görüntüyle güvenilir ön değerlendirme yapılamaz. Daha net, iyi aydınlatılmış ve meme ile koltuk altı bölgesini içeren bir görüntü yükleyiniz.',
            findings
        };
    }

    const suspiciousFindings = findings.filter(f => f.key !== 'quality' && f.suspicious);
    const suspiciousCount = suspiciousFindings.length;

    if (suspiciousCount === 0) {
        return {
            riskLevel: 'low',
            icon: '✅',
            title: 'Belirgin Şüpheli Görsel Bulgu Algılanmadı',
            description: 'Yüklenen görüntüde cilt değişikliği, belirgin asimetri veya meme ucu retraksiyonu açısından belirgin bir görsel bulgu algılanmadı. Bu sonuç tıbbi tanı değildir.',
            findings
        };
    }

    if (suspiciousCount === 1) {
        return {
            riskLevel: 'medium',
            icon: '⚠️',
            title: 'Tek Kriterde Şüpheli Görsel Bulgu Algılandı',
            description: 'Görüntüde bir kriter açısından şüpheli bulgu algılandı. Kesin değerlendirme için sağlık uzmanına danışılması önerilir.',
            findings
        };
    }

    return {
        riskLevel: 'high',
        icon: '🚨',
        title: 'Birden Fazla Şüpheli Görsel Bulgu Algılandı',
        description: 'Görüntüde birden fazla kriter açısından şüpheli bulgu algılandı. Bu bir teşhis değildir; ancak uzman değerlendirmesi önerilir.',
        findings
    };
}

function displayResult(result) {
    resultSection.className = 'result active ' + result.riskLevel;

    let html = `
        <div class="result-header">
            <span class="result-icon">${result.icon}</span>
            <h3 class="result-title">${result.title}</h3>
        </div>

        <p class="result-description">${result.description}</p>

        <div class="symptoms-list">
            <h4>🔬 Kriter Bazlı Değerlendirme:</h4>
            ${result.findings.map(item => `
                <div class="symptom-item">
                    <strong>
                        ${item.title}: ${item.status}
                        ${item.score !== null && item.score !== undefined ? ` - Skor: %${item.score}` : ''}
                    </strong>
                    <p>${item.description}</p>
                </div>
            `).join('')}
        </div>

        <div class="warning-box">
            <p>
                ⚠️ Bu sistem kanser tanısı koymaz. Yalnızca görüntü üzerinden ön değerlendirme yapar.
                Kitle, ağrı, akıntı, cilt çekintisi, meme ucunda yeni değişiklik veya koltuk altında şişlik varsa doktora başvurulmalıdır.
            </p>
        </div>
    `;

    resultSection.innerHTML = html;
    resultSection.classList.add('active');
    newAnalysisBtn.style.display = 'block';
}

function resetAnalysis() {
    removeImage();
}

console.log('Meme Görüntüsü Ön Değerlendirme - Güncel Analiz Aktif');
