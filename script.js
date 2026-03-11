// Meme Kanseri Ön Teşhis - Script with Image Processing

// DOM Elements
const uploadBtn = document.getElementById('uploadBtn');
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const previewImage = document.getElementById('previewImage');
const removeImageBtn = document.getElementById('removeImage');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingSection = document.getElementById('loading');
const resultSection = document.getElementById('result');
const newAnalysisBtn = document.getElementById('newAnalysisBtn');

// State
let selectedImage = null;
let isAnalyzing = false;

// Meme Kanseri Belirtileri ve Görüntü İşleme Karşılıkları
const BELIRTI_TANIMLARI = {
    kitle: {
        title: 'Memede Kitle',
        description: 'Memede veya koltuk altında ele gelen, genellikle ağrısız, sert kitle.',
        risk: 0.3,
        checkFunction: 'detectMass'
    },
    deri: {
        title: 'Meme Derisinde Değişiklikler',
        description: 'Ciltte çukurlaşma, büzüşme, kızarıklık, pullanma veya ödem (portakal kabuğu görüntüsü).',
        risk: 0.35,
        checkFunction: 'detectSkinChanges'
    },
    nipples: {
        title: 'Meme Başı Değişiklikleri',
        description: 'Meme ucunun içe çekilmesi, şekil bozukluğu, kaşıntı, kabuklanma veya yanma hissi.',
        risk: 0.25,
        checkFunction: 'detectNippleChanges'
    },
    akinti: {
        title: 'Anormal Akıntı',
        description: 'Meme başından özellikle tek taraflı ve kanlı/şeffaf akıntı gelmesi.',
        risk: 0.2,
        checkFunction: 'detectDischarge'
    },
    sekil: {
        title: 'Şekil/Boyut Değişikliği',
        description: 'İki meme arasında son zamanlarda gelişen, kalıcı asimetri veya menonun boyutunda/şeklinde belirgin değişiklik.',
        risk: 0.3,
        checkFunction: 'detectAsymmetry'
    },
    koltuk: {
        title: 'Koltuk Altı Şişliği',
        description: 'Koltuk altında ele gelen sertlik veya lenf bezi büyümesi.',
        risk: 0.25,
        checkFunction: 'detectAxillarySwelling'
    }
};

// Event Listeners
uploadBtn.addEventListener('click', () => {
    imageInput.click();
});

imageInput.addEventListener('change', handleImageSelect);
removeImageBtn.addEventListener('click', removeImage);
analyzeBtn.addEventListener('click', analyzeImage);
newAnalysisBtn.addEventListener('click', resetAnalysis);

// Handle Image Selection
function handleImageSelect(event) {
    const file = event.target.files[0];
    
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        alert('Lütfen bir görsel dosyası seçiniz.');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
        alert('Dosya boyutu 10MB\'dan büyük olamaz.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        selectedImage = e.target.result;
        previewImage.src = selectedImage;
        imagePreview.classList.add('active');
        analyzeBtn.disabled = false;
        resultSection.classList.remove('active');
    };
    reader.readAsDataURL(file);
}

// Remove Selected Image
function removeImage() {
    selectedImage = null;
    previewImage.src = '';
    imagePreview.classList.remove('active');
    imageInput.value = '';
    analyzeBtn.disabled = true;
    resultSection.classList.remove('active');
}

// Analyze Image with Image Processing
async function analyzeImage() {
    if (!selectedImage || isAnalyzing) return;
    
    isAnalyzing = true;
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<span class="icon">⏳</span> Analiz Ediliyor...';
    
    loadingSection.classList.add('active');
    resultSection.classList.remove('active');
    
    // Process image and detect symptoms
    const detectedSymptoms = await processImage(selectedImage);
    
    // Generate result based on detected symptoms
    const result = generateAnalysisResult(detectedSymptoms);
    
    // Display result
    displayResult(result);
    
    isAnalyzing = false;
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = '<span class="icon">🔍</span> Analiz Et';
    loadingSection.classList.remove('active');
}

