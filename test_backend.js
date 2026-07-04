import fs from 'fs';

async function test() {
  console.log("Starting test...");
  const formData = new FormData();
  const fileBuffer = fs.readFileSync('c:\\Windows\\Media\\tada.wav');
  const blob = new Blob([fileBuffer], { type: 'audio/wav' });
  formData.append('file', blob, 'tada.wav');
  
  const startTime = Date.now();
  try {
    const res = await fetch('https://singsmart-backend.onrender.com/analyze?mode=chinese_opera', {
      method: 'POST',
      body: formData
    });
    console.log(`Status: ${res.status}`);
    const data = await res.text();
    console.log(`Time taken: ${(Date.now() - startTime) / 1000}s`);
    console.log(data);
  } catch (e) {
    console.error(e);
  }
}
test();
