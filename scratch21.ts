import http from 'http';

http.get('http://localhost:5000/api/reports/vas?userId=6d406b3c-4055-4c8c-b421-9367f187a672&from=2026-03-31&to=2026-05-20', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log(data));
}).on('error', (err) => console.log("Error:", err.message));