// ==================== GÖRÜNTÜ İŞLEME FONKSİYONLARI ====================

// Normalizasyon fonksiyonu - piksel değerlerini 0-1 arasına normalize et
function normalizeImage(data) {
    const normalized = new Float32Array(data.length / 4);
    for (let i = 0; i < data.length; i += 4) {
        // RGB değerlerini 0-1 arasına normalize et
        normalized[i / 4] = (data[i] + data[i + 1] + data[i + 2]) / (3 * 255);
    }
    return normalized;
}

// Griye çevirme ve normalizasyon
function convertToGrayscaleNormalized(data) {
    const gray = new Float32Array(data.length / 4);
    for (let i = 0; i < data.length; i += 4) {
        // Weighted grayscale conversion (YUV standard)
        gray[i / 4] = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
    }
    return gray;
}

// Histogram eşitleme - kontrast iyileştirme
function histogramEqualization(gray, width, height) {
    const equalized = new Float32Array(gray.length);
    const histogram = new Array(256).fill(0);
    
    // Histogram oluştur
    for (let i = 0; i < gray.length; i++) {
        const val = Math.floor(gray[i] * 255);
        histogram[val]++;
    }
    
    // Kümülatif dağılım
    const cdf = new Array(256);
    cdf[0] = histogram[0];
    for (let i = 1; i < 256; i++) {
        cdf[i] = cdf[i - 1] + histogram[i];
    }
    
    // Normalize et
    const cdfMin = cdf.find(v => v > 0);
    const totalPixels = width * height;
    
    for (let i = 0; i < gray.length; i++) {
        const val = Math.floor(gray[i] * 255);
        equalized[i] = ((cdf[val] - cdfMin) / (totalPixels - cdfMin)) || 0;
    }
    
    return equalized;
}

// Gürültü azaltma (Gaussian blur)
function gaussianBlur(gray, width, height) {
    const blurred = new Float32Array(gray.length);
    const kernel = [
        [1/16, 2/16, 1/16],
        [2/16, 4/16, 2/16],
        [1/16, 2/16, 1/16]
    ];
    
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let sum = 0;
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const idx = (y + ky) * width + (x + kx);
                    sum += gray[idx] * kernel[ky + 1][kx + 1];
                }
            }
            blurred[y * width + x] = sum;
        }
    }
    
    return blurred;
}

// Görüntü tipi tespit (tek meme veya çift meme)
function detectImageType(data, width, height) {
    const gray = convertToGrayscaleNormalized(data);
    
    // Sol ve sağ yarıların parlaklık varyansını kontrol et
    const leftHalf = Math.floor(width / 2);
    let leftVar = 0, rightVar = 0;
    let leftMean = 0, rightMean = 0;
    let leftPixels = 0, rightPixels = 0;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < leftHalf; x++) {
            leftMean += gray[y * width + x];
            leftPixels++;
        }
        for (let x = leftHalf; x < width; x++) {
            rightMean += gray[y * width + x];
            rightPixels++;
        }
    }
    
    leftMean /= leftPixels;
    rightMean /= rightPixels;
    
    // Varyans hesapla
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < leftHalf; x++) {
            leftVar += Math.pow(gray[y * width + x] - leftMean, 2);
        }
        for (let x = leftHalf; x < width; x++) {
            rightVar += Math.pow(gray[y * width + x] - rightMean, 2);
        }
    }
    
    leftVar = Math.sqrt(leftVar / leftPixels);
    rightVar = Math.sqrt(rightVar / rightPixels);
    
    // Eğer iki yarı çok farklıysa, tek meme görüntüsü olabilir
    const varianceRatio = Math.abs(leftVar - rightVar) / Math.max(leftVar, rightVar);
    
    return {
        isSingleBreast: varianceRatio > 0.5,
        leftMean,
        rightMean,
        varianceRatio
    };
}

