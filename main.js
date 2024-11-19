import { GoogleGenerativeAI } from "@google/generative-ai";
import './style.css';

let API_KEY = 'Hidden';
let VISION_API_KEY = 'Hidden';

let form = document.querySelector('#assessment-form');
let promptInput = document.querySelector('input[name="prompt"]');
let fileInput = document.querySelector('#uploaded-image');
let output = document.querySelector('.output');
let scoreDisplay = document.querySelector('#score-display');
let previewImage = document.querySelector('#preview-image');
let deductionDetails = document.querySelector('#deduction-details');

async function analyzeImage(imageBase64) {
  const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`;
  const body = {
    requests: [
      {
        image: { content: imageBase64 },
        features: [{ type: "LABEL_DETECTION", maxResults: 50 }],
      },
    ],
  };

  const response = await fetch(visionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (data.responses && data.responses[0] && data.responses[0].labelAnnotations) {
    return data.responses[0].labelAnnotations.map((label) => label.description.toLowerCase());
  } else {
    console.warn("No labels detected in the image.");
    return [];
  }
}

form.onsubmit = async (ev) => {
  ev.preventDefault();

  output.textContent = 'Analyzing...';
  if (scoreDisplay) scoreDisplay.textContent = '';
  if (deductionDetails) deductionDetails.textContent = '';

  try {
    let file = fileInput.files[0];
    if (!file) {
      output.textContent = 'Please upload an image file.';
      return;
    }

    let reader = new FileReader();
    reader.onload = async () => {
      let imageBase64 = reader.result.split(',')[1];

      previewImage.src = reader.result;
      previewImage.style.display = 'block';

      const imageLabels = await analyzeImage(imageBase64);
      console.log('Image Labels:', imageLabels);

      const contents = [
        {
          role: 'user',
          parts: [
            { text: `Image labels: ${imageLabels.join(', ')}. Additional input: ${promptInput.value}` },
          ],
        },
      ];

      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({
        model: "tunedModels/wheelchair-ramp-testing-1-s3ixbcjc2hcu",
      });

      const generationConfig = {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: "text/plain",
      };

      const result = await model.generateContent({
        contents: contents,
        generationConfig,
      });

      let rampsChecked = imageLabels.includes("wheelchair ramp") || imageLabels.includes("ramp") || imageLabels.includes("wood");
      let stairsChecked = imageLabels.includes("stairs");
      let handrailsChecked = imageLabels.includes("handrail") || imageLabels.includes("hand rail");

      const rampsStatus = rampsChecked ? '✓' : '✗';
      const stairsStatus = stairsChecked ? '✓' : '✗';
      const handrailsStatus = handrailsChecked ? '✓' : '✗';

      if (scoreDisplay) {
        scoreDisplay.textContent = 'Accessibility Check Results';
      }

      if (deductionDetails) {
        deductionDetails.innerHTML = `
          <strong>Wheelchair Ramp:</strong> ${rampsStatus}<br>
          <strong>Stairs:</strong> ${stairsStatus}<br>
          <strong>Handrails:</strong> ${handrailsStatus}
        `;
      }

      if (output) {
        output.innerHTML = '';
      }
    };

    reader.readAsDataURL(file);
  } catch (e) {
    console.error('Error during analysis:', e);
    if (output) output.innerHTML += '<hr>' + e;
  }
};
