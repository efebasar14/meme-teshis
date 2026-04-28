// Meme Görüntüsü Ön Değerlendirme - Script

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

function convertToGrayscaleNormalized(data) {
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

function processImage(imageSrc) {
    return new Promise((resolve) => {
        const img = new Image();

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const maxSize = 500;
            let width = img.width;
            let height = img.height;

            if (width > height && width > maxSize) {
                height = height * maxSize / width;
                width = maxSize;
            } else if (height > maxSize) {
                width = width * maxSize / height;
                height = maxSize;
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            const gray = convertToGrayscaleNormalized(data);

            const quality = checkImageQuality(gray, width, height);
            const skinChange = detectSkinChanges(data, width, height);
            const asymmetry = detectAsymmetry(gray, width, height);
            const nippleRetraction = detectNippleRetraction(gray, width, height);

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

// 1. Görüntü kalitesi kontrolü
function checkImageQuality(gray, width, height) {
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

    let edgeAmount = 0;

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

            const magnitude = Math.sqrt(gx * gx + gy * gy);
            if (magnitude > 0.18) edgeAmount++;
        }
    }

    const edgeRatio = edgeAmount / (width * height);

    const isTooDark = mean < 0.18;
    const isTooBright = mean > 0.88;
    const isBlurry = edgeRatio < 0.015;
    const isLowContrast = variance < 0.01;

    const sufficient = !isTooDark && !isTooBright && !isBlurry && !isLowContrast;

    return {
        key: 'quality',
        title: 'Görüntü Kalitesi',
        status: sufficient ? 'Yeterli' : 'Yetersiz',
        suspicious: !sufficient,
        description: sufficient
            ? 'Görüntü analiz için yeterli netlik ve kontrasta sahip görünüyor.'
            : 'Görüntü bulanık, fazla karanlık/parlak veya düşük kontrastlı olabilir. Daha net bir görüntü yüklenmelidir.'
    };
}

// 2. Cilt değişikliği kontrolü
function detectSkinChanges(data, width, height) {
    let rednessPixels = 0;
    let darkSpotPixels = 0;
    let totalPixels = width * height;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;

        if (r > 0.62 && r > g + 0.13 && r > b + 0.13) {
            rednessPixels++;
        }

        if (r < 0.32 && g < 0.28 && b < 0.28) {
            darkSpotPixels++;
        }
    }

    const rednessRatio = rednessPixels / totalPixels;
    const darkRatio = darkSpotPixels / totalPixels;

    const suspicious = rednessRatio > 0.08 || darkRatio > 0.04;

    return {
        key: 'skin',
        title: 'Cilt Değişikliği',
        status: suspicious ? 'Şüpheli bulgu olabilir' : 'Belirgin değil',
        suspicious,
        description: suspicious
            ? 'Görüntüde kızarıklık, renk değişimi veya koyu alanlar açısından şüpheli bölgeler algılandı.'
            : 'Belirgin kızarıklık, renk değişikliği veya cilt bozulması algılanmadı.'
    };
}

// 3. Asimetri kontrolü
function detectAsymmetry(gray, width, height) {
    const half = Math.floor(width / 2);

    let leftSum = 0;
    let rightSum = 0;
    let leftCount = 0;
    let rightCount = 0;

    for (let y = Math.floor(height * 0.15); y < Math.floor(height * 0.9); y++) {
        for (let x = 0; x < half; x++) {
            leftSum += gray[y * width + x];
            leftCount++;
        }

        for (let x = half; x < width; x++) {
            rightSum += gray[y * width + x];
            rightCount++;
        }
    }

    const leftAvg = leftSum / leftCount;
    const rightAvg = rightSum / rightCount;

    const diff = Math.abs(leftAvg - rightAvg);
    const suspicious = diff > 0.14;

    return {
        key: 'asymmetry',
        title: 'Asimetri',
        status: suspicious ? 'Belirgin olabilir' : 'Belirgin değil',
        suspicious,
        description: suspicious
            ? 'Sol ve sağ bölge arasında parlaklık/yoğunluk farkı algılandı. Bu yalnızca görsel asimetri göstergesidir.'
            : 'Görüntüde belirgin asimetri algılanmadı.'
    };
}

// 4. Meme ucu retraksiyonu kontrolü
function detectNippleRetraction(gray, width, height) {
    const centerY = Math.floor(height * 0.55);
    const leftX = Math.floor(width * 0.33);
    const rightX = Math.floor(width * 0.67);
    const radius = Math.floor(Math.min(width, height) * 0.07);

    const leftScore = localDarknessScore(gray, width, height, leftX, centerY, radius);
    const rightScore = localDarknessScore(gray, width, height, rightX, centerY, radius);

    const suspicious = leftScore > 0.12 || rightScore > 0.12;

    return {
        key: 'nipple',
        title: 'Meme Ucu Retraksiyonu',
        status: suspicious ? 'Şüpheli olabilir' : 'Belirgin değil',
        suspicious,
        description: suspicious
            ? 'Meme ucu çevresinde içe çekilme/çöküntüye benzer koyu merkezli bölge algılandı.'
            : 'Belirgin meme ucu içe çekilmesi algılanmadı.'
    };
}

function localDarknessScore(gray, width, height, cx, cy, radius) {
    let inner = 0;
    let innerCount = 0;
    let outer = 0;
    let outerCount = 0;

    for (let y = cy - radius * 2; y <= cy + radius * 2; y++) {
        for (let x = cx - radius * 2; x <= cx + radius * 2; x++) {
            if (x < 0 || x >= width || y < 0 || y >= height) continue;

            const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
            const value = gray[y * width + x];

            if (dist <= radius) {
                inner += value;
                innerCount++;
            } else if (dist <= radius * 2) {
                outer += value;
                outerCount++;
            }
        }
    }

    if (innerCount === 0 || outerCount === 0) return 0;

    const innerAvg = inner / innerCount;
    const outerAvg = outer / outerCount;

    return outerAvg - innerAvg;
}

function generateAnalysisResult(analysis) {
    const findings = [
        analysis.quality,
        analysis.skinChange,
        analysis.asymmetry,
        analysis.nippleRetraction
    ];

    if (analysis.quality.suspicious) {
        return {
            riskLevel: 'medium',
            icon: '📷',
            title: 'Görüntü Kalitesi Yetersiz',
            description: 'Bu görüntü sağlıklı bir ön değerlendirme için yeterli olmayabilir. Daha net, iyi aydınlatılmış ve meme ile koltuk altı bölgesini içeren bir görüntü yükleyiniz.',
            findings
        };
    }

    const suspiciousCount = findings.filter(f => f.key !== 'quality' && f.suspicious).length;

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
            title: 'Uzman Değerlendirmesi Önerilir',
            description: 'Görüntüde bir görsel kriter açısından şüpheli bulgu algılandı. Kesin değerlendirme için bir sağlık uzmanına danışılması önerilir.',
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
                    <strong>${item.title}: ${item.status}</strong>
                    <p>${item.description}</p>
                </div>
            `).join('')}
        </div>

        <div class="warning-box">
            <p>
                ⚠️ Bu sistem kanser tanısı koymaz. Yalnızca görüntü üzerinden ön değerlendirme yapar.
                Kitle, ağrı, akıntı, cilt çekintisi veya koltuk altında şişlik varsa doktora başvurulmalıdır.
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

console.log('Meme Görüntüsü Ön Değerlendirme - 4 Kriterli Analiz Aktif');