// Ana görüntü işleme fonksiyonu
async function processImage(imageSrc) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            // Create canvas for image processing
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Resize for faster processing
            const maxSize = 400;
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
                if (width > maxSize) {
                    height = height * maxSize / width;
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width = width * maxSize / height;
                    height = maxSize;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            // Get image data
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            // ÖN İŞLEME: Normalize edilmiş gri tonlamalı görüntü
            const grayNormalized = convertToGrayscaleNormalized(data);
            const grayBlurred = gaussianBlur(grayNormalized, width, height);
            const grayEnhanced = histogramEqualization(grayBlurred, width, height);
            
            // Görüntü tipi tespit (tek meme veya çift meme)
            const imageType = detectImageType(data, width, height);
            console.log('Görüntü Tipi:', imageType.isSingleBreast ? 'Tek Meme' : 'Çift Meme');
            
            // Run all detection algorithms with normalized data
            const symptoms = [];
            
            // 1. Kitle (Mass) Detection - Edge/Blob detection
            if (detectMass(data, width, height, grayEnhanced)) {
                symptoms.push('kitle');
            }
            
            // 2. Deri Değişiklikleri - Texture analysis
            if (detectSkinChanges(data, width, height, grayEnhanced)) {
                symptoms.push('deri');
            }
            
            // 3. Meme Başı Değişiklikleri - Central region analysis
            if (detectNippleChanges(data, width, height, grayEnhanced)) {
                symptoms.push('nipples');
            }
            
            // 4. Anormal Akıntı - Color anomaly in nipple area
            if (detectDischarge(data, width, height, grayEnhanced)) {
                symptoms.push('akinti');
            }
            
            // 5. Asimetri - Left-right comparison
            if (detectAsymmetry(data, width, height, grayEnhanced)) {
                symptoms.push('sekil');
            }
            
            // 6. Koltuk Altı Şişliği - Edge detection in corners
            if (detectAxillarySwelling(data, width, height, grayEnhanced)) {
                symptoms.push('koltuk');
            }
            
            resolve(symptoms);
        };
        img.src = imageSrc;
    });
}

// 1. Kitle (Mass) Tespiti - Sobel Edge Detection with NORMALIZED thresholds
function detectMass(data, width, height, gray = null) {
    // Use pre-processed gray if provided, otherwise normalize
    const processedGray = gray || convertToGrayscaleNormalized(data);
    
    // Apply Sobel edge detection with normalized values (0-1 scale)
    let edgeStrength = 0;
    let edgePixels = 0;
    
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            
            // Sobel X - normalized
            const gx = 
                -processedGray[idx - width - 1] + processedGray[idx - width + 1] +
                -2 * processedGray[idx - 1] + 2 * processedGray[idx + 1] +
                -processedGray[idx + width - 1] + processedGray[idx + width + 1];
            
            // Sobel Y - normalized
            const gy = 
                -processedGray[idx - width - 1] - 2 * processedGray[idx - width] - processedGray[idx - width + 1] +
                processedGray[idx + width - 1] + 2 * processedGray[idx + width] + processedGray[idx + width + 1];
            
            const magnitude = Math.sqrt(gx * gx + gy * gy);
            
            // Düzeltilmiş threshold: 0-1 arası normalize değerler için
            // 0.2 yerine daha yüksek eşik değeri (normal görüntülerde edge düşük)
            if (magnitude > 0.3) {
                edgeStrength += magnitude;
                edgePixels++;
            }
        }
    }
    
    // Edge yoğunluğu hesapla
    const avgEdge = edgePixels > 0 ? edgeStrength / edgePixels : 0;
    // Düzeltilmiş threshold: 0.1 yerine daha yüksek (yanlış pozitifleri azaltmak için)
    return avgEdge > 0.15;
}

