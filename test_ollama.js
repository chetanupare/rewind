const fs = require('fs');

async function testOllama() {
  const filePath = 'C:\\Users\\User\\Projects\\assis\\test_compressed.jpg';
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    return;
  }
  
  const imageBuffer = fs.readFileSync(filePath);
  const base64Image = imageBuffer.toString('base64');
  console.log('Image read successfully. Size in base64:', base64Image.length);

  const prompt = `Analyze this screenshot and provide a JSON response with the following fields:
{
  "app": "name of the application shown",
  "task": "what task is being performed",
  "project": "likely project name if visible",
  "language": "programming language if visible",
  "framework": "framework or library if visible",
  "state": "one of: coding, debugging, reading, browsing, designing, meeting, email, terminal, testing, deploying, documenting, communicating, idle, other",
  "tags": ["relevant", "tags"],
  "description": "brief description of what's happening"
}

Respond ONLY with valid JSON, no markdown.`;

  const body = {
    model: 'qwen2.5vl:3b',
    prompt: prompt,
    stream: false,
    images: [base64Image],
    format: 'json'
  };

  console.log('Sending to Ollama...');
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('\\n--- OLLAMA RESPONSE ---');
    console.log(data.response);
  } catch (err) {
    console.error('Failed to hit Ollama:', err);
  }
}

testOllama();
