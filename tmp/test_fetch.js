// Testing built-in fetch

async function testFetch() {
  const url = 'http://localhost:5000/api/account/dollar-system/list?startDate=2026-03-01&endDate=2026-06-30';
  console.log(`Fetching ${url}...`);
  try {
    const res = await fetch(url);
    console.log(`Status: ${res.status}`);
    const data = await res.text();
    console.log(`Data length: ${data.length}`);
    console.log(`Data preview: ${data.substring(0, 500)}`);
    try {
        const json = JSON.parse(data);
        console.log("JSON parsed successfully");
        console.log("Keys:", Object.keys(json));
    } catch (e) {
        console.error("Failed to parse JSON:", e.message);
    }
  } catch (err) {
    console.error(`Fetch failed: ${err.message}`);
  }
}

testFetch();