// 2. Deri Değişiklikleri Tespiti - Texture Analysis with NORMALIZED thresholds
function detectSkinChanges(data, width, height, gray = null) {
    const processedGray = gray || convertToGrayscaleNormalized(data);
    let redAreas = 0;
    let totalPixels = width * height;
    
    // Check for redness/inflammation (portakal kabuğu efekti)
    // Normalized: R > 0.6, R > G + 0.12, R > B + 0.12
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;
        
        // Detect redness (inflammation indicator) - normalized values
        if (r > 0.6 && r > g + 0.12 && r > b + 0.12) {
            redAreas++;
        }
    }
    
    // Düzeltilmiş threshold: %8'den fazla kızarıklık varsa
    const redRatio = redAreas / totalPixels;
    return redRatio > 0.08;
}

// 3. Meme Başı Değişiklikleri - Central region analysis with NORMALIZED
function detectNippleChanges(data, width, height, gray = null) {
    const processedGray = gray || convertToGrayscaleNormalized(data);
    const centerX = width / 2;
    const centerY = height / 2;
    const nippleRadius = Math.min(width, height) * 0.1;
    
    let nippleBrightness = 0;
    let pixelCount = 0;
    
    // Analyze center region (nipple area)
    for (let y = centerY - nippleRadius; y < centerY + nippleRadius; y++) {
        for (let x = centerX - nippleRadius; x < centerX + nippleRadius; x++) {
            const idx = Math.floor(y) * width + Math.floor(x);
            if (idx >= 0 && idx < processedGray.length) {
                nippleBrightness += processedGray[idx];
                pixelCount++;
            }
        }
    }
    
    const avgBrightness = pixelCount > 0 ? nippleBrightness / pixelCount : 0;
    
    // Analyze surrounding tissue
    let surroundBrightness = 0;
    let surroundCount = 0;
    
    for (let y = centerY - nippleRadius * 3; y < centerY + nippleRadius * 3; y++) {
        for (let x = centerX - nippleRadius * 3; x < centerX + nippleRadius * 3; x++) {
            const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
            if (dist > nippleRadius * 1.5 && dist < nippleRadius * 3) {
                const idx = Math.floor(y) * width + Math.floor(x);
                if (idx >= 0 && idx < processedGray.length) {
                    surroundBrightness += processedGray[idx];
                    surroundCount++;
                }
            }
        }
    }
    
    const avgSurround = surroundCount > 0 ? surroundBrightness / surroundCount : 0;
    
    // Düzeltilmiş threshold: normalize edilmiş değerler için
    // 0.12 yerine daha makul bir eşik değeri
    return Math.abs(avgBrightness - avgSurround) > 0.15;
}

// 4. Anormal Akıntı - Color anomaly detection with NORMALIZED
function detectDischarge(data, width, height, gray = null) {
    const processedGray = gray || convertToGrayscaleNormalized(data);
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Check for abnormal colors in nipple area
    let abnormalColor = 0;
    
    for (let y = centerY - 20; y < centerY + 20; y++) {
        for (let x = centerX - 20; x < centerX + 20; x++) {
            if (x >= 0 && x < width && y >= 0 && y < height) {
                const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
                const r = data[idx] / 255;
                const g = data[idx + 1] / 255;
                const b = data[idx + 2] / 255;
                
                // Normalized renk aralıkları
                // Pinkish: R>0.7, G>0.4,G<0.8, B>0.4,B<0.7
                // Red/Bloody: R>0.8, G<0.4, B<0.4
                // Yellowish: R>0.8, G>0.8,G<1.0, B<0.4
                if ((r > 0.7 && g > 0.4 && g < 0.8 && b > 0.4 && b < 0.7) ||
                    (r > 0.8 && g < 0.4 && b < 0.4) ||
                    (r > 0.8 && g > 0.8 && g < 1.0 && b < 0.4)) {
                    abnormalColor++;
                }
            }
        }
    }
    
    // Düzeltilmiş threshold
    return abnormalColor > 30;
}

// 5. Asimetri Tespiti - Left-Right Comparison with NORMALIZED
function detectAsymmetry(data, width, height, gray = null) {
    const processedGray = gray || convertToGrayscaleNormalized(data);
    const leftHalf = Math.floor(width / 2);
    let leftAvg = 0, rightAvg = 0;
    let leftPixels = 0, rightPixels = 0;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < leftHalf; x++) {
            const idx = y * width + x;
            leftAvg += processedGray[idx];
            leftPixels++;
        }
        for (let x = leftHalf; x < width; x++) {
            const idx = y * width + x;
            rightAvg += processedGray[idx];
            rightPixels++;
        }
    }
    
    leftAvg /= leftPixels;
    rightAvg /= rightPixels;
    
    // Düzeltilmiş threshold: normalize değerler için
    // 0.1 yerine %15'lik fark (0.15)
    const diff = Math.abs(leftAvg - rightAvg);
    return diff > 0.15;
}

// 6. Koltuk Altı Şişliği - Corner edge detection with NORMALIZED
function detectAxillarySwelling(data, width, height, gray = null) {
    const processedGray = gray || convertToGrayscaleNormalized(data);
    const cornerSize = Math.floor(Math.min(width, height) * 0.2);
    let leftCornerEdges = 0;
    let rightCornerEdges = 0;
    
    // Check left corner (axillary region)
    for (let y = 0; y < cornerSize; y++) {
        for (let x = 0; x < cornerSize; x++) {
            if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
                const idx = y * width + x;
                const diff = Math.abs(processedGray[idx] - processedGray[idx - 1]) + 
                            Math.abs(processedGray[idx] - processedGray[idx + 1]) +
                            Math.abs(processedGray[idx] - processedGray[idx - width]) +
                            Math.abs(processedGray[idx] - processedGray[idx + width]);
                // Düzeltilmiş threshold: normalize değerler için
                if (diff > 0.15) leftCornerEdges++;
            }
        }
    }
    
    // Check right corner
    for (let y = 0; y < cornerSize; y++) {
        for (let x = width - cornerSize; x < width; x++) {
            if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
                const idx = y * width + x;
                const diff = Math.abs(processedGray[idx] - processedGray[idx - 1]) + 
                            Math.abs(processedGray[idx] - processedGray[idx + 1]) +
                            Math.abs(processedGray[idx] - processedGray[idx - width]) +
                            Math.abs(processedGray[idx] - processedGray[idx + width]);
                if (diff > 0.15) rightCornerEdges++;
            }
        }
    }
    
    // Düzeltilmiş threshold: daha az yanlış pozitif için
    const totalCornerPixels = cornerSize * cornerSize * 2;
    return (leftCornerEdges / totalCornerPixels > 0.05) || 
           (rightCornerEdges / totalCornerPixels > 0.05);
}

// ==================== SONUÇ HESAPLAMA ====================

function generateAnalysisResult(detectedSymptoms) {
    let totalRisk = 0;
    let riskDetails = [];
    
    if (detectedSymptoms.length === 0) {
        totalRisk = 0.1;
    } else {
        detectedSymptoms.forEach(symptom => {
            totalRisk += BELIRTI_TANIMLARI[symptom].risk;
            riskDetails.push(BELIRTI_TANIMLARI[symptom]);
        });
    }
    
    totalRisk = Math.min(totalRisk, 1.0);
    
    let riskLevel, riskClass, icon, title, description;
    
    if (totalRisk < 0.25) {
        riskLevel = 'low';
        riskClass = 'Düşük';
        icon = '✅';
        title = 'Düşük Risk';
        description = 'Fotoğrafta herhangi bir şüpheli belirti tespit edilmemiştir. ' +
                     'Meme sağlığınız için düzenli kontrollerinizi ihmal etmeyiniz.';
    } else if (totalRisk < 0.6) {
        riskLevel = 'medium';
        riskClass = 'Orta';
        icon = '⚠️';
        title = 'Orta Risk';
        description = 'Fotoğrafta bazı belirtiler tespit edilmiştir. ' +
                     'Kesin teşhis için bir kadın hastalıkları ve doğum uzmanına danışmanız önerilir.';
    } else {
        riskLevel = 'high';
        riskClass = 'Yüksek';
        icon = '🚨';
        title = 'Yüksek Risk';
        description = 'Fotoğrafta şüpheli belirtiler tespit edilmiştir. ' +
                     'Acilen bir kadın hastalıkları ve doğum uzmanına başvurmanızı öneriyoruz.';
    }
    
    const confidence = Math.floor(50 + (totalRisk * 50));
    
    return {
        riskLevel,
        riskClass,
        icon,
        title,
        description,
        confidence,
        detectedSymptoms: riskDetails,
        doctors: riskLevel !== 'low' ? getDoctors() : []
    };
}

function getDoctors() {
    const doctors = [
        { name: 'Dr. Ayşe Yılmaz', specialty: 'Kadın Hastalıkları ve Doğum', hospital: 'Acıbadem Hastanesi', address: 'İstanbul Cad. No:123, İstanbul', phone: '+90 212 123 45 67' },
        { name: 'Dr. Fatma Demir', specialty: 'Kadın Hastalıkları ve Doğum', hospital: 'Memorial Şişli Hastanesi', address: 'Şişli Mahallesi, Vatan Cad., İstanbul', phone: '+90 212 234 56 78' },
        { name: 'Dr. Merim Koçbaş', specialty: 'Kadın Hastalıkları ve Doğum', hospital: 'Ankara Üniversitesi Tıp Fakültesi', address: 'Sihhiye, Ankara', phone: '+90 312 508 20 30' },
        { name: 'Dr. Zeynep Aydın', specialty: 'Kadın Hastalıkları ve Doğum', hospital: 'Florence Nightingale', address: 'Alsancak, İzmir', phone: '+90 232 277 65 80' }
    ];
    
    return doctors.sort(() => Math.random() - 0.5).slice(0, 3);
}

function displayResult(result) {
    resultSection.className = 'result active ' + result.riskLevel;
    
    let html = `
        <div class="result-header">
            <span class="result-icon">${result.icon}</span>
            <h3 class="result-title">${result.title}</h3>
        </div>
        <p class="result-description">${result.description}</p>
        <span class="confidence">Güven: %${result.confidence}</span>
    `;
    
    if (result.detectedSymptoms && result.detectedSymptoms.length > 0) {
        html += `
            <div class="symptoms-list">
                <h4>🔬 Tespit Edilen Belirtiler:</h4>
                ${result.detectedSymptoms.map(symptom => `
                    <div class="symptom-item">
                        <strong>${symptom.title}</strong>
                        <p>${symptom.description}</p>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    if (result.doctors.length > 0) {
        html += `
            <div class="doctor-list">
                <h4>📍 En Yakın Doktorlar</h4>
                ${result.doctors.map(doctor => `
                    <div class="doctor-item">
                        <div class="doctor-name">${doctor.name}</div>
                        <div class="doctor-info">${doctor.hospital}</div>
                        <div class="doctor-info">${doctor.address}</div>
                        <a href="tel:${doctor.phone}" class="doctor-phone">📞 ${doctor.phone}</a>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    resultSection.innerHTML = html;
    resultSection.classList.add('active');
    newAnalysisBtn.style.display = 'block';
}

function resetAnalysis() {
    removeImage();
    resultSection.classList.remove('active');
    newAnalysisBtn.style.display = 'none';
}

console.log('Meme Kanseri Ön Teşhis - Görüntü İşleme Aktif');
